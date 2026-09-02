import { api } from '@/lib/api';
import type { Banner } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CheckField, CrudTable, TextField } from '@/components/CrudTable';

interface Draft {
  title: string;
  subtitle: string;
  image_url: string;
  mobile_image_url: string;
  alt_text: string;
  link_url: string;
  cta_label: string;
  placement: string;
  position: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const PLACEMENTS = [
  { value: 'home_hero', label: 'Homepage hero' },
  { value: 'home_promo', label: 'Homepage promo band' },
  { value: 'category_top', label: 'Top of a category page' },
];

export function Banners() {
  return (
    <CrudTable<Banner, Draft>
      config={{
        title: 'Banners',
        subtitle: 'Scheduled artwork. A banner outside its dates is simply not served.',
        noun: 'banner',
        writePermission: 'content.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.title,
        load: () => api.banners(),
        create: (draft) => api.createBanner(toPayload(draft)),
        update: (id, draft) => api.updateBanner(id, toPayload(draft)),
        remove: (id) => api.deleteBanner(id),
        columns: [
          {
            header: 'Banner',
            render: (row) => (
              <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                <img src={row.image_url} alt="" width={56} height={32} loading="lazy" style={{ objectFit: 'cover', borderRadius: 4 }} />
                {row.title}
              </span>
            ),
          },
          {
            header: 'Placement',
            render: (row) => PLACEMENTS.find((p) => p.value === row.placement)?.label ?? row.placement,
          },
          {
            header: 'Window',
            render: (row) =>
              row.starts_at || row.ends_at
                ? `${row.starts_at ? formatDate(row.starts_at) : '—'} to ${row.ends_at ? formatDate(row.ends_at) : '—'}`
                : 'Always',
          },
          { header: 'Position', render: (row) => row.position, numeric: true },
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
          title: '', subtitle: '', image_url: '', mobile_image_url: '', alt_text: '',
          link_url: '', cta_label: '', placement: 'home_hero', position: 0,
          starts_at: '', ends_at: '', is_active: true,
        }),
        toDraft: (row) => ({
          title: row.title,
          subtitle: row.subtitle ?? '',
          image_url: row.image_url,
          mobile_image_url: row.mobile_image_url ?? '',
          alt_text: row.alt_text,
          link_url: row.link_url ?? '',
          cta_label: row.cta_label ?? '',
          placement: row.placement,
          position: row.position,
          starts_at: toLocalInput(row.starts_at),
          ends_at: toLocalInput(row.ends_at),
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField label="Title" required value={draft.title} onChange={(v) => set('title', v)} />
            <TextField label="Subtitle" value={draft.subtitle} onChange={(v) => set('subtitle', v)} />
            <TextField label="Image URL" required value={draft.image_url} onChange={(v) => set('image_url', v)} />
            <TextField
              label="Mobile image URL"
              value={draft.mobile_image_url}
              onChange={(v) => set('mobile_image_url', v)}
              hint="A wide hero crops into nonsense on a phone. Falls back to the main image if blank."
            />
            <TextField
              label="Alt text"
              required
              minLength={3}
              value={draft.alt_text}
              onChange={(v) => set('alt_text', v)}
              hint="What the picture shows. Read aloud, and shown if the image fails to load."
            />
            <div className="a-form-grid-2">
              <TextField label="Link" value={draft.link_url} onChange={(v) => set('link_url', v)} placeholder="/shop" />
              <TextField label="Button label" value={draft.cta_label} onChange={(v) => set('cta_label', v)} />
            </div>
            <label className="a-form-field">
              <span>Placement</span>
              <select className="a-select" value={draft.placement} onChange={(e) => set('placement', e.target.value)}>
                {PLACEMENTS.map((placement) => (
                  <option key={placement.value} value={placement.value}>{placement.label}</option>
                ))}
              </select>
            </label>
            <div className="a-form-grid-2">
              <TextField label="Starts" type="datetime-local" value={draft.starts_at} onChange={(v) => set('starts_at', v)} />
              <TextField label="Ends" type="datetime-local" value={draft.ends_at} onChange={(v) => set('ends_at', v)} />
            </div>
            <TextField label="Position" type="number" value={draft.position} onChange={(v) => set('position', Number(v))} />
            <CheckField label="Serve this banner" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
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
    ...draft,
    subtitle: draft.subtitle || null,
    mobile_image_url: draft.mobile_image_url || null,
    link_url: draft.link_url || null,
    cta_label: draft.cta_label || null,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
  };
}
