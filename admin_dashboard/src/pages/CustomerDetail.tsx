import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, can } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  ErrorNote, PageHeader, Spinner, StatusBadge, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Address {
  id: number;
  kind: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.customer(Number(id)), [id]);
  const [confirming, setConfirming] = useState(false);

  if (loading && !data) return <Spinner label="Loading the customer" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const { customer, orders } = data;
  const addresses = data.addresses as unknown as Address[];

  const toggleActive = async () => {
    try {
      const result = await api.setCustomerActive(customer.id, !customer.is_active);
      push(result.message);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <PageHeader
        title={customer.name ?? customer.phone}
        subtitle={`Customer since ${formatDate(customer.created_at)}`}
        actions={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={() => navigate('/customers')}>
              Back to customers
            </button>
            {can('customers.write') && (
              <button
                type="button"
                className={`a-btn ${customer.is_active ? 'a-btn--danger' : 'a-btn--primary'}`}
                onClick={() => setConfirming(true)}
              >
                {customer.is_active ? 'Suspend account' : 'Reactivate account'}
              </button>
            )}
          </>
        }
      />

      <div className="a-detail-grid">
        <section className="a-card" style={{ padding: 20 }}>
          <h2 className="a-h2">Orders</h2>
          {orders.length === 0 ? (
            <p className="a-sub" style={{ marginTop: 12 }}>No orders yet.</p>
          ) : (
            <div className="a-table-wrap" style={{ marginTop: 12 }}>
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Fulfilment</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="a-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        {can('orders.read') ? (
                          <Link to={`/orders/${order.id}`}>{order.order_number}</Link>
                        ) : (
                          order.order_number
                        )}
                      </td>
                      <td>{formatDateTime(order.placed_at ?? order.created_at)}</td>
                      <td><StatusBadge value={order.fulfilment_status} kind="fulfilment" /></td>
                      <td><StatusBadge value={order.payment_status} kind="payment" /></td>
                      <td className="a-num">{formatMoney(Number(order.grand_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="a-detail-stack">
          <section className="a-card" style={{ padding: 20 }}>
            <h2 className="a-h2">Contact</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', marginTop: 12, fontSize: 14 }}>
              <dt className="a-sub">Phone</dt>
              <dd style={{ margin: 0 }}><a href={`tel:${customer.phone}`}>{customer.phone}</a></dd>
              <dt className="a-sub">Email</dt>
              <dd style={{ margin: 0 }}>
                {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}
              </dd>
              <dt className="a-sub">Lifetime spend</dt>
              <dd className="a-num" style={{ margin: 0 }}>{formatMoney(customer.total_spend)}</dd>
              <dt className="a-sub">Orders</dt>
              <dd className="a-num" style={{ margin: 0 }}>{customer.order_count}</dd>
            </dl>
            <p className="a-sub" style={{ marginTop: 14, fontSize: 12 }}>
              The phone number is the account identifier and cannot be changed here.
            </p>
          </section>

          <section className="a-card" style={{ padding: 20 }}>
            <h2 className="a-h2">Addresses</h2>
            {addresses.length === 0 ? (
              <p className="a-sub" style={{ marginTop: 12 }}>None saved.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
                {addresses.map((address) => (
                  <address key={address.id} style={{ fontStyle: 'normal', fontSize: 14, lineHeight: 1.6 }}>
                    <strong>
                      {address.label ?? address.kind}
                      {address.is_default && <span className="a-badge a-badge--ghost" style={{ marginLeft: 8 }}>Default</span>}
                    </strong>
                    <br />
                    {address.full_name}<br />
                    {address.line1}<br />
                    {address.line2 && <>{address.line2}<br /></>}
                    {address.city}, {address.state} {address.postal_code}
                  </address>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={customer.is_active ? 'Suspend this account?' : 'Reactivate this account?'}
          body={
            customer.is_active
              ? 'They will not be able to sign in or place an order. Past orders are unaffected.'
              : 'They will be able to sign in and order again.'
          }
          confirmLabel={customer.is_active ? 'Suspend' : 'Reactivate'}
          destructive={customer.is_active}
          onConfirm={toggleActive}
          onCancel={() => setConfirming(false)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
