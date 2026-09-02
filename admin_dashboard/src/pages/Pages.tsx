import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { Page } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  EmptyState, ErrorNote, IfAllowed, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Draft {
  slug: string;
  title: string;
  body: string;
  meta_title: string;
  meta_description: string;
  is_published: boolean;
  isNew: boolean;
}

export function Pages() {
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.pages(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);
  const writable = can('content.write');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const payload = {
      title: draft.title,
      body: draft.body,
      meta_title: draft.meta_title || null,
      meta_description: draft.meta_description || null,
      is_published: draft.is_published,
    };
    try {
      if (draft.isNew) await api.createPage({ ...payload, slug: draft.slug });
      else await api.updatePage(draft.slug, payload);
      push('Page saved.');
      setDraft(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const result = await api.deletePage(deleting.slug);
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
        title="Pages"
        subtitle="Policies and information, addressed by slug. HTML is sanitised when it is saved."
        actions={
          <IfAllowed permission="content.write">
            <button
              type="button"
              className="a-btn a-btn--primary"
              onClick={() =>
                setDraft({
                  slug: '', title: '', body: '', meta_title: '', meta_description: '',
                  is_published: true, isNew: true,
                })
              }
            >
              <Plus size={15} aria-hidden /> New page
            </button>
          </IfAllowed>
        }
      />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading pages" />}
      {data && data.length === 0 && <EmptyState title="No pages yet." body="Create the first one." />}

      {data && data.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Address</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last edited</th>
                  {writable && <th scope="col"><span className="nk-sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.map((page) => (
                  <tr key={page.slug}>
                    <td>
                      {page.title}
                      {page.is_system && (
                        <span className="a-badge a-badge--ghost" style={{ marginLeft: 8 }} title="Linked from the storefront">
                          Linked
                        </span>
                      )}
                    </td>
                    <td><code>/{page.slug}</code></td>
                    <td>
                      <span className={`a-badge ${page.is_published ? 'a-badge--ok' : 'a-badge--ghost'}`}>
                        {page.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>{formatDateTime(page.updated_at)}</td>
                    {writable && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="a-btn a-btn--ghost"
                          onClick={() =>
                            setDraft({
                              slug: page.slug,
                              title: page.title,
                              body: page.body,
                              meta_title: page.meta_title ?? '',
                              meta_description: page.meta_description ?? '',
                              is_published: page.is_published,
                              isNew: false,
                            })
                          }
                        >
                          <Pencil size={13} aria-hidden /> Edit
                        </button>
                        {/* System pages are linked from the footer and
                            checkout; the API refuses to delete them, so the
                            button is not offered rather than offered and
                            rejected. */}
                        {!page.is_system && (
                          <button
                            type="button"
                            className="a-btn a-btn--ghost"
                            style={{ marginLeft: 6 }}
                            aria-label={`Delete ${page.title}`}
                            onClick={() => setDeleting(page)}
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
        <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form className="a-dialog a-dialog--wide" onSubmit={save}>
            <h2>{draft.isNew ? 'New page' : `Edit ${draft.title}`}</h2>

            <div className="a-form-grid-2">
              <label className="a-form-field">
                <span>Title</span>
                <input className="a-input" required autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="a-form-field">
                <span>Address</span>
                <input
                  className="a-input"
                  required
                  // The slug is the address customers and the footer already
                  // link to. Changing it would 404 those links, so it is
                  // settled at creation and read-only afterwards.
                  disabled={!draft.isNew}
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
                {!draft.isNew && <span className="a-form-hint">The address cannot change once links point at it.</span>}
              </label>
            </div>

            <label className="a-form-field">
              <span>Content (HTML)</span>
              <textarea
                className="a-input"
                rows={14}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <span className="a-form-hint">
                Headings, lists, links, tables and images are kept. Scripts and inline styles are stripped on save.
              </span>
            </label>

            <div className="a-form-grid-2">
              <label className="a-form-field">
                <span>Meta title</span>
                <input className="a-input" value={draft.meta_title} onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })} />
              </label>
              <label className="a-form-field">
                <span>Meta description</span>
                <input className="a-input" value={draft.meta_description} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} />
              </label>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
              Visible on the storefront
            </label>

            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save the page'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.title}?`}
          body={`Anything linking to /${deleting.slug} will 404. Unpublish it instead if you may want it back.`}
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
