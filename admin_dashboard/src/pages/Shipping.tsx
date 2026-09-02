import { api } from '@/lib/api';
import type { ShippingRate } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { CheckField, CrudTable, TextField } from '@/components/CrudTable';

interface Draft {
  name: string;
  postcode_prefixes: string;
  rate: string;
  free_above: string;
  estimated_days_min: string;
  estimated_days_max: string;
  position: number;
  is_active: boolean;
}

export function Shipping() {
  return (
    <CrudTable<ShippingRate, Draft>
      config={{
        title: 'Shipping rates',
        subtitle:
          'The longest matching PIN prefix wins, so 5600 beats 56. Keep exactly one rate with no prefixes as the fallback.',
        noun: 'rate',
        writePermission: 'settings.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.name,
        load: () => api.shippingRates(),
        create: (draft) => api.createShippingRate(toPayload(draft)),
        update: (id, draft) => api.updateShippingRate(id, toPayload(draft)),
        remove: (id) => api.deleteShippingRate(id),
        deleteWarning:
          'Orders to those PIN codes fall through to the next matching rate. Deleting the fallback would make them ship free.',
        columns: [
          { header: 'Zone', render: (row) => row.name },
          {
            header: 'PIN prefixes',
            render: (row) => (row.postcode_prefixes ? <code>{row.postcode_prefixes}</code> : <em>Everywhere else</em>),
          },
          { header: 'Rate', render: (row) => formatMoney(Number(row.rate)), numeric: true },
          {
            header: 'Free above',
            render: (row) => (row.free_above ? formatMoney(Number(row.free_above)) : '—'),
            numeric: true,
          },
          {
            header: 'Estimate',
            render: (row) =>
              row.estimated_days_min && row.estimated_days_max
                ? `${row.estimated_days_min}–${row.estimated_days_max} days`
                : '—',
          },
          {
            header: 'Status',
            render: (row) => (
              <span className={`a-badge ${row.is_active ? 'a-badge--ok' : 'a-badge--ghost'}`}>
                {row.is_active ? 'Live' : 'Off'}
              </span>
            ),
          },
        ],
        blankDraft: () => ({
          name: '', postcode_prefixes: '', rate: '0', free_above: '',
          estimated_days_min: '', estimated_days_max: '', position: 0, is_active: true,
        }),
        toDraft: (row) => ({
          name: row.name,
          postcode_prefixes: row.postcode_prefixes,
          rate: row.rate,
          free_above: row.free_above ?? '',
          estimated_days_min: row.estimated_days_min?.toString() ?? '',
          estimated_days_max: row.estimated_days_max?.toString() ?? '',
          position: row.position,
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField label="Zone name" required value={draft.name} onChange={(v) => set('name', v)} />
            <TextField
              label="PIN code prefixes"
              value={draft.postcode_prefixes}
              onChange={(v) => set('postcode_prefixes', v)}
              placeholder="560,561,562"
              hint="Comma-separated. Leave blank to make this the fallback for everywhere else."
            />
            <TextField
              label="Rate (₹)"
              type="number"
              step="0.01"
              min="0"
              required
              value={draft.rate}
              onChange={(v) => set('rate', v)}
            />
            <TextField
              label="Free above (₹)"
              type="number"
              step="0.01"
              min="0"
              value={draft.free_above}
              onChange={(v) => set('free_above', v)}
              hint="Blank means shipping is always charged."
            />
            <div className="a-form-grid-2">
              <TextField
                label="Fastest (days)"
                type="number"
                min="0"
                value={draft.estimated_days_min}
                onChange={(v) => set('estimated_days_min', v)}
              />
              <TextField
                label="Slowest (days)"
                type="number"
                min="0"
                value={draft.estimated_days_max}
                onChange={(v) => set('estimated_days_max', v)}
              />
            </div>
            <TextField label="Position" type="number" value={draft.position} onChange={(v) => set('position', Number(v))} />
            <CheckField label="Use this rate" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          </>
        ),
      }}
    />
  );
}

function toPayload(draft: Draft) {
  return {
    name: draft.name,
    postcode_prefixes: draft.postcode_prefixes.replace(/\s+/g, ''),
    rate: draft.rate || '0',
    free_above: draft.free_above || null,
    estimated_days_min: draft.estimated_days_min ? Number(draft.estimated_days_min) : null,
    estimated_days_max: draft.estimated_days_max ? Number(draft.estimated_days_max) : null,
    position: draft.position,
    is_active: draft.is_active,
  };
}
