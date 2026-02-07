import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface StrengthResult {
  level: StrengthLevel;
  score: number;
  label: string;
  requirements: { met: boolean; label: string }[];
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo((): StrengthResult => {
    const requirements = [
      { met: password.length >= 6, label: 'At least 6 characters' },
      { met: password.length >= 8, label: 'At least 8 characters' },
      { met: /[a-z]/.test(password), label: 'Lowercase letter' },
      { met: /[A-Z]/.test(password), label: 'Uppercase letter' },
      { met: /[0-9]/.test(password), label: 'Number' },
      { met: /[^a-zA-Z0-9]/.test(password), label: 'Special character' },
    ];

    const score = requirements.filter(r => r.met).length;

    let level: StrengthLevel = 'weak';
    let label = 'Weak';

    if (score >= 5) {
      level = 'strong';
      label = 'Strong';
    } else if (score >= 3) {
      level = 'medium';
      label = 'Medium';
    }

    return { level, score, label, requirements };
  }, [password]);

  if (!password) return null;

  const barColors = {
    weak: 'bg-destructive',
    medium: 'bg-warning',
    strong: 'bg-success',
  };

  const textColors = {
    weak: 'text-destructive',
    medium: 'text-warning',
    strong: 'text-success',
  };

  const barWidth = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Password strength</span>
        <span className={cn('text-xs font-medium', textColors[strength.level])}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            barColors[strength.level],
            barWidth[strength.level]
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {strength.requirements.slice(0, 4).map((req, index) => (
          <div
            key={index}
            className={cn(
              'text-xs flex items-center gap-1',
              req.met ? 'text-success' : 'text-muted-foreground'
            )}
          >
            <span className={cn('w-1 h-1 rounded-full', req.met ? 'bg-success' : 'bg-muted-foreground')} />
            {req.label}
          </div>
        ))}
      </div>
    </div>
  );
}
