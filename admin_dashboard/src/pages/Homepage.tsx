import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { Collection, HomepageSection } from '@/lib/api';
import {
  ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';

interface Band {
  kind: string;
  title: string;
  subtitle: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

const KINDS = [
  { value: 'banner', label: 'Banner', hint: 'Serves whatever is scheduled for a placement.' },
  { value: 'collection_rail', label: 'Collection rail', hint: 'A row of products from one collection.' },
  { value: 'room_grid', label: 'Shop by room', hint: 'Tiles for every visible room.' },
  { value: 'category_grid', label: 'Category grid', hint: 'Tiles for top-level categories.' },
  { value: 'editorial', label: 'Editorial band', hint: 'A headline and copy, no products.' },
];

export function Homepage() {
  const { toasts, push, dismiss } = useToasts();
  const writable = can('content.write');

  const loaded = useAsync(
    async () => {
      const [sections, collections] = await Promise.all([api.homepage(), api.collections()]);
      return { sections, collections };
    },
    [],
  );

  const [bands, setBands] = useState<Band[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded.data) return;
    setBands(
      loaded.data.sections.map((section: HomepageSection) => ({
        kind: section.kind,
        title: section.title ?? '',
        subtitle: section.subtitle ?? '',
        config: section.config ?? {},
        is_active: section.is_active,
      })),
    );
  }, [loaded.data]);

  if (loaded.loading && !loaded.data) return <Spinner label="Loading the homepage" />;
  if (loaded.error) return <ErrorNote error={loaded.error} onRetry={loaded.reload} />;

  const collections: Collection[] = loaded.data?.collections ?? [];

  const update = (index: number, patch: Partial<Band>) =>
    setBands((current) => current.map((band, i) => (i === index ? { ...band, ...patch } : band)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= bands.length) return;
    setBands((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // The whole page goes in one write. Reordering is the common edit, and
      // a per-band save would leave the page half-reordered if one failed.
      await api.saveHomepage(
        bands.map((band, index) => ({
          kind: band.kind,
          title: band.title || null,
          subtitle: band.subtitle || null,
          config: band.config,
          position: index,
          is_active: band.is_active,
        })),
      );
      push('Homepage saved.');
      loaded.reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Homepage"
        subtitle="Bands run top to bottom in the order below."
        actions={
          writable && (
            <>
              <button
                type="button"
                className="a-btn a-btn--ghost"
                onClick={() =>
                  setBands((current) => [
                    ...current,
                    { kind: 'collection_rail', title: '', subtitle: '', config: { limit: 8 }, is_active: true },
                  ])
                }
              >
                <Plus size={15} aria-hidden /> Add a band
              </button>
              <button type="button" className="a-btn a-btn--primary" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save the homepage'}
              </button>
            </>
          )
        }
      />

      {bands.length === 0 && (
        <div className="a-note a-note--framed">
          The homepage has no bands. Add one to start building it.
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {bands.map((band, index) => {
          const meta = KINDS.find((k) => k.value === band.kind);
          return (
            <section
              key={index}
              className="a-card"
              style={{ padding: 18, opacity: band.is_active ? 1 : 0.6 }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <span className="a-num" style={{ opacity: 0.4, width: 22 }}>{index + 1}</span>
                <select
                  className="a-select"
                  aria-label="Band type"
                  disabled={!writable}
                  value={band.kind}
                  onChange={(e) => update(index, { kind: e.target.value })}
                  style={{ maxWidth: 220 }}
                >
                  {KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>{kind.label}</option>
                  ))}
                </select>
                <span className="a-sub" style={{ flex: 1, fontSize: 12 }}>{meta?.hint}</span>
                {writable && (
                  <>
                    <button type="button" className="a-link-btn" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" className="a-link-btn" aria-label="Move down" disabled={index === bands.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="a-link-btn"
                      aria-label="Remove this band"
                      onClick={() => setBands((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>

              <fieldset disabled={!writable} style={{ border: 0, padding: 0, margin: 0 }}>
                <div className="a-form-grid-2">
                  <label className="a-form-field">
                    <span>Heading</span>
                    <input className="a-input" value={band.title} onChange={(e) => update(index, { title: e.target.value })} />
                  </label>
                  <label className="a-form-field">
                    <span>Subheading</span>
                    <input className="a-input" value={band.subtitle} onChange={(e) => update(index, { subtitle: e.target.value })} />
                  </label>
                </div>

                {band.kind === 'collection_rail' && (
                  <div className="a-form-grid-2" style={{ marginTop: 12 }}>
                    <label className="a-form-field">
                      <span>Collection</span>
                      <select
                        className="a-select"
                        value={String(band.config.collection_slug ?? '')}
                        onChange={(e) => update(index, { config: { ...band.config, collection_slug: e.target.value } })}
                      >
                        <option value="">Choose a collection</option>
                        {collections.map((collection) => (
                          <option key={collection.slug} value={collection.slug}>
                            {collection.name} ({collection.product_count})
                          </option>
                        ))}
                      </select>
                      {!band.config.collection_slug && (
                        // Saved with no collection this band renders as an
                        // empty rail on the live homepage, which looks like a
                        // bug to a customer rather than an unfinished edit.
                        <span className="a-form-hint">Pick one, or this band shows nothing.</span>
                      )}
                    </label>
                    <label className="a-form-field">
                      <span>How many</span>
                      <input
                        className="a-input"
                        type="number"
                        min={2}
                        max={24}
                        value={Number(band.config.limit ?? 8)}
                        onChange={(e) => update(index, { config: { ...band.config, limit: Number(e.target.value) } })}
                      />
                    </label>
                  </div>
                )}

                {band.kind === 'banner' && (
                  <label className="a-form-field" style={{ marginTop: 12 }}>
                    <span>Placement</span>
                    <select
                      className="a-select"
                      value={String(band.config.placement ?? 'home_hero')}
                      onChange={(e) => update(index, { config: { ...band.config, placement: e.target.value } })}
                    >
                      <option value="home_hero">Homepage hero</option>
                      <option value="home_promo">Homepage promo band</option>
                    </select>
                  </label>
                )}

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginTop: 12 }}>
                  <input type="checkbox" checked={band.is_active} onChange={(e) => update(index, { is_active: e.target.checked })} />
                  Show this band
                </label>
              </fieldset>
            </section>
          );
        })}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
