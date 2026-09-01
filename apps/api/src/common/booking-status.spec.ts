import { BookingStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  nextHappyPathStatus,
  TERMINAL_STATUSES,
} from './booking-status';

describe('booking state machine', () => {
  it('walks the happy path in order', () => {
    expect(nextHappyPathStatus(BookingStatus.PENDING)).toBe(BookingStatus.ASSIGNED);
    expect(nextHappyPathStatus(BookingStatus.ASSIGNED)).toBe(BookingStatus.ON_THE_WAY);
    expect(nextHappyPathStatus(BookingStatus.ON_THE_WAY)).toBe(BookingStatus.IN_PROGRESS);
    expect(nextHappyPathStatus(BookingStatus.IN_PROGRESS)).toBe(BookingStatus.COMPLETED);
  });

  it('allows cancellation from every non-terminal state', () => {
    const open = [
      BookingStatus.PENDING,
      BookingStatus.ASSIGNED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.IN_PROGRESS,
    ];
    for (const status of open) {
      expect(canTransition(status, BookingStatus.CANCELLED)).toBe(true);
    }
  });

  it('treats COMPLETED and CANCELLED as terminal', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toHaveLength(0);
      expect(nextHappyPathStatus(status)).toBeNull();
    }
  });

  it('rejects skipping a step', () => {
    // The case that matters most: a job cannot be billed as done without
    // anyone having worked on it.
    expect(canTransition(BookingStatus.PENDING, BookingStatus.COMPLETED)).toBe(false);
    expect(canTransition(BookingStatus.ASSIGNED, BookingStatus.IN_PROGRESS)).toBe(false);
  });

  it('rejects moving backwards', () => {
    expect(canTransition(BookingStatus.IN_PROGRESS, BookingStatus.ASSIGNED)).toBe(false);
    expect(canTransition(BookingStatus.COMPLETED, BookingStatus.IN_PROGRESS)).toBe(false);
  });

  it('rejects reopening a cancelled booking', () => {
    expect(canTransition(BookingStatus.CANCELLED, BookingStatus.ASSIGNED)).toBe(false);
    expect(canTransition(BookingStatus.CANCELLED, BookingStatus.PENDING)).toBe(false);
  });

  it('never lets a status transition to itself', () => {
    for (const status of Object.values(BookingStatus)) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});
