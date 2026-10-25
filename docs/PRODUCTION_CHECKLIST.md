# Production-readiness checklist

Tick each item yourself. Items marked ⚠ are where mistakes lose money or leak files.

## Accounts and config
- [ ] Supabase project created; migrations 0001–0004 applied; `previews` public, `originals` private (⚠ confirm in Storage UI)
- [ ] Google OAuth consent screen published (not stuck in "Testing" with 100-user cap) and redirect URIs correct
- [ ] Supabase *Site URL* and *Redirect URLs* match the production URL
- [ ] Exactly the intended account(s) have `role='admin'`: `select email, role from profiles where role='admin';`
- [ ] `[SAMPLE]` wallpapers, sample coupon and sample collection deleted

## Security
- [ ] ⚠ `service_role` key appears nowhere in the repo, GitHub variables or built JS (`grep -r service_role dist/` returns nothing)
- [ ] ⚠ `ALLOW_MOCK_PAYMENTS` is `false` and `PAYMENT_PROVIDER=razorpay`
- [ ] `ALLOWED_ORIGIN` set to the production origin, not `*`
- [ ] `supabase test db` passes
- [ ] Manual test: signed-out user and a non-admin user cannot read `wallpaper_files`, list `originals`, insert `purchases`, or open `/admin` data
- [ ] Manual test: an unpurchased premium wallpaper returns 403 from `get-download-url`
- [ ] Signed URL expires (wait >60 s and retry)
- [ ] Dependency audit run (`npm audit`), lockfile committed
- [ ] Supabase Auth: email confirmations/other providers disabled if unused; leaked-password and rate-limit settings reviewed

## Payments
- [ ] Full test-mode run with Razorpay test keys: pay, cancel, fail, duplicate webhook (use *Resend* in the Razorpay dashboard), refund
- [ ] Webhook secret is long and random; webhook URL and 4 events configured
- [ ] Razorpay account activated (KYC) and live keys stored **only** as Supabase secrets; live webhook created
- [ ] Terms, Privacy, Refund pages reviewed by you (the shipped text is a template)
- [ ] One real low-value live purchase tested end-to-end, then refunded
- [ ] You understand fees, settlement timing and GST/tax obligations (consult an accountant)

## Operations
- [ ] Storage and egress usage reviewed; alert plan if nearing free-tier limits
- [ ] Database backup/export plan (Free plan has limited backups) and a copy of your original wallpapers outside Supabase
- [ ] Monitor Edge Function logs after launch
- [ ] Decide privacy details: data-deletion process, cookie/analytics notice appropriate for your audience
- [ ] Custom domain (optional) and HTTPS enforced in Pages settings
