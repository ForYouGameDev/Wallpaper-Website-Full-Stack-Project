import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Wallpaper } from '../lib/types';
import { previewUrl } from '../lib/supabase';
import { formatPrice, gradientFor } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { HeartIcon, LockIcon } from './Icons';

export function WallpaperCard({ w }: { w: Wallpaper }) {
  const { user } = useAuth();
  const { favorites, purchased, toggleFavorite } = useLibrary();
  const nav = useNavigate();
  const [broken, setBroken] = useState(false);
  const src = previewUrl(w.thumb_path ?? w.preview_path);
  const fav = favorites.has(w.id);
  const owned = purchased.has(w.id);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface">
      <Link to={`/w/${w.slug}`} className="block" aria-label={`${w.title} — ${w.is_premium ? (owned ? 'owned' : formatPrice(w.price_minor, w.currency)) : 'free'}`}>
        <div className="aspect-[9/16] w-full" style={{ background: gradientFor(w.id) }}>
          {src && !broken && (
            <img src={src} alt={w.title} loading="lazy" decoding="async" onError={() => setBroken(true)}
                 className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <span className="truncate text-sm font-medium">{w.title}</span>
          {w.is_premium && !owned
            ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sorbet px-2 py-0.5 text-xs font-semibold text-white"><LockIcon width={12} height={12} />{formatPrice(w.price_minor, w.currency)}</span>
            : <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{owned ? 'Owned' : 'Free'}</span>}
        </div>
      </Link>
      <button
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={fav}
        onClick={async () => { if (!(await toggleFavorite(w.id))) nav('/login', { state: { from: `/w/${w.slug}` } }); }}
        className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur ${fav ? 'text-sorbet' : 'text-white'}`}
      >
        <HeartIcon filled={fav} />
      </button>
    </div>
  );
}

export function WallpaperGrid({ items }: { items: Wallpaper[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((w) => <WallpaperCard key={w.id} w={w} />)}
    </div>
  );
}
