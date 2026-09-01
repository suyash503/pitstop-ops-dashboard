import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { BookingsService } from './bookings.service';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List bookings',
    description: 'Search, filter, sort and paginate. All parameters are optional and combine.',
  })
  @ApiOkResponse({ description: 'A page of bookings plus pagination metadata.' })
  findAll(@Query() query: QueryBookingsDto) {
    return this.bookings.findAll(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export the current selection as CSV',
    description: 'Accepts the same filters as GET /bookings. Capped at 5000 rows.',
  })
  @ApiProduces('text/csv')
  async exportCsv(@Query() query: QueryBookingsDto, @Res({ passthrough: true }) res: Response) {
    const csv = await this.bookings.exportCsv(query);
    const filename = `pitstop-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one booking with its full status timeline' })
  @ApiNotFoundResponse({ description: 'No booking with that id.' })
  findOne(@Param('id') id: string) {
    return this.bookings.findOne(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Advance a booking to a new status',
    description:
      'ADMIN only. The transition must be legal for the current status; the change is recorded on the timeline and broadcast over WebSocket.',
  })
  @ApiBadRequestResponse({ description: 'Illegal transition for the current status.' })
  @ApiForbiddenResponse({ description: 'Caller is not an ADMIN.' })
  @ApiNotFoundResponse({ description: 'No booking with that id.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.transitionStatus(id, dto.status, user.email, dto.note);
  }
}
