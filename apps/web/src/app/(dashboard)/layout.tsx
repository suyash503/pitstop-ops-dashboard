'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';

/**
 * Client-side route guard.
 *
 * The token lives in localStorage, which Next.js middleware cannot read, so the
 * gate has to run in the browser. This is not a security boundary — the API
 * enforces that independently on every request — it only stops the dashboard
 * rendering an empty shell to someone who is not signed in.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
