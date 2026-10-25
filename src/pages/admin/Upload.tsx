import { useEffect, useState } from 'react';
import { supabase, SITE_NAME } from '../../lib/supabase';
import { listCategories } from '../../lib/api';
import type { Category } from '../../lib/types';
import { extOf, processImage } from '../../lib/image';
import { formatBytes, gcdRatio, slugify } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

type Item = { file: File; title: string; state: 'queued' | 'working' | 'done' | 'error'; msg?: string };
export const parseTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 15);

export default function Upload() {
  const toast = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState('99');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [freeLogin, setFreeLogin] = useState(true);
  const [mark, setMark] = useState(SITE_NAME);
  const [running, setRunning] = useState(false);

  useEffect(() => { listCategories().then(setCats).catch(() => {}); }, []);
  const patch = (i: number, p: Partial<Item>) => setItems((a) => a.map((x, k) => (k === i ? { ...x, ...p } : x)));

  function pick(files: FileList | null) {
    if (!files) return;
    setItems([...files].map((f) => ({ file: f, title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), state: 'queued' })));
  }

  async function uploadOne(i: number, it: Item) {
    const minor = premium ? Math.round(parseFloat(price) * 100) : 0;
    if (premium && !(minor > 0)) throw new Error('Enter a price above 0 for premium wallpapers.');
    if (it.file.size > 50 * 1024 * 1024) throw new Error('File is larger than the 50 MB storage limit.');
    patch(i, { state: 'working', msg: 'Processing image…' });
    const p = await processImage(it.file, mark || SITE_NAME);

    const id = crypto.randomUUID();
    const orig = `${id}/original.${extOf(it.file)}`;
    const thumb = `${id}/thumb.webp`, prev = `${id}/preview.webp`, wm = `${id}/watermark.webp`;
    const cleanup = async () => {
      await supabase.storage.from('originals').remove([orig]);
      await supabase.storage.from('previews').remove([thumb, prev, wm]);
    };
    try {
      patch(i, { msg: 'Uploading original (private)…' });
      let r = await supabase.storage.from('originals').upload(orig, it.file, { contentType: it.file.type, upsert: false });
      if (r.error) throw r.error;
      patch(i, { msg: 'Uploading previews…' });
      for (const [path, blob] of [[thumb, p.thumb], [prev, p.preview], [wm, p.watermark]] as const) {
        r = await supabase.storage.from('previews').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
        if (r.error) throw r.error;
      }
      const { error: e1 } = await supabase.from('wallpapers').insert({
        id, slug: `${slugify(it.title)}-${id.slice(0, 6)}`, title: it.title.trim() || 'Untitled', description: description.trim() || null,
        category_id: categoryId || null, tags: parseTags(tags), width: p.width, height: p.height, aspect_ratio: gcdRatio(p.width, p.height),
        is_premium: premium, price_minor: minor, status, free_requires_login: freeLogin,
        thumb_path: thumb, preview_path: prev, watermark_path: wm,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('wallpaper_files').insert({ wallpaper_id: id, original_path: orig, original_bytes: it.file.size, mime_type: it.file.type });
      if (e2) { await supabase.from('wallpapers').delete().eq('id', id); throw e2; }
    } catch (e) { await cleanup(); throw e; }
  }

  async function run() {
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'done') continue;
      try { await uploadOne(i, items[i]); patch(i, { state: 'done', msg: 'Uploaded' }); }
      catch (e) { patch(i, { state: 'error', msg: (e as { message?: string }).message ?? 'Upload failed' }); }
    }
    setRunning(false);
    toast('Upload finished. Check the list for any errors.');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Settings for this batch</h2>
        <label className="block text-sm">Category<select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">Tags (comma separated)<input className="input mt-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="neon, city, night" /></label>
        <label className="block text-sm">Description<textarea className="input mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} /> Premium (paid)</label>
        {premium
          ? <label className="block text-sm">Price (₹)<input className="input mt-1" type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={freeLogin} onChange={(e) => setFreeLogin(e.target.checked)} /> Require sign-in to download</label>}
        <label className="block text-sm">Status<select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></label>
        <label className="block text-sm">Watermark text<input className="input mt-1" value={mark} onChange={(e) => setMark(e.target.value)} maxLength={30} /></label>
      </section>

      <section>
        <label className="card grid cursor-pointer place-items-center border-dashed p-8 text-center text-sm text-muted">
          <span className="font-semibold text-ink">Choose one or more images</span>JPEG, PNG or WebP · up to 50 MB each · uploaded once, previews are generated automatically
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
        </label>
        <ul className="mt-4 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <input className="input max-w-xs" value={it.title} disabled={running || it.state === 'done'} onChange={(e) => patch(i, { title: e.target.value })} aria-label="Title" />
              <span className="text-muted">{formatBytes(it.file.size)}</span>
              <span className={it.state === 'error' ? 'text-sorbet' : it.state === 'done' ? 'text-accent' : 'text-muted'}>{it.msg ?? it.state}</span>
            </li>
          ))}
        </ul>
        {items.length > 0 && <button className="btn-primary mt-4" disabled={running} onClick={run}>{running ? 'Uploading…' : `Upload ${items.length} wallpaper${items.length > 1 ? 's' : ''}`}</button>}
      </section>
    </div>
  );
}
