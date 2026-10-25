-- pgTAP tests for RLS, admin permissions, coupons, payment fulfilment and protected storage.
-- Run locally with:  supabase start && supabase db reset && supabase test db
-- (These tests were written but NOT executed in the environment that generated this repo — run them before launch.)
begin;
select plan(16);

-- fixtures -----------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.dev'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.dev'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.dev');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.wallpapers (id, slug, title, status, is_premium, price_minor) values
  ('10000000-0000-0000-0000-000000000001', 'pub', 'Published', 'published', true, 10000),
  ('10000000-0000-0000-0000-000000000002', 'draft', 'Draft', 'draft', false, 0);
insert into public.wallpaper_files (wallpaper_id, original_path) values ('10000000-0000-0000-0000-000000000001', 'x/original.jpg');
insert into public.coupons (id, code, discount_type, value, is_public) values
  ('20000000-0000-0000-0000-000000000001', 'HIDDEN', 'percent', 50, false),
  ('20000000-0000-0000-0000-000000000002', 'OFFER', 'percent', 10, true);
insert into public.favorites (user_id, wallpaper_id) values ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000001');
insert into public.orders (id, user_id, subtotal_minor, amount_minor, provider, provider_order_id)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 10000, 10000, 'mock', 'mock_1');
insert into public.order_items values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 10000);

-- helper to act as a role/user ---------------------------------------------
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

-- anonymous ------------------------------------------------------------------
select pg_temp.act_as(null);
select is((select count(*) from public.wallpapers where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')), 1::bigint, 'anon sees only published wallpapers');
select is((select count(*) from public.wallpaper_files), 0::bigint, 'anon cannot see original file paths');
select throws_ok($$insert into public.purchases (user_id, wallpaper_id) values ('00000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot insert purchases');

-- regular user (alice) --------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(public.is_admin(), false, 'normal user is not admin');
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$, '42501', null, 'user cannot grant themselves admin');
select is((select count(*) from public.favorites), 0::bigint, 'alice cannot read bob''s favorites');
select is((select count(*) from public.coupons where code in ('HIDDEN','OFFER')), 1::bigint, 'user only sees public coupons');
select throws_ok($$insert into public.purchases (user_id, wallpaper_id) values ('00000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-000000000001')$$, '42501', null, 'user cannot grant themselves a purchase');
select throws_ok($$update public.orders set status = 'paid' where id = '30000000-0000-0000-0000-000000000001'$$, '42501', null, 'user cannot mark their own order paid');
select throws_ok($$select public.admin_stats(7)$$, '42501', 'forbidden', 'non-admin cannot read admin stats');
select throws_ok($$select public.fulfill_order('30000000-0000-0000-0000-000000000001')$$, '42501', null, 'user cannot call fulfill_order');
select is((select count(*) from storage.objects where bucket_id = 'originals'), 0::bigint, 'user cannot list private originals');

-- service role: fulfilment is idempotent ---------------------------------------
reset role;
select is(public.fulfill_order('30000000-0000-0000-0000-000000000001', 'pay_1'), 'paid', 'fulfill_order marks order paid');
select is(public.fulfill_order('30000000-0000-0000-0000-000000000001', 'pay_1'), 'already_paid', 'duplicate callback is a no-op');
select is((select count(*) from public.purchases where user_id = '00000000-0000-0000-0000-0000000000b1'), 1::bigint, 'exactly one purchase granted');

-- admin ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.wallpapers where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')), 2::bigint, 'admin sees drafts too');

select * from finish();
rollback;
