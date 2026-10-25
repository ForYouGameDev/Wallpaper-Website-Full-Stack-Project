import { adminClient } from '../_shared/http.ts';
import { getProvider } from '../_shared/provider.ts';

// Provider -> server webhook. No user JWT. Authenticity = HMAC signature over the RAW body.
// Idempotent: payment_events has UNIQUE(provider, event_id), and fulfill_order() is itself idempotent.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  try {
    const provider = getProvider();
    const evt = await provider.parseWebhook(raw, req.headers);
    if (!evt) return new Response('invalid signature', { status: 400 });

    const db = adminClient();
    if (evt.event_id) {
      const { error } = await db.from('payment_events').insert({ provider: provider.name, event_id: evt.event_id, event_type: evt.kind, payload: JSON.parse(raw) });
      if (error?.code === '23505') return new Response('duplicate', { status: 200 });   // already processed
      if (error) throw error;
    }
    if (evt.kind === 'ignored') return new Response('ok', { status: 200 });

    const { data: order } = await db.from('orders').select('id,status').eq('provider_order_id', evt.provider_order_id).maybeSingle();
    if (!order) return new Response('unknown order', { status: 200 });   // 200 so the provider stops retrying

    if (evt.kind === 'paid') {
      const { error } = await db.rpc('fulfill_order', { p_order_id: order.id, p_payment_id: evt.payment_id || null });
      if (error) throw error;
    } else if (evt.kind === 'failed') {
      await db.from('orders').update({ status: 'failed' }).eq('id', order.id).eq('status', 'created');
    } else if (evt.kind === 'refunded') {
      const { error } = await db.rpc('refund_order', { p_order_id: order.id });
      if (error) throw error;
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('webhook error', e);
    return new Response('error', { status: 500 });   // provider will retry
  }
});
