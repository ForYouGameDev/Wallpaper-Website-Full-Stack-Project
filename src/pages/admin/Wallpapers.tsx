import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { listCategories, WP_COLS } from '../../lib/api';
import type { Category, Wallpaper } from '../../lib/types';
import { formatPrice } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { ErrorBox, Spinner } from '../../components/States';
import { parseTags } from './Upload';

export default function Wallpapers() {
  const toast = useToast();
  const [rows, setRows] = useState<Wallpaper[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState('');
  const [edit, setEdit] = useState<Wallpaper | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('wallpapers').select(WP_COLS).order('created_at', { ascending: false }).limit(500);
    if (error) setErr(true); else setRows(data as unknown as Wallpaper[]);
  }, []);
  useEffect(() => { void load(); listCategories().then(setCats).catch(() => {}); }, [load]);

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from('wallpapers').update(patch).eq('id', id);
    if (error) toast(`Could not update: ${error.message}`, 'error'); else { toast('Updated.'); void load(); }
  }

  async function remove(w: Wallpaper) {
    if (!window.confirm(`Delete “${w.title}” permanently, including its image files?`)) return;
    const { data: f } = await supabase.from('wallpaper_files').select('original_path').eq('wallpaper_id', w.id).maybeSingle();
    const { error } = await supabase.from('wallpapers').delete().eq('id', w.id);
    if (error) return toast(error.code === '23503' ? 'This wallpaper has orders, so it cannot be deleted. Unpublish it instead.' : error.message, 'error');
    if (f?.original_path) await supabase.storage.from('originals').remove([f.original_path]);
    const prev = [w.thumb_path, w.preview_path, w.watermark_path].filter(Boolean) as string[];
    if (prev.length) await supabase.storage.from('previews').remove(prev);
    toast('Deleted.'); void load();
  }

  if (err) return <ErrorBox message="Could not load wallpapers." />;
  if (!rows) return <Spinner />;
  const shown = rows.filter((w) => w.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="flex gap-3"><input className="input max-w-xs" placeholder="Filter by title" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by title" /><Link to="/admin/upload" className="btn-primary ml-auto">Upload</Link></div>
      <div className="card mt-4 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr><th className="th">Title</th><th className="th">Price</th><th className="th">Status</th><th className="th">Featured</th><th className="th">Views / downloads</th><th className="th" /></tr></thead>
        <tbody>{shown.map((w) => (
          <tr key={w.id} className="border-t border-line">
            <td className="td"><Link className="font-medium hover:text-accent" to={`/w/${w.slug}`}>{w.title}</Link></td>
            <td className="td">{w.is_premium ? formatPrice(w.price_minor, w.currency) : 'Free'}</td>
            <td className="td"><button className="chip" onClick={() => update(w.id, { status: w.status === 'published' ? 'draft' : 'published' })}>{w.status === 'published' ? 'Published — unpublish' : 'Draft — publish'}</button></td>
            <td className="td"><input type="checkbox" checked={w.featured} aria-label={`Feature ${w.title}`} onChange={(e) => update(w.id, { featured: e.target.checked })} /></td>
            <td className="td text-muted">{w.view_count} / {w.download_count}</td>
            <td className="td whitespace-nowrap text-right"><button className="btn-ghost !px-3 !py-1.5" onClick={() => setEdit(w)}>Edit</button> <button className="btn-danger !px-3 !py-1.5" onClick={() => remove(w)}>Delete</button></td>
          </tr>))}
          {shown.length === 0 && <tr><td className="td text-muted" colSpan={6}>No wallpapers found.</td></tr>}
        </tbody></table></div>
      {edit && <EditModal w={edit} cats={cats} onClose={() => setEdit(null)} onSave={async (p) => { await update(edit.id, p); setEdit(null); }} />}
    </div>
  );
}

function EditModal({ w, cats, onClose, onSave }: { w: Wallpaper; cats: Category[]; onClose: () => void; onSave: (p: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(w.title);
  const [description, setDescription] = useState(w.description ?? '');
  const [categoryId, setCategoryId] = useState(w.category_id ?? '');
  const [tags, setTags] = useState(w.tags.join(', '));
  const [premium, setPremium] = useState(w.is_premium);
  const [price, setPrice] = useState(String(w.price_minor / 100));
  const [freeLogin, setFreeLogin] = useState(w.free_requires_login);
  return (
    <div role="dialog" aria-modal="true" aria-label="Edit wallpaper" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto p-5">
        <h2 className="text-lg font-bold">Edit wallpaper</h2>
        <label className="block text-sm">Title<input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Description<textarea className="input mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="block text-sm">Category<select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">Tags<input className="input mt-1" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} /> Premium</label>
        {premium ? <label className="block text-sm">Price (₹)<input className="input mt-1" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={freeLogin} onChange={(e) => setFreeLogin(e.target.checked)} /> Require sign-in to download</label>}
        <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => void onSave({ title: title.trim(), description: description.trim() || null, category_id: categoryId || null, tags: parseTags(tags), is_premium: premium, price_minor: premium ? Math.round(parseFloat(price) * 100) : 0, free_requires_login: freeLogin })}>Save changes</button></div>
      </div>
    </div>
  );
}
