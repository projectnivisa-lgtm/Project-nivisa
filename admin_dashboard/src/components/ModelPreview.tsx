import { useState } from 'react';
import { Box, RotateCw } from 'lucide-react';

/**
 * `<model-viewer>` is a custom element, so React needs telling it exists.
 * Only the attributes actually used here are typed - a permissive index
 * signature would defeat the point of declaring it at all.
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        poster?: string;
        'camera-controls'?: boolean | '';
        'auto-rotate'?: boolean | '';
        'shadow-intensity'?: string;
        'environment-image'?: string;
        exposure?: string;
        loading?: 'auto' | 'lazy' | 'eager';
        reveal?: 'auto' | 'manual';
      };
    }
  }
}

/**
 * The uploaded .glb, actually rendered.
 *
 * Checking a model used to mean downloading the file and opening it in
 * something else, which is the kind of round trip that stops people checking
 * at all - and an unchecked model is how a sofa ends up in someone's living
 * room at the size of a doll's house.
 *
 * Loaded on demand rather than on page load, twice over: the viewer library
 * carries a WebGL renderer and is a few hundred kilobytes, and the model
 * itself can be tens of megabytes. Neither is worth spending on every staff
 * member who opens a product to fix a typo in its description.
 *
 * .glb only. USDZ is Apple's format for AR Quick Look on a real iPhone;
 * nothing renders it in a desktop browser, so offering a preview of one would
 * be a button that cannot work.
 */
export function ModelPreview({
  src,
  poster,
  alt,
}: {
  src: string;
  poster: string | null;
  alt: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  const load = async () => {
    setState('loading');
    try {
      // Side-effect import: the package registers the custom element.
      await import('@google/model-viewer');
      setState('ready');
    } catch {
      setState('failed');
    }
  };

  if (state === 'idle' || state === 'loading') {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          border: '1px solid var(--card-border)', borderRadius: 8, padding: '14px 12px',
        }}
      >
        <Box size={18} aria-hidden style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 13 }}>3D preview</strong>
          <div className="a-sub" style={{ fontSize: 12 }}>
            Turn the model, check it is the right piece and the right way up.
          </div>
        </div>
        <button
          type="button"
          className="a-btn a-btn--ghost"
          disabled={state === 'loading'}
          onClick={load}
        >
          <RotateCw size={14} aria-hidden /> {state === 'loading' ? 'Loading…' : 'Show model'}
        </button>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="a-note a-note--framed">
        The 3D viewer could not be loaded. The file itself is unaffected — open it from the
        link below to check it in another program.
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--surface-sunken, #f4f1ec)',
      }}
    >
      <model-viewer
        src={src}
        poster={poster ?? undefined}
        alt={alt}
        camera-controls
        auto-rotate
        shadow-intensity="1"
        // Eager, because the element only exists after someone clicked "Show
        // model" - the click is the intent, and there is nothing left to defer.
        //
        // It also has to be. The default waits for the element to intersect
        // the viewport, and this dashboard scrolls inside `.a-main` rather
        // than the document, so that observer can never fire: the viewer sat
        // blank with the model downloaded and never revealed.
        loading="eager"
        reveal="auto"
        style={{ width: '100%', height: 320, display: 'block' }}
      />
      <p className="a-sub" style={{ fontSize: 12, margin: 0, padding: '8px 12px' }}>
        Drag to turn it, scroll to zoom. This is the .glb — the file Android and the web use.
      </p>
    </div>
  );
}
