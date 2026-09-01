'use client';

import { AlertCircle, Inbox, RotateCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Loading, error and empty are three distinct answers to "why is there nothing
 * here?", and collapsing them into one blank panel is how a dashboard starts
 * feeling broken. Empty is further split: "no data at all" and "your filters
 * excluded everything" need different actions from the reader.
 */

export function ErrorState({
  title = 'Could not load this',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-2.5">
        <AlertCircle className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="size-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  filtered = false,
  className,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  filtered?: boolean;
  className?: string;
}) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
    >
      <div className="bg-muted rounded-full p-2.5">
        <Icon className="text-muted-foreground size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
