import { checkCoupon, computeTotals, type CouponRow } from './pricing-math.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Quote =
  | { ok: false; error: string }
  | {
      ok: true;
      currency: string;
      items: { id: string; title: string; price_minor: number }[];
      subtotal_minor: number;
      discount_minor: number;
      total_minor: number;
      coupon: { id: string; code: string } | null;
      coupon_error: string | null;
    };

/**
 * Authoritative price calculation. Prices come ONLY from the database; the client sends ids and a coupon code.
 * `db` is a service-role Supabase client.
 */
// deno-lint-ignore no-explicit-any
export async function priceCart(db: any, userId: string, ids: unknown, couponCode?: string | null): Promise<Quote> {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 10) return { ok: false, error: 'Cart must have 1–10 items.' };
  const wallpaperIds = [...new Set(ids.map(String))];
  if (!wallpaperIds.every((i) => UUID.test(i))) return { ok: false, error: 'Invalid wallpaper id.' };

  const { data: rows, error } = await db
    .from('wallpapers')
    .select('id,title,price_minor,currency,is_premium,status')
    .in('id', wallpaperIds);
  if (error) throw error;
  if (!rows || rows.length !== wallpaperIds.length) return { ok: false, error: 'Some wallpapers no longer exist.' };
  for (const w of rows) {
    if (w.status !== 'published') return { ok: false, error: `“${w.title}” is not available.` };
    if (!w.is_premium || w.price_minor <= 0) return { ok: false, error: `“${w.title}” is free — no purchase needed.` };
  }
  if (new Set(rows.map((w: { currency: string }) => w.currency)).size > 1) return { ok: false, error: 'Mixed currencies in one cart.' };

  const { data: owned } = await db.from('purchases').select('wallpaper_id').eq('user_id', userId).in('wallpaper_id', wallpaperIds);
  if (owned && owned.length) return { ok: false, error: 'You already own one of these wallpapers.' };

  const items = rows.map((w: { id: string; title: string; price_minor: number }) => ({ id: w.id, title: w.title, price_minor: w.price_minor }));
  const subtotal = computeTotals(items.map((i: { price_minor: number }) => i.price_minor), 0).subtotal_minor;

  let discount = 0;
  let coupon: { id: string; code: string } | null = null;
  let couponError: string | null = null;
  const code = (couponCode ?? '').trim().toUpperCase();
  if (code) {
    const { data: c } = await db.from('coupons').select('*').eq('code', code).maybeSingle();
    if (!c) {
      couponError = 'That coupon code is not valid.';
    } else {
      const { count } = await db.from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', c.id).eq('user_id', userId);
      const res = checkCoupon(c as CouponRow, subtotal, count ?? 0);
      if (res.ok) {
        discount = res.discount_minor;
        coupon = { id: c.id, code: c.code };
      } else couponError = res.reason;
    }
  }
  const totals = computeTotals(items.map((i: { price_minor: number }) => i.price_minor), discount);
  return { ok: true, currency: rows[0].currency, items, ...totals, coupon, coupon_error: couponError };
}
