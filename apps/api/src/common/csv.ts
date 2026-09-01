/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Extracted from the bookings export so the escaping rules can be tested
 * directly — customer names in this dataset contain commas ("Mr. Gopaal
 * Mukhopadhyay, Jr"), and a naive join corrupts every row that has one.
 */

/** Quotes a value if it contains a delimiter, quote or newline. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(',');
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [toCsvRow(header), ...rows.map(toCsvRow)].join('\n');
}
