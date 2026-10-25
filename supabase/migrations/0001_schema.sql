-- 0001_schema.sql — tables, constraints, indexes, triggers
-- Money is stored in MINOR units (paise for INR). 19900 = ₹199.00

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Trusted admin check. Reads the role from the DB (never from JWT user_metadata, which users can edit).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- catalog ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

create table public.wallpapers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  category_id uuid references public.categories(id) on delete set null,
  tags text[] not null default '{}',
  width int,
  height int,
  aspect_ratio text,
  is_premium boolean not null default false,
  price_minor int not null default 0 check (price_minor >= 0),
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  free_requires_login boolean not null default true,   -- access policy for FREE wallpapers
  thumb_path text,        -- previews bucket (public)
  preview_path text,      -- previews bucket (public)
  watermark_path text,    -- previews bucket (public)
  view_count int not null default 0,
  download_count int not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (not is_premium or price_minor > 0)
);
create index wallpapers_list_idx on public.wallpapers (status, created_at desc);
create index wallpapers_category_idx on public.wallpapers (category_id);
create index wallpapers_tags_idx on public.wallpapers using gin (tags);

-- Path to the PRIVATE original. Separate table so it can never leak through public wallpaper queries.
create table public.wallpaper_files (
  wallpaper_id uuid primary key references public.wallpapers(id) on delete cascade,
  original_path text not null,
  original_bytes bigint,
  mime_type text
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.collection_items (
  collection_id uuid references public.collections(id) on delete cascade,
  wallpaper_id uuid references public.wallpapers(id) on delete cascade,
  position int not null default 0,
  primary key (collection_id, wallpaper_id)
);

-- ---------- user data ----------
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallpaper_id uuid not null references public.wallpapers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, wallpaper_id)
);

-- ---------- coupons & orders ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  discount_type text not null check (discount_type in ('percent','fixed')),
  value int not null check (value > 0),
  min_order_minor int not null default 0 check (min_order_minor >= 0),
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  per_user_limit int not null default 1 check (per_user_limit > 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  is_public boolean not null default false,   -- shown in users' "offers" list
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or value between 1 and 100)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subtotal_minor int not null check (subtotal_minor >= 0),
  discount_minor int not null default 0 check (discount_minor >= 0),
  amount_minor int not null check (amount_minor >= 0),   -- authoritative amount charged
  currency text not null default 'INR',
  coupon_id uuid references public.coupons(id),
  provider text not null,                                 -- razorpay | mock | free
  provider_order_id text unique,
  provider_payment_id text,
  status text not null default 'created' check (status in ('created','paid','failed','cancelled','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  wallpaper_id uuid not null references public.wallpapers(id),
  price_minor int not null,
  primary key (order_id, wallpaper_id)
);

-- Granted ONLY by fulfill_order() after verified payment. Clients can never write this.
create table public.purchases (
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallpaper_id uuid not null references public.wallpapers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, wallpaper_id)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  user_id uuid not null references public.profiles(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_idx on public.coupon_redemptions (coupon_id, user_id);

-- Webhook idempotency: one row per provider event id.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------- downloads & analytics ----------
create table public.downloads (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,   -- null = anonymous free download
  wallpaper_id uuid not null references public.wallpapers(id) on delete cascade,
  kind text not null check (kind in ('free','premium')),
  created_at timestamptz not null default now()
);
create index downloads_wallpaper_idx on public.downloads (wallpaper_id, created_at desc);
create index downloads_user_idx on public.downloads (user_id, created_at desc);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','wallpaper_view','download_attempt')),
  path text,
  wallpaper_id uuid references public.wallpapers(id) on delete cascade,
  visitor_id text,                -- random anonymous id generated in the browser; no IP, no cookies
  user_id uuid,
  dedupe_key text unique,         -- same visitor + same page + same day counts once
  created_at timestamptz not null default now()
);
create index analytics_type_time_idx on public.analytics_events (event_type, created_at desc);

-- keep wallpapers.download_count in sync
create or replace function public.bump_download_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.wallpapers set download_count = download_count + 1 where id = new.wallpaper_id;
  return new;
end $$;
create trigger downloads_bump after insert on public.downloads
for each row execute function public.bump_download_count();

create or replace function public.set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger wallpapers_published_at before insert or update on public.wallpapers
for each row execute function public.set_published_at();
