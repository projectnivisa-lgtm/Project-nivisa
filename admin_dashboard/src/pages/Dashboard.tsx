import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, IndianRupee, MessageSquare,
  Package, ShoppingCart, Users,
} from 'lucide-react';

import { api, can } from '@/lib/api';
import { formatMoney, formatMoneyShort, formatNumber } from '@/lib/format';
import { ErrorNote, PageHeader, Spinner, useAsync } from '@/components/Ui';

const WINDOWS = [7, 30, 90] as const;

export function Dashboard() {
  const [days, setDays] = useState<number>(30);
  const { data, loading, error, reload } = useAsync(() => api.dashboard(days), [days]);

  if (loading && !data) return <Spinner label="Loading the dashboard" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const peak = Math.max(...data.series.map((point) => point.revenue), 1);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Trading over the last ${data.window_days} days.`}
        actions={
          <div role="group" aria-label="Reporting window" style={{ display: 'flex', gap: 6 }}>
            {WINDOWS.map((option) => (
              <button
                key={option}
                type="button"
                className={`a-btn ${days === option ? 'a-btn--primary' : 'a-btn--ghost'}`}
                aria-pressed={days === option}
                onClick={() => setDays(option)}
              >
                {option}d
              </button>
            ))}
          </div>
        }
      />

      <div className="a-kpi-grid">
        <Kpi
          icon={<IndianRupee size={18} />}
          label="Revenue"
          value={formatMoneyShort(data.revenue)}
          title={formatMoney(data.revenue)}
          change={data.revenue_change_pct}
          sub="Paid orders, cancellations excluded"
        />
        <Kpi
          icon={<ShoppingCart size={18} />}
          label="Orders"
          value={formatNumber(data.orders)}
          sub={`${formatNumber(data.paid_orders)} paid`}
        />
        <Kpi
          icon={<Package size={18} />}
          label="Average order"
          value={formatMoneyShort(data.average_order_value)}
          title={formatMoney(data.average_order_value)}
          sub="Revenue divided by paid orders"
        />
        <Kpi
          icon={<Users size={18} />}
          label="New customers"
          value={formatNumber(data.new_customers)}
          sub="First sign-in in this window"
        />
      </div>

      <section className="a-card" style={{ padding: 20, marginTop: 20 }}>
        <h2 className="a-h2">Revenue by day</h2>
        {data.series.every((point) => point.revenue === 0) ? (
          <p className="a-sub" style={{ marginTop: 12 }}>
            No paid orders in this window yet.
          </p>
        ) : (
          // A plain bar row rather than a charting library: it is one
          // dimension of data, it is readable at a glance, and it adds no
          // dependency to keep current.
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, marginTop: 16 }}
            role="img"
            aria-label={`Daily revenue over ${data.window_days} days, peaking at ${formatMoney(peak)}`}
          >
            {data.series.map((point) => (
              <div
                key={point.date}
                title={`${point.date}: ${formatMoney(point.revenue)} from ${point.orders} order(s)`}
                style={{
                  flex: 1,
                  // A day with revenue always draws at least a sliver, so a
                  // small sale is visibly different from no sale at all.
                  height: `${point.revenue ? Math.max(3, (point.revenue / peak) * 100) : 1}%`,
                  background: point.revenue ? 'var(--accent, #b4552d)' : 'var(--border, #ddd)',
                  borderRadius: '2px 2px 0 0',
                  minWidth: 3,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 20 }}>
        <section className="a-card" style={{ padding: 20 }}>
          <h2 className="a-h2">Waiting on the warehouse</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <QueueRow label="Awaiting fulfilment" count={data.queue.pending} to="/orders?fulfilment_status=pending" />
            <QueueRow label="Being picked" count={data.queue.processing} to="/orders?fulfilment_status=processing" />
            <QueueRow label="Packed, awaiting dispatch" count={data.queue.packed} to="/orders?fulfilment_status=packed" />
          </div>
          {can('reviews.moderate') && data.pending_reviews > 0 && (
            <p style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <MessageSquare size={15} aria-hidden />
              <Link to="/reviews?status=pending">
                {formatNumber(data.pending_reviews)} review(s) waiting to be moderated
              </Link>
            </p>
          )}
        </section>

        <section className="a-card" style={{ padding: 20 }}>
          <h2 className="a-h2">Running low</h2>
          {data.low_stock.length === 0 ? (
            <p className="a-sub" style={{ marginTop: 12 }}>
              Nothing is below its low-stock threshold.
            </p>
          ) : (
            <table className="a-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="a-num">Left</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock.map((row) => (
                  <tr key={row.sku}>
                    <td>
                      {can('products.read') ? (
                        <Link to={`/products/${row.product_id}`}>{row.product_name}</Link>
                      ) : (
                        row.product_name
                      )}
                    </td>
                    <td><code>{row.sku}</code></td>
                    <td className="a-num">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {row.stock === 0 && <AlertTriangle size={13} aria-label="Out of stock" />}
                        {row.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

function Kpi({
  icon, label, value, sub, title, change,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  title?: string;
  change?: number | null;
}) {
  return (
    <div className="a-kpi-card">
      <div className="a-kpi-icon-wrapper" aria-hidden>{icon}</div>
      <div className="a-kpi-details">
        <span className="a-kpi-label">{label}</span>
        <span className="a-kpi-value" title={title}>{value}</span>
        <span className="a-kpi-sub">
          {/* Rendered only when there is a previous period to compare with.
              A "0%" against no history would read as flat trading rather
              than as no data. */}
          {change !== null && change !== undefined && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 8,
                color: change >= 0 ? 'var(--ok, #2f7a4d)' : 'var(--danger, #b3261e)',
              }}
            >
              {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(change)}%
            </span>
          )}
          {sub}
        </span>
      </div>
    </div>
  );
}

function QueueRow({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #e5e0da)',
        textDecoration: 'none',
      }}
    >
      <span>{label}</span>
      <strong className="a-num">{formatNumber(count)}</strong>
    </Link>
  );
}
