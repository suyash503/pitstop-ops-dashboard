import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Whitelisted so a caller cannot order by an unindexed or relational column. */
export const BOOKING_SORT_FIELDS = ['createdAt', 'scheduledAt', 'amount', 'status', 'code'] as const;
export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export class QueryBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches booking code, customer name, or vehicle registration.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: BookingStatus,
    isArray: true,
    description: 'Repeat the param or pass a comma-separated list, e.g. status=PENDING,ASSIGNED.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return value;
  })
  @IsEnum(BookingStatus, { each: true })
  status?: BookingStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mechanicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on booking creation date (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on booking creation date (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: BOOKING_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(BOOKING_SORT_FIELDS)
  sort: BookingSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
