/**
 * A list plus a modal form, for the masters that are genuinely the same
 * shape: rooms, brands, attributes, shipping rates, coupons.
 *
 * Generic rather than five near-copies, because five copies is how one of
 * them ends up with a different confirmation message, a missing permission
 * check, or a form that silently drops a field.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { can } from '@/lib/api';
import {
  EmptyState, ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

export interface CrudConfig<T, D> {
  title: string;
  subtitle: string;
  /** Noun used in buttons and confirmations: "room", "brand". */
  noun: string;
  writePermission: string;
  columns: Column<T>[];
  load: () => Promise<T[]>;
  create: (draft: D) => Promise<unknown>;
  update: (id: number, draft: D) => Promise<unknown>;
  remove?: (id: number) => Promise<{ message: string }>;
  /** Warning shown in the delete dialog, above the generic line. */
  deleteWarning?: string;
  blankDraft: () => D;
  toDraft: (row: T) => D;
  rowId: (row: T) => number;
  rowLabel: (row: T) => string;
  /** The form body. Receives the draft and a setter for one field. */
  form: (draft: D, set: <K extends keyof D>(key: K, value: D[K]) => void) => ReactNode;
}

export function CrudTable<T, D>({ config }: { config: CrudConfig<T, D> }) {
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(config.load, []);
  const [draft, setDraft] = useState<{ id?: number; values: D } | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const writable = can(config.writePermission);

  const set = <K extends keyof D>(key: K, value: D[K]) =>
    setDraft((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) await config.update(draft.id, draft.values);
      else await config.create(draft.values);
      push(`${capitalise(config.noun)} saved.`);
      setDraft(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting || !config.remove) return;
    try {
      const result = await config.remove(config.rowId(deleting));
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
        title={config.title}
        subtitle={config.subtitle}
        actions={
          writable && (
            <button
              type="button"
              className="a-btn a-btn--primary"
              onClick={() => setDraft({ values: config.blankDraft() })}
            >
              <Plus size={15} aria-hidden /> New {config.noun}
            </button>
          )
        }
      />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label={`Loading ${config.title.toLowerCase()}`} />}

      {data && data.length === 0 && (
        <EmptyState
          title={`No ${config.noun}s yet.`}
          body={writable ? `Create the first ${config.noun} to get started.` : 'Nothing has been set up yet.'}
        />
      )}

      {data && data.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.header} scope="col" className={column.numeric ? 'a-num' : undefined}>
                      {column.header}
                    </th>
                  ))}
                  {writable && <th scope="col"><span className="nk-sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={config.rowId(row)}>
                    {config.columns.map((column) => (
                      <td key={column.header} className={column.numeric ? 'a-num' : undefined}>
                        {column.render(row)}
                      </td>
                    ))}
                    {writable && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="a-btn a-btn--ghost"
                          onClick={() => setDraft({ id: config.rowId(row), values: config.toDraft(row) })}
                        >
                          <Pencil size={13} aria-hidden /> Edit
                        </button>
                        {config.remove && (
                          <button
                            type="button"
                            className="a-btn a-btn--ghost"
                            style={{ marginLeft: 6 }}
                            aria-label={`Delete ${config.rowLabel(row)}`}
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 size={13} aria-hidden />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {draft && (
        <div
          className="a-dialog-backdrop"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setDraft(null)}
        >
          <form className="a-dialog" onSubmit={save}>
            <h2>{draft.id ? `Edit ${config.noun}` : `New ${config.noun}`}</h2>
            {config.form(draft.values, set)}
            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${config.rowLabel(deleting)}?`}
          body={config.deleteWarning ?? 'This cannot be undone.'}
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

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Shared field helpers, so every CRUD form looks the same. */
export function TextField({
  label, value, onChange, required, hint, type = 'text', placeholder, ...rest
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  type?: string;
  placeholder?: string;
  [key: string]: unknown;
}) {
  return (
    <label className="a-form-field">
      <span>{label}</span>
      <input
        className="a-input"
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint && <span className="a-form-hint">{hint}</span>}
    </label>
  );
}

export function CheckField({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, margin: '10px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
