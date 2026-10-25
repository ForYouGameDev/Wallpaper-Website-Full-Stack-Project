import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCollection } from '../lib/api';
import type { Collection } from '../lib/types';
import { WallpaperGrid } from '../components/WallpaperCard';
import { Empty, Spinner } from '../components/States';
import { Seo } from '../components/Seo';

export default function CollectionPage() {
  const { slug = '' } = useParams();
  const [c, setC] = useState<Collection | null | undefined>(undefined);
  useEffect(() => { getCollection(slug).then(setC).catch(() => setC(null)); }, [slug]);
  if (c === undefined) return <Spinner />;
  if (!c) return <Empty title="Collection not found"><Link to="/explore" className="text-accent">Browse all wallpapers</Link></Empty>;
  return (
    <main className="mx-auto max-w-7xl px-4 pt-6">
      <Seo title={c.title} description={c.description ?? undefined} path={`/collections/${c.slug}`} />
      <h1 className="text-4xl font-extrabold">{c.title}</h1>
      {c.description && <p className="mt-2 max-w-prose text-muted">{c.description}</p>}
      <div className="mt-6">{c.items?.length ? <WallpaperGrid items={c.items} /> : <Empty title="This collection is empty" />}</div>
    </main>
  );
}
