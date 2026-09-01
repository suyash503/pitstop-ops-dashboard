'use client';

import { Car, LayoutDashboard, LogOut, Menu, Users, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LiveIndicator } from '@/components/live-indicator';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: Car },
  { href: '/mechanics', label: 'Mechanics', icon: Wrench },
  { href: '/customers', label: 'Customers', icon: Users },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <Wrench className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">PitStop Ops</p>
        <p className="text-muted-foreground text-[11px]">Live service dashboard</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        // Every route except the overview should also match its sub-pages.
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <span className="bg-muted flex size-7 items-center justify-center rounded-full text-xs font-semibold">
            {initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-xs font-medium">{user.name}</span>
            <span className="text-muted-foreground block text-[11px]">{user.role}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground text-xs">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-muted/30 min-h-screen">
      {/* Desktop sidebar. Below lg it collapses into the sheet below. */}
      <aside className="bg-background fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="p-3">
          <NavLinks />
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center border-b px-4">
                <Brand />
              </div>
              <div className="p-3">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex-1" />
          <LiveIndicator />
          <ThemeToggle />
          <UserMenu />
        </header>

        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
