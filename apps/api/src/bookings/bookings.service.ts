import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, MechanicStatus, Prisma } from '@prisma/client';
import { canTransition, IN_FLIGHT_STATUSES } from '../common/booking-status';
import { CacheService } from '../common/cache/cache.service';
import { Paginated, paginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QueryBookingsDto } from './dto/query-bookings.dto';

/** Columns the list view needs — deliberately narrow, no full relation loads. */
const LIST_SELECT = {
  id: true,
  code: true,
  status: true,
  amount: true,
  city: true,
  scheduledAt: true,
  createdAt: true,
  completedAt: true,
  customer: { select: { id: true, name: true, phone: true } },
  vehicle: { select: { id: true, make: true, model: true, regNo: true } },
  service: { select: { id: true, name: true, category: true } },
  mechanic: { select: { id: true, name: true, status: true } },
} satisfies Prisma.BookingSelect;

export type BookingListItem = Prisma.BookingGetPayload<{ select: typeof LIST_SELECT }>;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly cache: CacheService,
  ) {}

  /** Translates the query DTO into a Prisma filter. Shared by list and export. */
  private buildWhere(query: QueryBookingsDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {};

    if (query.status?.length) where.status = { in: query.status };
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.mechanicId) where.mechanicId = query.mechanicId;
    if (query.city) where.city = query.city;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      // `to` is treated as inclusive of the whole day, which is what a date
      // picker implies to the person using it.
      if (query.to) {
        const end = new Date(query.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { vehicle: { regNo: { contains: search, mode: 'insensitive' } } },
        { service: { name: { contains: search, mode: 'insensitive' } } },
        { mechanic: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  async findAll(query: QueryBookingsDto): Promise<Paginated<BookingListItem>> {
    const where = this.buildWhere(query);

    // One round trip for the page and its total, rather than two sequential ones.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [query.sort]: query.order },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        mechanic: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }

  /**
   * Advances a booking and records why.
   *
   * Everything happens in one transaction: the booking row, its timeline entry
   * and the mechanic rollup must agree, or the dashboard will show a mechanic
   * who is busy on a job that already closed. Events are emitted only after the
   * transaction commits, so no client is ever told about a write that rolled back.
   */
  async transitionStatus(
    id: string,
    to: BookingStatus,
    actor: string,
    note?: string,
  ): Promise<{ id: string; status: BookingStatus }> {
    const current = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        amount: true,
        city: true,
        mechanicId: true,
        customer: { select: { name: true } },
        mechanic: { select: { id: true, name: true, status: true, jobsCompleted: true } },
      },
    });

    if (!current) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    if (!canTransition(current.status, to)) {
      throw new BadRequestException(
        `Cannot move booking ${current.code} from ${current.status} to ${to}`,
      );
    }

    // Assignment is what actually puts a mechanic on a job, so a booking moving
    // out of PENDING has to acquire one here — otherwise the board would show
    // assigned work with nobody on it.
    const assignee =
      to === BookingStatus.ASSIGNED && !current.mechanicId
        ? await this.pickAvailableMechanic(current.city)
        : null;

    if (to === BookingStatus.ASSIGNED && !current.mechanicId && !assignee) {
      throw new BadRequestException(`No mechanic is available to take booking ${current.code}`);
    }

    const mechanicId = current.mechanicId ?? assignee?.id ?? null;
    const now = new Date();
    const currentMechanic = current.mechanic ?? assignee;
    const isCompleting = to === BookingStatus.COMPLETED;
    const releasesMechanic = !IN_FLIGHT_STATUSES.includes(to);
    // Computed once and used for both the write and the broadcast, so the two
    // can never disagree. Finishing a job must not put someone who is off shift
    // back on the roster.
    const nextMechanicStatus = releasesMechanic
      ? currentMechanic?.status === MechanicStatus.OFF_DUTY
        ? MechanicStatus.OFF_DUTY
        : MechanicStatus.AVAILABLE
      : MechanicStatus.ON_JOB;

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id },
        data: {
          status: to,
          completedAt: isCompleting ? now : null,
          updatedAt: now,
          ...(assignee ? { mechanicId: assignee.id } : {}),
        },
        select: { id: true, status: true, updatedAt: true, completedAt: true },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          fromStatus: current.status,
          toStatus: to,
          note: note ?? (assignee ? `Assigned to ${assignee.name}` : undefined),
          actor,
        },
      });

      if (mechanicId) {
        await tx.mechanic.update({
          where: { id: mechanicId },
          data: {
            status: nextMechanicStatus,
            ...(isCompleting ? { jobsCompleted: { increment: 1 } } : {}),
          },
        });
      }

      return [booking];
    });

    // Aggregates are now stale; drop them before anyone can re-read them.
    this.cache.invalidate('dashboard:');

    this.realtime.emitBookingStatusChanged({
      id: current.id,
      code: current.code,
      from: current.status,
      to,
      mechanicId,
      mechanicName: currentMechanic?.name ?? null,
      customerName: current.customer.name,
      amount: current.amount,
      completedAt: updated.completedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
      actor,
    });

    if (currentMechanic && nextMechanicStatus !== currentMechanic.status) {
      this.realtime.emitMechanicStatusChanged({
        id: currentMechanic.id,
        name: currentMechanic.name,
        from: currentMechanic.status,
        to: nextMechanicStatus,
        jobsCompleted: currentMechanic.jobsCompleted + (isCompleting ? 1 : 0),
      });
    }

    return { id: updated.id, status: updated.status };
  }

  /**
   * Picks who takes the job: someone free in the same city, falling back to any
   * free mechanic. Least-loaded first, so work spreads instead of piling onto
   * whoever the database happens to return first.
   */
  private pickAvailableMechanic(city: string) {
    return this.prisma.mechanic
      .findFirst({
        where: { status: MechanicStatus.AVAILABLE, city },
        orderBy: { jobsCompleted: 'asc' },
        select: { id: true, name: true, status: true, jobsCompleted: true },
      })
      .then(
        (local) =>
          local ??
          this.prisma.mechanic.findFirst({
            where: { status: MechanicStatus.AVAILABLE },
            orderBy: { jobsCompleted: 'asc' },
            select: { id: true, name: true, status: true, jobsCompleted: true },
          }),
      );
  }

  /**
   * Creates a booking and announces it. Used by the ops simulator today; the
   * same path a customer-facing booking flow would call tomorrow.
   */
  async create(input: {
    customerId: string;
    vehicleId: string;
    serviceId: string;
    amount: number;
    city: string;
    scheduledAt: Date;
    notes?: string | null;
    actor?: string;
  }) {
    // Codes run in creation order; derive the next one from the current max.
    const year = new Date().getFullYear();
    const last = await this.prisma.booking.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const lastSeq = last ? Number.parseInt(last.code.split('-')[2] ?? '0', 10) : 0;
    const code = `BK-${year}-${String(lastSeq + 1).padStart(4, '0')}`;

    const booking = await this.prisma.booking.create({
      data: {
        code,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        serviceId: input.serviceId,
        amount: input.amount,
        city: input.city,
        scheduledAt: input.scheduledAt,
        notes: input.notes ?? null,
        status: BookingStatus.PENDING,
        events: {
          create: {
            toStatus: BookingStatus.PENDING,
            note: 'Booking created',
            actor: input.actor ?? 'system',
          },
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        amount: true,
        city: true,
        createdAt: true,
        customer: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    this.cache.invalidate('dashboard:');
    this.realtime.emitBookingCreated({
      id: booking.id,
      code: booking.code,
      customerName: booking.customer.name,
      serviceName: booking.service.name,
      status: booking.status,
      amount: booking.amount,
      city: booking.city,
      createdAt: booking.createdAt.toISOString(),
    });

    return booking;
  }

  /**
   * CSV of the current filter selection. Capped rather than streamed: the export
   * is an operator convenience, not a bulk data channel, and a hard ceiling keeps
   * one click from pinning a 1 GB instance.
   */
  async exportCsv(query: QueryBookingsDto): Promise<string> {
    const MAX_ROWS = 5000;
    const rows = await this.prisma.booking.findMany({
      where: this.buildWhere(query),
      select: LIST_SELECT,
      orderBy: { [query.sort]: query.order },
      take: MAX_ROWS,
    });

    const header = [
      'Booking ID',
      'Customer',
      'Phone',
      'Vehicle',
      'Registration',
      'Service',
      'Category',
      'Mechanic',
      'Status',
      'Amount (INR)',
      'City',
      'Scheduled At',
      'Created At',
      'Completed At',
    ];

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Quote anything containing a delimiter, quote or newline; double inner quotes.
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines = rows.map((b) =>
      [
        b.code,
        b.customer.name,
        b.customer.phone,
        `${b.vehicle.make} ${b.vehicle.model}`,
        b.vehicle.regNo,
        b.service.name,
        b.service.category,
        b.mechanic?.name ?? 'Unassigned',
        b.status,
        b.amount,
        b.city,
        b.scheduledAt.toISOString(),
        b.createdAt.toISOString(),
        b.completedAt?.toISOString() ?? '',
      ]
        .map(escape)
        .join(','),
    );

    return [header.join(','), ...lines].join('\n');
  }
}
