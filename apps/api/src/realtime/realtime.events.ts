import { BookingStatus, MechanicStatus } from '@prisma/client';

/**
 * The WebSocket contract, kept in one file so the frontend has a single place
 * to mirror. Payloads are intentionally small: they carry enough for the client
 * to patch a row in place, not enough to be a second copy of the REST API.
 */
export const REALTIME_EVENTS = {
  bookingCreated: 'booking.created',
  bookingStatusChanged: 'booking.status_changed',
  mechanicStatusChanged: 'mechanic.status_changed',
  statsInvalidated: 'stats.invalidated',
} as const;

export type BookingCreatedPayload = {
  id: string;
  code: string;
  customerName: string;
  serviceName: string;
  status: BookingStatus;
  amount: number;
  city: string;
  createdAt: string;
};

export type BookingStatusChangedPayload = {
  id: string;
  code: string;
  from: BookingStatus;
  to: BookingStatus;
  mechanicId: string | null;
  mechanicName: string | null;
  customerName: string;
  amount: number;
  completedAt: string | null;
  updatedAt: string;
  actor: string;
};

export type MechanicStatusChangedPayload = {
  id: string;
  name: string;
  from: MechanicStatus;
  to: MechanicStatus;
  jobsCompleted: number;
};
