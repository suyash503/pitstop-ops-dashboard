'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { WS_URL } from './api';
import { useAuth } from './auth-context';
import { BOOKING_STATUS_META } from './status';
import type { BookingListItem, BookingStatus, Paginated } from './types';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

type BookingStatusChanged = {
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

type BookingCreated = {
  id: string;
  code: string;
  customerName: string;
  serviceName: string;
  status: BookingStatus;
  amount: number;
  city: string;
  createdAt: string;
};

type SocketState = {
  connection: ConnectionState;
  /** Rises on every event; drives the "updated Xs ago" indicator. */
  lastEventAt: number | null;
};

const SocketContext = createContext<SocketState>({ connection: 'connecting', lastEventAt: null });

/**
 * Holds the live connection and folds incoming events into the React Query cache.
 *
 * Two behaviours are deliberate:
 *
 * 1. Booking rows are patched in place rather than refetched. A status change
 *    carries everything the row needs, so the table updates without a network
 *    round trip and without the row flashing through a loading state.
 *
 * 2. Aggregates are invalidated, not patched. Recomputing KPI deltas and chart
 *    buckets on the client would duplicate backend logic and drift from it; a
 *    refetch is cheap and always agrees with the server.
 *
 * If the socket cannot hold a connection, the query client falls back to polling
 * (see providers.tsx) so the board keeps moving either way.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useAuth();
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      // Queued rather than called inline: a synchronous setState here cascades
      // an extra render pass on every auth change.
      const id = setTimeout(() => setConnection('offline'), 0);
      return () => clearTimeout(id);
    }

    const socket = io(`${WS_URL}/events`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnection('live'));
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', () => setConnection('reconnecting'));
    socket.io.on('reconnect_failed', () => setConnection('offline'));
    socket.on('unauthorized', () => setConnection('offline'));

    socket.on('booking.status_changed', (payload: BookingStatusChanged) => {
      setLastEventAt(Date.now());

      // Patch every cached bookings page that contains this row.
      queryClient.setQueriesData<Paginated<BookingListItem>>(
        { queryKey: ['bookings'] },
        (old) => {
          if (!old) return old;
          if (!old.data.some((b) => b.id === payload.id)) return old;
          return {
            ...old,
            data: old.data.map((b) =>
              b.id === payload.id
                ? {
                    ...b,
                    status: payload.to,
                    completedAt: payload.completedAt,
                    mechanic: payload.mechanicId
                      ? {
                          id: payload.mechanicId,
                          name: payload.mechanicName ?? '',
                          status: b.mechanic?.status ?? 'ON_JOB',
                        }
                      : b.mechanic,
                  }
                : b,
            ),
          };
        },
      );

      // The detail view holds a timeline this payload cannot reconstruct.
      queryClient.invalidateQueries({ queryKey: ['booking', payload.id] });
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
    });

    socket.on('booking.created', (payload: BookingCreated) => {
      setLastEventAt(Date.now());
      toast(`New booking ${payload.code}`, {
        description: `${payload.customerName} — ${payload.serviceName}`,
      });
      // A new row changes what belongs on every page, so patching is not
      // meaningful here; refetch the list instead.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    });

    socket.on('mechanic.status_changed', () => {
      setLastEventAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
    });

    socket.on('stats.invalidated', () => {
      setLastEventAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, status, queryClient]);

  const value = useMemo<SocketState>(() => ({ connection, lastEventAt }), [connection, lastEventAt]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketState {
  return useContext(SocketContext);
}

export function statusChangeLabel(from: BookingStatus | null, to: BookingStatus): string {
  const toLabel = BOOKING_STATUS_META[to].label;
  if (!from) return `created as ${toLabel}`;
  return `${BOOKING_STATUS_META[from].label} → ${toLabel}`;
}
