import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ThemeMode = 'light' | 'dark';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const userExplicit = localStorage.getItem('theme_user_explicit');
  if (userExplicit === 'dark') return 'dark';
  return 'light';
};

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('theme_user_explicit', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('theme_user_explicit', 'light');
    }
  }, [theme]);

  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? (
        <>
          <Sun className={compact ? 'w-4 h-4' : 'w-4 h-4 mr-2'} />
          {!compact && 'Light Mode'}
        </>
      ) : (
        <>
          <Moon className={compact ? 'w-4 h-4' : 'w-4 h-4 mr-2'} />
          {!compact && 'Dark Mode'}
        </>
      )}
    </Button>
  );
}
