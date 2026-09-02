/**
 * The small pieces every screen needs: page headers, async state, permission
 * gates, badges, toasts and a pager.
 *
 * They live in one file because each is a handful of lines and splitting them
 * across ten files would make them harder to find than to write again - which
 * is how a codebase ends up with four toast components.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Loader2, Lock, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { can, canAny } from '@/lib/api';

// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="a-toolbar" style={{ marginBottom: 20 }}>
      <div>
        <h1 className="a-h1">{title}</h1>
        {subtitle && <p className="a-sub">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="a-note"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0' }}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={16} className="a-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="a-note a-note--framed" role="alert">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
        <div>
          <strong>That did not work.</strong>
          <p style={{ margin: '6px 0 0' }}>{error}</p>
          {onRetry && (
            <button type="button" className="a-btn a-btn--ghost" style={{ marginTop: 12 }} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="a-note a-note--framed"
      style={{ textAlign: 'center', padding: '48px 24px' }}
    >
      <strong>{title}</strong>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>{body}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permission gates
// ---------------------------------------------------------------------------

/**
 * Wraps a whole route. A user who reaches a URL their role does not cover
 * gets an explanation naming the permission, not a blank page or a redirect
 * that looks like the link is broken.
 */
export function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: ReactNode;
}) {
  if (anyOf.length === 0 || canAny(...anyOf)) return <>{children}</>;
  return (
    <div className="a-note a-note--framed" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <Lock size={28} style={{ color: 'var(--text-muted)' }} aria-hidden />
      <strong style={{ display: 'block', marginTop: 12 }}>You do not have access to this screen.</strong>
      <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)' }}>
        Your role does not include {anyOf.join(' or ')}. Ask a Super Admin if you need it.
      </p>
      <Link to="/" className="a-btn a-btn--primary">
        Back to the dashboard
      </Link>
    </div>
  );
}

/** Hides a single control. Use for buttons inside a screen the user can read. */
export function IfAllowed({ permission, children }: { permission: string; children: ReactNode }) {
  return can(permission) ? <>{children}</> : null;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const FULFILMENT_TONE: Record<string, string> = {
  pending: 'a-badge--ghost',
  processing: 'a-badge--info',
  packed: 'a-badge--purple',
  dispatched: 'a-badge--amber',
  delivered: 'a-badge--ok',
  cancelled: 'a-badge--warn',
  returned: 'a-badge--warn',
};

const PAYMENT_TONE: Record<string, string> = {
  pending: 'a-badge--ghost',
  paid: 'a-badge--ok',
  failed: 'a-badge--warn',
  refunded: 'a-badge--warn',
  partially_refunded: 'a-badge--amber',
};

const LABELS: Record<string, string> = {
  partially_refunded: 'Part refunded',
};

function humanise(value: string): string {
  return LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export function StatusBadge({ value, kind }: { value: string; kind: 'fulfilment' | 'payment' | 'plain' }) {
  const tone =
    kind === 'fulfilment' ? FULFILMENT_TONE[value] : kind === 'payment' ? PAYMENT_TONE[value] : '';
  return <span className={`a-badge ${tone ?? ''}`}>{humanise(value)}</span>;
}

export function ProductStatusBadge({ value }: { value: string }) {
  const tone = value === 'active' ? 'a-badge--ok' : value === 'draft' ? 'a-badge--ghost' : 'a-badge--warn';
  return <span className={`a-badge ${tone}`}>{humanise(value)}</span>;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: 'ok' | 'error' = 'ok') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      // Errors stay long enough to read and copy; successes get out of the way.
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 3500);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 90,
        display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380,
      }}
      // Polite rather than assertive: these confirm actions the user just
      // took, and interrupting a screen reader mid-sentence for "Saved" is
      // worse than telling them a moment later.
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="a-card"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
            borderLeft: `3px solid var(${toast.tone === 'ok' ? '--ok' : '--danger'}, #888)`,
          }}
        >
          {toast.tone === 'ok' ? <Check size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
          <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
          <button
            type="button"
            className="a-link-btn"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pager
// ---------------------------------------------------------------------------

export function Pager({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="a-table-card__footer">
      <span className="a-sub">
        {from}–{to} of {total}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="a-btn a-btn--ghost"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          type="button"
          className="a-btn a-btn--ghost"
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Fetch-on-mount with loading, error and a manual reload.
 *
 * `deps` is spread into the effect, so a page passes its filters and gets a
 * refetch when they change. The result of a stale request is discarded rather
 * than applied - without that, typing quickly in a search box lands the
 * earlier, slower response last and the list disagrees with the input.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (ticket === latest.current) setData(result);
      })
      .catch((err: Error) => {
        if (ticket === latest.current) setError(err.message);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** Delays a fast-changing value, so a search box does not fire per keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
