// Payment provider abstraction. To add Cashfree/PayPal: implement PaymentProvider and register it in getProvider().
import { hmacSha256Hex, razorpayCheckoutSignature, timingSafeEqual } from './crypto-utils.ts';

export type CreatedOrder = { provider_order_id: string; public_key?: string };
export type WebhookEvent =
  | { kind: 'paid'; provider_order_id: string; payment_id: string; event_id: string }
  | { kind: 'failed'; provider_order_id: string; event_id: string }
  | { kind: 'refunded'; provider_order_id: string; event_id: string }
  | { kind: 'ignored'; event_id: string };

export interface PaymentProvider {
  name: string;
  createOrder(p: { amount_minor: number; currency: string; receipt: string }): Promise<CreatedOrder>;
  verifyCheckout(p: { provider_order_id: string; payment_id: string; signature: string }): Promise<boolean>;
  /** Returns null when the webhook signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}

const need = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing secret ${k}`);
  return v;
};

const razorpay: PaymentProvider = {
  name: 'razorpay',
  async createOrder({ amount_minor, currency, receipt }) {
    const keyId = need('RAZORPAY_KEY_ID');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${keyId}:${need('RAZORPAY_KEY_SECRET')}`) },
      body: JSON.stringify({ amount: amount_minor, currency, receipt, payment_capture: 1 }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error('Razorpay createOrder failed', body);
      throw new Error('Payment provider rejected the order');
    }
    return { provider_order_id: body.id, public_key: keyId };
  },
  async verifyCheckout({ provider_order_id, payment_id, signature }) {
    const expected = await razorpayCheckoutSignature(provider_order_id, payment_id, need('RAZORPAY_KEY_SECRET'));
    return timingSafeEqual(expected, signature);
  },
  async parseWebhook(raw, headers) {
    const sig = headers.get('x-razorpay-signature') ?? '';
    const expected = await hmacSha256Hex(need('RAZORPAY_WEBHOOK_SECRET'), raw);
    if (!timingSafeEqual(expected, sig)) return null;
    const event_id = headers.get('x-razorpay-event-id') ?? '';
    const body = JSON.parse(raw);
    const payment = body?.payload?.payment?.entity;
    const order = body?.payload?.order?.entity;
    const orderId: string | undefined = payment?.order_id ?? order?.id;
    if (!orderId) return { kind: 'ignored', event_id };
    switch (body.event) {
      case 'payment.captured':
      case 'order.paid':
        return { kind: 'paid', provider_order_id: orderId, payment_id: payment?.id ?? '', event_id };
      case 'payment.failed':
        return { kind: 'failed', provider_order_id: orderId, event_id };
      case 'refund.processed':
        return { kind: 'refunded', provider_order_id: orderId, event_id };
      default:
        return { kind: 'ignored', event_id };
    }
  },
};

// NO real money. Local testing only. Refuses to work unless ALLOW_MOCK_PAYMENTS=true.
const mock: PaymentProvider = {
  name: 'mock',
  async createOrder({ receipt }) {
    if (Deno.env.get('ALLOW_MOCK_PAYMENTS') !== 'true') throw new Error('Mock payments are disabled');
    return { provider_order_id: `mock_${receipt}` };
  },
  async verifyCheckout() {
    return Deno.env.get('ALLOW_MOCK_PAYMENTS') === 'true';
  },
  async parseWebhook() {
    return null;
  },
};

export function getProvider(): PaymentProvider {
  const name = Deno.env.get('PAYMENT_PROVIDER') ?? 'razorpay';
  if (name === 'razorpay') return razorpay;
  if (name === 'mock') return mock;
  throw new Error(`Unsupported PAYMENT_PROVIDER "${name}". Implement it in _shared/provider.ts.`);
}
