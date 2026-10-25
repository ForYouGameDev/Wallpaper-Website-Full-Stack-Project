import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Empty, Spinner } from './States';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  return <Outlet />;
}

// UI gate only. Every admin read/write is independently enforced by RLS / storage policies / Edge Functions,
// so bypassing this component in dev tools gives an attacker nothing.
export function RequireAdmin() {
  const { user, profile, loading, isAdmin } = useAuth();
  const loc = useLocation();
  if (loading || (user && !profile)) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!isAdmin) return <Empty title="Admins only">This area is restricted to the site owner.</Empty>;
  return <Outlet />;
}
