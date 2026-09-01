import { cn } from '@/lib/utils';
import { BOOKING_STATUS_META, MECHANIC_STATUS_META } from '@/lib/status';
import type { BookingStatus, MechanicStatus } from '@/lib/types';

const base =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function StatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  const meta = BOOKING_STATUS_META[status];
  return (
    <span className={cn(base, meta.className, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function MechanicStatusBadge({
  status,
  className,
}: {
  status: MechanicStatus;
  className?: string;
}) {
  const meta = MECHANIC_STATUS_META[status];
  return (
    <span className={cn(base, meta.className, className)}>
      <span
        className={cn(
          'size-1.5 rounded-full',
          meta.dot,
          // A pulsing dot reads as "happening now" without extra words.
          status === 'ON_JOB' && 'animate-pulse',
        )}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
