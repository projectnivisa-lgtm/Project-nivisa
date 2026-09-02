// ---------------------------------------------------------------------------
// Numbers and money — always grouped the Indian way (lakh/crore), never the
// browser's guess.
//
// Same class of bug as the dates below: ~44 call sites used a bare
// `n.toLocaleString()`, which groups by the BROWSER's locale. On an en-US
// browser that renders 6,29,93,064 as 62,993,064 — the Total Inventory figure
// staff were shown was grouped in millions, not crores. It goes unnoticed
// because anything under 1,00,000 formats identically in both locales, so the
// wrongness only appears once a number gets big enough to matter.
//
// Pinned to 'en-IN' rather than left to the browser: this is an Indian
// publisher's back office, and the grouping is not a per-user preference.
// ---------------------------------------------------------------------------

const numberFmt = new Intl.NumberFormat('en-IN');

/** Whole-number counts: 11,334 · 6,29,93,064. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return numberFmt.format(n);
}

/** Rupee amounts with the symbol and no paise: ₹6,29,93,064. */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)}`;
}

/**
 * Rupee amounts with paise: ₹1,299.50. Use where the exact figure matters —
 * order totals, invoice lines, prices — as opposed to a rounded KPI headline.
 *
 * Six files had each declared their own identical `new Intl.NumberFormat('en-IN',
 * { style: 'currency', currency: 'INR' })`; this is that constant, once.
 */
export const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// Indian numeric date format (dd/mm/yyyy) everywhere in the admin app -
// `toLocaleDateString(undefined, ...)` used to render locale-dependent
// month-name dates (e.g. "17 Aug 2026" or "Aug 17, 2026" depending on the
// browser's locale), inconsistent with the dd/mm/yyyy staff expect and
// inconsistent across the ~13 places that called toLocaleDateString
// directly with their own ad-hoc options. This is the one place to change it.
/** Short rupee amounts for dashboard tiles: ₹5.43 Cr · ₹8.80 L · ₹7,450.
 *
 *  Crore/lakh, not million/billion — this is an Indian back office, same
 *  reasoning as the grouping above. Use ONLY where space is tight, and always
 *  put the exact `formatMoney` value in a `title` so the precise figure is a
 *  hover away. Tables, invoices and exports must keep the full number. */
export function formatMoneyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return formatMoney(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Same dd/mm/yyyy date, plus 24-hour local time - for places that currently
// show a bare toLocaleDateString/toLocaleString and need the time too.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Appends the current date/time to a download filename, e.g. "books_export" ->
// "books_export_10_08_2026_07_08.csv". Used so every CSV export/download is
// uniquely named by when it was generated.
export function timestampedFilename(base: string, ext = 'csv'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}_${pad(now.getHours())}_${pad(now.getMinutes())}`;
  return `${base}_${stamp}.${ext}`;
}

// Shared fetch-blob-and-save-as-file flow used by every "Export CSV" button —
// avoids re-typing the same auth-header/blob/anchor dance on every page.
export async function downloadCsvFromUrl(url: string, filenameBase: string, token: string | null): Promise<void> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = timestampedFilename(filenameBase);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
