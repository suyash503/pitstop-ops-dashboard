import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { IN_FLIGHT_STATUSES } from '../common/booking-status';
import { Paginated, paginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { QueryMechanicsDto } from './dto/query-mechanics.dto';

const CURRENT_BOOKING_SELECT = {
  id: true,
  code: true,
  status: true,
  scheduledAt: true,
  createdAt: true,
  customer: { select: { name: true } },
  service: { select: { name: true } },
} satisfies Prisma.BookingSelect;

@Injectable()
export class MechanicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMechanicsDto): Promise<Paginated<unknown>> {
    const where: Prisma.MechanicWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.city) where.city = query.city;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { specialization: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [mechanics, total] = await this.prisma.$transaction([
      this.prisma.mechanic.findMany({
        where,
        orderBy: [{ status: 'asc' }, { jobsCompleted: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
        include: {
          // Prisma resolves a bounded relation like this with one extra query,
          // not one per mechanic — so the list stays two round trips regardless
          // of page size.
          bookings: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: CURRENT_BOOKING_SELECT,
          },
        },
      }),
      this.prisma.mechanic.count({ where }),
    ]);

    const data = mechanics.map(({ bookings, ...m }) => {
      const latest = bookings[0] ?? null;
      const isActive = latest ? IN_FLIGHT_STATUSES.includes(latest.status) : false;
      return {
        ...m,
        // The UI shows one slot: what they are on now, or what they did last.
        currentBooking: isActive ? latest : null,
        lastBooking: isActive ? null : latest,
      };
    });

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const mechanic = await this.prisma.mechanic.findUnique({
      where: { id },
      include: {
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { ...CURRENT_BOOKING_SELECT, amount: true, completedAt: true },
        },
      },
    });

    if (!mechanic) {
      throw new NotFoundException(`Mechanic ${id} not found`);
    }

    const revenue = await this.prisma.booking.aggregate({
      where: { mechanicId: id, status: BookingStatus.COMPLETED },
      _sum: { amount: true },
      _avg: { amount: true },
    });

    const { bookings, ...rest } = mechanic;
    return {
      ...rest,
      recentBookings: bookings,
      stats: {
        revenueGenerated: revenue._sum.amount ?? 0,
        averageTicket: Math.round(revenue._avg.amount ?? 0),
      },
    };
  }
}
