import { formatDimensions } from "@/lib/utils";
import type { Product } from "@/types/product";

/**
 * The long-form half of the product page.
 *
 * Everything here renders conditionally. On the current backend most of it is
 * absent (API-GAPS §2), so an unmigrated product shows a description and a
 * dimension line rather than eight headings with nothing under them — a page
 * of empty sections looks broken in a way that a shorter page does not.
 *
 * Presented as open sections rather than tabs. Tabs hide the answer to the
 * question the customer has, and on a furniture page the specification IS the
 * product: they came to find out whether it fits and what it is made of.
 */
export function ProductDetails({ product }: { product: Product }) {
  const specs = product.specs;
  const dimensions = product.dimensions
    ? formatDimensions(product.dimensions)
    : null;

  const specRows: Array<{ label: string; value: string }> = [];
  if (specs?.material) specRows.push({ label: "Material", value: specs.material });
  if (specs?.finish) specRows.push({ label: "Finish", value: specs.finish });
  if (specs?.colour) specRows.push({ label: "Colour", value: specs.colour });
  if (specs?.style) specRows.push({ label: "Style", value: specs.style });
  if (specs?.room) specRows.push({ label: "Room", value: specs.room });
  if (specs?.seatingCapacity) {
    specRows.push({ label: "Seats", value: String(specs.seatingCapacity) });
  }
  if (product.brand) specRows.push({ label: "Brand", value: product.brand.name });
  specRows.push(...(specs?.additional ?? []));

  const hasDimensions =
    Boolean(dimensions) || Boolean(product.dimensions?.weightKg);

  return (
    <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
      {product.description ? (
        <Section title="About this piece" className="lg:col-span-2">
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-ink-muted">
            {product.description}
          </p>
        </Section>
      ) : null}

      {hasDimensions ? (
        <Section title="Dimensions">
          {/* Drawn to scale from the real numbers, so the footprint is
              legible before a tape measure comes out. */}
          {product.dimensions?.widthCm && product.dimensions?.depthCm ? (
            <FootprintDiagram
              width={product.dimensions.widthCm}
              depth={product.dimensions.depthCm}
              height={product.dimensions.heightCm}
            />
          ) : null}

          <dl className="mt-5 divide-y divide-border border-y border-border">
            {product.dimensions?.widthCm ? (
              <Row label="Width" value={`${product.dimensions.widthCm} cm`} />
            ) : null}
            {product.dimensions?.depthCm ? (
              <Row label="Depth" value={`${product.dimensions.depthCm} cm`} />
            ) : null}
            {product.dimensions?.heightCm ? (
              <Row label="Height" value={`${product.dimensions.heightCm} cm`} />
            ) : null}
            {product.dimensions?.weightKg ? (
              <Row label="Weight" value={`${product.dimensions.weightKg} kg`} />
            ) : null}
            {!product.dimensions?.widthCm && product.dimensions?.raw ? (
              <Row label="Size" value={product.dimensions.raw} />
            ) : null}
          </dl>
        </Section>
      ) : null}

      {specRows.length > 0 ? (
        <Section title="Specification">
          <dl className="divide-y divide-border border-y border-border">
            {specRows.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </Section>
      ) : null}

      {specs?.assemblyNotes || specs?.installationIncluded !== undefined ? (
        <Section title="Delivery & assembly">
          {specs?.assemblyNotes ? (
            <p className="max-w-prose leading-relaxed text-ink-muted">
              {specs.assemblyNotes}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <Bullet>
              {specs?.assemblyRequired
                ? "Assembly required — done by our team, included in the price."
                : "No assembly required."}
            </Bullet>
            {specs?.installationIncluded ? (
              <Bullet>Installation and wall anchoring included where needed.</Bullet>
            ) : null}
            <Bullet>We take the packaging away with us.</Bullet>
          </ul>
        </Section>
      ) : null}

      {specs?.warrantyMonths || specs?.careInstructions ? (
        <Section title="Warranty & care">
          {specs?.warrantyMonths ? (
            <p className="font-medium">
              {specs.warrantyMonths >= 12
                ? `${Math.round(specs.warrantyMonths / 12)}-year warranty`
                : `${specs.warrantyMonths}-month warranty`}
              <span className="ml-2 font-normal text-ink-muted">
                on frame and joinery
              </span>
            </p>
          ) : null}
          {specs?.careInstructions ? (
            <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
              {specs.careInstructions}
            </p>
          ) : null}
        </Section>
      ) : null}

      {product.faqs && product.faqs.length > 0 ? (
        <Section title="Questions people ask" className="lg:col-span-2">
          <dl className="max-w-3xl divide-y divide-border border-t border-border">
            {product.faqs.map((faq) => (
              <div key={faq.question} className="py-5">
                <dt className="font-medium">{faq.question}</dt>
                <dd className="mt-2 max-w-prose leading-relaxed text-ink-muted">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
    </div>
  );
}

/**
 * Overhead footprint, drawn to scale.
 *
 * Answers "will it fit" faster than three numbers in a table, because the
 * proportions are visible. Scale is preserved between width and depth — a
 * diagram that stretches to fill its box would misrepresent the shape.
 */
function FootprintDiagram({
  width,
  depth,
  height,
}: {
  width: number;
  depth: number;
  height?: number;
}) {
  const BOX = 160; // longest side of the footprint, in SVG units
  const FONT = 11;
  const PAD = 6;
  const TICK = 20; // distance from the box to the far side of a dimension line

  const maxSide = Math.max(width, depth);
  const w = (width / maxSide) * BOX;
  const d = (depth / maxSide) * BOX;

  const widthLabel = `${width} cm`;
  const depthLabel = `${depth} cm`;
  // Rough advance width for the numeric label. Overestimating costs a few
  // units of whitespace; underestimating clips the label, which is the bug
  // this replaces.
  const textWidth = (label: string) => label.length * FONT * 0.62;

  // Content bounds, so the viewBox is derived from what is actually drawn
  // rather than assumed. A wide, shallow piece pushes the depth label far to
  // the right; a narrow one lets the centred width label overhang to the left.
  const left = Math.min(0, w / 2 - textWidth(widthLabel) / 2);
  const right = Math.max(
    w + TICK + 4 + textWidth(depthLabel),
    w / 2 + textWidth(widthLabel) / 2,
  );
  const bottom = d + 32;

  const vbWidth = right - left + PAD * 2;
  const vbHeight = bottom + PAD * 2;

  return (
    <svg
      // Rendered at its natural size and allowed to shrink, never stretched:
      // stretching to the container would scale the labels with the box, so
      // the same diagram read differently on every product and screen width.
      width={vbWidth}
      height={vbHeight}
      viewBox={`0 0 ${vbWidth} ${vbHeight}`}
      className="h-auto max-w-full"
      role="img"
      aria-label={`Footprint ${width} by ${depth} centimetres${height ? `, ${height} centimetres tall` : ""}`}
    >
      <g transform={`translate(${PAD - left}, ${PAD})`}>
        <rect
          width={w}
          height={d}
          rx="2"
          fill="var(--color-lime-200)"
          stroke="var(--color-lime-500)"
          strokeWidth="1"
        />
        {/* Width dimension line, below */}
        <g stroke="var(--color-lime-600)" strokeWidth="0.8">
          <path d={`M0 ${d + 12} H${w}`} />
          <path d={`M0 ${d + 8} V${d + 16}`} />
          <path d={`M${w} ${d + 8} V${d + 16}`} />
        </g>
        <text
          x={w / 2}
          y={d + 28}
          textAnchor="middle"
          className="fill-ink-muted"
          style={{ fontSize: FONT }}
        >
          {widthLabel}
        </text>
        {/* Depth dimension line, right */}
        <g stroke="var(--color-lime-600)" strokeWidth="0.8">
          <path d={`M${w + 12} 0 V${d}`} />
          <path d={`M${w + 8} 0 H${w + 16}`} />
          <path d={`M${w + 8} ${d} H${w + 16}`} />
        </g>
        <text
          x={w + TICK + 4}
          y={d / 2}
          dominantBaseline="middle"
          className="fill-ink-muted"
          style={{ fontSize: FONT }}
        >
          {depthLabel}
        </text>
      </g>
    </svg>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h2 className="font-sans text-lg font-medium tracking-normal">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-6 py-3 text-sm">
      <dt className="w-32 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0 text-success"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12.5l5 5L20 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
