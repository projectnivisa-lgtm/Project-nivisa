import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Trash2, Upload } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { ArAsset, ArStatus } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ErrorNote, Spinner, useAsync } from '@/components/Ui';
import { ModelPreview } from '@/components/ModelPreview';

export const AR_STATUS_TONE: Record<ArStatus, string> = {
  unavailable: 'a-badge--ghost',
  processing: 'a-badge--amber',
  ready: 'a-badge--ok',
  failed: 'a-badge--warn',
  deprecated: 'a-badge--ghost',
};

export const AR_STATUS_LABEL: Record<ArStatus, string> = {
  unavailable: 'No model',
  processing: 'Needs checking',
  ready: 'Live',
  failed: 'Failed checks',
  deprecated: 'Withdrawn',
};

/**
 * The AR and 3D model for one product.
 *
 * Lives inside the product editor rather than on a screen of its own. A model
 * is not a thing in the catalogue - it is one more fact about a product, like
 * its photographs or its dimensions, and the size check it has to pass is
 * against the very numbers being edited a few sections above. Kept separate,
 * it meant finding the same product twice, in two places, to finish one job.
 *
 * Deliberately outside the product form's own fieldset and submit: every
 * action here writes immediately through its own endpoint, so uploading a
 * model never waits on the surrounding draft being valid, and "Save product"
 * never quietly publishes AR.
 */
