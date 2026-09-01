'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import { SocketProvider } from '@/lib/socket-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // WebSocket events drive freshness, so aggressive refetching would
            // be redundant. The 30s interval is the safety net for a dropped
            // socket: the board keeps updating, just less immediately.
            staleTime: 15_000,
            refetchInterval: 30_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Retrying an auth or validation failure just repeats it.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <SocketProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </TooltipProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
