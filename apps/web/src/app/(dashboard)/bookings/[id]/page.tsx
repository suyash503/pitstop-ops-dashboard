'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Car,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { MechanicStatusBadge, StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/format';
import { ALLOWED_TRANSITIONS, BOOKING_STATUS_META } from '@/lib/status';
import type { BookingStatus } from '@/lib/types';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.booking(id),
  });

  const mutation = useMutation({
    mutationFn: (status: BookingStatus) => api.updateBookingStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(`Moved to ${BOOKING_STATUS_META[status].label}`);
      // The write already broadcasts over WebSocket, but the initiating client
      // should not have to wait for its own echo to see the change.
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not update this booking');
    },
  });

  if (isError) {
    return (
      <ErrorState
        title="Could not load this booking"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const nextStatuses = ALLOWED_TRANSITIONS[data.status];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7"
            onClick={() => router.push('/bookings')}
          >
            <ArrowLeft className="size-3.5" />
            All bookings
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{data.code}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            Created {formatDateTime(data.createdAt)} · {data.city}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {nextStatuses.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              This booking is closed — no further transitions.
            </p>
          ) : isAdmin ? (
            nextStatuses.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === 'CANCELLED' ? 'outline' : 'default'}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(status)}
              >
                {mutation.isPending && mutation.variables === status ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Move to {BOOKING_STATUS_META[status].label}
              </Button>
            ))
          ) : (
            // Hiding the control entirely would leave an OPS user wondering
            // where it went; disabling it with a reason is kinder and honest.
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled>
                    <Lock className="size-3.5" />
                    Advance status
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Only an ADMIN can change booking status. You are signed in as OPS.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Job details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Service" value={data.service.name} sub={data.service.category} />
              <Field
                label="Amount"
                value={formatCurrency(data.amount)}
                sub={`Base ${formatCurrency(data.service.basePrice)} · ~${data.service.durationMins} min`}
              />
              <Field label="Scheduled" value={formatDateTime(data.scheduledAt)} />
              <Field
                label="Completed"
                value={data.completedAt ? formatDateTime(data.completedAt) : '—'}
              />
              {data.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="mt-1 text-sm">{data.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Status timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {/* The audit trail, straight from the database — this is what makes
                  the live feed trustworthy rather than decorative. */}
              <ol className="space-y-0">
                {data.events.map((event, i) => (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${BOOKING_STATUS_META[event.toStatus].dot}`}
                      />
                      {i < data.events.length - 1 ? (
                        <span className="bg-border w-px flex-1" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={event.toStatus} />
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {event.note ? `${event.note} · ` : ''}
                        {formatDateTime(event.createdAt)}
                        {event.actor === 'system' ? (
                          <span className="ml-1 inline-flex items-center gap-1">
                            <Bot className="size-3" /> system
                          </span>
                        ) : (
                          <span className="ml-1">by {event.actor}</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <User className="size-3.5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{data.customer.name}</p>
              <div className="text-muted-foreground space-y-1.5 text-xs">
                <p className="flex items-center gap-2">
                  <Mail className="size-3" /> {data.customer.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="size-3" /> {data.customer.phone}
                </p>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Car className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {data.vehicle.make} {data.vehicle.model}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">{data.vehicle.regNo}</p>
                  <p className="text-muted-foreground text-xs">
                    {data.vehicle.year} · {data.vehicle.fuelType}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Wrench className="size-3.5" />
                Mechanic
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.mechanic ? (
                <Link
                  href={`/mechanics?search=${encodeURIComponent(data.mechanic.name)}`}
                  className="hover:bg-muted -m-2 flex items-center gap-3 rounded-md p-2 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{data.mechanic.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {data.mechanic.specialization}
                    </p>
                    <MechanicStatusBadge status={data.mechanic.status} />
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not assigned yet. A mechanic is allocated when the booking moves to Assigned.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
    </div>
  );
}
