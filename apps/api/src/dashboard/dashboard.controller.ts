import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Everything the overview screen needs, in one request',
    description: [
      'Returns KPIs, daily time series, status and service-category breakdowns, and recent activity.',
      '',
      'Metric semantics:',
      '- Range-scoped: total/completed/pending/cancelled bookings, revenue, new customers.',
      '- Point-in-time: today bookings (IST day) and active mechanics.',
      '- Revenue counts completed bookings only — pending work is not earned yet.',
      '- Deltas compare the selected window against the preceding window of equal length.',
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'Aggregated dashboard payload.' })
  get(@Query() query: DashboardQueryDto) {
    return this.dashboard.getDashboard(query);
  }
}
