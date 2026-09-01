import type { BookingStatus, MechanicStatus } from './types';

/**
 * Status presentation, defined once.
 *
 * Colours carry meaning here: amber for work waiting on someone, blue for work
 * in motion, green for done, grey for cancelled. The badge text never relies on
 * colour alone, so the board still reads correctly in greyscale or with a colour
 * vision deficiency.
 */
export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  ASSIGNED: {
    label: 'Assigned',
    className:
      'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  ON_THE_WAY: {
    label: 'On the way',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  IN_PROGRESS: {
    label: 'In progress',
    className:
      'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    className:
      'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
};

export const MECHANIC_STATUS_META: Record<
  MechanicStatus,
  { label: string; className: string; dot: string }
> = {
  AVAILABLE: {
    label: 'Available',
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  ON_JOB: {
    label: 'On job',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  OFF_DUTY: {
    label: 'Off duty',
    className:
      'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

/** Chart-safe colours, keyed to the same semantics as the badges. */
export const STATUS_CHART_COLORS: Record<BookingStatus, string> = {
  PENDING: '#f59e0b',
  ASSIGNED: '#8b5cf6',
  ON_THE_WAY: '#0ea5e9',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#f43f5e',
};

export const BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'ASSIGNED',
  'ON_THE_WAY',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

/** Mirrors the backend state machine so the UI only offers legal moves. */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const OPEN_STATUSES: BookingStatus[] = [
  'PENDING',
  'ASSIGNED',
  'ON_THE_WAY',
  'IN_PROGRESS',
];
