import { useState } from 'react';
import { Download } from 'lucide-react';

import { api, can, session } from '@/lib/api';
import { downloadCsvFromUrl, formatMoney, formatNumber } from '@/lib/format';
import {
  ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';

type Tab = 'sales' | 'products' | 'customers' | 'inventory';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function Reports() {
  const { toasts, push, dismiss } = useToasts();
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const exportSales = async () => {
    try {
      await downloadCsvFromUrl(
        `/api/v1/admin/reports/sales.csv?date_from=${from}&date_to=${to}`,
        'nivisa_sales',
        session.token(),
      );
      push('Export downloaded.');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Every figure here is an aggregate over real orders. Cancelled orders are excluded from revenue."
        actions={
          tab === 'sales' &&
          can('reports.export') && (
            <button type="button" className="a-btn a-btn--ghost" onClick={exportSales}>
              <Download size={15} aria-hidden /> Export CSV
            </button>
          )
        }
      />

      <div className="a-fulfilment-tabs" role="tablist" aria-label="Report">
        {([
          ['sales', 'Sales'],
          ['products', 'Top products'],
          ['customers', 'Top customers'],
          ['inventory', 'Inventory'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`a-fulfilment-tab ${tab === key ? 'a-fulfilment-tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'inventory' && (
        <div className="a-toolbar" style={{ margin: '16px 0' }}>
          <label className="a-filter-field">
            <span className="a-filter-label">From</span>
            <input className="a-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="a-filter-field">
            <span className="a-filter-label">To</span>
            <input className="a-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      )}

      {tab === 'sales' && <SalesReport from={from} to={to} />}
      {tab === 'products' && <ProductsReport from={from} to={to} />}
      {tab === 'customers' && <CustomersReport from={from} to={to} />}
      {tab === 'inventory' && <InventoryReport />}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function SalesReport({ from, to }: { from: string; to: string }) {
  const [granularity, setGranularity] = useState('day');
  const { data, loading, error, reload } = useAsync(
    () => api.salesReport(from, to, granularity),
    [from, to, granularity],
  );

  if (loading && !data) return <Spinner label="Building the report" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const totals = data.rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      revenue: sum.revenue + row.revenue,
      discount: sum.discount + row.discount,
      shipping: sum.shipping + row.shipping,
      tax: sum.tax + row.tax,
    }),
    { orders: 0, revenue: 0, discount: 0, shipping: 0, tax: 0 },
  );

  return (
    <div className="a-table-card">
      <div className="a-table-card__header">
        <select
          className="a-select"
          aria-label="Group by"
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
        >
          <option value="day">By day</option>
          <option value="week">By week</option>
          <option value="month">By month</option>
        </select>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="a-num">Orders</th>
              <th scope="col" className="a-num">Revenue</th>
              <th scope="col" className="a-num">Discount</th>
              <th scope="col" className="a-num">Shipping</th>
              <th scope="col" className="a-num">Tax</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.period}>
                <td>{row.period}</td>
                <td className="a-num">{formatNumber(row.orders)}</td>
                <td className="a-num">{formatMoney(row.revenue)}</td>
                <td className="a-num">{formatMoney(row.discount)}</td>
                <td className="a-num">{formatMoney(row.shipping)}</td>
                <td className="a-num">{formatMoney(row.tax)}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr><td colSpan={6} className="a-sub">No paid orders in this range.</td></tr>
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td>
                <td className="a-num">{formatNumber(totals.orders)}</td>
                <td className="a-num">{formatMoney(totals.revenue)}</td>
                <td className="a-num">{formatMoney(totals.discount)}</td>
                <td className="a-num">{formatMoney(totals.shipping)}</td>
                <td className="a-num">{formatMoney(totals.tax)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function ProductsReport({ from, to }: { from: string; to: string }) {
  const { data, loading, error, reload } = useAsync(() => api.topProducts(from, to), [from, to]);
  if (loading && !data) return <Spinner label="Building the report" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="a-table-card">
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="a-num">Units</th>
              <th scope="col" className="a-num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={`${row.product_id}-${row.name}`}>
                <td>{row.name}</td>
                <td className="a-num">{formatNumber(row.units)}</td>
                <td className="a-num">{formatMoney(row.revenue)}</td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={3} className="a-sub">Nothing sold in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersReport({ from, to }: { from: string; to: string }) {
  const { data, loading, error, reload } = useAsync(() => api.topCustomers(from, to), [from, to]);
  if (loading && !data) return <Spinner label="Building the report" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="a-table-card">
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Phone</th>
              <th scope="col" className="a-num">Orders</th>
              <th scope="col" className="a-num">Spend</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.customer_id}>
                <td>{row.name ?? 'Unnamed'}</td>
                <td>{row.phone}</td>
                <td className="a-num">{formatNumber(row.orders)}</td>
                <td className="a-num">{formatMoney(row.spend)}</td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={4} className="a-sub">No orders in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryReport() {
  const { data, loading, error, reload } = useAsync(() => api.inventoryReport(), []);
  if (loading && !data) return <Spinner label="Counting the warehouse" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <div className="a-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="a-kpi-card">
          <div className="a-kpi-details">
            <span className="a-kpi-label">Units on hand</span>
            <span className="a-kpi-value">{formatNumber(data.total_units)}</span>
          </div>
        </div>
        <div className="a-kpi-card">
          <div className="a-kpi-details">
            <span className="a-kpi-label">Stock value at cost</span>
            <span className="a-kpi-value">{formatMoney(data.stock_value_at_cost)}</span>
            {/* Variants with no cost price are counted separately rather than
                valued at zero, which would understate the holding. */}
            {data.variants_without_cost > 0 && (
              <span className="a-kpi-sub">
                Excludes {data.variants_without_cost} variant(s) with no cost price recorded
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col" className="a-num">On hand</th>
                <th scope="col" className="a-num">Cost</th>
                <th scope="col" className="a-num">Price</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.sku}>
                  <td>{row.product_name}</td>
                  <td><code>{row.sku}</code></td>
                  <td className="a-num">{row.stock}</td>
                  <td className="a-num">{row.cost_price === null ? '—' : formatMoney(row.cost_price)}</td>
                  <td className="a-num">{formatMoney(row.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
