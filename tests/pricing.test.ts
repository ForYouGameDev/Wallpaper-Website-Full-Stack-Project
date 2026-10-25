import { describe, expect, it } from 'vitest';
import { checkCoupon, computeTotals, type CouponRow } from '../supabase/functions/_shared/pricing-math.ts';

const base: CouponRow = {
  id: 'c1', code: 'SAVE', discount_type: 'percent', value: 10, min_order_minor: 0,
  max_uses: null, used_count: 0, per_user_limit: 1, expires_at: null, is_active: true,
};
const now = new Date('2026-01-15T12:00:00Z');

describe('checkCoupon', () => {
  it('applies a percentage discount (rounded down)', () => {
    expect(checkCoupon(base, 9999, 0, now)).toEqual({ ok: true, discount_minor: 999 });
  });
  it('applies a fixed discount but never exceeds the subtotal', () => {
    const c = { ...base, discount_type: 'fixed' as const, value: 50000 };
    expect(checkCoupon(c, 12900, 0, now)).toEqual({ ok: true, discount_minor: 12900 });
  });
  it('100% coupon makes the order free', () => {
    expect(checkCoupon({ ...base, value: 100 }, 5000, 0, now)).toEqual({ ok: true, discount_minor: 5000 });
  });
  it('rejects inactive coupons', () => {
    expect(checkCoupon({ ...base, is_active: false }, 1000, 0, now).ok).toBe(false);
  });
  it('rejects expired coupons but accepts ones expiring later', () => {
    expect(checkCoupon({ ...base, expires_at: '2026-01-15T11:59:59Z' }, 1000, 0, now).ok).toBe(false);
    expect(checkCoupon({ ...base, expires_at: '2026-01-16T00:00:00Z' }, 1000, 0, now).ok).toBe(true);
  });
  it('enforces the minimum order amount', () => {
    const c = { ...base, min_order_minor: 20000 };
    expect(checkCoupon(c, 19999, 0, now).ok).toBe(false);
    expect(checkCoupon(c, 20000, 0, now).ok).toBe(true);
  });
  it('enforces the global usage limit', () => {
    expect(checkCoupon({ ...base, max_uses: 5, used_count: 5 }, 1000, 0, now).ok).toBe(false);
    expect(checkCoupon({ ...base, max_uses: 5, used_count: 4 }, 1000, 0, now).ok).toBe(true);
  });
  it('enforces the per-user limit', () => {
    expect(checkCoupon({ ...base, per_user_limit: 2 }, 1000, 2, now).ok).toBe(false);
    expect(checkCoupon({ ...base, per_user_limit: 2 }, 1000, 1, now).ok).toBe(true);
  });
});

describe('computeTotals', () => {
  it('sums items and subtracts the discount', () => {
    expect(computeTotals([10000, 5000], 3000)).toEqual({ subtotal_minor: 15000, discount_minor: 3000, total_minor: 12000 });
  });
  it('clamps the discount between 0 and the subtotal', () => {
    expect(computeTotals([1000], 9999).total_minor).toBe(0);
    expect(computeTotals([1000], -5).total_minor).toBe(1000);
  });
});
