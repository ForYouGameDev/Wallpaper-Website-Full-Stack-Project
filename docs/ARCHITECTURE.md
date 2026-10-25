# Architecture, schema and security plan

## 1. Architecture

```
Browser (GitHub Pages, static)            Supabase
┌──────────────────────────┐   anon key   ┌─────────────────────────────────────────┐
│ React SPA                │─────────────▶│ PostgREST + RLS  (catalog, favorites…)  │
│  • browse / favorites    │              │ Auth (Google, PKCE)                     │
│  • admin (RLS-gated)     │─────────────▶│ Storage: previews (public)              │
│  • image processing      │  user JWT    │          originals (PRIVATE, no read    │
│    (canvas, in browser)  │              │          policy at all)                 │
└────────────┬─────────────┘              │ Edge Functions (service role, secrets): │
             │ invoke                     │  validate-coupon · create-order         │
             └───────────────────────────▶│  verify-payment · get-download-url      │
        Razorpay Checkout (hosted)        │  payment-webhook ◀── Razorpay           │
                                          └─────────────────────────────────────────┘
```
The static site holds only the public anon key. Anything that needs trust (prices, payment verification, access to originals, fulfilment) happens in Edge Functions with the service-role key, which exists only as a Supabase-managed secret.

## 2. Folder structure
```
.github/workflows/deploy.yml          build + test + deploy to Pages
.github/workflows/deploy-functions.yml  optional manual function deploy
src/
  main.tsx, App.tsx, index.css
  lib/        supabase.ts api.ts image.ts analytics.ts csv.ts format.ts types.ts
  context/    Auth, Theme, Toast, Library (favorites + purchases)
  components/ Navbar, Footer, WallpaperCard, States, Guards, Seo, Icons
  pages/      Home, Explore, WallpaperDetail, Collection, Favorites, Profile, Login, Legal, NotFound
  pages/admin/ AdminLayout, Dashboard, Upload, Wallpapers, Catalog, Coupons, Orders
supabase/
  migrations/ 0001_schema 0002_rls 0003_functions 0004_storage
  seed.sql    categories + [SAMPLE] data
  functions/  _shared/ (http, pricing, pricing-math, provider, crypto-utils)
              create-order validate-coupon verify-payment get-download-url payment-webhook
  tests/security.test.sql   pgTAP
tests/        Vitest unit tests
docs/         SETUP, PAYMENTS, ARCHITECTURE, PRODUCTION_CHECKLIST
```

## 3. Database schema (public)
| Table | Purpose | Client access (via RLS) |
|---|---|---|
| `profiles` | one row per user; `role` = user/admin | read own (admin: all); update `full_name` only |
| `categories` | catalog categories | public read; admin write |
| `wallpapers` | metadata, price (minor units), status, preview paths, counters | public read of *published*; admin all |
| `wallpaper_files` | **path of the private original** | admin only (service role for downloads) |
| `collections`, `collection_items` | homepage collections | public read of published; admin write |
| `favorites` | user ↔ wallpaper | own rows only |
| `coupons` | discount rules | users see only `is_public` + active; admin all |
| `orders`, `order_items` | payment records | read own (admin all); **no client writes** |
| `purchases` | grants premium access | read own; **written only by `fulfill_order()`** |
| `coupon_redemptions` | per-user usage | admin read; server writes |
| `payment_events` | webhook idempotency | no client access at all |
| `downloads` | successful download log | read own (admin all); server writes |
| `analytics_events` | deduplicated views + download attempts | admin read; written via `track_event()` RPC |

Money is in minor units (paise). Premium wallpapers must have `price_minor > 0` (CHECK constraint).

