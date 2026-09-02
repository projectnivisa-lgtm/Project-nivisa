import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { ProductRow } from '@/lib/api';
import { AR_STATUS_LABEL, AR_STATUS_TONE } from '@/components/ArPanel';
import { formatMoney } from '@/lib/format';
import {
  EmptyState, ErrorNote, IfAllowed, PageHeader, Pager, ProductStatusBadge,
  Spinner, ToastStack, useAsync, useDebounced, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const LIMIT = 25;

export function Products() {
  const [params, setParams] = useSearchParams();
  const { toasts, push, dismiss } = useToasts();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const query = useDebounced(search);
  const status = params.get('status') ?? '';
  const stock = params.get('stock') ?? '';
  const ar = params.get('ar') ?? '';
  const sort = params.get('sort') ?? 'recent';
  const offset = Number(params.get('offset') ?? 0);
  const [archiving, setArchiving] = useState<ProductRow | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change returns to the first page. Without this, narrowing a
    // list while on page four shows an empty screen that looks like no
    // results at all.
    if (key !== 'offset') next.delete('offset');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useAsync(
    () => api.products({ q: query, status, stock, ar, sort, limit: LIMIT, offset }),
    [query, status, stock, ar, sort, offset],
  );

  const archive = async () => {
    if (!archiving) return;
    try {
      const result = await api.archiveProduct(archiving.id);
      push(result.message);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setArchiving(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Everything in the catalogue, including drafts and archived pieces."
        actions={
          <IfAllowed permission="products.write">
            <Link to="/products/new" className="a-btn a-btn--primary">
              <Plus size={15} aria-hidden /> New product
            </Link>
          </IfAllowed>
        }
      />

      <div className="a-toolbar" style={{ marginBottom: 16 }}>
        <input
          className="a-input"
          type="search"
          placeholder="Search by name or SKU"
          aria-label="Search products"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setParam('q', e.target.value);
          }}
          style={{ minWidth: 240 }}
        />
        <select className="a-select" aria-label="Status" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className="a-select" aria-label="Stock" value={stock} onChange={(e) => setParam('stock', e.target.value)}>
          <option value="">Any stock level</option>
          <option value="low">Running low</option>
          <option value="out">Out of stock</option>
          <option value="in">In stock</option>
        </select>
        {/* AR moved onto the product itself, so this is what replaced the
            screen that listed every product and its model: the question it
            answered was "which of these still needs one", and that is a filter
            on the catalogue, not a catalogue of its own. */}
        <select className="a-select" aria-label="AR model" value={ar} onChange={(e) => setParam('ar', e.target.value)}>
          <option value="">Any AR status</option>
          <option value="missing">Needs a model</option>
          <option value="processing">Needs checking</option>
          <option value="ready">AR live</option>
          <option value="failed">Failed checks</option>
          <option value="deprecated">Withdrawn</option>
        </select>
        <select className="a-select" aria-label="Sort" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="recent">Recently updated</option>
          <option value="name">Name</option>
          <option value="price_asc">Price, low to high</option>
          <option value="price_desc">Price, high to low</option>
          <option value="stock">Stock, low to high</option>
        </select>
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading products" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No products match."
          body="Try a different search, or clear the filters."
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
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">AR</th>
                  <th scope="col" className="a-num">From</th>
                  <th scope="col" className="a-num">Stock</th>
                  <th scope="col" className="a-num">Variants</th>
                  <th scope="col"><span className="nk-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {product.primary_image ? (
                          <img
                            src={product.primary_image.url}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                            style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                          />
                        ) : (
                          <span
                            aria-hidden
                            style={{
                              width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                              background: 'var(--border, #e5e0da)',
                            }}
                          />
                        )}
                        <div>
                          <Link to={`/products/${product.id}`}>{product.name}</Link>
                          {product.brand && (
                            <div className="a-sub" style={{ fontSize: 12 }}>{product.brand.name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{product.category?.name ?? '—'}</td>
                    <td><ProductStatusBadge value={product.status} /></td>
                    <td>
                      {/* A dash rather than "No model" for the common case:
                          most of a furniture catalogue will never have one,
                          and a column of grey badges saying so would shout
                          louder than the products that do. */}
                      {product.ar_status && product.ar_status !== 'unavailable' ? (
                        <span className={`a-badge ${AR_STATUS_TONE[product.ar_status]}`}>
                          {AR_STATUS_LABEL[product.ar_status]}
                        </span>
                      ) : (
                        <span className="a-sub">—</span>
                      )}
                    </td>
                    <td className="a-num">{formatMoney(Number(product.price_from))}</td>
                    <td className="a-num">
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        title={product.low_stock ? 'At or below the low-stock threshold' : undefined}
                      >
                        {product.low_stock && <AlertTriangle size={13} aria-label="Running low" />}
                        {product.total_stock}
                      </span>
                    </td>
                    <td className="a-num">{product.variant_count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/products/${product.id}`} className="a-btn a-btn--ghost">
                        {can('products.write') ? 'Edit' : 'View'}
                      </Link>
                      {product.status !== 'archived' && (
                        <IfAllowed permission="products.delete">
                          <button
                            type="button"
                            className="a-btn a-btn--ghost"
                            style={{ marginLeft: 6 }}
                            onClick={() => setArchiving(product)}
                          >
                            Archive
                          </button>
                        </IfAllowed>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            total={data.total}
            limit={LIMIT}
            offset={offset}
            onChange={(value) => setParam('offset', String(value))}
          />
        </div>
      )}

      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}?`}
          body="It disappears from the shop straight away. Past orders keep it, and you can bring it back by setting its status to active."
          confirmLabel="Archive it"
          destructive
          onConfirm={archive}
          onCancel={() => setArchiving(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
