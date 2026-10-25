import { adminClient, getUser, handler, HttpError, json } from '../_shared/http.ts';
import { priceCart } from '../_shared/pricing.ts';

// Returns an authoritative price quote for a cart (+ optional coupon). Does not create anything.
Deno.serve(handler(async (req, cors) => {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const { wallpaper_ids, coupon_code } = await req.json();
  const quote = await priceCart(adminClient(), user.id, wallpaper_ids, coupon_code);
  if (!quote.ok) throw new HttpError(400, quote.error);
  return json(quote, 200, cors);
}));
