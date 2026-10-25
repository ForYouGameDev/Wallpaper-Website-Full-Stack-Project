import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFavorites } from '../lib/api';
import type { Wallpaper } from '../lib/types';
import { useLibrary } from '../context/LibraryContext';
import { WallpaperGrid } from '../components/WallpaperCard';
import { Empty, ErrorBox, GridSkeleton } from '../components/States';
import { Seo } from '../components/Seo';

export default function Favorites() {
  const { favorites } = useLibrary();
  const [items, setItems] = useState<Wallpaper[] | null>(null);
  const [err, setErr] = useState(false);
  // Re-fetch when the set of favorite ids changes (e.g. after un-favoriting from this page).
  useEffect(() => { listFavorites().then(setItems).catch(() => setErr(true)); }, [favorites.size]);
  return (
    <main className="mx-auto max-w-7xl px-4 pt-6">
      <Seo title="Your favorites" path="/favorites" />
      <h1 className="text-3xl font-extrabold">Your favorites</h1>
      <div className="mt-6">
        {err ? <ErrorBox message="We could not load your favorites." /> : !items ? <GridSkeleton count={6} /> :
          items.length ? <WallpaperGrid items={items} /> :
          <Empty title="No favorites yet">Tap the heart on any wallpaper to save it here. <Link to="/explore" className="text-accent">Explore wallpapers</Link></Empty>}
      </div>
    </main>
  );
}
