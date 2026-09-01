/**
 * Percentage change between the current window and the one before it.
 *
 * Returns null when there is no baseline to compare against, so the UI can show
 * nothing rather than an invented "+100%" or a division by zero. Growing from
 * zero is genuinely undefined as a percentage, and pretending otherwise puts a
 * meaningless number on a dashboard people make decisions from.
 */
export function percentageDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  // One decimal place: more precision than that is noise on a trend indicator.
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
