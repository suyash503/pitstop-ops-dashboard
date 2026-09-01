import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { nextHappyPathStatus } from '../common/booking-status';
import { PrismaService } from '../common/prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

/**
 * Ops traffic simulator.
 *
 * This stands in for the real world. A production deployment of this dashboard
 * would receive status changes from the mechanic mobile app and new bookings
 * from the customer app; neither exists here, so this service produces the same
 * events on a timer to make the live layer demonstrable.
 *
 * It is deliberately not a shortcut: it drives everything through
 * BookingsService, so simulated traffic obeys the same state machine, writes the
 * same audit rows and fires the same WebSocket events as a real operator action.
 * Switching it off with SIMULATOR_ENABLED=false leaves a completely functional
 * dashboard — just a quiet one.
 */
const OPEN_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.ASSIGNED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.IN_PROGRESS,
];

/** Keep at least this much live work on the board. */
const MIN_OPEN_BOOKINGS = 12;

@Injectable()
export class SimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<string>('SIMULATOR_ENABLED', 'true') === 'true';
    if (!enabled) {
      this.logger.log('Simulator disabled (SIMULATOR_ENABLED=false)');
      return;
    }

    const intervalMs = Number(this.config.get<string>('SIMULATOR_INTERVAL_MS', '7000'));
    this.timer = setInterval(() => {
      // Never let ticks overlap: one slow database call would otherwise stack up
      // concurrent transitions on the same booking.
      if (this.running) return;
      this.running = true;
      void this.tick()
        .catch((err) => this.logger.warn(`Simulator tick failed: ${(err as Error).message}`))
        .finally(() => {
          this.running = false;
        });
    }, intervalMs);

    this.logger.log(`Simulator running every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const open = await this.prisma.booking.count({ where: { status: { in: OPEN_STATUSES } } });

    // A booking needs four transitions to reach COMPLETED, so creating on ~1 tick
    // in 5 keeps the open pool roughly stable rather than draining it. Below the
    // floor, always create — an empty board is the one thing a live dashboard
    // must never show.
    if (open < MIN_OPEN_BOOKINGS || Math.random() < 0.2) {
      await this.createBooking();
      return;
    }
    await this.advanceBooking(open);
  }

  /** Advances one random in-flight booking along the state machine. */
  private async advanceBooking(open: number): Promise<void> {
    const openStatuses = OPEN_STATUSES;
    if (open === 0) {
      this.logger.debug('No open bookings to advance');
      return;
    }

    // Random offset rather than ORDER BY random(): a full sort of the table on
    // every tick would be wasteful, and any open booking will do.
    const [booking] = await this.prisma.booking.findMany({
      where: { status: { in: openStatuses } },
      select: { id: true, code: true, status: true },
      skip: Math.floor(Math.random() * open),
      take: 1,
    });
    if (!booking) return;

    // A small share of jobs fall over rather than completing, so the board is
    // not implausibly tidy.
    const shouldCancel =
      Math.random() < 0.06 &&
      (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.ASSIGNED);

    const next = shouldCancel ? BookingStatus.CANCELLED : nextHappyPathStatus(booking.status);
    if (!next) return;

    try {
      await this.bookings.transitionStatus(
        booking.id,
        next,
        'system',
        shouldCancel ? 'Cancelled by customer' : undefined,
      );
      this.logger.debug(`${booking.code}: ${booking.status} -> ${next}`);
    } catch (err) {
      // Expected when no mechanic is free to take an assignment; not an error.
      this.logger.debug(`Skipped ${booking.code}: ${(err as Error).message}`);
    }
  }

  /** Creates a booking for a random existing customer and one of their vehicles. */
  private async createBooking(): Promise<void> {
    const [customerCount, serviceCount] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.service.count(),
    ]);
    if (customerCount === 0 || serviceCount === 0) return;

    const [customer] = await this.prisma.customer.findMany({
      skip: Math.floor(Math.random() * customerCount),
      take: 1,
      select: { id: true, city: true, vehicles: { select: { id: true } } },
    });
    if (!customer || customer.vehicles.length === 0) return;

    const [service] = await this.prisma.service.findMany({
      skip: Math.floor(Math.random() * serviceCount),
      take: 1,
      select: { id: true, basePrice: true },
    });
    if (!service) return;

    const vehicle = customer.vehicles[Math.floor(Math.random() * customer.vehicles.length)];
    const variance = 0.85 + Math.random() * 0.35;

    const booking = await this.bookings.create({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: service.id,
      amount: Math.round((service.basePrice * variance) / 10) * 10,
      city: customer.city,
      // Scheduled somewhere in the next eight hours.
      scheduledAt: new Date(Date.now() + Math.floor(Math.random() * 8 * 60) * 60_000),
      actor: 'system',
    });

    this.logger.debug(`Created ${booking.code}`);
  }
}
