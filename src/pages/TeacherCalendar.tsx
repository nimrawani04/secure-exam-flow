import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTeacherCalendar, type TeacherSessionStatus } from '@/hooks/useTeacherCalendar';
import { useTeacherCustomEntries } from '@/hooks/useTeacherCustomEntries';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';

import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Upload, Pencil, Trash2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EXAM_TYPE_LABELS } from '@/types';


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

// Unified event type for both HOD sessions and custom entries
interface UnifiedEvent {
  id: string;
  title: string;
  subtitle: string;
  examType: string;
  examDate: Date | null;
  submissionDeadline: Date;
  status: TeacherSessionStatus;
  isCustom: boolean;
  isHODSession: boolean;
  paperId?: string;
}

export default function TeacherCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { events: hodEvents, isLoading: hodLoading, refetch: refetchHOD } = useTeacherCalendar();
  const {
    entries: customEntries,
    isLoading: customLoading,
    refetch: refetchCustom,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleStatus,
  } = useTeacherCustomEntries();
  const { subjects } = useTeacherSubjects();

  const isLoading = hodLoading || customLoading;

  // Real-time subscriptions
  useEffect(() => {
    const ch1 = supabase
      .channel('teacher-calendar-papers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_papers' }, () => refetchHOD())
      .subscribe();

    const ch2 = supabase
      .channel('teacher-calendar-custom')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_calendar_entries' }, () => refetchCustom())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [refetchHOD, refetchCustom]);

  // Merge HOD sessions + custom entries into unified list
  const allEvents = useMemo<UnifiedEvent[]>(() => {
    const fromHOD: UnifiedEvent[] = hodEvents.map((ev) => ({
      id: ev.id,
      title: ev.subjectName,
      subtitle: `${ev.subjectCode} · ${EXAM_TYPE_LABELS[ev.examType] || ev.examType} · Sem ${ev.semester}`,
      examType: ev.examType,
      examDate: ev.examDate,
      submissionDeadline: ev.submissionDeadline,
      status: ev.status,
      isCustom: false,
      isHODSession: true,
      paperId: ev.paperId,
    }));

    const fromCustom: UnifiedEvent[] = customEntries.map((e) => ({
      id: e.id,
      title: e.title,
      subtitle: [
        e.examType ? EXAM_TYPE_LABELS[e.examType] || e.examType : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Custom Entry',
      examType: e.examType || 'other',
      examDate: e.examDate,
      submissionDeadline: e.submissionDeadline,
      status: e.status,
      isCustom: true,
      isHODSession: false,
    }));

    return [...fromHOD, ...fromCustom];
  }, [hodEvents, customEntries]);

  // Group events by date for calendar dots
  const eventsByDate = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const ev of allEvents) {
      const dates = [ev.submissionDeadline];
      if (ev.examDate) dates.push(ev.examDate);
      for (const d of dates) {
        const key = format(d, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [allEvents]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(
      (ev) =>
        isSameDay(ev.submissionDeadline, selectedDate) ||
        (ev.examDate && isSameDay(ev.examDate, selectedDate))
    );
  }, [allEvents, selectedDate]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<TeacherSessionStatus, number> = { pending: 0, submitted: 0 };
    for (const ev of allEvents) counts[ev.status]++;
    return counts;
  }, [allEvents]);

  const handleDelete = async (id: string) => {
    const result = await deleteEntry(id);
    if (result.success) toast.success('Entry removed');
    else toast.error('Failed to remove entry');
  };

  const handleToggle = async (id: string, currentStatus: 'pending' | 'submitted') => {
    const result = await toggleStatus(id, currentStatus);
    if (result.success) toast.success(`Marked as ${currentStatus === 'pending' ? 'Submitted' : 'Pending'}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Add button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exam Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Track your exam dates, submission deadlines, and paper status
            </p>
          </div>
          <AddCalendarEntryDialog subjects={subjects} onSave={addEntry} />
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
                    const isExamDay = ev.examDate && isSameDay(ev.examDate, selectedDate!);

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
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{ev.title}</p>
                            {ev.isHODSession && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                HOD
                              </Badge>
                            )}
                            {ev.isCustom && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                Custom
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs opacity-80">{ev.subtitle}</p>
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

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {ev.isHODSession && ev.status === 'pending' && (
                              <Link to="/upload">
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                  <Upload className="h-3 w-3" />
                                  Upload Paper
                                </Button>
                              </Link>
                            )}
                            {ev.isCustom && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleToggle(ev.id, ev.status)}
                                >
                                  {ev.status === 'pending' ? (
                                    <><CheckCircle2 className="h-3 w-3" /> Mark Submitted</>
                                  ) : (
                                    <><Clock className="h-3 w-3" /> Mark Pending</>
                                  )}
                                </Button>
                                <AddCalendarEntryDialog
                                  subjects={subjects}
                                  onSave={addEntry}
                                  onUpdate={updateEntry}
                                  editEntry={{
                                    id: ev.id,
                                    title: ev.title,
                                    subjectId: customEntries.find((c) => c.id === ev.id)?.subjectId || null,
                                    examType: ev.examType,
                                    examDate: ev.examDate,
                                    submissionDeadline: ev.submissionDeadline,
                                    status: ev.status,
                                    notes: customEntries.find((c) => c.id === ev.id)?.notes || null,
                                  }}
                                  trigger={
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(ev.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
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
            <CardTitle className="text-lg">All Upcoming Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : allEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No entries yet. Add a custom entry or wait for your HOD to create exam sessions.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {allEvents
                  .sort((a, b) => a.submissionDeadline.getTime() - b.submissionDeadline.getTime())
                  .map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={`${ev.id}-${ev.isCustom ? 'c' : 'h'}`}
                        onClick={() => setSelectedDate(ev.submissionDeadline)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors hover:ring-2 hover:ring-ring/30',
                          cfg.color
                        )}
                      >
                        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dotClass)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {ev.title}
                            {ev.isCustom && <span className="ml-1 opacity-50">★</span>}
                          </p>
                          <p className="text-[10px] opacity-70">
                            Deadline: {format(ev.submissionDeadline, 'd MMM')}
                            {ev.examDate && ` · Exam: ${format(ev.examDate, 'd MMM')}`}
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
