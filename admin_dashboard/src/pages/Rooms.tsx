import { api } from '@/lib/api';
import type { Room } from '@/lib/api';
import { CheckField, CrudTable, TextField } from '@/components/CrudTable';

interface Draft {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  position: number;
  is_active: boolean;
}

export function Rooms() {
  return (
    <CrudTable<Room, Draft>
      config={{
        title: 'Rooms',
        subtitle: 'Flat, and a product can belong to several. This is what "shop by room" navigates.',
        noun: 'room',
        writePermission: 'taxonomy.write',
        rowId: (row) => row.id,
        rowLabel: (row) => row.name,
        load: () => api.rooms(),
        create: (draft) => api.createRoom(normalise(draft)),
        update: (id, draft) => api.updateRoom(id, normalise(draft)),
        remove: (id) => api.deleteRoom(id),
        deleteWarning:
          'Products stay, but they lose this room and disappear from its page. Hide it instead if you may want it back.',
        columns: [
          { header: 'Room', render: (row) => row.name },
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
        blankDraft: () => ({ name: '', slug: '', description: '', image_url: '', position: 0, is_active: true }),
        toDraft: (row) => ({
          name: row.name,
          slug: row.slug,
          description: row.description ?? '',
          image_url: row.image_url ?? '',
          position: row.position,
          is_active: row.is_active,
        }),
        form: (draft, set) => (
          <>
            <TextField label="Name" required value={draft.name} onChange={(v) => set('name', v)} />
            <TextField
              label="URL slug"
              placeholder="Generated from the name"
              value={draft.slug}
              onChange={(v) => set('slug', v)}
            />
            <TextField label="Description" value={draft.description} onChange={(v) => set('description', v)} />
            <TextField
              label="Image URL"
              value={draft.image_url}
              onChange={(v) => set('image_url', v)}
              hint="Used on the room tile on the homepage."
            />
            <TextField
              label="Position"
              type="number"
              value={draft.position}
              onChange={(v) => set('position', Number(v))}
            />
            <CheckField label="Visible in the shop" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          </>
        ),
      }}
    />
  );
}

function normalise(draft: Draft) {
  return {
    ...draft,
    // Blank strings are sent as null so the API stores "nothing" rather than
    // an empty string a template would render as a gap.
    slug: draft.slug || undefined,
    description: draft.description || null,
    image_url: draft.image_url || null,
  };
}
