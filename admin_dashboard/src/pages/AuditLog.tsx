import { useState } from 'react';

import { api } from '@/lib/api';
import type { AuditEntry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  EmptyState, ErrorNote, PageHeader, Pager, Spinner, useAsync,
} from '@/components/Ui';

const LIMIT = 50;

export function AuditLog() {
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => api.auditLogs({ action, entity, date_from: dateFrom, date_to: dateTo, limit: LIMIT, offset }),
    [action, entity, dateFrom, dateTo, offset],
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who changed what, and from where. Entries cannot be edited or removed."
      />

      <div className="a-toolbar" style={{ marginBottom: 16 }}>
        <select
          className="a-select"
          aria-label="Action"
          value={action}
          onChange={(e) => { setAction(e.target.value); setOffset(0); }}
        >
          <option value="">Any action</option>
          <option value="login">Sign-in</option>
          <option value="login_failed">Failed sign-in</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="archive">Archive</option>
          <option value="cancel">Cancel</option>
          <option value="dispatch">Dispatch</option>
          <option value="refund">Refund</option>
          <option value="password_reset">Password reset</option>
        </select>
        <select
          className="a-select"
          aria-label="Area"
          value={entity}
          onChange={(e) => { setEntity(e.target.value); setOffset(0); }}
        >
          <option value="">Anywhere</option>
          <option value="products">Products</option>
          <option value="orders">Orders</option>
          <option value="customers">Customers</option>
          <option value="staff_users">Staff</option>
          <option value="roles">Roles</option>
          <option value="categories">Categories</option>
          <option value="coupons">Coupons</option>
          <option value="pages">Pages</option>
          <option value="settings">Settings</option>
        </select>
        <label className="a-filter-field">
          <span className="a-filter-label">From</span>
          <input className="a-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }} />
        </label>
        <label className="a-filter-field">
          <span className="a-filter-label">To</span>
          <input className="a-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setOffset(0); }} />
        </label>
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading the audit log" />}
      {data && data.items.length === 0 && (
        <EmptyState title="Nothing recorded here." body="Try a wider date range or a different filter." />
      )}

      {data && data.items.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Where</th>
                  <th scope="col">From</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry: AuditEntry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    style={{ cursor: entry.changes ? 'pointer' : 'default' }}
                  >
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.created_at)}</td>
                    <td>{entry.actor_name ?? entry.actor_email ?? 'System'}</td>
                    <td>
                      {entry.summary ?? `${entry.action} ${entry.entity}`}
                      {entry.status !== 'success' && (
                        <span className="a-badge a-badge--warn" style={{ marginLeft: 8 }}>Failed</span>
                      )}
                      {/* The change detail is collapsed by default: most rows
                          are read as a stream, and a nested diff on every one
                          would drown the sequence of events. */}
                      {expanded === entry.id && entry.changes && (
                        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '10px 0 0', fontSize: 12 }}>
                          {Object.entries(entry.changes).map(([field, [before, after]]) => (
                            <div key={field} style={{ display: 'contents' }}>
                              <dt className="a-sub">{field}</dt>
                              <dd style={{ margin: 0 }}>
                                <s style={{ opacity: 0.6 }}>{format(before)}</s> → <strong>{format(after)}</strong>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                    <td>
                      <code>{entry.entity}</code>
                      {entry.entity_id && <span className="a-sub"> #{entry.entity_id}</span>}
                    </td>
                    <td className="a-sub">{entry.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}
    </>
  );
}

function format(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
