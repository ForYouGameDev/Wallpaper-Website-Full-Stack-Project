import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SITE_NAME } from '../lib/supabase';
import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from './Icons';

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const search = (e: FormEvent) => { e.preventDefault(); nav(`/explore?q=${encodeURIComponent(q.trim())}`); setOpen(false); };
  const link = ({ isActive }: { isActive: boolean }) => `text-sm font-medium ${isActive ? 'text-accent' : 'text-muted hover:text-ink'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight">{SITE_NAME}</Link>
        <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
          <NavLink to="/explore" className={link}>Explore</NavLink>
          <NavLink to="/explore?access=free" className={link}>Free</NavLink>
          <NavLink to="/explore?access=premium" className={link}>Premium</NavLink>
        </nav>
        <form onSubmit={search} role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label className="relative block">
            <span className="sr-only">Search wallpapers</span>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
            <input className="input pl-9" placeholder="Search wallpapers" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </form>
        <button className="btn-ghost !p-2.5" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <SunIcon /> : <MoonIcon />}</button>
        {user ? (
          <div className="relative hidden md:block">
            <button className="flex items-center gap-2" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
                : <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white">{(profile?.full_name ?? user.email ?? '?')[0].toUpperCase()}</span>}
            </button>
            {open && (
              <div className="card absolute right-0 mt-2 w-48 p-1 text-sm shadow-xl" onClick={() => setOpen(false)}>
                <Link className="block rounded-lg px-3 py-2 hover:bg-bg" to="/favorites">Favorites</Link>
                <Link className="block rounded-lg px-3 py-2 hover:bg-bg" to="/profile">Profile</Link>
                {isAdmin && <Link className="block rounded-lg px-3 py-2 hover:bg-bg" to="/admin">Admin</Link>}
                <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-bg" onClick={() => void signOut()}>Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn-primary hidden md:inline-flex">Sign in</Link>
        )}
        <button className="btn-ghost !p-2.5 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}><MenuIcon /></button>
      </div>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3 md:hidden">
          <form onSubmit={search} role="search" className="mb-3"><input className="input" placeholder="Search wallpapers" aria-label="Search wallpapers" value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <div className="flex flex-col gap-3 text-sm font-medium" onClick={() => setOpen(false)}>
            <Link to="/explore">Explore</Link>
            <Link to="/explore?access=free">Free</Link>
            <Link to="/explore?access=premium">Premium</Link>
            {user ? (<>
              <Link to="/favorites">Favorites</Link><Link to="/profile">Profile</Link>
              {isAdmin && <Link to="/admin">Admin</Link>}
              <button className="text-left" onClick={() => void signOut()}>Sign out</button>
            </>) : <Link to="/login" className="btn-primary">Sign in</Link>}
          </div>
        </div>
      )}
    </header>
  );
}
