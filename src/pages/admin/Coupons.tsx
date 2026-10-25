import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Coupon } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export default function Coupons() {
  const toast = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [f, setF] = useState({ code: '', type: 'percent', value: '10', min: '0', max: '', perUser: '1', expires: '', isPublic: false });
  const load = useCallback(async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as Coupon[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    const value = f.type === 'percent' ? parseInt(f.value, 10) : Math.round(parseFloat(f.value) * 100);
    if (!/^[A-Z0-9_-]{3,20}$/.test(f.code)) return toast('Code must be 3–20 letters, numbers, - or _.', 'error');
    if (!(value > 0) || (f.type === 'percent' && value > 100)) return toast('Enter a valid discount value.', 'error');
    const { error } = await supabase.from('coupons').insert({
      code: f.code, discount_type: f.type, value, min_order_minor: Math.round(parseFloat(f.min || '0') * 100),
      max_uses: f.max ? parseInt(f.max, 10) : null, per_user_limit: parseInt(f.perUser || '1', 10),
      expires_at: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null, is_public: f.isPublic,
    });
    if (error) toast(error.code === '23505' ? 'That code already exists.' : error.message, 'error');
    else { toast('Coupon created.'); setF({ ...f, code: '' }); void load(); }
  }
  async function patch(id: string, p: Partial<Coupon>) {
    const { error } = await supabase.from('coupons').update(p).eq('id', id);
    if (error) toast(error.message, 'error'); else void load();
  }
  async function remove(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from('coupons').delete().eq('id', c.id);
    if (error) toast(error.code === '23503' ? 'This coupon was used in orders. Deactivate it instead.' : error.message, 'error'); else void load();
  }

  return (
    <div>
      <section className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Code<input className="input mt-1 font-mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" /></label>
        <label className="text-sm">Type<select className="input mt-1" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label>
        <label className="text-sm">{f.type === 'percent' ? 'Percent off' : 'Amount off (₹)'}<input className="input mt-1" type="number" min="1" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
        <label className="text-sm">Minimum order (₹)<input className="input mt-1" type="number" min="0" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></label>
        <label className="text-sm">Total usage limit<input className="input mt-1" type="number" min="1" placeholder="Unlimited" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label>
        <label className="text-sm">Uses per user<input className="input mt-1" type="number" min="1" value={f.perUser} onChange={(e) => setF({ ...f, perUser: e.target.value })} /></label>
        <label className="text-sm">Expires on<input className="input mt-1" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />Show in users’ offers</label>
        <div className="sm:col-span-2 lg:col-span-4"><button className="btn-primary" onClick={() => void create()}>Create coupon</button></div>
      </section>

      <div className="card mt-6 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr><th className="th">Code</th><th className="th">Discount</th><th className="th">Min order</th><th className="th">Used</th><th className="th">Expires</th><th className="th">Active</th><th className="th" /></tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.id} className="border-t border-line">
            <td className="td font-mono font-bold">{c.code}{c.is_public && <span className="ml-2 text-xs text-accent">public</span>}{c.is_sample && <span className="ml-2 text-xs text-muted">sample</span>}</td>
            <td className="td">{c.discount_type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</td>
            <td className="td">{c.min_order_minor ? formatPrice(c.min_order_minor) : '—'}</td>
            <td className="td">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
            <td className="td">{formatDate(c.expires_at)}</td>
            <td className="td"><input type="checkbox" checked={c.is_active} aria-label={`${c.code} active`} onChange={(e) => void patch(c.id, { is_active: e.target.checked })} /></td>
            <td className="td text-right"><button className="btn-danger !px-3 !py-1" onClick={() => void remove(c)}>Delete</button></td>
          </tr>))}
          {rows.length === 0 && <tr><td className="td text-muted" colSpan={7}>No coupons yet.</td></tr>}</tbody></table></div>
    </div>
  );
}
