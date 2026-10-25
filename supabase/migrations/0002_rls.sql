-- 0002_rls.sql — Row Level Security. Every table has RLS ON; no policy = no access.

alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.wallpapers         enable row level security;
alter table public.wallpaper_files    enable row level security;
alter table public.collections        enable row level security;
alter table public.collection_items   enable row level security;
alter table public.favorites          enable row level security;
alter table public.coupons            enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.purchases          enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.payment_events     enable row level security;
alter table public.downloads          enable row level security;
alter table public.analytics_events   enable row level security;

-- Defense in depth: strip default write grants on server-only tables.
revoke insert, update, delete, truncate on
  public.orders, public.order_items, public.purchases, public.coupon_redemptions,
  public.downloads, public.analytics_events from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

-- ---------- profiles ----------
-- Users can read their own row (admins read all) and change ONLY full_name. role is not writable by clients.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- public catalog ----------
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_admin on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy wallpapers_read on public.wallpapers for select to anon, authenticated
  using (status = 'published' or public.is_admin());
create policy wallpapers_admin on public.wallpapers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Originals' paths: admin only (service role bypasses RLS and is used by Edge Functions).
create policy wallpaper_files_admin on public.wallpaper_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy collections_read on public.collections for select to anon, authenticated
  using (is_published or public.is_admin());
create policy collections_admin on public.collections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy collection_items_read on public.collection_items for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_published or public.is_admin())));
create policy collection_items_admin on public.collection_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- favorites ----------
create policy favorites_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

-- ---------- coupons ----------
-- Signed-in users can only see coupons the owner marked public (offers). Validation happens server-side.
create policy coupons_public_offers on public.coupons for select to authenticated
  using (is_public and is_active and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses));
create policy coupons_admin on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- orders / purchases / downloads (read-only for clients) ----------
create policy orders_select on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy purchases_select on public.purchases for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy downloads_select on public.downloads for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy redemptions_select_admin on public.coupon_redemptions for select to authenticated
  using (public.is_admin());
create policy analytics_select_admin on public.analytics_events for select to authenticated
  using (public.is_admin());
-- payment_events: no policy at all -> only the service role can touch it.