export function ArPanel({
  productId,
  push,
}: {
  productId: number;
  push: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const writable = can('ar.manage');
  const [asset, setAsset] = useState<ArAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const loaded = useAsync(() => api.arAsset(productId), [productId]);
  useEffect(() => {
    if (loaded.data) setAsset(loaded.data);
  }, [loaded.data]);

  const run = async (action: () => Promise<ArAsset>, message: string) => {
    setBusy(true);
    try {
      setAsset(await action());
      push(message);
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File, kind: 'auto' | 'poster') =>
    run(() => api.uploadArFile(productId, file, kind), 'Uploaded.');

  const save = () => {
    if (!asset) return;
    return run(
      () =>
        api.saveArAsset(productId, {
          real_width_mm: asset.real_width_mm,
          real_height_mm: asset.real_height_mm,
          real_depth_mm: asset.real_depth_mm,
          scale_mode: asset.scale_mode,
          placement: asset.placement,
        }),
      'Saved.',
    );
  };

  const set = <K extends keyof ArAsset>(key: K, value: ArAsset[K]) =>
    setAsset((current) => (current ? { ...current, [key]: value } : current));

  return (
    <>
      {loaded.loading && !asset && <Spinner label="Loading the AR asset" />}
      {loaded.error && <ErrorNote error={loaded.error} onRetry={loaded.reload} />}

      {asset && (
        <>
          <p
            className="a-sub"
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <span className={`a-badge ${AR_STATUS_TONE[asset.status]}`}>
              {AR_STATUS_LABEL[asset.status]}
            </span>
            <span>
              Version {asset.version}
              {asset.updated_at ? ` · last change ${formatDateTime(asset.updated_at)}` : ''}
            </span>
          </p>

          {asset.validation && <ValidationPanel validation={asset.validation} />}

          {/* Outside the fieldset below, which is disabled for anyone without
              `ar.manage` and while a request is in flight. Looking at the
              model is not editing it, and a viewer who cannot check the model
              is a viewer who has to take somebody's word for it. */}
          {asset.model_url ? (
            <div style={{ marginTop: 18 }}>
              <ModelPreview
                src={asset.model_url}
                poster={asset.poster_url}
                alt={`3D model of ${asset.product_name}`}
              />
            </div>
          ) : null}

          <fieldset disabled={!writable || busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <h3 className="a-h2" style={{ fontSize: 14, marginTop: 20 }}>Files</h3>

            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <FileSlot
                label="3D model (.glb)"
                hint="Android and the web."
                url={asset.model_url}
                accept=".glb,.gltf"
                onUpload={(file) => upload(file, 'auto')}
                onRemove={() => run(() => api.removeArFile(productId, 'glb'), 'Removed.')}
                writable={writable}
              />
              <FileSlot
                label="3D model (.usdz)"
                hint="iPhone and iPad."
                url={asset.ios_model_url}
                accept=".usdz"
                onUpload={(file) => upload(file, 'auto')}
                onRemove={() => run(() => api.removeArFile(productId, 'usdz'), 'Removed.')}
                writable={writable}
              />
              <FileSlot
                label="Poster image"
                hint="The still shown before AR opens."
                url={asset.poster_url}
                accept="image/*"
                preview
                onUpload={(file) => upload(file, 'poster')}
                onRemove={() => run(() => api.removeArFile(productId, 'poster'), 'Removed.')}
                writable={writable}
              />
            </div>

            <h3 className="a-h2" style={{ fontSize: 14, marginTop: 22 }}>Real-world size</h3>
            <p className="a-sub" style={{ fontSize: 12 }}>
              What the model measures, in millimetres. It has to agree with the product&apos;s own
              dimensions within 5% &mdash; a piece shown at the wrong size in someone&apos;s room
              answers the only question AR is for, wrongly.
            </p>

            <div className="a-form-grid-2" style={{ marginTop: 12 }}>
              <DimensionField
                label="Width"
                value={asset.real_width_mm}
                expected={asset.product_width_mm}
                onChange={(v) => set('real_width_mm', v)}
              />
              <DimensionField
                label="Height"
                value={asset.real_height_mm}
                expected={asset.product_height_mm}
                onChange={(v) => set('real_height_mm', v)}
              />
              <DimensionField
                label="Depth"
                value={asset.real_depth_mm}
                expected={asset.product_depth_mm}
                onChange={(v) => set('real_depth_mm', v)}
              />
            </div>

            <div className="a-form-grid-2" style={{ marginTop: 12 }}>
              <label className="a-form-field">
                <span>Scale</span>
                <select
                  className="a-select"
                  value={asset.scale_mode}
                  onChange={(e) => set('scale_mode', e.target.value as ArAsset['scale_mode'])}
                >
                  <option value="fixed">Fixed &mdash; actual size</option>
                  <option value="manual">Manual &mdash; customer can resize</option>
                </select>
                {asset.scale_mode === 'manual' && (
                  <span className="a-form-hint">
                    Only for decorative objects. Never for anything measured.
                  </span>
                )}
              </label>
              <label className="a-form-field">
                <span>Placement</span>
                <select
                  className="a-select"
                  value={asset.placement}
                  onChange={(e) => set('placement', e.target.value as ArAsset['placement'])}
                >
                  <option value="floor">Stands on the floor</option>
                  <option value="wall">Hangs on a wall</option>
                </select>
              </label>
            </div>
          </fieldset>

          {!writable && (
            <p className="a-sub" style={{ marginTop: 14 }}>
              Your role can see the AR model but not change it.
            </p>
          )}

          {writable && (
            <div
              style={{
                display: 'flex', gap: 8, justifyContent: 'flex-end',
                marginTop: 18, flexWrap: 'wrap',
              }}
            >
              <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={save}>
                Save AR settings
              </button>
              {asset.status === 'ready' ? (
                <button
                  type="button"
                  className="a-btn a-btn--danger"
                  disabled={busy}
                  onClick={() => run(() => api.unpublishAr(productId), 'AR taken off the shop.')}
                >
                  Take off the shop
                </button>
              ) : (
                <button
                  type="button"
                  className="a-btn a-btn--primary"
                  // Disabled on the client for clarity; the server refuses
                  // regardless, which is what actually protects customers.
                  disabled={busy || !asset.validation?.ok}
                  title={asset.validation?.ok ? undefined : 'Fix the problems above first.'}
                  onClick={() => run(() => api.publishAr(productId), 'AR is live.')}
                >
                  Publish AR
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ValidationPanel({ validation }: { validation: NonNullable<ArAsset['validation']> }) {
  if (validation.ok && validation.warnings.length === 0) {
    return (
      <p
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 14 }}
        className="a-sub"
      >
        <Check size={15} aria-hidden /> Everything checks out. This is ready to publish.
      </p>
    );
  }

  return (
    <div className="a-note a-note--framed" style={{ marginTop: 14 }}>
      {validation.problems.length > 0 && (
        <>
          <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={15} aria-hidden /> Cannot publish yet
          </strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 22, fontSize: 14 }}>
            {validation.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </>
      )}
      {validation.warnings.length > 0 && (
        <ul
          style={{
            margin: validation.problems.length ? '12px 0 0' : 0,
            paddingLeft: 22,
            fontSize: 13,
          }}
          className="a-sub"
        >
          {validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A dimension, shown beside the product's own.
 *
 * Both numbers together, because the check compares them and somebody
 * correcting a model should not have to scroll back up to find out what they
 * are correcting it to.
 */
function DimensionField({
  label, value, expected, onChange,
}: {
  label: string;
  value: number | null;
  expected: number | null;
  onChange: (value: number | null) => void;
}) {
  const drift =
    value !== null && expected !== null && expected > 0
      ? Math.abs(value - expected) / expected
      : null;
  const off = drift !== null && drift > 0.05;

  return (
    <label className="a-form-field">
      <span>{label} (mm)</span>
      <input
        className="a-input"
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        style={off ? { borderColor: 'var(--danger, #b3261e)' } : undefined}
      />
      <span className="a-form-hint" style={off ? { color: 'var(--danger, #b3261e)' } : undefined}>
        {expected === null
          ? 'The product has no measurement here.'
          : `Product: ${expected} mm${off ? ` — ${Math.round(drift! * 100)}% out` : ''}`}
      </span>
    </label>
  );
}

function FileSlot({
  label, hint, url, accept, onUpload, onRemove, writable, preview = false,
}: {
  label: string;
  hint: string;
  url: string | null;
  accept: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  writable: boolean;
  /** Renders the file itself as a thumbnail. Images only. */
  preview?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px',
      }}
    >
      {preview && url && (
        <img
          src={url}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <div className="a-sub" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {url.split('/').pop()}
            </a>
          ) : (
            hint
          )}
        </div>
      </div>

      {writable && (
        <>
          <label className="a-btn a-btn--ghost" style={{ cursor: 'pointer' }}>
            <Upload size={14} aria-hidden /> {url ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept={accept}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                // Cleared so choosing the same file twice fires a change.
                e.target.value = '';
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              className="a-btn a-btn--ghost"
              aria-label={`Remove ${label}`}
              onClick={onRemove}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}
