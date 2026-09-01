import { Injectable } from '@nestjs/common';
import { BookingStatus, MechanicStatus, Prisma } from '@prisma/client';
import { CacheService } from '../common/cache/cache.service';
import { percentageDelta as delta } from '../common/metrics';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardQueryDto, DashboardRange, RANGE_DAYS } from './dto/dashboard-query.dto';

/**
 * The business runs on IST and has no DST, so a fixed offset is exact — "today"
 * and the daily chart buckets both break at midnight India time, not UTC. Without
 * this, an evening booking in Mumbai lands on the previous day in every chart.
 */
const IST_OFFSET_MINUTES = 330;
const IST_TZ = 'Asia/Kolkata';

const CACHE_TTL_MS = 60_000;

export type Kpi = { value: number; delta: number | null };

function istDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const startUtcMs =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    IST_OFFSET_MINUTES * 60_000;
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1) };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Cached for a minute, but invalidated the moment a booking changes, so the
   * cards can never disagree with a live event the operator just watched arrive.
   */
  async getDashboard(query: DashboardQueryDto) {
    return this.cache.wrap(`dashboard:${query.range}`, CACHE_TTL_MS, () => this.build(query.range));
  }

  private async build(range: DashboardRange) {
    const days = RANGE_DAYS[range];
    const now = new Date();
    const windowMs = days * 24 * 60 * 60 * 1000;
    const from = new Date(now.getTime() - windowMs);
    // The equal-length window immediately before this one, for trend deltas.
    const prevFrom = new Date(from.getTime() - windowMs);
    const today = istDayBounds(now);

    const inRange: Prisma.BookingWhereInput = { createdAt: { gte: from, lte: now } };
    const inPrevRange: Prisma.BookingWhereInput = { createdAt: { gte: prevFrom, lt: from } };

    const [
      totalBookings,
      prevTotalBookings,
      todayBookings,
      statusCounts,
      prevStatusCounts,
      revenue,
      prevRevenue,
      activeMechanics,
      newCustomers,
      prevNewCustomers,
      timeseries,
      serviceBreakdown,
      recentActivity,
    ] = await Promise.all([
      this.prisma.booking.count({ where: inRange }),
      this.prisma.booking.count({ where: inPrevRange }),
      this.prisma.booking.count({ where: { createdAt: { gte: today.start, lte: today.end } } }),
      this.prisma.booking.groupBy({ by: ['status'], where: inRange, _count: { _all: true } }),
      this.prisma.booking.groupBy({ by: ['status'], where: inPrevRange, _count: { _all: true } }),
      // Revenue counts only completed work — pending jobs are not earned yet,
      // and cancelled ones are stored at zero.
      this.prisma.booking.aggregate({
        where: { ...inRange, status: BookingStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.booking.aggregate({
        where: { ...inPrevRange, status: BookingStatus.COMPLETED },
        _sum: { amount: true },
      }),
      // Point-in-time, not range-scoped: an ops team wants to know who is on
      // shift right now.
      this.prisma.mechanic.count({
        where: { status: { in: [MechanicStatus.AVAILABLE, MechanicStatus.ON_JOB] } },
      }),
      this.prisma.customer.count({ where: { createdAt: { gte: from, lte: now } } }),
      this.prisma.customer.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.getTimeseries(from, now),
      this.getServiceBreakdown(from, now),
      this.getRecentActivity(),
    ]);

    const countFor = (rows: typeof statusCounts, status: BookingStatus) =>
      rows.find((r) => r.status === status)?._count._all ?? 0;

    const completed = countFor(statusCounts, BookingStatus.COMPLETED);
    const cancelled = countFor(statusCounts, BookingStatus.CANCELLED);
    // "Pending" on an ops board means everything not yet finished, not just the
    // PENDING enum value — that is the number the team actually works from.
    const openStatuses = [
      BookingStatus.PENDING,
      BookingStatus.ASSIGNED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.IN_PROGRESS,
    ];
    const pending = openStatuses.reduce((sum, s) => sum + countFor(statusCounts, s), 0);
    const prevPending = openStatuses.reduce((sum, s) => sum + countFor(prevStatusCounts, s), 0);

    const revenueValue = revenue._sum.amount ?? 0;
    const prevRevenueValue = prevRevenue._sum.amount ?? 0;

    return {
      range: { key: range, days, from: from.toISOString(), to: now.toISOString(), timezone: IST_TZ },
      kpis: {
        totalBookings: { value: totalBookings, delta: delta(totalBookings, prevTotalBookings) },
        todayBookings: { value: todayBookings, delta: null },
        completedBookings: {
          value: completed,
          delta: delta(completed, countFor(prevStatusCounts, BookingStatus.COMPLETED)),
        },
        pendingBookings: { value: pending, delta: delta(pending, prevPending) },
        cancelledBookings: {
          value: cancelled,
          delta: delta(cancelled, countFor(prevStatusCounts, BookingStatus.CANCELLED)),
        },
        totalRevenue: { value: revenueValue, delta: delta(revenueValue, prevRevenueValue) },
        activeMechanics: { value: activeMechanics, delta: null },
        newCustomers: { value: newCustomers, delta: delta(newCustomers, prevNewCustomers) },
      },
      timeseries,
      statusBreakdown: Object.values(BookingStatus).map((status) => ({
        status,
        count: countFor(statusCounts, status),
      })),
      serviceBreakdown,
      recentActivity,
    };
  }

  /**
   * Daily buckets, zero-filled. The zero-fill matters: without it a quiet day is
   * a missing point and the chart silently draws a straight line across it.
   */
  private async getTimeseries(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<{ day: Date; bookings: number; revenue: number }[]>`
      SELECT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${IST_TZ})::date AS day,
             COUNT(*)::int AS bookings,
             COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::int AS revenue
      FROM bookings
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
    const out: { date: string; bookings: number; revenue: number }[] = [];
    const cursor = istDayBounds(from).start;

    while (cursor <= to) {
      const key = new Date(cursor.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
      const hit = byDay.get(key);
      out.push({ date: key, bookings: hit?.bookings ?? 0, revenue: hit?.revenue ?? 0 });
      cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return out;
  }

  private getServiceBreakdown(from: Date, to: Date) {
    return this.prisma.$queryRaw<{ category: string; count: number; revenue: number }[]>`
      SELECT s.category,
             COUNT(*)::int AS count,
             COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' THEN b.amount ELSE 0 END), 0)::int AS revenue
      FROM bookings b
      JOIN services s ON s.id = b."serviceId"
      WHERE b."createdAt" >= ${from} AND b."createdAt" <= ${to}
      GROUP BY s.category
      ORDER BY count DESC
    `;
  }

  /** The live feed: real timeline rows, so a refresh does not wipe the history. */
  private async getRecentActivity() {
    const events = await this.prisma.bookingEvent.findMany({
      take: 12,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        actor: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            code: true,
            customer: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      bookingId: e.booking.id,
      code: e.booking.code,
      customerName: e.booking.customer.name,
      serviceName: e.booking.service.name,
      from: e.fromStatus,
      to: e.toStatus,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
