import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  BookingCreatedPayload,
  BookingStatusChangedPayload,
  MechanicStatusChangedPayload,
  REALTIME_EVENTS,
} from './realtime.events';

/**
 * Broadcasts operational changes to every connected dashboard.
 *
 * Sockets are authenticated at handshake with the same JWT the REST API uses —
 * an unauthenticated socket would otherwise be a side door around the guards on
 * the HTTP routes.
 *
 * Everything is broadcast to all clients because every operator sees the same
 * board. Per-user rooms would be the change if the product ever grows
 * city-scoped or role-scoped views.
 */
@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim());
      cb(null, !origin || allowed.includes(origin));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Rejected socket ${client.id}: no token`);
      client.emit('unauthorized', { message: 'Missing token' });
      client.disconnect(true);
      return;
    }

    try {
      await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow<string>('JWT_SECRET') });
      this.logger.log(`Socket connected: ${client.id} (${this.clientCount()} online)`);
    } catch {
      this.logger.warn(`Rejected socket ${client.id}: invalid token`);
      client.emit('unauthorized', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id} (${this.clientCount()} online)`);
  }

  private clientCount(): number {
    return this.server?.sockets instanceof Map ? this.server.sockets.size : 0;
  }

  emitBookingCreated(payload: BookingCreatedPayload): void {
    this.server?.emit(REALTIME_EVENTS.bookingCreated, payload);
    this.emitStatsInvalidated();
  }

  emitBookingStatusChanged(payload: BookingStatusChangedPayload): void {
    this.server?.emit(REALTIME_EVENTS.bookingStatusChanged, payload);
    this.emitStatsInvalidated();
  }

  emitMechanicStatusChanged(payload: MechanicStatusChangedPayload): void {
    this.server?.emit(REALTIME_EVENTS.mechanicStatusChanged, payload);
  }

  /** Tells clients their cached aggregates are stale without shipping new ones. */
  emitStatsInvalidated(): void {
    this.server?.emit(REALTIME_EVENTS.statsInvalidated, { at: new Date().toISOString() });
  }
}
