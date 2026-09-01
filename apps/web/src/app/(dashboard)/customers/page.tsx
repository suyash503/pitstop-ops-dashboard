'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

const PAGE_SIZE = 20;

function CustomersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? '1');

  const [draft, setDraft] = useState(search);

  // Resync when the URL changes underneath us. Adjusting state during render is
  // React's documented answer; an effect renders once with the stale value first.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setDraft(search);
  }

  useEffect(() => {
    if (draft === search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams();
      if (draft) next.set('search', draft);
      router.replace(`/customers?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [draft, search, router]);

  const query = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => api.customers({ search: search || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function goToPage(next: number) {
    const p = new URLSearchParams(params.toString());
    p.set('page', String(next));
    router.replace(`/customers?${p.toString()}`, { scroll: false });
  }

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-sm">
          Everyone who has booked, with lifetime value from completed jobs.
        </p>
      </div>

      <div className="relative max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Name, email or phone…"
          className="pl-8"
          aria-label="Search customers"
        />
      </div>

      {query.isError ? (
        <ErrorState
          title="Could not load customers"
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Vehicles</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Lifetime value</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        className="border-0"
                        filtered={Boolean(search)}
                        title={search ? 'No customers match' : 'No customers yet'}
                        message={
                          search ? 'Try a different name, email or phone number.' : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{customer.name}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-muted-foreground truncate text-xs">{customer.email}</p>
                        <p className="text-muted-foreground text-xs">{customer.phone}</p>
                      </TableCell>
                      <TableCell className="text-sm">{customer.city}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {customer.vehicleCount}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatNumber(customer.bookingCount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatCurrency(customer.lifetimeValue)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-right text-xs whitespace-nowrap sm:table-cell">
                        {formatDate(customer.createdAt)}
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
                of <span className="font-medium">{formatNumber(meta.total)}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => goToPage(meta.page - 1)}
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
                  onClick={() => goToPage(meta.page + 1)}
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

export default function CustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CustomersPageInner />
    </Suspense>
  );
}
