import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createOrder, getQuote, getWallpaperBySlug, listWallpapers, requestDownload, verifyPayment } from '../lib/api';
import type { Quote, Wallpaper } from '../lib/types';
import { previewUrl, SITE_NAME } from '../lib/supabase';
import { formatPrice, gradientFor } from '../lib/format';
import { trackWallpaperView } from '../lib/analytics';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { useToast } from '../context/ToastContext';
import { Seo } from '../components/Seo';
import { Empty, Spinner } from '../components/States';
import { WallpaperGrid } from '../components/WallpaperCard';
import { DownloadIcon, HeartIcon, LockIcon } from '../components/Icons';

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(evt: string, cb: (r: unknown) => void): void } }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(true); s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

export default function WallpaperDetail() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { favorites, purchased, toggleFavorite, refresh } = useLibrary();
  const toast = useToast();

  const [w, setW] = useState<Wallpaper | null | undefined>(undefined);
  const [related, setRelated] = useState<Wallpaper[]>([]);
  const [busy, setBusy] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    setW(undefined); setBuyOpen(false); setQuote(null); setCode('');
    getWallpaperBySlug(slug).then((x) => {
      setW(x);
      if (x) {
        trackWallpaperView(x.id);
        listWallpapers({ category: x.categories?.slug, limit: 7 }).then((r) => setRelated(r.rows.filter((y) => y.id !== x.id).slice(0, 6))).catch(() => {});
      }
    }).catch(() => setW(null));
  }, [slug]);

  if (w === undefined) return <Spinner />;
  if (w === null) return <Empty title="Wallpaper not found">It may have been unpublished. <Link className="text-accent" to="/explore">Back to Explore</Link></Empty>;

  const owned = !w.is_premium || purchased.has(w.id) || profile?.role === 'admin';
  const fav = favorites.has(w.id);
  const shown = !owned && w.watermark_path ? w.watermark_path : w.preview_path;
  const img = previewUrl(shown);
  const here = `/w/${w.slug}`;

  const needLogin = () => { toast('Please sign in first.'); nav('/login', { state: { from: here } }); };

  async function download() {
    if (!w) return;
    if (!user && (w.is_premium || w.free_requires_login)) return needLogin();
    setBusy(true);
    try {
      const { url } = await requestDownload(w.id);
      window.location.assign(url);          // signed URL, valid ~60 seconds
      toast('Your download is starting.');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  async function refreshQuote(c = code) {
    if (!w) return;
    try {
      const q = await getQuote([w.id], c.trim() || undefined);
      setQuote(q);
      if (c.trim() && q.coupon_error) toast(q.coupon_error, 'error');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function openBuy() {
    if (!user) return needLogin();
    setBuyOpen(true);
    await refreshQuote('');
  }

  async function pay() {
    if (!w) return;
    setBusy(true);
    try {
      const order = await createOrder([w.id], quote?.coupon ? code : undefined);
      if (order.status === 'paid') { await refresh(); setBuyOpen(false); toast('Unlocked! You can download it now.'); return; }

      const finish = async (r: { order_id: string; payment_id: string; signature: string }) => {
        try { await verifyPayment(r); await refresh(); setBuyOpen(false); toast('Payment confirmed. Your wallpaper is unlocked.'); }
        catch (e) { toast((e as Error).message + ' If money was deducted, it will unlock automatically within a few minutes.', 'error'); }
      };

      if (order.provider === 'mock') {
        if (window.confirm('TEST MODE (mock provider, no real money). Simulate a successful payment?')) {
          await finish({ order_id: order.order_id, payment_id: 'mock_payment', signature: 'mock' });
        } else toast('Payment cancelled.');
        return;
      }
      if (order.provider !== 'razorpay') throw new Error('This payment provider is not supported in the browser yet.');
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection.');
      const rzp = new window.Razorpay({
        key: order.public_key, order_id: order.provider_order_id, amount: order.amount_minor, currency: order.currency,
        name: SITE_NAME, description: w.title,
        prefill: { email: user?.email ?? '', name: profile?.full_name ?? '' },
        theme: { color: '#5b3fe8' },
        handler: (r: RzpResponse) => void finish({ order_id: order.order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }),
        modal: { ondismiss: () => toast('Payment cancelled. You have not been charged.') },
      });
      rzp.on('payment.failed', () => toast('Payment failed. You can try again.', 'error'));
      rzp.open();
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <Seo title={w.title} description={w.description ?? `${w.title} — ${w.is_premium ? 'premium' : 'free'} wallpaper`} image={previewUrl(w.preview_path)} path={here} />
      <nav className="mb-4 text-sm text-muted"><Link to="/explore">Explore</Link>{w.categories && <> / <Link to={`/explore?category=${w.categories.slug}`}>{w.categories.name}</Link></>}</nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="mx-auto w-full max-w-sm">
          <div className="relative overflow-hidden rounded-3xl border border-line" style={{ background: gradientFor(w.id), aspectRatio: w.width && w.height ? `${w.width} / ${w.height}` : '9 / 16' }}>
            {img && <img src={img} alt={w.title} decoding="async" className="h-full w-full object-cover" onContextMenu={(e) => e.preventDefault()} draggable={false} />}
          </div>
          {!owned && <p className="mt-2 text-xs text-muted">Preview is low-resolution and watermarked. Buying unlocks the full-resolution original.</p>}
        </div>

        <div>
          <h1 className="text-4xl font-extrabold">{w.title}</h1>
          {w.description && <p className="mt-3 max-w-prose text-muted">{w.description}</p>}
          <dl className="mt-5 grid max-w-md grid-cols-2 gap-3 text-sm">
            {w.width && w.height && <><dt className="text-muted">Resolution</dt><dd>{w.width} × {w.height}</dd></>}
            {w.aspect_ratio && <><dt className="text-muted">Aspect ratio</dt><dd>{w.aspect_ratio}</dd></>}
            {w.categories && <><dt className="text-muted">Category</dt><dd>{w.categories.name}</dd></>}
            <dt className="text-muted">Price</dt><dd className="font-semibold">{w.is_premium ? formatPrice(w.price_minor, w.currency) : 'Free'}</dd>
          </dl>
          {w.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{w.tags.map((t) => <Link key={t} to={`/explore?q=${encodeURIComponent(t)}`} className="chip">#{t}</Link>)}</div>}

          <div className="mt-6 flex flex-wrap gap-3">
            {owned
              ? <button className="btn-primary" disabled={busy} onClick={download}><DownloadIcon /> {busy ? 'Preparing…' : 'Download original'}</button>
              : <button className="btn-primary" disabled={busy} onClick={openBuy}><LockIcon /> Buy for {formatPrice(w.price_minor, w.currency)}</button>}
            <button className="btn-ghost" aria-pressed={fav} onClick={async () => { if (!(await toggleFavorite(w.id))) needLogin(); }}>
              <HeartIcon filled={fav} className={fav ? 'text-sorbet' : ''} /> {fav ? 'Favorited' : 'Favorite'}
            </button>
          </div>
          {!user && !w.is_premium && w.free_requires_login && <p className="mt-2 text-xs text-muted">Sign in with Google to download free wallpapers.</p>}

          {buyOpen && quote && (
            <section className="card mt-6 max-w-md p-5" aria-label="Checkout">
              <h2 className="text-lg font-bold">Checkout</h2>
              <div className="mt-3 flex gap-2">
                <input className="input" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Coupon code" />
                <button className="btn-ghost" onClick={() => void refreshQuote()}>Apply</button>
              </div>
              {quote.coupon && <p className="mt-2 text-sm text-accent">Coupon {quote.coupon.code} applied.</p>}
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Price</dt><dd>{formatPrice(quote.subtotal_minor, quote.currency)}</dd></div>
                {quote.discount_minor > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>−{formatPrice(quote.discount_minor, quote.currency)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{formatPrice(quote.total_minor, quote.currency)}</dd></div>
              </dl>
              <button className="btn-primary mt-4 w-full" disabled={busy} onClick={pay}>{busy ? 'Please wait…' : quote.total_minor === 0 ? 'Unlock for free' : `Pay ${formatPrice(quote.total_minor, quote.currency)}`}</button>
              <p className="mt-2 text-xs text-muted">Payments are handled by our payment provider; we never see your card details. The final amount is calculated on our server.</p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && <section className="mt-14"><h2 className="mb-4 text-2xl font-extrabold">More like this</h2><WallpaperGrid items={related} /></section>}
    </main>
  );
}
