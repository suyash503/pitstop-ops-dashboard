'use client';

import { Bot, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { formatRelativeTime } from '@/lib/format';
import type { ActivityItem } from '@/lib/types';

/**
 * The live feed reads from the BookingEvent audit trail rather than from
 * WebSocket messages held in memory, so the history survives a refresh and
 * always matches what the database actually recorded.
 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [, tick] = useState(0);

  // Relative timestamps go stale on their own; nudge a re-render every 15s.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm font-medium">Live activity</CardTitle>
        <CardDescription className="text-xs">Every status change, newest first</CardDescription>
      </CardHeader>
      {/* Capped and internally scrollable: the feed holds a dozen entries while
          the charts beside it are short, and letting it set the row height left
          a large dead gap under them. */}
      <CardContent className="max-h-[300px] overflow-y-auto p-0">
        {items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            message="Status changes will appear here as they happen."
            className="m-4 border-0"
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="hover:bg-muted/40 transition-colors">
                <Link href={`/bookings/${item.bookingId}`} className="flex gap-3 px-4 py-3">
                  <div className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                    {item.actor === 'system' ? (
                      <Bot className="text-muted-foreground size-3.5" />
                    ) : (
                      <User className="text-muted-foreground size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-medium">{item.code}</span>
                      <StatusBadge status={item.to} />
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.customerName} — {item.serviceName}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="p-4 pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-3 w-40" />
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
