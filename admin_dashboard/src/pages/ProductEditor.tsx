import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GripVertical, Plus, Trash2, Upload } from 'lucide-react';

import { api, can } from '@/lib/api';
import type {
  Attribute, AttributeKind, Brand, CategoryNode, ProductImage, ProductVariant, Room,
} from '@/lib/api';
import {
  ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ArPanel } from '@/components/ArPanel';

const IMAGE_KINDS: ProductImage['kind'][] = ['studio', 'lifestyle', 'detail', 'dimension'];
const ATTRIBUTE_KINDS: AttributeKind[] = ['material', 'finish', 'colour', 'style', 'upholstery'];

interface Draft {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category_id: number | null;
  brand_id: number | null;
  status: 'draft' | 'active' | 'archived';
  assembly_required: boolean | null;
  assembly_note: string;
  warranty_months: number | null;
  care_instructions: string;
  seating_capacity: number | null;
  specifications: { label: string; value: string }[];
  meta_title: string;
  meta_description: string;
  room_ids: number[];
  attribute_ids: number[];
  variants: ProductVariant[];
  images: ProductImage[];
}

function blankVariant(position: number): ProductVariant {
  return {
    sku: '', option_label: null, price: '0.00', compare_at_price: null, cost_price: null,
    tax_rate: '18.00', stock_quantity: 0, low_stock_threshold: 3, backorder_allowed: false,
    width_mm: null, depth_mm: null, height_mm: null, weight_g: null,
    boxed_width_mm: null, boxed_depth_mm: null, boxed_height_mm: null,
    lead_time_days: null, position, is_active: true,
  };
}

const EMPTY: Draft = {
  name: '', slug: '', tagline: '', description: '',
  category_id: null, brand_id: null, status: 'draft',
  assembly_required: null, assembly_note: '', warranty_months: null,
  care_instructions: '', seating_capacity: null, specifications: [],
  meta_title: '', meta_description: '',
  room_ids: [], attribute_ids: [],
  variants: [blankVariant(0)], images: [],
};

