// Web Crypto helpers — work in Deno and in Node 20 (Vitest).

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (length leak only). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Razorpay checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function razorpayCheckoutSignature(orderId: string, paymentId: string, keySecret: string) {
  return hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
}
