import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { OrderRow } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { ErrorBox, Spinner } from '../../components/States';

export default function Orders() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [status, setStatus] = useState('all');
  const [err, setErr] = useState(false);

  useEffect(() => {
    supabase.from('orders').select('*,profiles(email),order_items(wallpaper_id,price_minor,wallpapers(title))').order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (error) setErr(true); else setRows(data as unknown as OrderRow[]); });
  }, []);
  if (err) return <ErrorBox message="Could not load orders." />;
  if (!rows) return <Spinner />;
  const shown = rows.filter((o) => status === 'all' || o.status === status);
  const items = (o: OrderRow) => (o.order_items ?? []).map((i) => i.wallpapers?.title ?? i.wallpaper_id).join('; ');

  const exportCsv = () => downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Order ID', 'Created', 'Paid at', 'Customer', 'Items', 'Subtotal', 'Discount', 'Total', 'Currency', 'Status', 'Provider', 'Provider order', 'Provider payment'],
    ...shown.map((o) => [o.id, o.created_at, o.paid_at, o.profiles?.email, items(o), o.subtotal_minor / 100, o.discount_minor / 100, o.amount_minor / 100, o.currency, o.status, o.provider, o.provider_order_id, o.provider_payment_id]),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">Status
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['all', 'created', 'paid', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <button className="btn-ghost ml-auto" onClick={exportCsv} disabled={!shown.length}>Export CSV ({shown.length})</button>
      </div>
      <div className="card mt-4 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr><th className="th">Date</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Total</th><th className="th">Status</th><th className="th">Provider</th></tr></thead>
        <tbody>{shown.map((o) => (
          <tr key={o.id} className="border-t border-line">
            <td className="td whitespace-nowrap">{formatDate(o.created_at)}</td><td className="td">{o.profiles?.email ?? '—'}</td>
            <td className="td max-w-xs truncate">{items(o)}</td>
            <td className="td whitespace-nowrap">{formatPrice(o.amount_minor, o.currency)}{o.discount_minor > 0 && <span className="text-xs text-muted"> (−{formatPrice(o.discount_minor, o.currency)})</span>}</td>
            <td className="td capitalize">{o.status}</td><td className="td">{o.provider}</td>
          </tr>))}
          {shown.length === 0 && <tr><td className="td text-muted" colSpan={6}>No orders.</td></tr>}</tbody></table></div>
      <p className="mt-3 text-xs text-muted">Refunds are issued in your payment provider’s dashboard. The refund webhook then marks the order refunded and removes the buyer’s access.</p>
    </div>
  );
}
