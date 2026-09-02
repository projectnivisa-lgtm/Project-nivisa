import { api } from '@/lib/api';
import type { Coupon } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { CheckField, CrudTable, TextField } from '@/components/CrudTable';

interface Draft {
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  max_discount: string;
  min_order_value: string;
  starts_at: string;
  ends_at: string;
  usage_limit: string;
  usage_limit_per_customer: string;
  is_active: boolean;
}

export function Coupons() {
  return (
    <CrudTable<Coupon, Draft>
      config={{
        title: 'Discounts',
        subtitle: 'Codes a customer types at checkout. Percentages should always carry a cap.',
        noun: 'coupon',
        writePermission: 'coupons.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.code,
        load: () => api.coupons(),
        create: (draft) => api.createCoupon(toPayload(draft)),
        update: (id, draft) => api.updateCoupon(id, toPayload(draft)),
        remove: (id) => api.deactivateCoupon(id),
        deleteWarning:
          'The code stops working immediately. It is deactivated rather than deleted, so past orders still explain their discount.',
        columns: [
          { header: 'Code', render: (row) => <code>{row.code}</code> },
          {
            header: 'Discount',
            render: (row) =>
              row.discount_type === 'percent'
                ? `${Number(row.discount_value)}%${row.max_discount ? ` (max ${formatMoney(Number(row.max_discount))})` : ''}`
                : formatMoney(Number(row.discount_value)),
          },
          {
            header: 'Minimum spend',
            render: (row) => (Number(row.min_order_value) > 0 ? formatMoney(Number(row.min_order_value)) : '—'),
            numeric: true,
          },
          {
            header: 'Window',
            render: (row) =>
              row.starts_at || row.ends_at
                ? `${row.starts_at ? formatDate(row.starts_at) : '—'} to ${row.ends_at ? formatDate(row.ends_at) : '—'}`
                : 'Always',
          },
          {
            header: 'Used',
            render: (row) => `${row.used_count}${row.usage_limit ? ` / ${row.usage_limit}` : ''}`,
            numeric: true,
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
          code: '', description: '', discount_type: 'percent', discount_value: '10',
          max_discount: '', min_order_value: '0', starts_at: '', ends_at: '',
          usage_limit: '', usage_limit_per_customer: '', is_active: true,
        }),
        toDraft: (row) => ({
          code: row.code,
          description: row.description ?? '',
          discount_type: row.discount_type,
          discount_value: row.discount_value,
          max_discount: row.max_discount ?? '',
          min_order_value: row.min_order_value,
          // datetime-local wants "YYYY-MM-DDTHH:mm"; the API sends a full
          // ISO string with seconds and a zone, which the input rejects
          // outright and renders as blank.
          starts_at: toLocalInput(row.starts_at),
          ends_at: toLocalInput(row.ends_at),
          usage_limit: row.usage_limit?.toString() ?? '',
          usage_limit_per_customer: row.usage_limit_per_customer?.toString() ?? '',
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField
              label="Code"
              required
              value={draft.code}
              onChange={(v) => set('code', v.toUpperCase())}
              hint="What the customer types. Case does not matter at checkout."
            />
            <TextField label="Description" value={draft.description} onChange={(v) => set('description', v)} />

            <label className="a-form-field">
              <span>Type</span>
              <select
                className="a-select"
                value={draft.discount_type}
                onChange={(e) => set('discount_type', e.target.value as Draft['discount_type'])}
              >
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </label>

            <TextField
              label={draft.discount_type === 'percent' ? 'Percentage' : 'Amount (₹)'}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={draft.discount_value}
              onChange={(v) => set('discount_value', v)}
            />

            {draft.discount_type === 'percent' && (
              <TextField
                label="Maximum discount (₹)"
                type="number"
                step="0.01"
                min="0"
                value={draft.max_discount}
                onChange={(v) => set('max_discount', v)}
                hint="Strongly recommended. Without a cap, 10% off a large order is a large giveaway."
              />
            )}

            <TextField
              label="Minimum order value (₹)"
              type="number"
              step="0.01"
              min="0"
              value={draft.min_order_value}
              onChange={(v) => set('min_order_value', v)}
            />

            <div className="a-form-grid-2">
              <TextField label="Starts" type="datetime-local" value={draft.starts_at} onChange={(v) => set('starts_at', v)} />
              <TextField label="Ends" type="datetime-local" value={draft.ends_at} onChange={(v) => set('ends_at', v)} />
            </div>

            <div className="a-form-grid-2">
              <TextField
                label="Total uses"
                type="number"
                min="1"
                value={draft.usage_limit}
                onChange={(v) => set('usage_limit', v)}
                hint="Blank for unlimited."
              />
              <TextField
                label="Uses per customer"
                type="number"
                min="1"
                value={draft.usage_limit_per_customer}
                onChange={(v) => set('usage_limit_per_customer', v)}
                hint="Blank for unlimited."
              />
            </div>

            <CheckField label="Accept this code at checkout" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          </>
        ),
      }}
    />
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toPayload(draft: Draft) {
  return {
    code: draft.code.trim(),
    description: draft.description || null,
    discount_type: draft.discount_type,
    discount_value: draft.discount_value,
    // A cap only means something on a percentage. Sending one with a fixed
    // amount would store a number that never applies and confuse whoever
    // reads the row next.
    max_discount: draft.discount_type === 'percent' && draft.max_discount ? draft.max_discount : null,
    min_order_value: draft.min_order_value || '0',
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    usage_limit: draft.usage_limit ? Number(draft.usage_limit) : null,
    usage_limit_per_customer: draft.usage_limit_per_customer ? Number(draft.usage_limit_per_customer) : null,
    is_active: draft.is_active,
  };
}
