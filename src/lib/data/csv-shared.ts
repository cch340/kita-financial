// Pure, framework-free CSV serialization helpers — no supabase / next/headers here,
// so the export Route Handler, client code, and vitest can all import them.

/** Integer cents → fixed two-decimal string (RFC-4180-friendly numeric field). */
export function centsToDecimal(cents: number): string {
  const s = (Math.abs(cents) / 100).toFixed(2)
  return cents < 0 ? '-' + s : s
}

/** Escape a single CSV field per RFC 4180. null/undefined become the empty string. */
export function csvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Build a CSV document (no trailing newline, no BOM) from a header row and data rows. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}

/** Build the download filename for an asset CSV. Slugifies the asset name to ASCII;
 *  when that yields nothing (e.g. an all-CJK name) or the name is blank, falls back
 *  to the asset id so the file is never named `kita-asset-.csv`. */
export function assetCsvFilename(name: string, id: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `kita-asset-${slug || id}.csv`
}
