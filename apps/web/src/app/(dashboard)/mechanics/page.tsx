'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { MechanicStatusBadge, StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { MECHANIC_STATUS_META } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { MechanicStatus } from '@/lib/types';

const STATUS_TABS: { key: MechanicStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'ON_JOB', label: 'On job' },
  { key: 'OFF_DUTY', label: 'Off duty' },
];

function MechanicsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get('search') ?? '';
  const status = (params.get('status') ?? 'ALL') as MechanicStatus | 'ALL';

  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);

  useEffect(() => {
    if (draft === search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (draft) next.set('search', draft);
      else next.delete('search');
      router.replace(`/mechanics?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [draft, search, params, router]);

  const query = useQuery({
    queryKey: ['mechanics', { search, status }],
    queryFn: () =>
      api.mechanics({
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        pageSize: 100,
      }),
    placeholderData: keepPreviousData,
  });

  function setStatus(next: MechanicStatus | 'ALL') {
    const params2 = new URLSearchParams(params.toString());
    if (next === 'ALL') params2.delete('status');
    else params2.set('status', next);
    router.replace(`/mechanics?${params2.toString()}`, { scroll: false });
  }

  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mechanics</h1>
        <p className="text-muted-foreground text-sm">
          Who is on shift, what they are working on, and how much they have closed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Name or specialization…"
            className="pl-8"
            aria-label="Search mechanics"
          />
        </div>
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              aria-pressed={status === tab.key}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                status === tab.key
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          title="Could not load mechanics"
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          filtered
          title="No mechanics match"
          message="Try a different name or clear the status filter."
          action={
            <Button size="sm" variant="outline" onClick={() => router.replace('/mechanics')}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((mechanic) => {
            const job = mechanic.currentBooking ?? mechanic.lastBooking;
            return (
              <Card key={mechanic.id} className="gap-0 py-0">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{mechanic.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {mechanic.specialization} · {mechanic.city}
                      </p>
                    </div>
                    <MechanicStatusBadge status={mechanic.status} />
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <Star
                        className={cn(
                          'size-3',
                          MECHANIC_STATUS_META[mechanic.status].dot.replace('bg-', 'text-'),
                        )}
                      />
                      <span className="font-medium tabular-nums">{mechanic.rating.toFixed(1)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium tabular-nums">
                        {formatNumber(mechanic.jobsCompleted)}
                      </span>{' '}
                      jobs completed
                    </span>
                  </div>

                  <div className="bg-muted/50 rounded-md p-2.5">
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                      {mechanic.currentBooking ? 'Current job' : 'Last job'}
                    </p>
                    {job ? (
                      <Link href={`/bookings/${job.id}`} className="group block space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium group-hover:underline">
                            {job.code}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {job.customer.name} — {job.service.name}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-muted-foreground text-xs">No jobs on record yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MechanicsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MechanicsPageInner />
    </Suspense>
  );
}
