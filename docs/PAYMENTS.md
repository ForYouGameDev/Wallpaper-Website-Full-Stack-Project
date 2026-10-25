# Payments

## Flow (all server-side decisions)
1. Browser asks `validate-coupon` for a quote (ids + optional code). Prices come from the database only.
2. Browser calls `create-order`. The function re-prices the cart, re-validates the coupon, creates the provider order (Razorpay Orders API) and stores an `orders` row (`status=created`). A 100%-off order is fulfilled immediately without a provider.
3. Provider-hosted Razorpay Checkout opens. Card/UPI details go to Razorpay, never to us.
4. On success the browser calls `verify-payment` with the signature; the function verifies `HMAC_SHA256(order_id|payment_id, key_secret)` and calls `fulfill_order`.
5. Independently, Razorpay calls `payment-webhook`. The raw body signature is verified, the event id is stored (`payment_events`, unique) so duplicates are ignored, and `fulfill_order` is called.
6. `fulfill_order` (service role only) locks the order row, marks it paid, inserts `purchases`, records the coupon redemption. Running it twice changes nothing.
7. `get-download-url` checks `purchases` in the database before issuing a 60-second signed URL.

Failures: `payment.failed` marks a `created` order `failed` (a later successful retry still fulfils it). Cancelled checkouts leave the order `created`. `refund.processed` calls `refund_order`, which marks the order refunded and removes the purchase.

## Razorpay setup
1. Create a Razorpay account. Use **Test mode** and `rzp_test_*` keys from *Settings → API Keys*.
2. Set secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (a long random string you choose), `PAYMENT_PROVIDER=razorpay`.
3. *Settings → Webhooks → Add*: URL `https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-webhook`, the same secret, events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.
4. Keep payment auto-capture enabled (the code requests `payment_capture: 1`).
5. Try Razorpay's test cards/UPI IDs from their docs. Confirm: order becomes `paid`, the purchase appears in the profile, download works, a repeat webhook changes nothing.

**Going live** requires Razorpay account activation (KYC). Typically: PAN, bank account, business or individual details, and a website that clearly shows terms, privacy, refund policy and contact details (templates are in `/legal/*` — have them reviewed). Activation can take days and Razorpay may ask questions about digital goods. Standard domestic fees are typically a percentage per transaction plus GST — check Razorpay's current pricing page; do not assume a number. Replace test keys with live keys only in Supabase secrets, and create a live-mode webhook.

## Adding Cashfree or PayPal
Implement `PaymentProvider` in `supabase/functions/_shared/provider.ts`:
- `createOrder` — create the provider order, return its id (and any public key the checkout needs)
- `verifyCheckout` — verify the browser-return signature/capture with the provider's server API
- `parseWebhook` — verify the webhook signature over the raw body; map events to `paid | failed | refunded`

Register it in `getProvider()` and set `PAYMENT_PROVIDER`. Add the provider's checkout launch next to the Razorpay branch in `src/pages/WallpaperDetail.tsx`. The database, pricing, fulfilment and download code need no changes. PayPal mostly suits international buyers; Cashfree supports Indian methods similar to Razorpay.

## Never
Store card data, put secrets in `VITE_*` variables or GitHub variables, trust the browser's claim that it paid, or leave `ALLOW_MOCK_PAYMENTS=true` in production.
