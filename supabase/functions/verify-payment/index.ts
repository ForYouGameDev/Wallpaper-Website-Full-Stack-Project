import { adminClient, getUser, handler, HttpError, json } from '../_shared/http.ts';
import { getProvider } from '../_shared/provider.ts';

// Called by the browser right after checkout. The signature is verified server-side;
// the webhook is the second, independent path that grants access (both are idempotent).
Deno.serve(handler(async (req, cors) => {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const { order_id, payment_id, signature } = await req.json();
  if (typeof order_id !== 'string' || typeof payment_id !== 'string' || typeof signature !== 'string') {
    throw new HttpError(400, 'Missing payment details.');
  }
  const db = adminClient();
  const { data: order } = await db.from('orders').select('*').eq('id', order_id).eq('user_id', user.id).maybeSingle();
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status === 'paid') return json({ status: 'paid' }, 200, cors);
  if (order.status === 'refunded') throw new HttpError(409, 'This order was refunded.');

  const provider = getProvider();
  if (provider.name !== order.provider) throw new HttpError(400, 'Provider mismatch.');
  const ok = await provider.verifyCheckout({ provider_order_id: order.provider_order_id, payment_id, signature });
  if (!ok) throw new HttpError(400, 'Payment signature could not be verified.');

  const { data, error } = await db.rpc('fulfill_order', { p_order_id: order.id, p_payment_id: payment_id });
  if (error) throw error;
  return json({ status: data === 'already_paid' ? 'paid' : data }, 200, cors);
}));
