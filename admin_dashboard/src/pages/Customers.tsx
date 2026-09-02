import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import {
  EmptyState, ErrorNote, PageHeader, Pager, Spinner, useAsync, useDebounced,
} from '@/components/Ui';

const LIMIT = 25;

export function Customers() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const query = useDebounced(search);
  const active = params.get('is_active') ?? '';
  const offset = Number(params.get('offset') ?? 0);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.delete('offset');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useAsync(
    () => api.customers({ q: query, is_active: active, limit: LIMIT, offset }),
    [query, active, offset],
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Spend excludes cancelled orders, so the figures here match the books."
      />

      <div className="a-toolbar" style={{ marginBottom: 16 }}>
        <input
          className="a-input"
          type="search"
          placeholder="Name, phone or email"
          aria-label="Search customers"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setParam('q', e.target.value);
          }}
          style={{ minWidth: 240 }}
        />
        <select className="a-select" aria-label="Account status" value={active} onChange={(e) => setParam('is_active', e.target.value)}>
          <option value="">All accounts</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading customers" />}

      {data && data.items.length === 0 && (
        <EmptyState title="No customers match." body="Try a different search." />
      )}

      {data && data.items.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Phone</th>
                  <th scope="col" className="a-num">Orders</th>
                  <th scope="col" className="a-num">Spend</th>
                  <th scope="col">Last order</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link to={`/customers/${customer.id}`}>{customer.name ?? 'Unnamed'}</Link>
                      {customer.email && <div className="a-sub" style={{ fontSize: 12 }}>{customer.email}</div>}
                    </td>
                    <td>{customer.phone}</td>
                    <td className="a-num">{formatNumber(customer.order_count)}</td>
                    <td className="a-num">{formatMoney(customer.total_spend)}</td>
                    <td>{customer.last_order_at ? formatDate(customer.last_order_at) : '—'}</td>
                    <td>
                      <span className={`a-badge ${customer.is_active ? 'a-badge--ok' : 'a-badge--warn'}`}>
                        {customer.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={data.total} limit={LIMIT} offset={offset} onChange={(value) => setParam('offset', String(value))} />
        </div>
      )}
    </>
  );
}
