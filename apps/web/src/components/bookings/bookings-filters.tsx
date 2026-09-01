'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Download, Filter, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { BOOKING_STATUS_META, BOOKING_STATUSES } from '@/lib/status';
import type { BookingStatus } from '@/lib/types';

export type BookingFilters = {
  search: string;
  status: BookingStatus[];
  serviceId: string;
  mechanicId: string;
};

export function BookingsFilters({
  filters,
  onChange,
  onReset,
  onExport,
  exporting,
  total,
}: {
  filters: BookingFilters;
  onChange: (patch: Partial<BookingFilters>) => void;
  onReset: () => void;
  onExport: () => void;
  exporting: boolean;
  total: number;
}) {
  // Local mirror so typing stays responsive; the committed value is debounced
  // below so every keystroke does not become a request.
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const id = setTimeout(() => onChange({ search: searchDraft }), 300);
    return () => clearTimeout(id);
  }, [searchDraft, filters.search, onChange]);

  // Reference data for the dropdowns. It changes rarely, so cache it hard
  // rather than refetching it alongside the booking list.
  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.services(),
    staleTime: 30 * 60_000,
    refetchInterval: false,
  });

  const { data: mechanics } = useQuery({
    queryKey: ['mechanics', 'filter-options'],
    queryFn: () => api.mechanics({ pageSize: 100 }),
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.status.length ? 1 : 0) +
    (filters.serviceId ? 1 : 0) +
    (filters.mechanicId ? 1 : 0);

  function toggleStatus(status: BookingStatus) {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ status: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Booking, customer, vehicle…"
          className="pl-8"
          aria-label="Search bookings"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="size-3.5" />
            Status
            {filters.status.length ? (
              <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-[10px] font-semibold">
                {filters.status.length}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {BOOKING_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={filters.status.includes(status)}
              onCheckedChange={() => toggleStatus(status)}
              onSelect={(e) => e.preventDefault()}
            >
              {BOOKING_STATUS_META[status].label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={filters.serviceId || 'all'}
        onValueChange={(v) => onChange({ serviceId: v === 'all' ? '' : v })}
      >
        <SelectTrigger size="sm" className="h-9 w-[170px]">
          <SelectValue placeholder="Service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All services</SelectItem>
          {services?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.mechanicId || 'all'}
        onValueChange={(v) => onChange({ mechanicId: v === 'all' ? '' : v })}
      >
        <SelectTrigger size="sm" className="h-9 w-[170px]">
          <SelectValue placeholder="Mechanic" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All mechanics</SelectItem>
          {mechanics?.data.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={onReset}>
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onExport}
          disabled={exporting || total === 0}
        >
          {exporting ? <Check className="size-3.5" /> : <Download className="size-3.5" />}
          Export CSV
        </Button>
      </div>
    </div>
  );
}
