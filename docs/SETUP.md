# Setup guide

Order matters: Supabase → Google login → admin → payments → GitHub Pages.

## 0. Prerequisites
Node 20+, a GitHub account, a Google account, a Supabase account. For CLI steps: `npm i -g supabase` (or use `npx supabase`).

## 1. Create the Supabase project
1. supabase.com → New project (Free plan). Save the database password.
2. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Never copy the `service_role` key into any frontend file or GitHub variable.

## 2. Create tables, policies, buckets
Either use the CLI:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push            # applies supabase/migrations/0001..0004
```
or open **SQL Editor** and run the four files in `supabase/migrations/` in order.
Then (optional) run `supabase/seed.sql` for categories plus clearly labelled `[SAMPLE]` demo rows. Sample wallpapers have no image files; delete them from `/admin` before launch.

Check **Storage**: `previews` is public, `originals` is private.

## 3. Google sign-in
1. Google Cloud Console → *APIs & Services → OAuth consent screen* (External, add your email as a test user while testing).
2. *Credentials → Create credentials → OAuth client ID → Web application*.
   Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. Supabase → *Authentication → Providers → Google*: enable, paste Client ID and Secret.
4. Supabase → *Authentication → URL Configuration*:
   - **Site URL**: your deployed site, e.g. `https://USER.github.io/REPO/`
   - **Redirect URLs**: add `https://USER.github.io/REPO/` and `http://localhost:5173/`

## 4. Make yourself the admin
Sign in once on the site (this creates your profile), then in the Supabase **SQL Editor**:
```sql
update public.profiles set role = 'admin' where email = 'you@gmail.com';
```
This is the only way to grant admin. Clients cannot write `role` (column privileges + RLS), and every admin action is checked by RLS on the server — hiding the `/admin` UI is not what protects it. Sign out and in again (or refresh) to see the Admin link.

## 5. Edge Functions + secrets
```bash
cp supabase/functions/.env.example supabase/functions/.env     # edit: placeholders only in the example
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy create-order verify-payment validate-coupon get-download-url payment-webhook
```
Set `ALLOWED_ORIGIN` to your site origin (e.g. `https://USER.github.io`, no path, no trailing slash).
`supabase/config.toml` disables gateway JWT checking (`verify_jwt = false`) because each function authenticates callers itself; if you run `supabase init` and get a fresh config.toml, merge those blocks back in.

For a first end-to-end test **without any payment account**, set `PAYMENT_PROVIDER=mock` and `ALLOW_MOCK_PAYMENTS=true`. Checkout then asks you to confirm a simulated payment. **Never leave mock enabled in production** — set `ALLOW_MOCK_PAYMENTS=false` (the mock provider then refuses to work).

For Razorpay see `docs/PAYMENTS.md`.

## 6. Deploy to GitHub Pages
1. Create a GitHub repo and push this project to `main`.
2. *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
3. *Settings → Secrets and variables → Actions → **Variables***: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public by design), `VITE_SITE_NAME`, `VITE_SITE_URL`, `VITE_CONTACT_EMAIL`. Optional: `CUSTOM_DOMAIN`.
4. Push to `main`. The workflow runs typecheck + tests, builds with the right base path (`/REPO/` or `/`), copies `index.html` to `404.html` so deep links and refreshes work, and publishes.

## 7. Upload your first wallpaper
`/admin → Upload`: choose one or many images. The browser makes a ~240px thumbnail, a ~500px preview and a watermarked preview; the original goes to the private bucket. Nothing is committed to Git.

## Troubleshooting
- *Redirected back but not signed in*: the site URL is missing from Supabase *Redirect URLs*.
- *404 on refresh*: the build must run through the workflow (it creates `404.html`).
- *Upload fails with "new row violates row-level security"*: your profile is not `admin`.
- *"Mock payments are disabled"*: set `ALLOW_MOCK_PAYMENTS=true` (testing only) or switch to Razorpay.
- *Function CORS errors*: `ALLOWED_ORIGIN` must exactly equal the page's origin.
