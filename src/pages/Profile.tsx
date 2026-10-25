import { useEffect, useState } from 'react';
import { listDownloadHistory, listMyOrders, listPublicOffers, listPurchases } from '../lib/api';
import type { Coupon, Wallpaper } from '../lib/types';
import { supabase } from '../lib/supabase';
import { formatDate, formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { WallpaperGrid } from '../components/WallpaperCard';
import { Seo } from '../components/Seo';

type Hist = Awaited<ReturnType<typeof listDownloadHistory>>;
type Ord = Awaited<ReturnType<typeof listMyOrders>>;

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [purchases, setPurchases] = useState<Wallpaper[] | null>(null);
  const [hist, setHist] = useState<Hist | null>(null);
  const [orders, setOrders] = useState<Ord | null>(null);
  const [offers, setOffers] = useState<Coupon[] | null>(null);

  useEffect(() => { setName(profile?.full_name ?? ''); }, [profile?.full_name]);
  useEffect(() => {
    listPurchases().then(setPurchases).catch(() => setPurchases([]));
    listDownloadHistory().then(setHist).catch(() => setHist([]));
    listMyOrders().then(setOrders).catch(() => setOrders([]));
    listPublicOffers().then(setOffers).catch(() => setOffers([]));
  }, []);

  async function save() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() || null }).eq('id', user.id);
    if (error) toast('Could not save your name.', 'error'); else { toast('Saved.'); void refreshProfile(); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pt-6">
      <Seo title="Your profile" path="/profile" />
      <h1 className="text-3xl font-extrabold">Your profile</h1>

      <section className="card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {profile?.avatar_url && <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full" />}
        <div className="flex-1">
          <label className="text-xs text-muted" htmlFor="nm">Display name</label>
          <div className="mt-1 flex gap-2"><input id="nm" className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /><button className="btn-ghost" onClick={save}>Save</button></div>
          <p className="mt-2 text-sm text-muted">{user?.email}</p>
        </div>
        <button className="btn-ghost" onClick={() => void signOut()}>Sign out</button>
      </section>

      <section className="mt-10"><h2 className="mb-3 text-2xl font-extrabold">Your purchases</h2>
        {purchases === null ? <p className="text-sm text-muted">Loading…</p> : purchases.length ? <WallpaperGrid items={purchases} /> : <p className="text-sm text-muted">Premium wallpapers you buy will appear here, ready to download.</p>}
      </section>

      <section className="mt-10"><h2 className="mb-3 text-2xl font-extrabold">Available offers</h2>
        {offers === null ? <p className="text-sm text-muted">Loading…</p> : offers.length ? (
          <div className="grid gap-3 sm:grid-cols-2">{offers.map((c) => (
            <div key={c.id} className="card p-4"><p className="font-mono text-lg font-bold">{c.code}</p>
              <p className="text-sm text-muted">{c.discount_type === 'percent' ? `${c.value}% off` : `${formatPrice(c.value)} off`}{c.min_order_minor > 0 && ` on orders over ${formatPrice(c.min_order_minor)}`}{c.expires_at && ` · expires ${formatDate(c.expires_at)}`}</p></div>
          ))}</div>) : <p className="text-sm text-muted">No offers right now. Check back soon.</p>}
      </section>

      <section className="mt-10"><h2 className="mb-3 text-2xl font-extrabold">Orders</h2>
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="th">Date</th><th className="th">Items</th><th className="th">Amount</th><th className="th">Status</th></tr></thead><tbody>
          {(orders ?? []).map((o) => <tr key={o.id} className="border-t border-line"><td className="td">{formatDate(o.created_at)}</td><td className="td">{o.order_items.map((i) => i.wallpapers?.title).filter(Boolean).join(', ')}</td><td className="td">{formatPrice(o.amount_minor, o.currency)}</td><td className="td capitalize">{o.status}</td></tr>)}
          {orders?.length === 0 && <tr><td className="td text-muted" colSpan={4}>No orders yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="mt-10"><h2 className="mb-3 text-2xl font-extrabold">Download history</h2>
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="th">Date</th><th className="th">Wallpaper</th><th className="th">Type</th></tr></thead><tbody>
          {(hist ?? []).map((h) => <tr key={h.id} className="border-t border-line"><td className="td">{formatDate(h.created_at)}</td><td className="td">{h.wallpapers?.title ?? 'Removed wallpaper'}</td><td className="td capitalize">{h.kind}</td></tr>)}
          {hist?.length === 0 && <tr><td className="td text-muted" colSpan={3}>No downloads yet.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}
