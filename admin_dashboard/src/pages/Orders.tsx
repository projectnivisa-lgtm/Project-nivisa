import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';

import { api, session } from '@/lib/api';
import type { FulfilmentStatus } from '@/lib/api';
import { downloadCsvFromUrl, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import {
  EmptyState, ErrorNote, PageHeader, Pager, Spinner, StatusBadge, ToastStack,
  useAsync, useDebounced, useToasts,
} from '@/components/Ui';

const LIMIT = 25;

const QUEUES: { key: string; label: string; status?: FulfilmentStatus }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting fulfilment', status: 'pending' },
  { key: 'processing', label: 'Being picked', status: 'processing' },
  { key: 'packed', label: 'Packed', status: 'packed' },
  { key: 'dispatched', label: 'Dispatched', status: 'dispatched' },
  { key: 'delivered', label: 'Delivered', status: 'delivered' },
  { key: 'cancelled', label: 'Cancelled', status: 'cancelled' },
];

export function Orders() {
  const [params, setParams] = useSearchParams();
  const { toasts, push, dismiss } = useToasts();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const query = useDebounced(search);
  const fulfilment = params.get('fulfilment_status') ?? '';
  const payment = params.get('payment_status') ?? '';
  const dateFrom = params.get('date_from') ?? '';
  const dateTo = params.get('date_to') ?? '';
  const offset = Number(params.get('offset') ?? 0);

  const filters = {
    q: query,
    fulfilment_status: fulfilment,
    payment_status: payment,
    date_from: dateFrom,
    date_to: dateTo,
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.delete('offset');
    setParams(next, { replace: true });
  };

  const queues = useAsync(() => api.orderQueues(), []);
  const { data, loading, error, reload } = useAsync(
    () => api.orders({ ...filters, limit: LIMIT, offset }),
    [query, fulfilment, payment, dateFrom, dateTo, offset],
  );

  const exportCsv = async () => {
    try {
      await downloadCsvFromUrl(api.orderExportUrl(filters), 'nivisa_orders', session.token());
      push('Export downloaded.');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Fulfilment and payment are separate. An order can be paid and unfulfilled, or dispatched and refunded."
        actions={
          <button type="button" className="a-btn a-btn--ghost" onClick={exportCsv}>
            <Download size={15} aria-hidden /> Export CSV
          </button>
        }
      />

      <div className="a-fulfilment-tabs" role="tablist" aria-label="Order queue">
        {QUEUES.map((queue) => {
          const active = (queue.status ?? '') === fulfilment;
          const count = queue.status ? queues.data?.[queue.status] : undefined;
          return (
            <button
              key={queue.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`a-fulfilment-tab ${active ? 'a-fulfilment-tab--active' : ''}`}
              onClick={() => setParam('fulfilment_status', queue.status ?? '')}
            >
              {queue.label}
              {/* Counts come from a dedicated aggregate, not from the fetched
                  page, so a tab never says "25" because that is the page size. */}
              {count !== undefined && count > 0 && (
                <span className="a-fulfilment-tab__count">{formatNumber(count)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="a-toolbar" style={{ margin: '16px 0' }}>
        <input
          className="a-input"
          type="search"
          placeholder="Order number, name or phone"
          aria-label="Search orders"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setParam('q', e.target.value);
          }}
          style={{ minWidth: 240 }}
        />
        <select
          className="a-select"
          aria-label="Payment status"
          value={payment}
          onChange={(e) => setParam('payment_status', e.target.value)}
        >
          <option value="">Any payment status</option>
          <option value="pending">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="partially_refunded">Part refunded</option>
          <option value="refunded">Refunded</option>
        </select>
        <label className="a-filter-field">
          <span className="a-filter-label">From</span>
          <input className="a-input" type="date" value={dateFrom} onChange={(e) => setParam('date_from', e.target.value)} />
        </label>
        <label className="a-filter-field">
          <span className="a-filter-label">To</span>
          <input className="a-input" type="date" value={dateTo} onChange={(e) => setParam('date_to', e.target.value)} />
        </label>
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading orders" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No orders match."
          body="Try a wider date range, or clear the filters."
          action={
            <button type="button" className="a-btn a-btn--ghost" onClick={() => setParams({})}>
              Clear filters
            </button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Fulfilment</th>
                  <th scope="col">Payment</th>
                  <th scope="col" className="a-num">Items</th>
                  <th scope="col" className="a-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id}>
                    <td><Link to={`/orders/${order.id}`}>{order.order_number}</Link></td>
                    <td>{formatDateTime(order.placed_at ?? order.created_at)}</td>
                    <td><StatusBadge value={order.fulfilment_status} kind="fulfilment" /></td>
                    <td><StatusBadge value={order.payment_status} kind="payment" /></td>
                    <td className="a-num">{order.item_count}</td>
                    <td className="a-num">{formatMoney(Number(order.grand_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={data.total} limit={LIMIT} offset={offset} onChange={(value) => setParam('offset', String(value))} />
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
