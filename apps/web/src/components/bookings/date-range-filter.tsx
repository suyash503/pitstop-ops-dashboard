'use client';

import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/format';

/** Days back from today, or null for "everything". */
const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

/** ISO calendar date (YYYY-MM-DD) in local time — the API treats it as a day. */
function toIsoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return Number.isFinite(y) ? new Date(y, (m ?? 1) - 1, d ?? 1) : undefined;
}

/**
 * Presets plus a calendar, rather than one or the other.
 *
 * An operations team almost always wants "today" or "this week", which should be
 * one click — but month-end reporting needs an arbitrary range, and a preset-only
 * control cannot express it.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected: DateRange | undefined = from
    ? { from: parseIsoDate(from), to: parseIsoDate(to) }
    : undefined;

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ from: toIsoDate(start), to: toIsoDate(end) });
    setOpen(false);
  }

  const label = from
    ? to && to !== from
      ? `${formatDate(from)} — ${formatDate(to)}`
      : formatDate(from)
    : 'Any date';

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 font-normal">
            <CalendarDays className="size-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col gap-1 p-2 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Separator orientation="vertical" className="hidden h-auto sm:block" />
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={selected?.from}
              selected={selected}
              // Bookings cannot be created in the future, so offering future
              // dates would only ever return an empty table.
              disabled={{ after: new Date() }}
              onSelect={(range: DateRange | undefined) => {
                if (!range?.from) {
                  onChange({ from: undefined, to: undefined });
                  return;
                }
                onChange({
                  from: toIsoDate(range.from),
                  to: range.to ? toIsoDate(range.to) : toIsoDate(range.from),
                });
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {from ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Clear date filter"
          onClick={() => onChange({ from: undefined, to: undefined })}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
