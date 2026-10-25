import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isConfigured, SITE_NAME } from '../lib/supabase';
import { Seo } from '../components/Seo';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from ?? '/';

  // After the Google redirect lands back on the site, send people where they were headed.
  useEffect(() => {
    if (!user) return;
    let dest: string | null = null;
    try { dest = sessionStorage.getItem('returnTo'); sessionStorage.removeItem('returnTo'); } catch { /* ignore */ }
    if (dest) nav(dest, { replace: true });
  }, [user, nav]);

  if (!loading && user) return <Navigate to={from} replace />;

  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      <Seo title="Sign in" path="/login" />
      <h1 className="text-3xl font-extrabold">Sign in to {SITE_NAME}</h1>
      <p className="mt-2 text-sm text-muted">Save favorites across devices, download free wallpapers and keep your purchases in one place.</p>
      {!isConfigured && <p role="alert" className="mt-4 rounded-xl border border-sorbet p-3 text-sm">Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.</p>}
      <button className="btn-primary mt-6 w-full" disabled={busy || !isConfigured}
        onClick={async () => { setBusy(true); try { await signInWithGoogle(from); } catch { toast('Google sign-in failed. Please try again.', 'error'); setBusy(false); } }}>
        {busy ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>
    </main>
  );
}
