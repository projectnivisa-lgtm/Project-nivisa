import type { ArtKey } from "@/config/navigation";
import type { Product, ProductVariant } from "@/types/product";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Product-detail depth: gallery views, variants, warranty and care copy,
 * assembly notes and buying FAQs. None of this exists on the backend
 * (API-GAPS §2), so it is applied only in demo mode and only so the product
 * page can be designed against a realistic product rather than four empty
 * sections.
 *
 * Applied on top of the listing product, so a piece has the same price,
 * dimensions and stock wherever it appears.
 */

interface DetailSeed {
  /** Extra gallery views, drawn as line art rather than faked photography. */
  gallery: ArtKey[];
  description: string;
  care: string;
  assembly: string;
  assemblyRequired: boolean;
  warrantyMonths: number;
  installationIncluded: boolean;
  style: string;
  colour: string;
  variants?: Array<{ label: string; axis: string; swatchHex: string }>;
  extraSpecs?: Array<{ label: string; value: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

const FINISH_SWATCHES = {
  walnut: "#5A3A22",
  natural: "#C4A374",
  charcoal: "#3A342E",
  ivory: "#E8DFCE",
  honey: "#B07B3E",
} as const;

/** Applies to every demo product unless overridden below. */
const DEFAULTS: DetailSeed = {
  gallery: [],
  description:
    "Built from named materials, measured before it is listed, and delivered assembled by our own team. Every piece carries a ten-year structural warranty on its frame and joinery.",
  care: "Wipe with a dry or barely damp cloth. Keep out of direct sunlight, which fades and dries timber over time. Do not use solvent-based polish.",
  assembly:
    "Delivered flat-packed and assembled in your home by our own two-person team. Allow about 40 minutes.",
  assemblyRequired: true,
  warrantyMonths: 120,
  installationIncluded: true,
  style: "Contemporary",
  colour: "Natural",
};

const DETAILS: Record<string, Partial<DetailSeed>> = {
  "malabar-3-seater-sofa": {
    gallery: ["sofa", "chair", "storage"],
    description:
      "A low-backed three-seater on a kiln-dried solid teak frame, finished with hand-rubbed oil rather than lacquer — so the grain stays visible and small scuffs can be rubbed out rather than resprayed.\n\nThe seat cushions are reversible and the back cushions are loose, which means the sofa wears evenly instead of developing one sunken end. Pirelli webbing under the seat gives it support without the bounce of springs.\n\nAt 210 cm it suits a wall of about seven feet. The legs unbolt for delivery, taking the depth down to 78 cm to clear a standard doorway.",
    style: "Mid-century",
    colour: "Sand",
    care: "Vacuum the upholstery monthly with a brush head. Rotate and flip the seat cushions every few weeks so they wear evenly. Oil the exposed teak once a year with a clear furniture oil.",
    assembly:
      "Arrives with the legs detached. Our team fits them and positions the piece; allow about 20 minutes.",
    variants: [
      { label: "Sand", axis: "Upholstery", swatchHex: "#C9BBA4" },
      { label: "Slate", axis: "Upholstery", swatchHex: "#5C6169" },
      { label: "Ochre", axis: "Upholstery", swatchHex: "#B4823A" },
    ],
    extraSpecs: [
      { label: "Frame", value: "Kiln-dried solid teak" },
      { label: "Suspension", value: "Pirelli webbing" },
      { label: "Filling", value: "32-density foam with fibre wrap" },
      { label: "Seat height", value: "42 cm" },
      { label: "Leg height", value: "18 cm" },
    ],
    faqs: [
      {
        question: "Will it fit through a standard door?",
        answer:
          "Yes. With the legs off the sofa is 78 cm deep, which clears a standard 80 cm Indian doorway. Our team removes and refits the legs as part of delivery.",
      },
      {
        question: "Are the covers removable?",
        answer:
          "The seat and back cushion covers unzip for dry cleaning. The base upholstery is fixed.",
      },
      {
        question: "How firm is the seat?",
        answer:
          "Medium-firm. It holds its shape for sitting upright and reading rather than sinking in.",
      },
    ],
  },
  "kadamba-queen-bed-with-storage": {
    gallery: ["bed", "storage"],
    description:
      "A queen bed with a hydraulic lift-up base, built in solid sheesham with a walnut finish. The storage well is 22 cm deep and runs the full footprint of the bed — enough for two quilts, a spare set of linen and a cabin suitcase.\n\nThe struts carry the mattress weight, so the base opens one-handed and stays up on its own. The frame is assembled in the room it will stand in; built up, it does not fit through a doorway.",
    colour: "Walnut",
    style: "Classic",
    assembly:
      "Assembled in the room it will stand in — the frame does not fit through a doorway built up. Allow about 50 minutes.",
    variants: [
      { label: "Walnut", axis: "Finish", swatchHex: FINISH_SWATCHES.walnut },
      { label: "Honey", axis: "Finish", swatchHex: FINISH_SWATCHES.honey },
    ],
    extraSpecs: [
      { label: "Storage type", value: "Hydraulic lift-up" },
      { label: "Storage depth", value: "22 cm" },
      { label: "Mattress size", value: "Queen, 152 × 198 cm" },
      { label: "Headboard height", value: "95 cm" },
      { label: "Max load", value: "250 kg" },
    ],
    faqs: [
      {
        question: "Is a mattress included?",
        answer:
          "No. The bed takes a standard queen mattress, 152 × 198 cm. Our Nira mattress is sized to fit.",
      },
      {
        question: "How heavy is the lift?",
        answer:
          "The hydraulic struts carry the mattress weight, so it opens one-handed and stays up on its own.",
      },
    ],
  },
  "anantha-4-door-wardrobe": {
    gallery: ["wardrobe", "storage"],
    colour: "Ivory",
    care: "Wipe with a dry cloth. Do not let water stand on the laminate edges.",
    warrantyMonths: 60,
    variants: [
      { label: "Matte Ivory", axis: "Finish", swatchHex: FINISH_SWATCHES.ivory },
      { label: "Charcoal", axis: "Finish", swatchHex: FINISH_SWATCHES.charcoal },
    ],
    extraSpecs: [
      { label: "Hanging space", value: "2 full-length sections" },
      { label: "Shelves", value: "6 adjustable" },
      { label: "Drawers", value: "2 lockable" },
      { label: "Mirror", value: "Full length, inside right door" },
    ],
    faqs: [
      {
        question: "Does it need to be anchored to the wall?",
        answer:
          "Yes, and our team does it. At 210 cm tall it is a tipping risk otherwise, particularly with children in the house.",
      },
    ],
  },
  "vetri-6-seater-dining-table": {
    gallery: ["table", "chair"],
    colour: "Honey",
    style: "Industrial",
    extraSpecs: [
      { label: "Top", value: "Live-edge solid acacia, 4 cm" },
      { label: "Base", value: "Powder-coated mild steel" },
      { label: "Legroom", value: "68 cm clearance" },
    ],
    faqs: [
      {
        question: "Are chairs included?",
        answer: "No, the table is sold on its own. It seats six comfortably.",
      },
      {
        question: "Will the live edge catch on clothing?",
        answer:
          "No. The edge is sanded and sealed; it keeps the timber's natural outline but is smooth to the touch.",
      },
    ],
  },
  "nira-orthopaedic-mattress": {
    gallery: ["mattress"],
    description:
      "Seven-zone memory foam over a high-density support core, finished medium-firm — the range most people find comfortable whether they sleep on their back or their side.\n\nThe top layer is open-cell foam under a knit cover, so it runs cooler than solid memory foam. It arrives rolled and compressed; give it up to 48 hours to reach its full 20 cm.\n\nThirty nights to decide. A mattress cannot honestly be judged by lying on it in a showroom for two minutes.",
    assemblyRequired: false,
    installationIncluded: false,
    assembly:
      "Arrives rolled and compressed. Unroll it on the bed and allow up to 48 hours to reach full height.",
    care: "Rotate head-to-foot every three months. Use a mattress protector; the cover is not removable.",
    extraSpecs: [
      { label: "Firmness", value: "Medium-firm" },
      { label: "Height", value: "20 cm" },
      { label: "Layers", value: "Memory foam over high-density support foam" },
      { label: "Trial", value: "30 nights" },
    ],
    faqs: [
      {
        question: "Is there a trial period?",
        answer:
          "Thirty nights. If it does not suit you we collect it and refund in full — a mattress cannot be judged in a showroom.",
      },
      {
        question: "Does it sleep hot?",
        answer:
          "The top layer is open-cell foam with a knit cover, so it runs cooler than solid memory foam, but warmer than a spring mattress.",
      },
    ],
  },
  "sanjh-cane-armchair": {
    gallery: ["chair", "decor"],
    style: "Coastal",
    care: "Dust the cane with a soft brush. If it slackens over the years, wipe the underside with a damp cloth and let it dry — the weave tightens as it dries.",
    extraSpecs: [
      { label: "Weave", value: "Hand-woven natural rattan" },
      { label: "Frame", value: "Solid ash" },
      { label: "Seat height", value: "44 cm" },
    ],
  },
  "deepa-arc-floor-lamp": {
    gallery: ["lighting", "decor"],
    assemblyRequired: true,
    warrantyMonths: 24,
    assembly: "Three-part stem that screws together. Two minutes, no tools.",
    care: "Dust the shade with a lint roller. Clean the brass with a dry cloth only.",
    extraSpecs: [
      { label: "Bulb", value: "E27, max 15W LED (not included)" },
      { label: "Cable length", value: "2.5 m" },
      { label: "Switch", value: "Inline foot switch" },
      { label: "Reach", value: "160 cm from base" },
    ],
  },
};

/** Merge the demo detail layer onto a listing product. */
export function withDemoDetail(product: Product): Product {
  const seed = { ...DEFAULTS, ...(DETAILS[product.slug] ?? {}) };

  const variants: ProductVariant[] = (seed.variants ?? []).map((v, index) => ({
    id: `${product.id}:v${index}`,
    label: v.label,
    axis: v.axis,
    swatchHex: v.swatchHex,
    // Every demo variant shares the base price and stock. Real variants carry
    // their own, which is why the type allows both.
    stockState: product.stockState,
    available: product.stockState !== "out-of-stock",
  }));

  return {
    ...product,
    description: product.description ?? seed.description,
    variants,
    specs: {
      ...product.specs,
      style: seed.style,
      colour: seed.colour,
      assemblyRequired: seed.assemblyRequired,
      assemblyNotes: seed.assembly,
      warrantyMonths: seed.warrantyMonths,
      careInstructions: seed.care,
      installationIncluded: seed.installationIncluded,
      additional: seed.extraSpecs,
    },
    faqs: seed.faqs,
    ...({ demoGallery: seed.gallery } as Record<string, unknown>),
  };
}

/** The gallery art keys a demo product carries. Absent on real products. */
export function demoGallery(product: Product): ArtKey[] {
  return (product as unknown as { demoGallery?: ArtKey[] }).demoGallery ?? [];
}
