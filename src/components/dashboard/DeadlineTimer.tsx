import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineTimerProps {
  deadline: Date;
  label?: string;
}

export function DeadlineTimer({ deadline, label = 'Deadline' }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  function getTimeLeft(deadline: Date) {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 12;
  const isWarning = timeLeft.days === 0 && timeLeft.hours < 24;

  if (timeLeft.expired) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold">Deadline Passed</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border p-5 transition-colors',
      isUrgent ? 'border-destructive/30 bg-destructive/5' :
      isWarning ? 'border-warning/30 bg-warning/5' :
      'border-accent/20 bg-accent/5'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className={cn(
          'h-4 w-4',
          isUrgent ? 'text-destructive' : isWarning ? 'text-warning' : 'text-accent'
        )} />
        <span className={cn(
          'font-medium text-sm',
          isUrgent ? 'text-destructive' : isWarning ? 'text-warning' : 'text-accent'
        )}>
          {label}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { value: timeLeft.days, label: 'Days' },
          { value: timeLeft.hours, label: 'Hours' },
          { value: timeLeft.minutes, label: 'Mins' },
          { value: timeLeft.seconds, label: 'Secs' },
        ].map((item) => (
          <div key={item.label} className="bg-background/60 rounded-md p-2">
            <div className={cn(
              'text-2xl font-semibold tabular-nums',
              isUrgent ? 'text-destructive' :
              isWarning ? 'text-warning' :
              item.label === 'Days' ? 'text-accent' : 'text-foreground'
            )}>
              {String(item.value).padStart(2, '0')}
            </div>
            <div className="text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
