import { adminClient, getUser, handler, HttpError, json } from '../_shared/http.ts';
import { priceCart } from '../_shared/pricing.ts';
import { getProvider } from '../_shared/provider.ts';

// 1. validate cart + coupon  2. compute price from DB  3. create provider order  4. store order (status=created)
Deno.serve(handler(async (req, cors) => {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const { wallpaper_ids, coupon_code } = await req.json();

  const db = adminClient();
  const quote = await priceCart(db, user.id, wallpaper_ids, coupon_code);
  if (!quote.ok) throw new HttpError(400, quote.error);
  if (coupon_code && quote.coupon_error) throw new HttpError(400, quote.coupon_error);

  const orderId = crypto.randomUUID();
  const base = {
    id: orderId,
    user_id: user.id,
    subtotal_minor: quote.subtotal_minor,
    discount_minor: quote.discount_minor,
    amount_minor: quote.total_minor,
    currency: quote.currency,
    coupon_id: quote.coupon?.id ?? null,
  };
  const items = quote.items.map((i) => ({ order_id: orderId, wallpaper_id: i.id, price_minor: i.price_minor }));

  // 100% discount: nothing to charge, fulfil immediately.
  if (quote.total_minor === 0) {
    const { error } = await db.from('orders').insert({ ...base, provider: 'free', status: 'created' });
    if (error) throw error;
    await db.from('order_items').insert(items);
    const { error: fe } = await db.rpc('fulfill_order', { p_order_id: orderId, p_payment_id: 'free' });
    if (fe) throw fe;
    return json({ order_id: orderId, status: 'paid', provider: 'free' }, 200, cors);
  }

  if (quote.total_minor < 100) throw new HttpError(400, 'Order total is below the minimum payable amount (1.00).');

  const provider = getProvider();
  const created = await provider.createOrder({ amount_minor: quote.total_minor, currency: quote.currency, receipt: orderId });

  const { error } = await db.from('orders').insert({ ...base, provider: provider.name, provider_order_id: created.provider_order_id });
  if (error) throw error;
  const { error: ie } = await db.from('order_items').insert(items);
  if (ie) throw ie;

  return json({
    order_id: orderId,
    status: 'created',
    provider: provider.name,
    provider_order_id: created.provider_order_id,
    public_key: created.public_key ?? null,
    amount_minor: quote.total_minor,
    currency: quote.currency,
  }, 200, cors);
}));
