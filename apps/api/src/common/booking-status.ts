import { BookingStatus } from '@prisma/client';

/**
 * The booking state machine, in one place.
 *
 * Both the manual `PATCH /bookings/:id/status` endpoint and the ops simulator
 * transition bookings. Having a single source of truth means a rule added here
 * applies to both, and neither can invent a transition the other rejects.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  [BookingStatus.ASSIGNED]: [BookingStatus.ON_THE_WAY, BookingStatus.CANCELLED],
  [BookingStatus.ON_THE_WAY]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  // Terminal states.
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

/** Statuses that represent work currently occupying a mechanic. */
export const IN_FLIGHT_STATUSES: BookingStatus[] = [
  BookingStatus.ASSIGNED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.IN_PROGRESS,
];

/** Statuses no longer counted as open work. */
export const TERMINAL_STATUSES: BookingStatus[] = [BookingStatus.COMPLETED, BookingStatus.CANCELLED];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** The next status on the happy path, or null if there is nowhere left to go. */
export function nextHappyPathStatus(from: BookingStatus): BookingStatus | null {
  const [next] = ALLOWED_TRANSITIONS[from];
  return next && next !== BookingStatus.CANCELLED ? next : null;
}
