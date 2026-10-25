import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCategories, listCollections, listWallpapers } from '../lib/api';
import type { Category, Collection, Wallpaper } from '../lib/types';
import { previewUrl, SITE_NAME } from '../lib/supabase';
import { gradientFor } from '../lib/format';
import { WallpaperGrid } from '../components/WallpaperCard';
import { ErrorBox, GridSkeleton } from '../components/States';
import { Seo } from '../components/Seo';

function Frame({ w, className, idx }: { w?: Wallpaper; className: string; idx: number }) {
  const src = previewUrl(w?.preview_path);
  return (
    <div className={`absolute left-1/2 top-0 aspect-[9/19] w-[44%] -translate-x-1/2 overflow-hidden rounded-[2rem] border-[6px] border-ink shadow-2xl ${className}`}
         style={{ background: gradientFor(w?.id ?? `frame-${idx}`) }}>
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

function Section({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold">{title}</h2>
        {to && <Link to={to} className="text-sm font-medium text-accent">See all</Link>}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const [state, setState] = useState<{ cats: Category[]; trending: Wallpaper[]; fresh: Wallpaper[]; free: Wallpaper[]; premium: Wallpaper[]; featured: Wallpaper[]; cols: Collection[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    Promise.all([
      listCategories(),
      listWallpapers({ sort: 'popular', limit: 6 }),
      listWallpapers({ sort: 'new', limit: 6 }),
      listWallpapers({ access: 'free', limit: 6 }),
      listWallpapers({ access: 'premium', limit: 6 }),
      listWallpapers({ featured: true, limit: 3 }),
      listCollections(true),
    ]).then(([cats, t, n, f, p, ft, cols]) => setState({ cats, trending: t.rows, fresh: n.rows, free: f.rows, premium: p.rows, featured: ft.rows, cols }))
      .catch(() => setErr('We could not load wallpapers. Check your connection and try again.'));
  };
  useEffect(load, []);

  const hero = state?.featured ?? [];
  return (
    <main className="mx-auto max-w-7xl px-4">
      <Seo path="/" />
      <section className="grid items-center gap-8 pt-8 md:grid-cols-2 md:pt-14">
        <div>
          <h1 className="text-5xl font-extrabold leading-[1.02] sm:text-6xl">Make every unlock a little nicer.</h1>
          <p className="mt-5 max-w-md text-lg text-muted">Phone and desktop wallpapers from independent artists. Download the free ones right away, or buy a premium original in full resolution.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/explore" className="btn-primary">Browse wallpapers</Link>
            <Link to="/explore?access=free" className="btn-ghost">Start with free</Link>
          </div>
        </div>
        <div className="relative mx-auto h-[26rem] w-full max-w-md" aria-hidden="true">
          <Frame w={hero[1]} idx={1} className="fan-left" />
          <Frame w={hero[2]} idx={2} className="fan-right" />
          <Frame w={hero[0]} idx={0} className="z-10" />
        </div>
      </section>

      {err && <ErrorBox message={err} onRetry={load} />}
      {!state && !err && <div className="mt-12"><GridSkeleton count={6} /></div>}

      {state && (
        <>
          <div className="mt-10 flex flex-wrap gap-2" role="list" aria-label="Categories">
            {state.cats.map((c) => <Link key={c.id} role="listitem" to={`/explore?category=${c.slug}`} className="chip">{c.name}</Link>)}
          </div>

          {state.trending.length > 0 && <Section title="Trending" to="/explore?sort=popular"><WallpaperGrid items={state.trending} /></Section>}
          {state.fresh.length > 0 && <Section title="New arrivals" to="/explore"><WallpaperGrid items={state.fresh} /></Section>}

          {state.cols.length > 0 && (
            <Section title="Featured collections">
              <div className="grid gap-4 md:grid-cols-2">
                {state.cols.map((c) => (
                  <Link key={c.id} to={`/collections/${c.slug}`} className="card group flex gap-3 p-3">
                    <div className="grid w-40 shrink-0 grid-cols-3 gap-1.5">
                      {(c.items ?? []).slice(0, 3).map((w) => (
                        <div key={w.id} className="aspect-[9/16] overflow-hidden rounded-lg" style={{ background: gradientFor(w.id) }}>
                          {previewUrl(w.thumb_path) && <img src={previewUrl(w.thumb_path)!} alt="" loading="lazy" className="h-full w-full object-cover" />}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 self-center">
                      <h3 className="text-lg font-bold group-hover:text-accent">{c.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {state.free.length > 0 && <Section title="Free to download" to="/explore?access=free"><WallpaperGrid items={state.free} /></Section>}
          {state.premium.length > 0 && <Section title={`Premium on ${SITE_NAME}`} to="/explore?access=premium"><WallpaperGrid items={state.premium} /></Section>}

          {state.trending.length + state.fresh.length === 0 && (
            <div className="card my-10 p-8 text-center"><h2 className="text-xl font-semibold">No wallpapers yet</h2><p className="mt-2 text-sm text-muted">Sign in as the owner and upload the first wallpapers from /admin, or run supabase/seed.sql for sample data.</p></div>
          )}
        </>
      )}
    </main>
  );
}
