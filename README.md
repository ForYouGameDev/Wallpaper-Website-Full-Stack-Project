# Frameshift — wallpaper marketplace (React + Supabase + GitHub Pages)

A mobile-first marketplace for free and premium wallpapers.

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS (static site) |
| Hosting | GitHub Pages, deployed by GitHub Actions |
| Auth | Supabase Auth, Google OAuth (PKCE) |
| Data | Supabase PostgreSQL with Row Level Security on every table |
| Images | Supabase Storage: public `previews` bucket, private `originals` bucket |
| Server logic | Supabase Edge Functions (Deno): coupon quote, order creation, payment verification, webhook, signed download URLs |
| Payments | Provider-agnostic interface; **Razorpay** implemented, `mock` provider for local testing |

## What works, and what you must configure

Everything in the code is real, not mocked. But these need **your** accounts and keys before they function — nothing is pre-configured and no credentials are included:

- A Supabase project (URL + anon key) → `.env`
- Google OAuth client → Supabase Auth settings
- First admin → one SQL statement (see `docs/SETUP.md`)
- Razorpay account (test keys are enough to try the whole flow) → Edge Function secrets
- GitHub repo variables for the deploy workflow

Start here: **`docs/SETUP.md`** (about 30–40 minutes the first time).

## Quick start (local)

```bash
npm install
cp .env.example .env        # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                 # http://localhost:5173
npm test                    # unit tests (pricing, coupons, signatures, CSV)
npm run build               # typecheck + production build
```

## Documentation

- `docs/SETUP.md` — step-by-step setup: Supabase, Google login, admin, payments, GitHub Pages
- `docs/ARCHITECTURE.md` — architecture, folder structure, schema, security plan, analytics definitions, free-tier notes, known limitations
- `docs/PAYMENTS.md` — payment flow, Razorpay setup, webhook, KYC/fees, adding Cashfree or PayPal
- `docs/PRODUCTION_CHECKLIST.md` — what to verify before taking real money

## Tests

- `tests/*.test.ts` — Vitest: coupon rules, price totals, HMAC/Razorpay signature checks, CSV-injection safety (run in CI).
- `supabase/tests/security.test.sql` — pgTAP: RLS, role escalation, purchases, coupons, admin stats, idempotent fulfilment. Run with `supabase test db` (needs Docker + Supabase CLI).

## Honest limitations

- Screenshots cannot be prevented. Watermarks and right-click blocking only discourage casual copying. Real protection = low-res public previews + private originals + signed URLs.
- Checkout buys one wallpaper at a time in the UI. The backend (`create-order`, `priceCart`, `order_items`) already supports multi-item carts; only the cart screen is not built.
- Cashfree and PayPal are documented, not implemented.
- Refunds are issued in the provider dashboard; the webhook then revokes access. There is no in-app refund button and partial refunds are not modelled.
- GitHub Pages is a static host: page metadata is set in the browser, so social-media link previews will not show wallpaper-specific cards (see ARCHITECTURE → SEO).
