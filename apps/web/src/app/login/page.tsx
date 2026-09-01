'use client';

import { Loader2, ShieldCheck, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const DEMO_ACCOUNTS = [
  {
    email: 'admin@pitstop.dev',
    role: 'Admin',
    description: 'Full access — can advance booking status',
  },
  { email: 'ops@pitstop.dev', role: 'Operations', description: 'Read-only view of the board' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [email, setEmail] = useState('admin@pitstop.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  async function submit(nextEmail = email, nextPassword = password) {
    setSubmitting(true);
    setError(null);
    try {
      await login(nextEmail, nextPassword);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reach the API. Is the backend running?',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <Wrench className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">PitStop Ops</h1>
            <p className="text-muted-foreground text-sm">
              Live operations dashboard for vehicle servicing
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>Use a demo account below, or enter credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Sign in
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Demo accounts</p>
              {/* One click to sign in: a reviewer should not have to copy
                  credentials out of a README to see the product. */}
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('password123');
                    void submit(account.email, 'password123');
                  }}
                  className="hover:bg-muted flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60"
                >
                  <ShieldCheck className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{account.role}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {account.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
