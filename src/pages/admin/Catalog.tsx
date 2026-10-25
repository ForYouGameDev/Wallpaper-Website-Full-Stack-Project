import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Category, Collection, Wallpaper } from '../../lib/types';
import { slugify } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { Spinner } from '../../components/States';

export default function Catalog() {
  const toast = useToast();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [wps, setWps] = useState<Pick<Wallpaper, 'id' | 'title'>[]>([]);
  const [catName, setCatName] = useState('');
  const [colTitle, setColTitle] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [c, k, w] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('collections').select('*').order('sort_order'),
      supabase.from('wallpapers').select('id,title').order('title').limit(1000),
    ]);
    setCats((c.data ?? []) as Category[]); setCols((k.data ?? []) as Collection[]); setWps((w.data ?? []) as Pick<Wallpaper, 'id' | 'title'>[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p; if (error) toast(error.message, 'error'); else { toast(ok); void load(); }
  };

  async function openCollection(c: Collection) {
    const { data } = await supabase.from('collection_items').select('wallpaper_id').eq('collection_id', c.id);
    setMembers(new Set((data ?? []).map((r) => r.wallpaper_id as string))); setEditing(c);
  }
  async function saveMembers() {
    if (!editing) return;
    const { error: e1 } = await supabase.from('collection_items').delete().eq('collection_id', editing.id);
    if (e1) return toast(e1.message, 'error');
    const rows = [...members].map((wallpaper_id, position) => ({ collection_id: editing.id, wallpaper_id, position }));
    if (rows.length) { const { error } = await supabase.from('collection_items').insert(rows); if (error) return toast(error.message, 'error'); }
    toast('Collection saved.'); setEditing(null);
  }

  if (!cats) return <Spinner />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="text-lg font-bold">Categories</h2>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!catName.trim()) return; void run(supabase.from('categories').insert({ name: catName.trim(), slug: slugify(catName), sort_order: cats.length + 1 }), 'Category added.'); setCatName(''); }}>
          <input className="input" placeholder="New category" value={catName} onChange={(e) => setCatName(e.target.value)} /><button className="btn-primary">Add</button></form>
        <ul className="mt-3 divide-y divide-line text-sm">{cats.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2"><span>{c.name} <span className="text-muted">/{c.slug}</span></span>
            <button className="btn-danger !px-3 !py-1" onClick={() => window.confirm(`Delete category “${c.name}”? Wallpapers keep existing but become uncategorised.`) && void run(supabase.from('categories').delete().eq('id', c.id), 'Category deleted.')}>Delete</button></li>))}</ul>
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-bold">Homepage collections</h2>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!colTitle.trim()) return; void run(supabase.from('collections').insert({ title: colTitle.trim(), slug: `${slugify(colTitle)}-${Math.random().toString(36).slice(2, 6)}`, sort_order: cols.length + 1 }), 'Collection created (unpublished).'); setColTitle(''); }}>
          <input className="input" placeholder="New collection title" value={colTitle} onChange={(e) => setColTitle(e.target.value)} /><button className="btn-primary">Create</button></form>
        <ul className="mt-3 divide-y divide-line text-sm">{cols.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2"><span className="mr-auto font-medium">{c.title}</span>
            <label className="flex items-center gap-1"><input type="checkbox" checked={c.is_published} onChange={(e) => void run(supabase.from('collections').update({ is_published: e.target.checked }).eq('id', c.id), 'Updated.')} />Published</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={c.is_featured} onChange={(e) => void run(supabase.from('collections').update({ is_featured: e.target.checked }).eq('id', c.id), 'Updated.')} />On homepage</label>
            <button className="btn-ghost !px-3 !py-1" onClick={() => void openCollection(c)}>Wallpapers</button>
            <button className="btn-danger !px-3 !py-1" onClick={() => window.confirm(`Delete collection “${c.title}”?`) && void run(supabase.from('collections').delete().eq('id', c.id), 'Collection deleted.')}>Delete</button></li>))}</ul>
      </section>

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Collection wallpapers" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="card flex max-h-[85vh] w-full max-w-md flex-col p-5">
            <h2 className="text-lg font-bold">{editing.title}</h2>
            <div className="my-3 flex-1 space-y-1 overflow-y-auto text-sm">{wps.map((w) => (
              <label key={w.id} className="flex items-center gap-2"><input type="checkbox" checked={members.has(w.id)} onChange={(e) => setMembers((s) => { const n = new Set(s); if (e.target.checked) n.add(w.id); else n.delete(w.id); return n; })} />{w.title}</label>))}</div>
            <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={() => void saveMembers()}>Save</button></div>
          </div>
        </div>)}
    </div>
  );
}
