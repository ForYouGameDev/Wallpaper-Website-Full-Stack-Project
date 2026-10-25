import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listCategories, listWallpapers, type Access, type Sort } from '../lib/api';
import type { Category, Wallpaper } from '../lib/types';
import { WallpaperGrid } from '../components/WallpaperCard';
import { Empty, ErrorBox, GridSkeleton } from '../components/States';
import { Seo } from '../components/Seo';

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const access = (params.get('access') ?? 'all') as Access;
  const sort = (params.get('sort') ?? 'new') as Sort;

  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => { listCategories().then(setCats).catch(() => {}); }, []);

  const fetchPage = useCallback(async (p: number, reset: boolean) => {
    const id = ++reqId.current;
    setLoading(true); setErr(null);
    try {
      const r = await listWallpapers({ q, category: category || undefined, access, sort, page: p });
      if (id !== reqId.current) return;           // a newer request superseded this one
      setItems((prev) => (reset ? r.rows : [...prev, ...r.rows]));
      setHasMore(r.hasMore); setPage(p);
    } catch {
      if (id === reqId.current) setErr('We could not load wallpapers. Please try again.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, category, access, sort]);

  useEffect(() => { void fetchPage(0, true); }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void fetchPage(page + 1, false); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v && v !== 'all' && !(k === 'sort' && v === 'new')) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6">
      <Seo title={q ? `Search: ${q}` : 'Explore wallpapers'} path="/explore" />
      <h1 className="text-3xl font-extrabold">{q ? `Results for “${q}”` : 'Explore wallpapers'}</h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className={`chip ${!category ? 'chip-on' : ''}`} onClick={() => set('category', '')}>All</button>
        {cats.map((c) => <button key={c.id} className={`chip ${category === c.slug ? 'chip-on' : ''}`} onClick={() => set('category', c.slug)}>{c.name}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="group" aria-label="Price filter">
          {(['all', 'free', 'premium'] as const).map((a) => <button key={a} className={`chip ${access === a ? 'chip-on' : ''}`} aria-pressed={access === a} onClick={() => set('access', a)}>{a === 'all' ? 'Any price' : a === 'free' ? 'Free' : 'Premium'}</button>)}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">Sort
          <select className="input !w-auto" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="new">Newest</option><option value="popular">Most popular</option>
            <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className="mt-6">
        {items.length > 0 && <WallpaperGrid items={items} />}
        {loading && <div className={items.length ? 'mt-3' : ''}><GridSkeleton count={items.length ? 6 : 12} /></div>}
        {err && <ErrorBox message={err} onRetry={() => void fetchPage(page + (items.length ? 1 : 0), items.length === 0)} />}
        {!loading && !err && items.length === 0 && <Empty title="Nothing matches those filters">Try a different category or clear the search.</Empty>}
        <div ref={sentinel} className="h-10" />
      </div>
    </main>
  );
}
