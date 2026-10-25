import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, razorpayCheckoutSignature, timingSafeEqual } from '../supabase/functions/_shared/crypto-utils.ts';

describe('payment signatures', () => {
  it('matches the RFC 4231 HMAC-SHA256 test vector', async () => {
    expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?'))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('builds the Razorpay checkout signature as HMAC(order_id|payment_id)', async () => {
    const expected = await hmacSha256Hex('secret', 'order_1|pay_1');
    expect(await razorpayCheckoutSignature('order_1', 'pay_1', 'secret')).toBe(expected);
  });
  it('rejects a forged or tampered signature', async () => {
    const good = await razorpayCheckoutSignature('order_1', 'pay_1', 'secret');
    expect(timingSafeEqual(good, good)).toBe(true);
    expect(timingSafeEqual(good, await razorpayCheckoutSignature('order_1', 'pay_2', 'secret'))).toBe(false);
    expect(timingSafeEqual(good, await razorpayCheckoutSignature('order_1', 'pay_1', 'wrong'))).toBe(false);
    expect(timingSafeEqual(good, good.slice(1))).toBe(false);
  });
});
