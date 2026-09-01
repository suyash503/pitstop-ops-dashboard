const IST = 'Asia/Kolkata';

/**
 * Amounts are whole rupees. Indian grouping (1,00,000) is what the operations
 * team reads natively, so use the en-IN locale rather than generic thousands.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact form for KPI cards, where ₹20,43,200 would overflow the tile. */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST,
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: IST }).format(
    new Date(iso),
  );
}

/** Short axis label, e.g. "12 Sep". */
export function formatChartDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: IST,
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * "just now" / "4m ago" / "3h ago". Live feeds are read at a glance, and an
 * absolute timestamp makes the reader do the subtraction.
 */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(diffMs / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(iso);
}

export function formatDelta(delta: number | null): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}%`;
}
