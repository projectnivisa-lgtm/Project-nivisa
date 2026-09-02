import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { Collection, ProductRow } from '@/lib/api';
import {
  EmptyState, ErrorNote, IfAllowed, PageHeader, Spinner, ToastStack, useAsync,
  useDebounced, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Draft {
  id?: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  position: number;
  is_active: boolean;
  is_featured: boolean;
}

const blank = (): Draft => ({
  name: '', slug: '', description: '', image_url: '', position: 0, is_active: true, is_featured: false,
});

export function Collections() {
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.collections(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [curating, setCurating] = useState<Collection | null>(null);
  const writable = can('taxonomy.write');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const payload = {
      name: draft.name,
      slug: draft.slug || undefined,
      description: draft.description || null,
      image_url: draft.image_url || null,
      position: draft.position,
      is_active: draft.is_active,
      is_featured: draft.is_featured,
    };
    try {
      if (draft.id) await api.updateCollection(draft.id, payload);
      else await api.createCollection(payload);
      push('Collection saved.');
      setDraft(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const result = await api.deleteCollection(deleting.id);
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
        title="Collections"
        subtitle="Hand-curated rails. Create as many as you like — the order you set here is the order customers see."
        actions={
          <IfAllowed permission="taxonomy.write">
            <button type="button" className="a-btn a-btn--primary" onClick={() => setDraft(blank())}>
              <Plus size={15} aria-hidden /> New collection
            </button>
          </IfAllowed>
        }
      />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading collections" />}

      {data && data.length === 0 && (
        <EmptyState
          title="No collections yet."
          body='Try "New This Season" or "Small Spaces" — anything you would want as a rail on the homepage.'
        />
      )}

      {data && data.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Slug</th>
                  <th scope="col" className="a-num">Products</th>
                  <th scope="col">On homepage</th>
                  <th scope="col">Status</th>
                  {writable && <th scope="col"><span className="nk-sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.map((collection) => (
                  <tr key={collection.id}>
                    <td>{collection.name}</td>
                    <td><code>{collection.slug}</code></td>
                    <td className="a-num">{collection.product_count}</td>
                    <td>
                      <span className={`a-badge ${collection.is_featured ? 'a-badge--info' : 'a-badge--ghost'}`}>
                        {collection.is_featured ? 'Featured' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`a-badge ${collection.is_active ? 'a-badge--ok' : 'a-badge--ghost'}`}>
                        {collection.is_active ? 'Live' : 'Hidden'}
                      </span>
                    </td>
                    {writable && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="a-btn a-btn--ghost" onClick={() => setCurating(collection)}>
                          Products
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn--ghost"
                          style={{ marginLeft: 6 }}
                          onClick={() =>
                            setDraft({
                              ...collection,
                              description: collection.description ?? '',
                              image_url: collection.image_url ?? '',
                            })
                          }
                        >
                          <Pencil size={13} aria-hidden /> Edit
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn--ghost"
                          style={{ marginLeft: 6 }}
                          aria-label={`Delete ${collection.name}`}
                          onClick={() => setDeleting(collection)}
                        >
                          <Trash2 size={13} aria-hidden />
                        </button>
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
          <form className="a-dialog" onSubmit={save}>
            <h2>{draft.id ? 'Edit collection' : 'New collection'}</h2>
            <label className="a-form-field">
              <span>Name</span>
              <input className="a-input" required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="a-form-field">
              <span>URL slug</span>
              <input
                className="a-input"
                placeholder="Generated from the name"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
              <span className="a-form-hint">A homepage rail refers to a collection by this slug.</span>
            </label>
            <label className="a-form-field">
              <span>Description</span>
              <textarea className="a-input" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="a-form-field">
              <span>Image URL</span>
              <input className="a-input" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} />
            </label>
            <label className="a-form-field">
              <span>Position</span>
              <input className="a-input" type="number" value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, margin: '10px 0' }}>
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
              Live in the shop
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={draft.is_featured} onChange={(e) => setDraft({ ...draft, is_featured: e.target.checked })} />
              Offer as a homepage rail
            </label>
            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="a-btn a-btn--primary">Save</button>
            </div>
          </form>
        </div>
      )}

      {curating && (
        <CurateDialog
          collection={curating}
          onClose={() => setCurating(null)}
          onSaved={(message) => {
            push(message);
            setCurating(null);
            reload();
          }}
          onError={(message) => push(message, 'error')}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="The products stay in the catalogue; only the rail goes. Any homepage band pointing at it will render empty."
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

/**
 * Picking and ordering the products in one rail.
 *
 * The order is the whole point of a collection, so chosen products are a
 * reorderable list rather than a set of ticks - a merchandiser deciding what
 * customers see first cannot express that with checkboxes.
 */
function CurateDialog({
  collection, onClose, onSaved, onError,
}: {
  collection: Collection;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const [chosen, setChosen] = useState<ProductRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // The collection's current membership, in order. Loaded once; the search
  // results below are a separate, changing list.
  const current = useAsync(
    async () => api.products({ collection_id: collection.id, limit: 100 }),
    [collection.id],
  );

  const results = useAsync(
    () => api.products({ q: query, status: 'active', limit: 20 }),
    [query],
  );

  if (current.data && !loaded) {
    setChosen(current.data.items);
    setLoaded(true);
  }

  const add = (product: ProductRow) => {
    if (chosen.some((p) => p.id === product.id)) return;
    setChosen((list) => [...list, product]);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= chosen.length) return;
    setChosen((list) => {
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.setCollectionProducts(collection.id, chosen.map((p) => p.id));
      onSaved(result.message);
    } catch (err) {
      onError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="a-dialog a-dialog--wide" role="dialog" aria-modal="true" aria-label={`Products in ${collection.name}`}>
        <button type="button" className="a-dialog__close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>Products in {collection.name}</h2>
        <p className="a-sub">The order below is the order customers see on the rail.</p>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
          <div>
            <h3 className="a-h2" style={{ fontSize: 14 }}>In this collection ({chosen.length})</h3>
            {chosen.length === 0 ? (
              <p className="a-sub" style={{ marginTop: 10 }}>Nothing chosen yet.</p>
            ) : (
              <ol style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                {chosen.map((product, index) => (
                  <li
                    key={product.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                      border: '1px solid var(--border, #e5e0da)', borderRadius: 6, padding: '6px 8px',
                    }}
                  >
                    <span className="a-num" style={{ width: 20, opacity: 0.5 }}>{index + 1}</span>
                    <span style={{ flex: 1 }}>{product.name}</span>
                    <button type="button" className="a-link-btn" aria-label={`Move ${product.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className="a-link-btn" aria-label={`Move ${product.name} down`} disabled={index === chosen.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="a-link-btn"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => setChosen((list) => list.filter((p) => p.id !== product.id))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <h3 className="a-h2" style={{ fontSize: 14 }}>Add a product</h3>
            <input
              className="a-input"
              type="search"
              placeholder="Search active products"
              aria-label="Search products to add"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginTop: 10, width: '100%' }}
            />
            {results.loading && <Spinner label="Searching" />}
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {(results.data?.items ?? []).map((product) => {
                const already = chosen.some((p) => p.id === product.id);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="a-btn a-btn--ghost"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      disabled={already}
                      onClick={() => add(product)}
                    >
                      {already ? '✓ ' : '+ '}
                      {product.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="a-btn a-btn--primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save the rail'}
          </button>
        </div>
      </div>
    </div>
  );
}
