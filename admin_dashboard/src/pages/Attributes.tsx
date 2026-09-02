import { useState } from 'react';

import { api } from '@/lib/api';
import type { Attribute, AttributeKind, Brand } from '@/lib/api';
import { CheckField, CrudTable, TextField } from '@/components/CrudTable';

const KINDS: { key: AttributeKind; label: string; hint: string }[] = [
  { key: 'material', label: 'Materials', hint: 'Teak, sheesham, rattan, marble.' },
  { key: 'finish', label: 'Finishes', hint: 'Natural oil, walnut stain, matte black.' },
  { key: 'colour', label: 'Colours', hint: 'Each carries a swatch shown in the shop filters.' },
  { key: 'style', label: 'Styles', hint: 'Contemporary, mid-century, rustic.' },
  { key: 'upholstery', label: 'Upholstery', hint: 'Cotton weave, boucle, leather, linen.' },
];

type Tab = 'brands' | AttributeKind;

export function Attributes() {
  const [tab, setTab] = useState<Tab>('brands');

  return (
    <>
      <div className="a-fulfilment-tabs" role="tablist" aria-label="Attribute type" style={{ marginBottom: 20 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'brands'}
          className={`a-fulfilment-tab ${tab === 'brands' ? 'a-fulfilment-tab--active' : ''}`}
          onClick={() => setTab('brands')}
        >
          Brands
        </button>
        {KINDS.map((kind) => (
          <button
            key={kind.key}
            type="button"
            role="tab"
            aria-selected={tab === kind.key}
            className={`a-fulfilment-tab ${tab === kind.key ? 'a-fulfilment-tab--active' : ''}`}
            onClick={() => setTab(kind.key)}
          >
            {kind.label}
          </button>
        ))}
      </div>

      {/* Keyed by tab so switching remounts the table and refetches, rather
          than showing the previous kind's rows while the new ones load. */}
      {tab === 'brands' ? <BrandsPanel key="brands" /> : <AttributePanel key={tab} kind={tab} />}
    </>
  );
}

interface BrandDraft {
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  is_active: boolean;
}

function BrandsPanel() {
  return (
    <CrudTable<Brand, BrandDraft>
      config={{
        title: 'Brands',
        subtitle: 'Who made the piece. Optional on a product.',
        noun: 'brand',
        writePermission: 'taxonomy.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.name,
        load: () => api.brands(),
        create: (draft) => api.createBrand(clean(draft)),
        update: (id, draft) => api.updateBrand(id, clean(draft)),
        remove: (id) => api.deleteBrand(id),
        deleteWarning: 'Products keep their other details but lose the brand.',
        columns: [
          { header: 'Brand', render: (row) => row.name },
          { header: 'Slug', render: (row) => <code>{row.slug}</code> },
          {
            header: 'Status',
            render: (row) => (
              <span className={`a-badge ${row.is_active ? 'a-badge--ok' : 'a-badge--ghost'}`}>
                {row.is_active ? 'Visible' : 'Hidden'}
              </span>
            ),
          },
        ],
        blankDraft: () => ({ name: '', slug: '', description: '', logo_url: '', is_active: true }),
        toDraft: (row) => ({
          name: row.name,
          slug: row.slug,
          description: row.description ?? '',
          logo_url: row.logo_url ?? '',
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField label="Name" required value={draft.name} onChange={(v) => set('name', v)} />
            <TextField label="URL slug" placeholder="Generated from the name" value={draft.slug} onChange={(v) => set('slug', v)} />
            <TextField label="Description" value={draft.description} onChange={(v) => set('description', v)} />
            <TextField label="Logo URL" value={draft.logo_url} onChange={(v) => set('logo_url', v)} />
            <CheckField label="Visible in the shop" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          </>
        ),
      }}
    />
  );
}

interface AttributeDraft {
  kind: AttributeKind;
  name: string;
  slug: string;
  hex_code: string;
  position: number;
  is_active: boolean;
}

function AttributePanel({ kind }: { kind: AttributeKind }) {
  const meta = KINDS.find((k) => k.key === kind)!;
  const isColour = kind === 'colour';

  return (
    <CrudTable<Attribute, AttributeDraft>
      config={{
        title: meta.label,
        subtitle: `${meta.hint} Every value here becomes a filter in the shop.`,
        noun: kind,
        writePermission: 'taxonomy.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.name,
        load: () => api.attributes(kind),
        create: (draft) => api.createAttribute(cleanAttribute(draft)),
        update: (id, draft) => api.updateAttribute(id, cleanAttribute(draft)),
        remove: (id) => api.deleteAttribute(id),
        deleteWarning: 'Products lose this attribute and drop out of its filter.',
        columns: [
          {
            header: 'Name',
            render: (row) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {row.hex_code && (
                  <span
                    aria-hidden
                    style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: row.hex_code, border: '1px solid rgba(0,0,0,.15)',
                    }}
                  />
                )}
                {row.name}
              </span>
            ),
          },
          { header: 'Slug', render: (row) => <code>{row.slug}</code> },
          { header: 'Position', render: (row) => row.position, numeric: true },
          {
            header: 'Status',
            render: (row) => (
              <span className={`a-badge ${row.is_active ? 'a-badge--ok' : 'a-badge--ghost'}`}>
                {row.is_active ? 'Visible' : 'Hidden'}
              </span>
            ),
          },
        ],
        blankDraft: () => ({ kind, name: '', slug: '', hex_code: '', position: 0, is_active: true }),
        toDraft: (row) => ({
          kind: row.kind,
          name: row.name,
          slug: row.slug,
          hex_code: row.hex_code ?? '',
          position: row.position,
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField label="Name" required value={draft.name} onChange={(v) => set('name', v)} />
            <TextField label="URL slug" placeholder="Generated from the name" value={draft.slug} onChange={(v) => set('slug', v)} />
            {isColour && (
              <label className="a-form-field">
                <span>Swatch</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={draft.hex_code || '#cccccc'}
                    onChange={(e) => set('hex_code', e.target.value)}
                    style={{ width: 44, height: 38, padding: 2 }}
                    aria-label="Pick a colour"
                  />
                  <input
                    className="a-input"
                    placeholder="#8B5E3C"
                    value={draft.hex_code}
                    onChange={(e) => set('hex_code', e.target.value)}
                  />
                </span>
                <span className="a-form-hint">Shown as the swatch on the shop's colour filter.</span>
              </label>
            )}
            <TextField label="Position" type="number" value={draft.position} onChange={(v) => set('position', Number(v))} />
            <CheckField label="Visible in the shop" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          </>
        ),
      }}
    />
  );
}

function clean(draft: BrandDraft) {
  return {
    ...draft,
    slug: draft.slug || undefined,
    description: draft.description || null,
    logo_url: draft.logo_url || null,
  };
}

function cleanAttribute(draft: AttributeDraft) {
  return {
    ...draft,
    slug: draft.slug || undefined,
    // The server rejects a malformed hex, so an empty field must be null
    // rather than "" - otherwise saving a material with no swatch fails
    // validation for a field that does not apply to it.
    hex_code: draft.hex_code || null,
  };
}
