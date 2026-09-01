'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/**
 * Both icons are always rendered and CSS picks one, keyed off the `dark` class
 * next-themes puts on <html> before hydration.
 *
 * The usual alternative — a `mounted` flag set in an effect — exists to dodge a
 * hydration mismatch, but it costs an extra render on every page load and leaves
 * the control visibly empty until React hydrates. Letting CSS decide needs
 * neither.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
