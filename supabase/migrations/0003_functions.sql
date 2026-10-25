-- 0003_functions.sql — server-side business logic

-- ---- Order fulfilment (called ONLY by Edge Functions with the service role) ----
create or replace function public.fulfill_order(p_order_id uuid, p_payment_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;   -- serialises duplicate callbacks
  if not found then raise exception 'order not found'; end if;
  if o.status = 'paid' then return 'already_paid'; end if;
  if o.status = 'refunded' then return 'refunded'; end if;

  update public.orders
     set status = 'paid', paid_at = now(), provider_payment_id = coalesce(p_payment_id, provider_payment_id)
   where id = o.id;

  insert into public.purchases (user_id, wallpaper_id, order_id)
  select o.user_id, wallpaper_id, o.id from public.order_items where order_id = o.id
  on conflict (user_id, wallpaper_id) do nothing;

  if o.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (o.coupon_id, o.user_id, o.id) on conflict (order_id) do nothing;
    update public.coupons set used_count = used_count + 1 where id = o.coupon_id;
  end if;
  return 'paid';
end $$;

create or replace function public.refund_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if o.status <> 'paid' then return o.status; end if;
  update public.orders set status = 'refunded', refunded_at = now() where id = o.id;
  delete from public.purchases where order_id = o.id;      -- access is revoked on refund
  return 'refunded';
end $$;

revoke execute on function public.fulfill_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.refund_order(uuid) from public, anon, authenticated;
grant  execute on function public.fulfill_order(uuid, text) to service_role;
grant  execute on function public.refund_order(uuid) to service_role;

-- ---- Privacy-conscious analytics ----
-- page_view / wallpaper_view are deduplicated per (visitor, page, day). visitor_id is a random id kept in the
-- browser's localStorage: no IP address and no cookie is stored. Clients cannot insert rows directly.
create or replace function public.track_event(p_type text, p_path text, p_wallpaper_id uuid, p_visitor_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text; v_rows int;
begin
  if p_type not in ('page_view','wallpaper_view') then return; end if;
  if p_visitor_id is null or char_length(p_visitor_id) not between 8 and 64 then return; end if;
  v_key := md5(p_type || '|' || p_visitor_id || '|' || coalesce(left(p_path, 200), '') || '|' ||
               coalesce(p_wallpaper_id::text, '') || '|' || current_date::text);
  insert into public.analytics_events (event_type, path, wallpaper_id, visitor_id, user_id, dedupe_key)
  values (p_type, left(p_path, 200), p_wallpaper_id, p_visitor_id, auth.uid(), v_key)
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 and p_type = 'wallpaper_view' and p_wallpaper_id is not null then
    update public.wallpapers set view_count = view_count + 1 where id = p_wallpaper_id;
  end if;
end $$;
revoke execute on function public.track_event(text, text, uuid, text) from public;
grant  execute on function public.track_event(text, text, uuid, text) to anon, authenticated;

-- ---- Admin dashboard stats ----
-- Metric definitions (window = last p_days days):
--  page_views        deduplicated page_view events (1 per visitor per page per day)
--  unique_visitors   distinct visitor_id among page_view events (anonymous, per browser — approximate)
--  registered_users  rows in profiles (all time)
--  free/premium_downloads  rows in downloads (successful signed-URL issues)
--  orders_paid / revenue_minor  orders with status 'paid' and paid_at in window (refunds shown separately)
create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_since timestamptz := now() - make_interval(days => greatest(p_days, 1)); r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'page_views',       (select count(*) from analytics_events where event_type = 'page_view' and created_at >= v_since),
    'wallpaper_views',  (select count(*) from analytics_events where event_type = 'wallpaper_view' and created_at >= v_since),
    'unique_visitors',  (select count(distinct visitor_id) from analytics_events where event_type = 'page_view' and created_at >= v_since),
    'registered_users', (select count(*) from profiles),
    'free_downloads',   (select count(*) from downloads where kind = 'free' and created_at >= v_since),
    'premium_downloads',(select count(*) from downloads where kind = 'premium' and created_at >= v_since),
    'download_attempts',(select count(*) from analytics_events where event_type = 'download_attempt' and created_at >= v_since),
    'orders_paid',      (select count(*) from orders where status = 'paid' and paid_at >= v_since),
    'orders_total',     (select count(*) from orders where created_at >= v_since),
    'revenue_minor',    (select coalesce(sum(amount_minor), 0) from orders where status = 'paid' and paid_at >= v_since),
    'refunded_minor',   (select coalesce(sum(amount_minor), 0) from orders where status = 'refunded' and refunded_at >= v_since),
    'top_wallpapers',   (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select w.id, w.title, w.is_premium, count(d.id) as downloads, w.view_count
        from wallpapers w left join downloads d on d.wallpaper_id = w.id and d.created_at >= v_since
        group by w.id order by count(d.id) desc, w.view_count desc limit 8) t),
    'top_categories',   (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select c.name, count(d.id) as downloads
        from categories c
        left join wallpapers w on w.category_id = c.id
        left join downloads d on d.wallpaper_id = w.id and d.created_at >= v_since
        group by c.id order by count(d.id) desc, c.name limit 8) t),
    'daily',            (select coalesce(jsonb_agg(t order by t.day), '[]'::jsonb) from (
        select g.day::date as day,
               (select count(*) from analytics_events a where a.event_type = 'page_view' and a.created_at::date = g.day::date) as views,
               (select coalesce(sum(o.amount_minor), 0) from orders o where o.status = 'paid' and o.paid_at::date = g.day::date) as revenue_minor
        from generate_series(v_since::date, now()::date, interval '1 day') as g(day)) t)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats(int) from public, anon;
grant  execute on function public.admin_stats(int) to authenticated;
