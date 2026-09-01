'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookingsFilters, type BookingFilters } from '@/components/bookings/bookings-filters';
import { EmptyState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/lib/types';

const SORTABLE = [
  { key: 'code', label: 'Booking' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
] as const;

const PAGE_SIZE = 20;

function BookingsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [exporting, setExporting] = useState(false);

  // Filter state lives in the URL, so a filtered view is a shareable link and
  // survives a refresh or a back button press.
  const filters: BookingFilters = useMemo(
    () => ({
      search: params.get('search') ?? '',
      status: (params.get('status')?.split(',').filter(Boolean) ?? []) as BookingStatus[],
      serviceId: params.get('serviceId') ?? '',
      mechanicId: params.get('mechanicId') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
    }),
    [params],
  );

  const page = Number(params.get('page') ?? '1');
  const sort = params.get('sort') ?? 'createdAt';
  const order = (params.get('order') ?? 'desc') as 'asc' | 'desc';

  const setParams = useCallback(
    (patch: Record<string, string | string[] | number | undefined>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        const serialised = Array.isArray(value) ? value.join(',') : value?.toString();
        if (!serialised) next.delete(key);
        else next.set(key, serialised);
      }
      // Any filter change invalidates the current page number — page 7 of the
      // old result set is meaningless against the new one.
      if (resetPage) next.delete('page');
      router.replace(`/bookings?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const query = useQuery({
    queryKey: ['bookings', { ...filters, page, sort, order }],
    queryFn: () =>
      api.bookings({
        search: filters.search || undefined,
        status: filters.status.length ? filters.status : undefined,
        serviceId: filters.serviceId || undefined,
        mechanicId: filters.mechanicId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort,
        order,
      }),
    // Keeps the previous page visible while the next one loads, so paging does
    // not flash the table through an empty state.
    placeholderData: keepPreviousData,
  });

  function toggleSort(key: string) {
    if (sort === key) {
      setParams({ order: order === 'asc' ? 'desc' : 'asc' }, false);
    } else {
      setParams({ sort: key, order: 'desc' }, false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportBookingsCsv({
        search: filters.search || undefined,
        status: filters.status.length ? filters.status : undefined,
        serviceId: filters.serviceId || undefined,
        mechanicId: filters.mechanicId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        sort,
        order,
      });
      toast.success('Export downloaded');
    } catch {
      toast.error('Could not export bookings');
    } finally {
      setExporting(false);
    }
  }

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters =
    Boolean(filters.search) ||
    filters.status.length > 0 ||
    Boolean(filters.serviceId) ||
    Boolean(filters.mechanicId) ||
    Boolean(filters.from);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground text-sm">
          Every job on the board. Filters are reflected in the URL.
        </p>
      </div>

      <BookingsFilters
        filters={filters}
        onChange={(patch) => setParams(patch as Record<string, string | string[]>)}
        onReset={() => router.replace('/bookings', { scroll: false })}
        onExport={handleExport}
        exporting={exporting}
        total={meta?.total ?? 0}
      />

      {query.isError ? (
        <ErrorState
          title="Could not load bookings"
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {SORTABLE.slice(0, 1).map((col) => (
                    <SortHeader
                      key={col.key}
                      label={col.label}
                      active={sort === col.key}
                      order={order}
                      onClick={() => toggleSort(col.key)}
                    />
                  ))}
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden lg:table-cell">Service</TableHead>
                  <TableHead className="hidden lg:table-cell">Mechanic</TableHead>
                  <SortHeader
                    label="Status"
                    active={sort === 'status'}
                    order={order}
                    onClick={() => toggleSort('status')}
                  />
                  <SortHeader
                    label="Amount"
                    align="right"
                    active={sort === 'amount'}
                    order={order}
                    onClick={() => toggleSort('amount')}
                  />
                  <SortHeader
                    label="Created"
                    align="right"
                    className="hidden sm:table-cell"
                    active={sort === 'createdAt'}
                    order={order}
                    onClick={() => toggleSort('createdAt')}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        className="border-0"
                        filtered={hasFilters}
                        title={hasFilters ? 'No bookings match these filters' : 'No bookings yet'}
                        message={
                          hasFilters
                            ? 'Try widening the date range or clearing a filter.'
                            : 'New bookings will appear here as they come in.'
                        }
                        action={
                          hasFilters ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.replace('/bookings', { scroll: false })}
                            >
                              Clear filters
                            </Button>
                          ) : null
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((booking) => (
                    <TableRow
                      key={booking.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/bookings/${booking.id}`)}
                    >
                      <TableCell>
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="font-mono text-xs font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {booking.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{booking.customer.name}</p>
                          <p className="text-muted-foreground truncate text-xs">{booking.city}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {booking.vehicle.make} {booking.vehicle.model}
                          </p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {booking.vehicle.regNo}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="truncate text-sm">{booking.service.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {booking.service.category}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {booking.mechanic ? (
                          <span className="text-sm">{booking.mechanic.name}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={booking.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatCurrency(booking.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-right text-xs whitespace-nowrap sm:table-cell">
                        {formatDateTime(booking.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {meta && meta.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                Showing{' '}
                <span className="font-medium">
                  {(meta.page - 1) * meta.pageSize + 1}–
                  {Math.min(meta.page * meta.pageSize, meta.total)}
                </span>{' '}
                of <span className="font-medium">{meta.total.toLocaleString('en-IN')}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setParams({ page: meta.page - 1 }, false)}
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <span className="text-xs tabular-nums">
                  {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setParams({ page: meta.page + 1 }, false)}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  order,
  onClick,
  align = 'left',
  className,
}: {
  label: string;
  active: boolean;
  order: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === 'right' && 'text-right', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 transition-colors',
          active && 'text-foreground font-medium',
        )}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}

export default function BookingsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BookingsPageInner />
    </Suspense>
  );
}
