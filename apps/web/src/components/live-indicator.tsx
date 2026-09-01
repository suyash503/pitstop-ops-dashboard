'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket-context';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const META = {
  connecting: { label: 'Connecting', dot: 'bg-amber-500', pulse: true },
  live: { label: 'Live', dot: 'bg-emerald-500', pulse: true },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber-500', pulse: true },
  offline: { label: 'Offline', dot: 'bg-slate-400', pulse: false },
} as const;

/**
 * Says out loud whether the numbers on screen are actually live.
 *
 * A dashboard that silently stops updating is worse than one that admits it, so
 * the degraded states are named rather than hidden — and the tooltip explains
 * that polling continues to cover a dropped socket.
 */
export function LiveIndicator() {
  const { connection, lastEventAt } = useSocket();
  const meta = META[connection];
  const [, forceTick] = useState(0);

  // Re-render every 10s so "updated 40s ago" stays honest between events.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = lastEventAt ? Math.round((Date.now() - lastEventAt) / 1000) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium">
          <span className="relative flex size-2">
            {meta.pulse ? (
              <span
                className={cn(
                  'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                  meta.dot,
                )}
              />
            ) : null}
            <span className={cn('relative inline-flex size-2 rounded-full', meta.dot)} />
          </span>
          <span className="hidden sm:inline">{meta.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {connection === 'live' ? (
          <p>
            Connected over WebSocket.
            {secondsAgo === null
              ? ' Waiting for the first event.'
              : ` Last update ${secondsAgo}s ago.`}
          </p>
        ) : connection === 'offline' ? (
          <p>Live connection unavailable — falling back to polling every 30s.</p>
        ) : (
          <p>Reconnecting. Data is still refreshing by polling.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
