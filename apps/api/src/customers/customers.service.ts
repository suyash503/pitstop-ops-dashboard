import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { Paginated, paginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { QueryCustomersDto } from './dto/query-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCustomersDto): Promise<Paginated<unknown>> {
    const where: Prisma.CustomerWhereInput = {};
    if (query.city) where.city = query.city;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          _count: { select: { bookings: true, vehicles: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Lifetime value is a single grouped query over just the customers on this
    // page, rather than an aggregate per row.
    const ids = customers.map((c) => c.id);
    const spend = ids.length
      ? await this.prisma.booking.groupBy({
          by: ['customerId'],
          where: { customerId: { in: ids }, status: BookingStatus.COMPLETED },
          _sum: { amount: true },
        })
      : [];
    const spendByCustomer = new Map(spend.map((s) => [s.customerId, s._sum.amount ?? 0]));

    const data = customers.map(({ _count, ...c }) => ({
      ...c,
      bookingCount: _count.bookings,
      vehicleCount: _count.vehicles,
      lifetimeValue: spendByCustomer.get(c.id) ?? 0,
    }));

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        vehicles: true,
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            code: true,
            status: true,
            amount: true,
            createdAt: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const spend = await this.prisma.booking.aggregate({
      where: { customerId: id, status: BookingStatus.COMPLETED },
      _sum: { amount: true },
    });

    const { bookings, ...rest } = customer;
    return { ...rest, recentBookings: bookings, lifetimeValue: spend._sum.amount ?? 0 };
  }
}
