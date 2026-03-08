import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHODPapers } from '@/hooks/useHODPapers';
import { useHODExamSessions } from '@/hooks/useHODExamSessions';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Lock, RefreshCw, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react';
import { EXAM_TYPE_LABELS } from '@/types';

type PaperStatusKey = 'not_selected' | 'needs_resubmission' | 'approved' | 'locked' | 'resubmitted_pending' | 'pending_review';

interface CalendarEvent {
  id: string;
  date: Date;
  deadlineDate: Date;
  subjectName: string;
  subjectCode: string;
  examType: string;
  status: PaperStatusKey;
  label: string;
}

const STATUS_CONFIG: Record<PaperStatusKey, { color: string; dotClass: string; icon: typeof Clock; label: string }> = {
  pending_review: {
    color: 'bg-warning/15 text-warning border-warning/20',
    dotClass: 'bg-warning',
    icon: Clock,
    label: 'Pending Review',
  },
  not_selected: {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    dotClass: 'bg-yellow-500',
    icon: AlertCircle,
    label: 'Not Yet Selected',
  },
  needs_resubmission: {
    color: 'bg-destructive/15 text-destructive border-destructive/20',
    dotClass: 'bg-destructive',
    icon: RefreshCw,
    label: 'Needs Resubmission',
  },
  approved: {
    color: 'bg-success/15 text-success border-success/20',
    dotClass: 'bg-success',
    icon: CheckCircle2,
    label: 'Approved',
  },
  locked: {
    color: 'bg-primary/15 text-primary border-primary/20',
    dotClass: 'bg-primary',
    icon: Lock,
    label: 'Locked (Finalized)',
  },
  resubmitted_pending: {
    color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    dotClass: 'bg-purple-500',
    icon: FileText,
    label: 'Resubmitted – Awaiting Review',
  },
};


function mapPaperStatus(status: string, isSelected: boolean): PaperStatusKey {
  if (status === 'locked') return 'locked';
  if (status === 'approved' && isSelected) return 'locked';
  if (status === 'approved') return 'approved';
  if (status === 'resubmission_requested') return 'needs_resubmission';
  if (status === 'rejected') return 'needs_resubmission';
  if (status === 'pending_review') return 'pending_review';
  return 'not_selected';
}

export default function HODCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { papers, isLoading: papersLoading } = useHODPapers();
  const { sessions, isLoading: sessionsLoading } = useHODExamSessions();

  const isLoading = papersLoading || sessionsLoading;

  // Build calendar events from papers (using deadline as the calendar date)
  const events = useMemo<CalendarEvent[]>(() => {
    // Group papers by subject+examType, pick the most relevant status
    const grouped: Record<string, CalendarEvent> = {};

    for (const paper of papers) {
      const key = `${paper.subjectId}-${paper.examType}`;
      const status = mapPaperStatus(paper.status, paper.isSelected);

      const existing = grouped[key];
      const priority: PaperStatusKey[] = ['locked', 'approved', 'resubmitted_pending', 'pending_review', 'needs_resubmission', 'not_selected'];

      if (!existing || priority.indexOf(status) < priority.indexOf(existing.status)) {
        grouped[key] = {
          id: paper.id,
          date: paper.deadline,
          deadlineDate: paper.deadline,
          subjectName: paper.subjectName,
          subjectCode: paper.subjectCode,
          examType: paper.examType,
          status,
          label: `${paper.subjectCode} – ${EXAM_TYPE_LABELS[paper.examType] || paper.examType}`,
        };
      }
    }

    // Also include sessions that may not have papers yet
    for (const session of sessions) {
      const key = `${session.subjectId}-${session.examType}`;
      if (!grouped[key]) {
        grouped[key] = {
          id: session.id,
          date: new Date(session.submissionDeadline),
          deadlineDate: new Date(session.submissionDeadline),
          subjectName: session.subjectName,
          subjectCode: session.subjectCode,
          examType: session.examType,
          status: 'not_selected',
          label: `${session.subjectCode} – ${EXAM_TYPE_LABELS[session.examType] || session.examType}`,
        };
      }
    }

    return Object.values(grouped);
  }, [papers, sessions]);

  // Dates that have events
  const eventDates = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = format(ev.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  // Events for the selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((ev) => isSameDay(ev.date, selectedDate));
  }, [events, selectedDate]);

  // Status summary counts
  const statusCounts = useMemo(() => {
    const counts: Record<PaperStatusKey, number> = {
      not_selected: 0,
      needs_resubmission: 0,
      approved: 0,
      locked: 0,
      resubmitted_pending: 0,
      pending_review: 0,
    };
    for (const ev of events) {
      counts[ev.status]++;
    }
    return counts;
  }, [events]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paper Status Calendar</h1>
          <p className="text-muted-foreground mt-1">Track exam paper submissions and statuses at a glance</p>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [PaperStatusKey, typeof STATUS_CONFIG[PaperStatusKey]][]).map(([key, cfg]) => {
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
          })}
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
                  hasEvent: (date) => eventDates.has(format(date, 'yyyy-MM-dd')),
                }}
                modifiersClassNames={{
                  hasEvent: 'font-bold',
                }}
                components={{
                  DayContent: ({ date }) => {
                    const key = format(date, 'yyyy-MM-dd');
                    const dayEvents = eventDates.get(key);
                    return (
                      <div className="relative flex flex-col items-center">
                        <span>{date.getDate()}</span>
                        {dayEvents && dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <span
                                key={i}
                                className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[ev.status].dotClass)}
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
                <p className="text-muted-foreground text-sm">No paper deadlines on this date.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3',
                          cfg.color
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{ev.subjectName}</p>
                          <p className="text-xs opacity-80">
                            {ev.subjectCode} · {EXAM_TYPE_LABELS[ev.examType] || ev.examType}
                          </p>
                          <Badge variant="outline" className="mt-1.5 text-[10px]">
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All upcoming events list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Paper Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-muted-foreground text-sm">No exam sessions or papers found.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {events
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedDate(ev.date)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors hover:ring-2 hover:ring-ring/30',
                          cfg.color
                        )}
                      >
                        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dotClass)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{ev.label}</p>
                          <p className="text-[10px] opacity-70">{format(ev.date, 'd MMM yyyy')}</p>
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
