import { createClient } from 'npm:@supabase/supabase-js@2';

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
  const origin = req.headers.get('Origin') ?? '';
  const allow = allowed === '*' ? '*' : origin === allowed ? origin : allowed;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

/** Service-role client. Server-side ONLY. Bypasses RLS. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verify the caller's JWT with Supabase Auth. Returns null for anonymous / invalid tokens. */
export async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handler(fn: (req: Request, cors: Record<string, string>) => Promise<Response>) {
  return async (req: Request) => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      return await fn(req, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      console.error(e);
      return json({ error: 'Something went wrong. Please try again.' }, 500, cors);
    }
  };
}
