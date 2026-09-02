import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { OrderDetail as Order } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  ErrorNote, PageHeader, Spinner, StatusBadge, ToastStack, useAsync, useToasts,
} from '@/components/Ui';

const STEP_LABEL: Record<string, string> = {
  processing: 'Start picking',
  packed: 'Mark packed',
  dispatched: 'Dispatch',
  delivered: 'Mark delivered',
  returned: 'Record a return',
};

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.order(Number(id)), [id]);

  const [dialog, setDialog] = useState<'dispatch' | 'cancel' | 'refund' | 'note' | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner label="Loading the order" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const order = data;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      push(message);
      setDialog(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // The server sends what this order is allowed to become next. Rendering
  // buttons from that rather than a copy of the ladder here means a stale tab
  // cannot offer a step the order has already passed.
  const steps = order.allowed_transitions.filter((s) => s !== 'cancelled' && s !== 'dispatched');
  const canDispatch = order.allowed_transitions.includes('dispatched');
  const canCancel = order.allowed_transitions.includes('cancelled');

  return (
    <>
      <PageHeader
        title={order.order_number}
        subtitle={`Placed ${formatDateTime(order.placed_at ?? order.created_at)}`}
        actions={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={() => navigate('/orders')}>
              Back to orders
            </button>
            <button type="button" className="a-btn a-btn--ghost" onClick={() => window.print()}>
              <Printer size={15} aria-hidden /> Print
            </button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge value={order.fulfilment_status} kind="fulfilment" />
        <StatusBadge value={order.payment_status} kind="payment" />
        {order.coupon_code && <span className="a-badge a-badge--info">{order.coupon_code}</span>}
      </div>

      {can('orders.fulfil') && (steps.length > 0 || canDispatch) && (
        <section className="a-card" style={{ padding: 16, marginBottom: 20 }}>
          <h2 className="a-h2" style={{ fontSize: 14 }}>Next step</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                className="a-btn a-btn--primary"
                disabled={busy}
                onClick={() => run(() => api.setOrderStatus(order.id, step), `Marked ${step}.`)}
              >
                {STEP_LABEL[step] ?? step}
              </button>
            ))}
            {canDispatch && (
              <button type="button" className="a-btn a-btn--primary" onClick={() => setDialog('dispatch')}>
                Dispatch with tracking
              </button>
            )}
            {canCancel && can('orders.cancel') && (
              <button type="button" className="a-btn a-btn--danger" onClick={() => setDialog('cancel')}>
                Cancel order
              </button>
            )}
            {order.payment_status === 'paid' && can('orders.refund') && (
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDialog('refund')}>
                Record a refund
              </button>
            )}
          </div>
        </section>
      )}

      <div className="a-detail-grid">
        <div className="a-detail-stack">
          <section className="a-card" style={{ padding: 20 }}>
            <h2 className="a-h2">Items</h2>
            <div className="a-table-wrap" style={{ marginTop: 12 }}>
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col">Piece</th>
                    <th scope="col">SKU</th>
                    <th scope="col" className="a-num">Unit</th>
                    <th scope="col" className="a-num">Qty</th>
                    <th scope="col" className="a-num">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {item.image_url && (
                            <img src={item.image_url} alt="" width={36} height={36} loading="lazy" style={{ objectFit: 'cover', borderRadius: 5 }} />
                          )}
                          <div>
                            {/* The name is a snapshot from checkout time. It is
                                what the invoice says was bought, even if the
                                product has since been renamed. */}
                            {item.product_id && can('products.read') ? (
                              <Link to={`/products/${item.product_id}`}>{item.product_name}</Link>
                            ) : (
                              item.product_name
                            )}
                            {item.variant_label && (
                              <div className="a-sub" style={{ fontSize: 12 }}>{item.variant_label}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><code>{item.sku}</code></td>
                      <td className="a-num">{formatMoney(Number(item.unit_price))}</td>
                      <td className="a-num">{item.quantity}</td>
                      <td className="a-num">{formatMoney(Number(item.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="a-totals">
              <Money label="Subtotal" value={order.subtotal} />
              {Number(order.discount_total) > 0 && <Money label="Discount" value={`-${order.discount_total}`} />}
              <Money label="Shipping" value={order.shipping_total} />
              <Money label="Tax (included)" value={order.tax_total} muted />
              <dt className="a-totals__rule" style={{ fontWeight: 600 }}>Total</dt>
              <dd className="a-num a-totals__rule" style={{ fontWeight: 600 }}>
                {formatMoney(Number(order.grand_total))}
              </dd>
              {Number(order.refunded_total) > 0 && <Money label="Refunded" value={order.refunded_total} />}
            </dl>
          </section>

          <section className="a-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="a-h2">History</h2>
              {can('orders.read') && (
                <button type="button" className="a-btn a-btn--ghost" onClick={() => setDialog('note')}>
                  Add an internal note
                </button>
              )}
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 12 }}>
              {order.events.map((event) => (
                <li key={event.id} style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                  <span className="a-sub" style={{ minWidth: 130, fontSize: 12 }}>
                    {formatDateTime(event.created_at)}
                  </span>
                  <span>
                    {event.message}
                    {event.staff_name && <span className="a-sub"> — {event.staff_name}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="a-detail-stack">
          <section className="a-card" style={{ padding: 20 }}>
            <h2 className="a-h2">Customer</h2>
            <p style={{ margin: '12px 0 0', fontSize: 14 }}>
              {order.customer_id && can('customers.read') ? (
                <Link to={`/customers/${order.customer_id}`}>{order.customer_name ?? order.customer_phone}</Link>
              ) : (
                order.customer_name ?? '—'
              )}
              <br />
              {order.customer_phone && <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>}
              <br />
              {order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}
            </p>
          </section>

          <section className="a-card" style={{ padding: 20 }}>
            <h2 className="a-h2">Delivering to</h2>
            <address style={{ fontStyle: 'normal', fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
              {order.shipping_address.full_name}<br />
              {order.shipping_address.line1}<br />
              {order.shipping_address.line2 && <>{order.shipping_address.line2}<br /></>}
              {order.shipping_address.landmark && <>{order.shipping_address.landmark}<br /></>}
              {order.shipping_address.city}, {order.shipping_address.state}<br />
              {order.shipping_address.postal_code}<br />
              {order.shipping_address.phone}
            </address>
          </section>

          {order.courier_name && (
            <section className="a-card" style={{ padding: 20 }}>
              <h2 className="a-h2">Shipment</h2>
              <p style={{ fontSize: 14, marginTop: 12, lineHeight: 1.7 }}>
                {order.courier_name}<br />
                <code>{order.tracking_number}</code><br />
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noreferrer noopener">Track the parcel</a>
                )}
                {order.expected_delivery_date && <><br />Expected {order.expected_delivery_date}</>}
              </p>
            </section>
          )}

          {order.customer_note && (
            <section className="a-card" style={{ padding: 20 }}>
              <h2 className="a-h2">Note from the customer</h2>
              <p style={{ fontSize: 14, marginTop: 12 }}>{order.customer_note}</p>
            </section>
          )}

          {order.staff_note && (
            <section className="a-card" style={{ padding: 20 }}>
              <h2 className="a-h2">Internal note</h2>
              <p style={{ fontSize: 14, marginTop: 12 }}>{order.staff_note}</p>
            </section>
          )}
        </div>
      </div>

      {dialog === 'dispatch' && (
        <DispatchDialog order={order} busy={busy} onClose={() => setDialog(null)} onSubmit={(body) =>
          run(() => api.dispatchOrder(order.id, body), 'Order dispatched.')
        } />
      )}
      {dialog === 'cancel' && (
        <CancelDialog busy={busy} onClose={() => setDialog(null)} onSubmit={(reason, restock) =>
          run(() => api.cancelOrder(order.id, reason, restock), 'Order cancelled.')
        } />
      )}
      {dialog === 'refund' && (
        <RefundDialog
          outstanding={(Number(order.grand_total) - Number(order.refunded_total)).toFixed(2)}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(amount, reason) => run(() => api.refundOrder(order.id, amount, reason), 'Refund recorded.')}
        />
      )}
      {dialog === 'note' && (
        <NoteDialog
          initial={order.staff_note ?? ''}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(note) => run(() => api.addOrderNote(order.id, note), 'Note saved.')}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Money({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <>
      <dt className={muted ? 'a-sub' : undefined}>{label}</dt>
      <dd className={`a-num ${muted ? 'a-sub' : ''}`}>{formatMoney(Number(value))}</dd>
    </>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="a-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DispatchDialog({
  order, busy, onClose, onSubmit,
}: {
  order: Order;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [courier, setCourier] = useState(order.courier_name ?? '');
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [url, setUrl] = useState(order.tracking_url ?? '');
  const [expected, setExpected] = useState(order.expected_delivery_date ?? '');

  return (
    <Dialog title="Dispatch this order" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            courier_name: courier,
            tracking_number: tracking,
            tracking_url: url || null,
            expected_delivery_date: expected || null,
          });
        }}
      >
        {/* Courier and tracking are required together with the status change.
            Marking dispatched without them is the state customers email
            about, so the form does not allow reaching it. */}
        <label className="a-form-field">
          <span>Courier</span>
          <input className="a-input" required autoFocus value={courier} onChange={(e) => setCourier(e.target.value)} />
        </label>
        <label className="a-form-field">
          <span>Tracking number</span>
          <input className="a-input" required value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </label>
        <label className="a-form-field">
          <span>Tracking URL</span>
          <input className="a-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="a-form-field">
          <span>Expected delivery</span>
          <input className="a-input" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Dispatch'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function CancelDialog({
  busy, onClose, onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, restock: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);

  return (
    <Dialog title="Cancel this order" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason, restock); }}>
        <label className="a-form-field">
          <span>Reason</span>
          <textarea className="a-input" rows={3} required autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="a-form-hint">The customer sees this on their order.</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Put the stock back
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Keep the order</button>
          <button type="submit" className="a-btn a-btn--danger" disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel the order'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function RefundDialog({
  outstanding, busy, onClose, onSubmit,
}: {
  outstanding: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amount: string, reason: string) => void;
}) {
  const [amount, setAmount] = useState(outstanding);
  const [reason, setReason] = useState('');

  return (
    <Dialog title="Record a refund" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(amount, reason); }}>
        <p className="a-sub">
          This records the refund against the order. Move the money in your payment provider's own
          console — nothing here touches the gateway.
        </p>
        <label className="a-form-field">
          <span>Amount (₹)</span>
          <input
            className="a-input" type="number" step="0.01" min="0.01" max={outstanding} required autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="a-form-hint">{formatMoney(Number(outstanding))} is still refundable.</span>
        </label>
        <label className="a-form-field">
          <span>Reason</span>
          <input className="a-input" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record it'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function NoteDialog({
  initial, busy, onClose, onSubmit,
}: {
  initial: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState(initial);
  return (
    <Dialog title="Internal note" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }}>
        <label className="a-form-field">
          <span>Note</span>
          <textarea className="a-input" rows={4} required autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="a-form-hint">Staff only. The customer never sees this.</span>
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save the note'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
