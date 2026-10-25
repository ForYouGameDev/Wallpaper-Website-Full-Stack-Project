import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);
export const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'Frameshift';
export const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'support@example.com';

// Only the public anon key is used here. Authorization is enforced by RLS and Edge Functions.
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'missing-anon-key', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Public URL of an object in the public `previews` bucket. */
export function previewUrl(path?: string | null): string | null {
  return path && url ? `${url}/storage/v1/object/public/previews/${path}` : null;
}

/** Call an Edge Function and surface the server's error message. */
export async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch { /* keep default message */ }
    throw new Error(msg);
  }
  return data as T;
}
