'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  IndianRupee,
  UserPlus,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  BookingsTrendChart,
  ChartSkeleton,
  RevenueTrendChart,
  ServiceBreakdownChart,
  StatusBreakdownChart,
} from '@/components/dashboard/charts';
import { ActivityFeed, ActivityFeedSkeleton } from '@/components/dashboard/activity-feed';
import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/kpi-card';
import { ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { formatCurrencyCompact, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export default function OverviewPage() {
  const [range, setRange] = useState('30d');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => api.dashboard(range),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Operations overview</h1>
          <p className="text-muted-foreground text-sm">
            Live view of bookings, mechanics and revenue.
          </p>
        </div>

        <div className="bg-muted inline-flex rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === r.key
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <ErrorState
          title="Could not load the dashboard"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isPending
              ? Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)
              : (
                  <>
                    <KpiCard
                      label="Total bookings"
                      value={formatNumber(data.kpis.totalBookings.value)}
                      kpi={data.kpis.totalBookings}
                      icon={ClipboardList}
                      accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    />
                    <KpiCard
                      label="Today's bookings"
                      value={formatNumber(data.kpis.todayBookings.value)}
                      kpi={data.kpis.todayBookings}
                      icon={CalendarDays}
                      hint="Bookings created today (Asia/Kolkata), regardless of the selected range."
                      accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    />
                    <KpiCard
                      label="Completed"
                      value={formatNumber(data.kpis.completedBookings.value)}
                      kpi={data.kpis.completedBookings}
                      icon={CheckCircle2}
                      accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    />
                    <KpiCard
                      label="Open jobs"
                      value={formatNumber(data.kpis.pendingBookings.value)}
                      kpi={data.kpis.pendingBookings}
                      icon={Clock}
                      hint="Everything not yet finished: pending, assigned, on the way and in progress."
                      goodDirection="neutral"
                      accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    />
                    <KpiCard
                      label="Cancelled"
                      value={formatNumber(data.kpis.cancelledBookings.value)}
                      kpi={data.kpis.cancelledBookings}
                      icon={XCircle}
                      goodDirection="down"
                      accent="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    />
                    <KpiCard
                      label="Total revenue"
                      value={formatCurrencyCompact(data.kpis.totalRevenue.value)}
                      kpi={data.kpis.totalRevenue}
                      icon={IndianRupee}
                      hint="Completed bookings only — work in progress is not counted as earned."
                      accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    />
                    <KpiCard
                      label="Active mechanics"
                      value={formatNumber(data.kpis.activeMechanics.value)}
                      kpi={data.kpis.activeMechanics}
                      icon={Wrench}
                      hint="On shift right now: available or on a job. Excludes off-duty."
                      accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    />
                    <KpiCard
                      label="New customers"
                      value={formatNumber(data.kpis.newCustomers.value)}
                      kpi={data.kpis.newCustomers}
                      icon={UserPlus}
                      accent="bg-pink-500/10 text-pink-600 dark:text-pink-400"
                    />
                  </>
                )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {isPending ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : (
              <>
                <BookingsTrendChart data={data.timeseries} />
                <RevenueTrendChart data={data.timeseries} />
              </>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {isPending ? (
              <>
                <ChartSkeleton height={200} />
                <ChartSkeleton height={200} />
                <ActivityFeedSkeleton />
              </>
            ) : (
              <>
                <StatusBreakdownChart data={data.statusBreakdown} />
                <ServiceBreakdownChart data={data.serviceBreakdown} />
                <ActivityFeed items={data.recentActivity} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
