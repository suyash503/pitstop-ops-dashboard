'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatChartDate, formatCurrency, formatCurrencyCompact, formatNumber } from '@/lib/format';
import { BOOKING_STATUS_META, STATUS_CHART_COLORS } from '@/lib/status';
import type { BookingStatus, DashboardResponse } from '@/lib/types';

/** Category colours, distinct in both themes and ordered for stable mapping. */
const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

const AXIS = {
  stroke: 'currentColor',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  className: 'text-muted-foreground',
} as const;

export function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-0">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-4 pt-3">{children}</CardContent>
    </Card>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="p-4 pb-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1.5 h-3 w-44" />
      </CardHeader>
      <CardContent className="p-4 pt-3">
        <Skeleton style={{ height }} className="w-full" />
      </CardContent>
    </Card>
  );
}

/** Shared tooltip so all four charts read identically. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[];
  label?: string;
  formatter: (value: number) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      {label !== undefined ? (
        <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(label) : label}</p>
      ) : null}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium tabular-nums">{formatter(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export function BookingsTrendChart({ data }: { data: DashboardResponse['timeseries'] }) {
  return (
    <ChartCard title="Bookings over time" description="Daily booking volume (IST)">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            minTickGap={28}
            {...AXIS}
          />
          <YAxis allowDecimals={false} width={44} {...AXIS} />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => formatNumber(v)} labelFormatter={formatChartDate} />
            }
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
          />
          <Area
            type="monotone"
            dataKey="bookings"
            name="Bookings"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#bookingsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RevenueTrendChart({ data }: { data: DashboardResponse['timeseries'] }) {
  return (
    <ChartCard title="Revenue over time" description="From completed bookings only">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -6 }}>
          <XAxis dataKey="date" tickFormatter={formatChartDate} minTickGap={28} {...AXIS} />
          <YAxis tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={58} {...AXIS} />
          <Tooltip
            content={<ChartTooltip formatter={formatCurrency} labelFormatter={formatChartDate} />}
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
          />
          <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StatusBreakdownChart({ data }: { data: DashboardResponse['statusBreakdown'] }) {
  const visible = data.filter((d) => d.count > 0);
  const total = visible.reduce((sum, d) => sum + d.count, 0);

  return (
    <ChartCard title="Booking status" description="Distribution across the selected range">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ResponsiveContainer width="100%" height={200} className="max-w-[200px]">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="status"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_CHART_COLORS[entry.status as BookingStatus]}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v) =>
                    `${formatNumber(v)} (${total ? Math.round((v / total) * 100) : 0}%)`
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* A legend beside the donut, not inside it: exact counts are what an
            operator actually reads off this chart. */}
        <ul className="w-full flex-1 space-y-1.5">
          {visible.map((entry) => (
            <li key={entry.status} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_CHART_COLORS[entry.status as BookingStatus] }}
                aria-hidden
              />
              <span className="text-muted-foreground flex-1 truncate">
                {BOOKING_STATUS_META[entry.status as BookingStatus].label}
              </span>
              <span className="font-medium tabular-nums">{formatNumber(entry.count)}</span>
              <span className="text-muted-foreground w-9 text-right tabular-nums">
                {total ? Math.round((entry.count / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

export function ServiceBreakdownChart({ data }: { data: DashboardResponse['serviceBreakdown'] }) {
  return (
    <ChartCard title="Service categories" description="Bookings by category">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="category"
            width={132}
            tick={{ fontSize: 11 }}
            {...AXIS}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => `${formatNumber(v)} bookings`} />}
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
          />
          <Bar dataKey="count" name="Bookings" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
