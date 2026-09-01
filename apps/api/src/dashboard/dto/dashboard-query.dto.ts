import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const DASHBOARD_RANGES = ['7d', '30d', '90d'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const RANGE_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export class DashboardQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_RANGES,
    default: '30d',
    description: 'Window for range-scoped metrics. Trend deltas compare against the preceding window of equal length.',
  })
  @IsOptional()
  @IsIn(DASHBOARD_RANGES)
  range: DashboardRange = '30d';
}
