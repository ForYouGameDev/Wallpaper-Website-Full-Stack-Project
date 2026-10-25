// Pure pricing / coupon logic — no imports, so it runs in Deno (Edge Functions) AND in Vitest.

export type CouponRow = {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  min_order_minor: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number;
  expires_at: string | null;
  is_active: boolean;
};

export type CouponCheck = { ok: true; discount_minor: number } | { ok: false; reason: string };

/** Validate a coupon against a subtotal. `userRedemptions` = how many times THIS user already redeemed it. */
export function checkCoupon(
  c: CouponRow,
  subtotalMinor: number,
  userRedemptions: number,
  now: Date = new Date(),
): CouponCheck {
  if (!c.is_active) return { ok: false, reason: 'This coupon is not active.' };
  if (c.expires_at && new Date(c.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: 'This coupon has expired.' };
  }
  if (c.max_uses !== null && c.used_count >= c.max_uses) {
    return { ok: false, reason: 'This coupon has reached its usage limit.' };
  }
  if (userRedemptions >= c.per_user_limit) {
    return { ok: false, reason: 'You have already used this coupon.' };
  }
  if (subtotalMinor < c.min_order_minor) {
    return { ok: false, reason: `Minimum order for this coupon is ${(c.min_order_minor / 100).toFixed(2)}.` };
  }
  const raw = c.discount_type === 'percent' ? Math.floor((subtotalMinor * c.value) / 100) : c.value;
  const discount = Math.max(0, Math.min(raw, subtotalMinor));
  return { ok: true, discount_minor: discount };
}

export function computeTotals(itemPricesMinor: number[], discountMinor: number) {
  const subtotal = itemPricesMinor.reduce((a, b) => a + b, 0);
  const discount = Math.max(0, Math.min(discountMinor, subtotal));
  return { subtotal_minor: subtotal, discount_minor: discount, total_minor: subtotal - discount };
}
