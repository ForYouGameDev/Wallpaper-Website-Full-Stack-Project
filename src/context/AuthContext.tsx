import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** UI hint only. Real authorization is enforced by RLS and Edge Functions. */
  isAdmin: boolean;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    // Keep this callback synchronous — no awaited Supabase calls inside it.
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const refreshProfile = useCallback(async () => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, [uid]);
  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  const signInWithGoogle = useCallback(async (returnTo?: string) => {
    if (returnTo) { try { sessionStorage.setItem('returnTo', returnTo); } catch { /* ignore */ } }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Must be listed under Authentication → URL Configuration → Redirect URLs in Supabase.
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); setProfile(null); }, []);

  const value = useMemo<Ctx>(() => ({
    user: session?.user ?? null, session, profile, loading,
    isAdmin: profile?.role === 'admin', signInWithGoogle, signOut, refreshProfile,
  }), [session, profile, loading, signInWithGoogle, signOut, refreshProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