## 4. Security plan
- **Admin identity**: `profiles.role`, set only by SQL run in the Supabase dashboard (or service role). `is_admin()` reads that column, never JWT `user_metadata` (user-editable). `profiles` UPDATE is column-restricted to `full_name`, so users cannot self-promote. The `RequireAdmin` component is only UX; RLS, storage policies and function checks are the enforcement.
- **RLS on every table**; sensitive tables additionally have INSERT/UPDATE/DELETE revoked from `anon`/`authenticated`.
- **Originals**: private bucket with *no SELECT policy*; only the service role can sign URLs, valid 60 s, issued after: published check → login rule (free) or purchase/admin check (premium). Free and premium originals both live here so there is one enforcement path. Public buckets contain only ≤500 px previews.
- **Prices are never sent by the client.** Only ids + coupon code. The server prices from `wallpapers`.
- **Payments**: signature verification (browser return and webhook, HMAC over raw body, constant-time compare); webhook idempotency table; `fulfill_order` locks the order row, so duplicate/parallel callbacks are safe; `EXECUTE` on fulfil/refund functions is revoked from everyone except `service_role`.
- **Secrets**: service-role key, Razorpay secrets and webhook secret exist only as Edge Function secrets. `.env.example` has placeholders only. The anon key is public by design.
- **CORS** on functions is restricted to `ALLOWED_ORIGIN`.
- **CSV export** neutralises formula injection.
- **Analytics** stores a random browser id, no IP, no cookies; honours Do Not Track.

### What this does not stop
- **Screenshots / screen recording of previews.** Watermarks and disabled right-click/drag are deterrents only. Previews are 500 px so a screenshot is low quality.
- A buyer who downloads a legitimate original can share it. Nothing technical prevents that.
- **Abuse of public RPCs**: anyone can call `track_event` with random visitor ids and inflate view counts; free downloads without login (if you disable `free_requires_login`) can be scripted. Add Cloudflare/rate limiting if this matters.
- Supabase Free has no SLA, and projects can pause after inactivity.

## 5. Image processing
In the admin's browser (canvas → WebP): thumbnail ~240 px, preview ~500 px, watermarked preview ~500 px; the original is uploaded unchanged to the private bucket in the same action. **Limits**: very large images (tens of megapixels) can exhaust memory on phones; the bucket file limit is 50 MB (Supabase Free's per-file ceiling); processing runs on the admin's device; if a step fails everything uploaded for that file is rolled back. A server-side alternative (Edge Function with an image library, or Supabase image transformations on paid plans) can replace `src/lib/image.ts` later.

## 6. Analytics definitions
- **Page view** — one per visitor per path per day.
- **Unique visitors** — distinct anonymous browser ids with a page view in the period (approximate; one person on two browsers = two).
- **Wallpaper view** — one per visitor per wallpaper per day; also increments `wallpapers.view_count`.
- **Download attempt** — every call to `get-download-url`, allowed or not.
- **Free / premium download** — a signed URL was issued (`downloads` row). Admin test downloads are not logged.
- **Order / revenue** — orders with `status='paid'` by `paid_at`; refunds reported separately.
- **Popular** — by downloads in the period, tie-break by views.

## 7. Free-tier notes (verify current limits at supabase.com/pricing and docs.github.com)
Supabase Free is roughly: ~1 GB file storage, a few GB/month egress, 50 MB max upload, 500 MB database, a monthly quota of Edge Function invocations; inactive projects can be paused. Because previews are small WebP files with a one-year cache header, bandwidth stays low, but a wallpaper site is image-heavy — watch *Project Settings → Usage*. When a quota is exceeded Supabase returns errors; the UI shows "could not load / try again" messages rather than crashing. Plan to move to Pro (or put Cloudflare in front of the `previews` bucket) as traffic grows. The site never promises unlimited storage or bandwidth.

## 8. SEO
Titles, descriptions, Open Graph tags and canonical links are set in the browser per page. Google and Bing execute JavaScript and will usually index them; social-media scrapers generally will not, so shared links show the default card. Images use lazy loading, async decoding and explicit aspect-ratio boxes. A sitemap is not generated (no server); add a static one or pre-render pages later if SEO becomes a priority. GitHub Pages answers unknown paths with the 404 page, so deep links return HTTP 404 status to crawlers even though the app renders — a custom domain behind Cloudflare, Netlify or Vercel avoids that.

## 9. Known gaps
Single-item checkout UI (multi-item backend exists) · Razorpay only · no in-app refund button · no email receipts · no rate limiting · SQL/pgTAP and Edge Functions were written but **not executed** in the environment that generated this repo (only TypeScript typecheck, the production build and Vitest were) — run `supabase test db` and a full test-mode payment before launch.
