import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Kpi } from '@/lib/types';

/**
 * A KPI is only useful next to a baseline, so every card that has a comparable
 * previous window shows the change against it. Cards without one (a point-in-time
 * count like active mechanics) show nothing rather than a fake zero.
 *
 * `goodDirection` exists because down is not universally bad: fewer cancellations
 * is an improvement, and colouring that red would be actively misleading.
 */
export function KpiCard({
  label,
  value,
  kpi,
  icon: Icon,
  hint,
  goodDirection = 'up',
  accent,
}: {
  label: string;
  value: string;
  kpi?: Kpi;
  icon: LucideIcon;
  hint?: string;
  goodDirection?: 'up' | 'down' | 'neutral';
  accent?: string;
}) {
  const delta = kpi?.delta ?? null;
  const deltaLabel = formatDelta(delta);

  const tone =
    delta === null || delta === 0 || goodDirection === 'neutral'
      ? 'text-muted-foreground'
      : (delta > 0) === (goodDirection === 'up')
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  const card = (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
          <div className={cn('rounded-md p-1.5', accent ?? 'bg-muted')}>
            <Icon className="size-3.5" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {deltaLabel ? (
            <p className={cn('flex items-center gap-1 text-xs font-medium', tone)}>
              <DeltaIcon className="size-3" />
              {deltaLabel}
              <span className="text-muted-foreground font-normal">vs previous period</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">{hint ?? 'Current snapshot'}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!hint) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="size-6 rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}
