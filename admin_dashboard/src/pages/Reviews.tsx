import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Trash2 } from 'lucide-react';

import { api } from '@/lib/api';
import type { Review } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  EmptyState, ErrorNote, PageHeader, Pager, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const LIMIT = 25;

export function Reviews() {
  const [params, setParams] = useSearchParams();
  const { toasts, push, dismiss } = useToasts();
  const status = params.get('status') ?? 'pending';
  const offset = Number(params.get('offset') ?? 0);
  const [replying, setReplying] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<Review | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.delete('offset');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useAsync(
    () => api.reviews({ status, limit: LIMIT, offset }),
    [status, offset],
  );

  const moderate = async (review: Review, next: Review['status']) => {
    try {
      await api.moderateReview(review.id, { status: next });
      push(next === 'approved' ? 'Review published.' : 'Review rejected.');
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const result = await api.deleteReview(deleting.id);
      push(result.message);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Nothing appears on the shop until it is approved here."
      />

      <div className="a-fulfilment-tabs" role="tablist" aria-label="Review status" style={{ marginBottom: 16 }}>
        {[
          { key: 'pending', label: 'Waiting' },
          { key: 'approved', label: 'Published' },
          { key: 'rejected', label: 'Rejected' },
          { key: '', label: 'All' },
        ].map((tab) => (
          <button
            key={tab.key || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.key}
            className={`a-fulfilment-tab ${status === tab.key ? 'a-fulfilment-tab--active' : ''}`}
            onClick={() => setParam('status', tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading reviews" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting.' : 'No reviews here.'}
          body={status === 'pending' ? 'Every review has been dealt with.' : 'Try another tab.'}
        />
      )}

      {data && data.items.length > 0 && (
        <div className="a-table-card">
          <div style={{ display: 'grid' }}>
            {data.items.map((review) => (
              <article
                key={review.id}
                style={{ padding: 18, borderBottom: '1px solid var(--border, #e5e0da)' }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <Stars rating={review.rating} />
                  <div style={{ flex: 1, minWidth: 240 }}>
                    {review.title && <strong>{review.title}</strong>}
                    <p style={{ margin: '4px 0 8px', fontSize: 14 }}>{review.body || <em>No written review.</em>}</p>
                    <p className="a-sub" style={{ fontSize: 12 }}>
                      {review.author_name} · {formatDate(review.created_at)} · product #{review.product_id}
                      {review.is_verified_purchase && (
                        <span className="a-badge a-badge--ok" style={{ marginLeft: 8 }}>Verified purchase</span>
                      )}
                    </p>
                    {review.staff_reply && (
                      <p style={{ margin: '10px 0 0', padding: 10, background: 'var(--surface-2, #f6f4f1)', borderRadius: 6, fontSize: 13 }}>
                        <strong>Our reply:</strong> {review.staff_reply}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {review.status !== 'approved' && (
                      <button type="button" className="a-btn a-btn--primary" onClick={() => moderate(review, 'approved')}>
                        Publish
                      </button>
                    )}
                    {review.status !== 'rejected' && (
                      <button type="button" className="a-btn a-btn--ghost" onClick={() => moderate(review, 'rejected')}>
                        Reject
                      </button>
                    )}
                    <button type="button" className="a-btn a-btn--ghost" onClick={() => setReplying(review)}>
                      Reply
                    </button>
                    <button
                      type="button"
                      className="a-btn a-btn--ghost"
                      aria-label="Delete this review"
                      onClick={() => setDeleting(review)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pager total={data.total} limit={LIMIT} offset={offset} onChange={(value) => setParam('offset', String(value))} />
        </div>
      )}

      {replying && (
        <ReplyDialog
          review={replying}
          onClose={() => setReplying(null)}
          onSaved={() => {
            push('Reply saved.');
            setReplying(null);
            reload();
          }}
          onError={(message) => push(message, 'error')}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this review?"
          body="It goes for good. Rejecting instead keeps the record and hides it from the shop."
          confirmLabel="Delete it"
          destructive
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}
      // Screen readers get the number; the icons are decorative once it is
      // stated, and five separately-announced stars would be noise.
      aria-label={`${rating} out of 5`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          aria-hidden
          fill={n <= rating ? 'currentColor' : 'none'}
          style={{ opacity: n <= rating ? 1 : 0.3 }}
        />
      ))}
    </span>
  );
}

function ReplyDialog({
  review, onClose, onSaved, onError,
}: {
  review: Review;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [reply, setReply] = useState(review.staff_reply ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.moderateReview(review.id, { staff_reply: reply });
      onSaved();
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="a-dialog" onSubmit={save}>
        <h2>Reply publicly</h2>
        <p className="a-sub">Shown under the review on the product page, signed as the shop.</p>
        <label className="a-form-field">
          <span>Reply</span>
          <textarea className="a-input" rows={4} autoFocus value={reply} onChange={(e) => setReply(e.target.value)} />
          <span className="a-form-hint">Leave blank to remove an existing reply.</span>
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save the reply'}
          </button>
        </div>
      </form>
    </div>
  );
}
