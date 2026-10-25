import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { AdminStats } from '../../lib/types';
import { formatPrice } from '../../lib/format';
import { ErrorBox, Spinner } from '../../components/States';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="card p-4"><p className="text-sm text-muted" title={hint}>{label}</p><p className="mt-1 font-display text-3xl font-extrabold">{value}</p></div>;
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [s, setS] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setS(null); setErr(null);
    supabase.rpc('admin_stats', { p_days: days }).then(({ data, error }) => {
      if (error) setErr(error.message); else setS(data as AdminStats);
    });
  }, [days]);

  if (err) return <ErrorBox message={`Could not load stats: ${err}`} />;
  if (!s) return <Spinner />;
  const maxV = Math.max(1, ...s.daily.map((d) => d.views));

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-muted">Period
        <select className="input !w-auto" value={days} onChange={(e) => setDays(+e.target.value)}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
        </select>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Page views" value={s.page_views} hint="One view per visitor per page per day" />
        <Stat label="Unique visitors" value={s.unique_visitors} hint="Distinct anonymous browser ids — approximate" />
        <Stat label="Registered users" value={s.registered_users} hint="All time" />
        <Stat label="Wallpaper views" value={s.wallpaper_views} />
        <Stat label="Free downloads" value={s.free_downloads} />
        <Stat label="Premium downloads" value={s.premium_downloads} />
        <Stat label="Paid orders" value={`${s.orders_paid} / ${s.orders_total}`} hint="Paid / all orders created in the period" />
        <Stat label="Revenue" value={formatPrice(s.revenue_minor)} hint={`Refunded in period: ${formatPrice(s.refunded_minor)}`} />
      </div>

      <section className="card mt-6 p-4">
        <h2 className="text-lg font-bold">Daily page views</h2>
        <div className="mt-4 flex h-32 items-end gap-0.5" role="img" aria-label="Bar chart of daily page views">
          {s.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.views} views · ${formatPrice(d.revenue_minor)}`} className="flex-1 rounded-t bg-accent" style={{ height: `${Math.max(2, (d.views / maxV) * 100)}%` }} />)}
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card p-4"><h2 className="text-lg font-bold">Popular wallpapers</h2>
          <ol className="mt-3 space-y-2 text-sm">{s.top_wallpapers.map((w) => <li key={w.id} className="flex justify-between gap-3"><span className="truncate">{w.title} {w.is_premium && <span className="text-sorbet">· premium</span>}</span><span className="shrink-0 text-muted">{w.downloads} downloads · {w.view_count} views</span></li>)}</ol></section>
        <section className="card p-4"><h2 className="text-lg font-bold">Popular categories</h2>
          <ol className="mt-3 space-y-2 text-sm">{s.top_categories.map((c) => <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="text-muted">{c.downloads} downloads</span></li>)}</ol></section>
      </div>

      <details className="mt-6 text-sm text-muted"><summary className="cursor-pointer">How these numbers are counted</summary>
        <p className="mt-2 max-w-prose">Page and wallpaper views are counted once per visitor per page per day. Visitors are anonymous random ids kept in the browser, so one person on two devices counts twice and visitors who block storage or enable Do Not Track are not counted. Downloads are counted when a signed download link is issued; admin test downloads are excluded. Revenue counts orders with a verified payment; refunds are shown separately.</p></details>
    </div>
  );
}