export function ProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const isNew = !id;
  const readOnly = !can('products.write');

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Taxonomy is loaded once for the whole form. Four separate loading states
  // would make the form appear in pieces.
  const taxonomy = useAsync(
    async () => {
      const [categories, rooms, brands, attributes] = await Promise.all([
        api.categories(), api.rooms(), api.brands(), api.attributes(),
      ]);
      return { categories, rooms, brands, attributes };
    },
    [],
  );

  const existing = useAsync(
    async () => (isNew ? null : api.product(Number(id))),
    [id],
  );

  useEffect(() => {
    const product = existing.data;
    if (!product) return;
    setDraft({
      name: product.name,
      slug: product.slug,
      tagline: product.tagline ?? '',
      description: product.description ?? '',
      category_id: product.category_id,
      brand_id: product.brand_id,
      status: product.status,
      assembly_required: product.assembly_required,
      assembly_note: product.assembly_note ?? '',
      warranty_months: product.warranty_months,
      care_instructions: product.care_instructions ?? '',
      seating_capacity: product.seating_capacity,
      specifications: product.specifications ?? [],
      meta_title: product.meta_title ?? '',
      meta_description: product.meta_description ?? '',
      room_ids: product.room_ids,
      attribute_ids: product.attribute_ids,
      variants: product.variants.length ? product.variants : [blankVariant(0)],
      images: product.images,
    });
  }, [existing.data]);

  const flatCategories = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const node of nodes) {
        out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` });
        walk(node.children, depth + 1);
      }
    };
    walk(taxonomy.data?.categories ?? [], 0);
    return out;
  }, [taxonomy.data]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setVariant = (index: number, patch: Partial<ProductVariant>) =>
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const setImage = (index: number, patch: Partial<ProductImage>) =>
    setDraft((current) => ({
      ...current,
      images: current.images.map((img, i) => (i === index ? { ...img, ...patch } : img)),
    }));

  const toggleId = (key: 'room_ids' | 'attribute_ids', value: number) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((v) => v !== value)
        : [...current[key], value],
    }));

  const uploadImage = async (file: File) => {
    try {
      const result = await api.upload(file, 'products');
      setDraft((current) => ({
        ...current,
        images: [
          ...current.images,
          {
            url: result.url,
            // Seeded from the product name so the field is never left blank
            // by accident, but plainly a placeholder the author should
            // replace with what the photograph actually shows.
            alt_text: current.name ? `${current.name}, studio photograph` : '',
            kind: 'studio',
            position: current.images.length,
          },
        ],
      }));
      push('Image uploaded.');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    const payload = {
      ...draft,
      slug: draft.slug || undefined,
      tagline: draft.tagline || null,
      description: draft.description || null,
      assembly_note: draft.assembly_note || null,
      care_instructions: draft.care_instructions || null,
      meta_title: draft.meta_title || null,
      meta_description: draft.meta_description || null,
      specifications: draft.specifications.length ? draft.specifications : null,
      variants: draft.variants.map((variant, index) => ({
        ...variant,
        position: index,
        option_label: variant.option_label || null,
        // A blank compare-at is "no previous price", not zero - and zero
        // would be rejected as being below the selling price anyway.
        compare_at_price: variant.compare_at_price || null,
        cost_price: variant.cost_price || null,
      })),
      images: draft.images.map((image, index) => ({ ...image, position: index })),
    };

    try {
      const saved = isNew
        ? await api.createProduct(payload)
        : await api.updateProduct(Number(id), payload);
      push('Product saved.');
      if (isNew) navigate(`/products/${saved.id}`, { replace: true });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (existing.loading || taxonomy.loading) return <Spinner label="Loading the product" />;
  if (existing.error) return <ErrorNote error={existing.error} onRetry={existing.reload} />;
  if (taxonomy.error) return <ErrorNote error={taxonomy.error} onRetry={taxonomy.reload} />;

  const attributesByKind = (kind: AttributeKind) =>
    (taxonomy.data?.attributes ?? []).filter((a: Attribute) => a.kind === kind);

  return (
    <form onSubmit={save}>
      <PageHeader
        title={isNew ? 'New product' : draft.name || 'Product'}
        subtitle={isNew ? 'Drafts are invisible to customers until you publish.' : `/${draft.slug}`}
        actions={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={() => navigate('/products')}>
              Back to products
            </button>
            {!readOnly && (
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save product'}
              </button>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="a-note a-note--framed" style={{ marginBottom: 16 }}>
          Your role can view products but not change them.
        </div>
      )}
      {saveError && <ErrorNote error={saveError} />}

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Basics</h2>
          <div className="a-form-grid-2" style={{ marginTop: 14 }}>
            <label className="a-form-field">
              <span>Name</span>
              <input className="a-input" required value={draft.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="a-form-field">
              <span>URL slug</span>
              <input
                className="a-input"
                value={draft.slug}
                placeholder="Generated from the name"
                onChange={(e) => set('slug', e.target.value)}
              />
              <span className="a-form-hint">Changing this breaks any link already shared.</span>
            </label>
            <label className="a-form-field">
              <span>Category</span>
              <select
                className="a-select"
                value={draft.category_id ?? ''}
                onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No category</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="a-form-field">
              <span>Brand</span>
              <select
                className="a-select"
                value={draft.brand_id ?? ''}
                onChange={(e) => set('brand_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No brand</option>
                {(taxonomy.data?.brands ?? []).map((b: Brand) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="a-form-field">
              <span>Status</span>
              <select
                className="a-select"
                value={draft.status}
                disabled={!can('products.publish')}
                onChange={(e) => set('status', e.target.value as Draft['status'])}
              >
                <option value="draft">Draft — hidden from the shop</option>
                <option value="active">Active — on sale</option>
                <option value="archived">Archived — withdrawn</option>
              </select>
              {!can('products.publish') && (
                <span className="a-form-hint">Your role cannot publish or unpublish.</span>
              )}
            </label>
            <label className="a-form-field">
              <span>Seats</span>
              <input
                className="a-input"
                type="number"
                min={0}
                value={draft.seating_capacity ?? ''}
                onChange={(e) => set('seating_capacity', e.target.value ? Number(e.target.value) : null)}
              />
              <span className="a-form-hint">Leave blank for anything that is not seating.</span>
            </label>
          </div>

          <label className="a-form-field" style={{ marginTop: 14 }}>
            <span>Tagline</span>
            <input
              className="a-input"
              maxLength={300}
              value={draft.tagline}
              onChange={(e) => set('tagline', e.target.value)}
            />
            <span className="a-form-hint">One line, shown under the name on a card.</span>
          </label>

          <label className="a-form-field" style={{ marginTop: 14 }}>
            <span>Description</span>
            <textarea
              className="a-input"
              rows={6}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Variants</h2>
          <p className="a-sub">
            Price and stock belong to a variant, never to the product. A piece with one option still
            has one variant.
          </p>

          {draft.variants.map((variant, index) => (
            <div
              key={variant.id ?? `new-${index}`}
              style={{
                border: '1px solid var(--border, #e5e0da)', borderRadius: 8,
                padding: 16, marginTop: 14,
                opacity: variant.is_active ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong>{variant.option_label || variant.sku || `Variant ${index + 1}`}</strong>
                {draft.variants.length > 1 && (
                  <button
                    type="button"
                    className="a-btn a-btn--ghost"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        variants: current.variants.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 size={14} aria-hidden /> Remove
                  </button>
                )}
              </div>

              <div className="a-form-grid-2">
                <label className="a-form-field">
                  <span>SKU</span>
                  <input
                    className="a-input"
                    required
                    value={variant.sku}
                    onChange={(e) => setVariant(index, { sku: e.target.value.toUpperCase() })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Option label</span>
                  <input
                    className="a-input"
                    placeholder="Walnut / 3-seater"
                    value={variant.option_label ?? ''}
                    onChange={(e) => setVariant(index, { option_label: e.target.value })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Price (₹)</span>
                  <input
                    className="a-input" type="number" step="0.01" min="0" required
                    value={variant.price}
                    onChange={(e) => setVariant(index, { price: e.target.value })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Was (₹)</span>
                  <input
                    className="a-input" type="number" step="0.01" min="0"
                    value={variant.compare_at_price ?? ''}
                    onChange={(e) => setVariant(index, { compare_at_price: e.target.value })}
                  />
                  <span className="a-form-hint">Must be higher than the price, or blank.</span>
                </label>
                <label className="a-form-field">
                  <span>Cost (₹)</span>
                  <input
                    className="a-input" type="number" step="0.01" min="0"
                    value={variant.cost_price ?? ''}
                    onChange={(e) => setVariant(index, { cost_price: e.target.value })}
                  />
                  <span className="a-form-hint">Internal. Used for stock valuation.</span>
                </label>
                <label className="a-form-field">
                  <span>Tax rate (%)</span>
                  <input
                    className="a-input" type="number" step="0.01" min="0" max="100"
                    value={variant.tax_rate}
                    onChange={(e) => setVariant(index, { tax_rate: e.target.value })}
                  />
                  <span className="a-form-hint">Prices include tax.</span>
                </label>
                <label className="a-form-field">
                  <span>Stock on hand</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.stock_quantity}
                    onChange={(e) => setVariant(index, { stock_quantity: Number(e.target.value) })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Low-stock threshold</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.low_stock_threshold}
                    onChange={(e) => setVariant(index, { low_stock_threshold: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="a-form-grid-2" style={{ marginTop: 12 }}>
                <label className="a-form-field">
                  <span>Width (mm)</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.width_mm ?? ''}
                    onChange={(e) => setVariant(index, { width_mm: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Depth (mm)</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.depth_mm ?? ''}
                    onChange={(e) => setVariant(index, { depth_mm: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Height (mm)</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.height_mm ?? ''}
                    onChange={(e) => setVariant(index, { height_mm: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
                <label className="a-form-field">
                  <span>Lead time (days)</span>
                  <input
                    className="a-input" type="number" min="0"
                    value={variant.lead_time_days ?? ''}
                    onChange={(e) => setVariant(index, { lead_time_days: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={variant.backorder_allowed}
                    onChange={(e) => setVariant(index, { backorder_allowed: e.target.checked })}
                  />
                  Sell past zero (made to order)
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={variant.is_active}
                    onChange={(e) => setVariant(index, { is_active: e.target.checked })}
                  />
                  Available to buy
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="a-btn a-btn--ghost"
            style={{ marginTop: 14 }}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                variants: [...current.variants, blankVariant(current.variants.length)],
              }))
            }
          >
            <Plus size={15} aria-hidden /> Add a variant
          </button>
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Images</h2>
          <p className="a-sub">
            The first studio shot is what a product card uses. Alt text is required — it is what a
            screen reader and a failed image both fall back to.
          </p>

          <label className="a-btn a-btn--ghost" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
            <Upload size={15} aria-hidden /> Upload an image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
                // Cleared so choosing the same file twice fires a change.
                e.target.value = '';
              }}
            />
          </label>

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {draft.images.map((image, index) => (
              <div
                key={image.id ?? `img-${index}`}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  border: '1px solid var(--border, #e5e0da)', borderRadius: 8, padding: 12,
                }}
              >
                <GripVertical size={16} style={{ marginTop: 30, opacity: 0.4 }} aria-hidden />
                <img
                  src={image.url}
                  alt=""
                  width={72}
                  height={72}
                  style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                />
                <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                  <label className="a-form-field">
                    <span>Alt text</span>
                    <input
                      className="a-input"
                      required
                      minLength={3}
                      value={image.alt_text}
                      onChange={(e) => setImage(index, { alt_text: e.target.value })}
                    />
                  </label>
                  <label className="a-form-field">
                    <span>Kind</span>
                    <select
                      className="a-select"
                      value={image.kind}
                      onChange={(e) => setImage(index, { kind: e.target.value as ProductImage['kind'] })}
                    >
                      {IMAGE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>{kind}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="a-btn a-btn--ghost"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      images: current.images.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Rooms and attributes</h2>
          <p className="a-sub">These drive the shop's filters and its "shop by room" navigation.</p>

          <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
            <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Rooms</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(taxonomy.data?.rooms ?? []).map((room: Room) => (
                <Chip
                  key={room.id}
                  label={room.name}
                  checked={draft.room_ids.includes(room.id)}
                  onToggle={() => toggleId('room_ids', room.id)}
                />
              ))}
            </div>
          </fieldset>

          {ATTRIBUTE_KINDS.map((kind) => {
            const options = attributesByKind(kind);
            if (!options.length) return null;
            return (
              <fieldset key={kind} style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
                <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>
                  {kind}
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {options.map((attribute) => (
                    <Chip
                      key={attribute.id}
                      label={attribute.name}
                      swatch={attribute.hex_code}
                      checked={draft.attribute_ids.includes(attribute.id)}
                      onToggle={() => toggleId('attribute_ids', attribute.id)}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Delivery, assembly and care</h2>
          <p className="a-sub">
            Anything left blank is hidden on the product page rather than filled with generic copy.
          </p>
          <div className="a-form-grid-2" style={{ marginTop: 14 }}>
            <label className="a-form-field">
              <span>Assembly</span>
              <select
                className="a-select"
                value={draft.assembly_required === null ? '' : String(draft.assembly_required)}
                onChange={(e) =>
                  set('assembly_required', e.target.value === '' ? null : e.target.value === 'true')
                }
              >
                <option value="">Not stated</option>
                <option value="true">Assembly required</option>
                <option value="false">Arrives assembled</option>
              </select>
            </label>
            <label className="a-form-field">
              <span>Warranty (months)</span>
              <input
                className="a-input" type="number" min="0"
                value={draft.warranty_months ?? ''}
                onChange={(e) => set('warranty_months', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
          </div>
          <label className="a-form-field" style={{ marginTop: 14 }}>
            <span>Assembly note</span>
            <textarea
              className="a-input" rows={2}
              value={draft.assembly_note}
              onChange={(e) => set('assembly_note', e.target.value)}
            />
          </label>
          <label className="a-form-field" style={{ marginTop: 14 }}>
            <span>Care instructions</span>
            <textarea
              className="a-input" rows={3}
              value={draft.care_instructions}
              onChange={(e) => set('care_instructions', e.target.value)}
            />
          </label>
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Specifications</h2>
          <p className="a-sub">Free rows shown as a table. Anything filterable belongs in attributes instead.</p>
          {draft.specifications.map((row, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                className="a-input"
                placeholder="Label"
                value={row.label}
                onChange={(e) =>
                  set('specifications', draft.specifications.map((s, i) =>
                    i === index ? { ...s, label: e.target.value } : s))
                }
              />
              <input
                className="a-input"
                placeholder="Value"
                value={row.value}
                onChange={(e) =>
                  set('specifications', draft.specifications.map((s, i) =>
                    i === index ? { ...s, value: e.target.value } : s))
                }
              />
              <button
                type="button"
                className="a-btn a-btn--ghost"
                onClick={() => set('specifications', draft.specifications.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="a-btn a-btn--ghost"
            style={{ marginTop: 12 }}
            onClick={() => set('specifications', [...draft.specifications, { label: '', value: '' }])}
          >
            <Plus size={15} aria-hidden /> Add a row
          </button>
        </section>

        <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="a-h2">Search listing</h2>
          <div className="a-form-grid-2" style={{ marginTop: 14 }}>
            <label className="a-form-field">
              <span>Meta title</span>
              <input
                className="a-input" maxLength={200}
                value={draft.meta_title}
                onChange={(e) => set('meta_title', e.target.value)}
              />
            </label>
            <label className="a-form-field">
              <span>Meta description</span>
              <input
                className="a-input" maxLength={400}
                value={draft.meta_description}
                onChange={(e) => set('meta_description', e.target.value)}
              />
            </label>
          </div>
        </section>

      </fieldset>

      {/* Outside the fieldset above on purpose. AR is governed by its own
          permission and writes through its own endpoints, so it stays usable
          for someone who may manage models but not edit the product, and it
          is never carried along by "Save product". */}
      <section className="a-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="a-h2">AR &amp; 3D</h2>
        <p className="a-sub">
          The model customers place in their room. It is only offered to them once its real-world
          size matches the dimensions set on this product.
        </p>
        {isNew ? (
          <div className="a-note a-note--framed" style={{ marginTop: 14 }}>
            Save the product first. A model is attached to a product, and this one does not exist
            yet.
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <ArPanel productId={Number(id)} push={push} />
          </div>
        )}
      </section>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 40 }}>
          <button type="button" className="a-btn a-btn--ghost" onClick={() => navigate('/products')}>
            Cancel
          </button>
          <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </form>
  );
}

function Chip({
  label, checked, onToggle, swatch,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  swatch?: string | null;
}) {
  return (
    <label
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
        border: `1px solid ${checked ? 'var(--accent, #b4552d)' : 'var(--border, #e5e0da)'}`,
        background: checked ? 'var(--accent-soft, #f7ece6)' : 'transparent',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ margin: 0 }} />
      {swatch && (
        <span
          aria-hidden
          style={{
            width: 12, height: 12, borderRadius: 3, background: swatch,
            border: '1px solid rgba(0,0,0,.15)',
          }}
        />
      )}
      {label}
    </label>
  );
}
