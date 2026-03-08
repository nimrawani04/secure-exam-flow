import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeacherCalendar, type TeacherSessionStatus } from '@/hooks/useTeacherCalendar';
import { useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const EXAM_TYPE_LABELS: Record<string, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
  cia_1: 'CIA 1',
  cia_2: 'CIA 2',
  practical_external: 'Practical External',
};

const STATUS_CONFIG: Record<TeacherSessionStatus, {
  color: string;
  dotClass: string;
  icon: typeof Clock;
  label: string;
  emoji: string;
}> = {
  pending: {
    color: 'bg-destructive/15 text-destructive border-destructive/20',
    dotClass: 'bg-destructive',
    icon: Clock,
    label: 'Pending',
    emoji: '🔴',
  },
  submitted: {
    color: 'bg-success/15 text-success border-success/20',
    dotClass: 'bg-success',
    icon: CheckCircle2,
    label: 'Submitted',
    emoji: '🟢',
  },
};

export default function TeacherCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { events, isLoading } = useTeacherCalendar();

  // Group events by date for calendar dots
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const ev of events) {
      // Show on both deadline and exam date
      for (const d of [ev.submissionDeadline, ev.examDate]) {
        const key = format(d, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [events]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(
      (ev) =>
        isSameDay(ev.submissionDeadline, selectedDate) ||
        isSameDay(ev.examDate, selectedDate)
    );
  }, [events, selectedDate]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<TeacherSessionStatus, number> = {
      pending: 0,
      submitted: 0,
      awaiting_review: 0,
      locked: 0,
    };
    for (const ev of events) counts[ev.status]++;
    return counts;
  }, [events]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exam Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Track your exam dates, submission deadlines, and paper status
          </p>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [TeacherSessionStatus, typeof STATUS_CONFIG[TeacherSessionStatus]][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dotClass)} />
                  <Icon className="h-3 w-3 opacity-70" />
                  <span className="text-muted-foreground">
                    {cfg.label} ({statusCounts[key]})
                  </span>
                </div>
              );
            }
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          {/* Calendar */}
          <Card className="w-fit">
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="pointer-events-auto"
                modifiers={{
                  hasEvent: (date) => eventsByDate.has(format(date, 'yyyy-MM-dd')),
                }}
                modifiersClassNames={{
                  hasEvent: 'font-bold',
                }}
                components={{
                  DayContent: ({ date }) => {
                    const key = format(date, 'yyyy-MM-dd');
                    const dayEvents = eventsByDate.get(key);
                    return (
                      <div className="relative flex flex-col items-center">
                        <span>{date.getDate()}</span>
                        {dayEvents && dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  STATUS_CONFIG[ev.status].dotClass
                                )}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No exams or deadlines on this date.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    const isDeadlineDay = isSameDay(ev.submissionDeadline, selectedDate!);
                    const isExamDay = isSameDay(ev.examDate, selectedDate!);

                    return (
                      <div
                        key={`${ev.id}-${isDeadlineDay ? 'dl' : 'ex'}`}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3',
                          cfg.color
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{ev.subjectName}</p>
                          <p className="text-xs opacity-80">
                            {ev.subjectCode} · {EXAM_TYPE_LABELS[ev.examType] || ev.examType} · Sem {ev.semester}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {isDeadlineDay && (
                              <Badge variant="outline" className="text-[10px]">
                                📅 Submission Deadline
                              </Badge>
                            )}
                            {isExamDay && (
                              <Badge variant="outline" className="text-[10px]">
                                📝 Exam Day
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {cfg.emoji} {cfg.label}
                            </Badge>
                          </div>
                          {ev.status === 'pending' && (
                            <Link to="/upload" className="inline-block mt-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <Upload className="h-3 w-3" />
                                Upload Paper
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All upcoming events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active exam sessions found for your courses.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {events
                  .sort((a, b) => a.submissionDeadline.getTime() - b.submissionDeadline.getTime())
                  .map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedDate(ev.submissionDeadline)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors hover:ring-2 hover:ring-ring/30',
                          cfg.color
                        )}
                      >
                        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dotClass)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {ev.subjectCode} – {EXAM_TYPE_LABELS[ev.examType] || ev.examType}
                          </p>
                          <p className="text-[10px] opacity-70">
                            Deadline: {format(ev.submissionDeadline, 'd MMM')} · Exam: {format(ev.examDate, 'd MMM')}
                          </p>
                        </div>
                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      </button>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
