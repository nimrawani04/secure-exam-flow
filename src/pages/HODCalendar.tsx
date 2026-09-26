import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { Calendar } from '@/components/ui/calendar';
import { useHODPapers } from '@/hooks/useHODPapers';
import { useHODExamSessions } from '@/hooks/useHODExamSessions';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  Inbox,
} from 'lucide-react';
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

const STATUS_CONFIG: Record<
  PaperStatusKey,
  { dotClass: string; pill: string; tile: string; icon: typeof Clock; label: string }
> = {
  pending_review: {
    dotClass: 'bg-amber-500',
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
    tile: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    icon: Clock,
    label: 'Pending Review',
  },
  not_selected: {
    dotClass: 'bg-[#a0aec0] dark:bg-[#3d5166]',
    pill: 'border-[#e8e2da] bg-[#f7f4ef] text-[#64748b] dark:border-[#1c2d3d] dark:bg-[#131c27] dark:text-[#6b8299]',
    tile: 'bg-[#f0ece5] text-[#64748b] dark:bg-[#1c2d3d] dark:text-[#6b8299]',
    icon: AlertCircle,
    label: 'Not Yet Selected',
  },
  needs_resubmission: {
    dotClass: 'bg-rose-500',
    pill: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300',
    tile: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    icon: RefreshCw,
    label: 'Needs Resubmission',
  },
  approved: {
    dotClass: 'bg-emerald-500',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
    tile: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Approved',
  },
  locked: {
    dotClass: 'bg-[#0d7a6b] dark:bg-[#2dd4bf]',
    pill: 'border-teal-200 bg-[#eaf6f4] text-[#0d7a6b] dark:border-[#2dd4bf]/25 dark:bg-[#2dd4bf]/10 dark:text-[#2dd4bf]',
    tile: 'bg-[#eaf6f4] text-[#0d7a6b] dark:bg-[#2dd4bf]/15 dark:text-[#2dd4bf]',
    icon: Lock,
    label: 'Locked (Finalized)',
  },
  resubmitted_pending: {
    dotClass: 'bg-violet-500',
    pill: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300',
    tile: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
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

const PANEL = 'bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]';
const EYEBROW = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]';

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

    // Also include sessions that may not have papers yet — use exam date
    for (const session of sessions) {
      const key = `${session.subjectId}-${session.examType}`;
      if (!grouped[key]) {
        grouped[key] = {
          id: session.id,
          date: new Date(session.examDate),
          deadlineDate: new Date(session.submissionDeadline),
          subjectName: session.subjectName,
          subjectCode: session.subjectCode,
          examType: session.examType,
          status: 'not_selected',
          label: `${session.subjectCode} – ${EXAM_TYPE_LABELS[session.examType] || session.examType}`,
        };
      } else {
        // Update the date to exam date if session has one
        grouped[key].date = new Date(session.examDate);
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
      <HodPageShell
        eyebrow="HOD · Calendar"
        title={<>Paper <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Calendar</em></>}
        description="Deadlines and exam dates across your department."
      >
      <div className="space-y-5">

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={EYEBROW}>Legend</span>
          {(Object.entries(STATUS_CONFIG) as [PaperStatusKey, (typeof STATUS_CONFIG)[PaperStatusKey]][]).map(([key, cfg]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e2da] bg-white px-2.5 py-1 dark:border-[#1c2d3d] dark:bg-[#101820]"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#64748b] dark:text-[#6b8299]">
                {cfg.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                {statusCounts[key]}
              </span>
            </span>
          ))}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
          {/* Calendar */}
          <section className={cn(PANEL, 'w-fit overflow-hidden mx-auto lg:mx-0')}>
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <p className={EYEBROW}>Month view</p>
              <button
                type="button"
                onClick={() => setSelectedDate(new Date())}
                className="rounded-[8px] border border-[#e8e2da] bg-white px-2 py-1 font-mono text-[11px] text-[#64748b] transition-colors hover:bg-[#ede9e2] hover:text-[#18202e] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#6b8299] dark:hover:bg-[#131c27] dark:hover:text-[#e2eaf4]"
              >
                Today
              </button>
            </div>
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
              classNames={{
                caption_label: 'font-serif text-[15px] font-medium text-[#18202e] dark:text-[#e2eaf4]',
                nav_button:
                  'h-7 w-7 rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-0 text-[12px] text-[#64748b] dark:text-[#6b8299] opacity-100 hover:bg-[#ede9e2] dark:hover:bg-[#131c27] hover:text-[#18202e] dark:hover:text-[#e2eaf4]',
                head_cell:
                  'w-11 rounded-md font-mono text-[10px] font-normal uppercase text-[#a0aec0] dark:text-[#3d5166]',
                cell: 'h-11 w-11 p-0 text-center text-[13px] relative focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent',
                day: 'h-11 w-11 rounded-[10px] p-0 font-normal tabular-nums text-[#18202e] dark:text-[#e2eaf4] hover:bg-[#ede9e2] dark:hover:bg-[#131c27] aria-selected:opacity-100',
                day_selected:
                  '!bg-[#0d7a6b] !text-white hover:!bg-[#0b6a5e] hover:!text-white focus:!bg-[#0d7a6b] focus:!text-white dark:!bg-[#2dd4bf] dark:!text-[#0c1118] dark:hover:!bg-[#2dd4bf] dark:focus:!bg-[#2dd4bf]',
                day_today:
                  'font-semibold ring-1 ring-inset ring-[#0d7a6b]/60 dark:ring-[#2dd4bf]/60 rounded-[10px]',
                day_outside: 'text-[#a0aec0] dark:text-[#3d5166] opacity-50',
                day_disabled: 'text-[#a0aec0] dark:text-[#3d5166] opacity-40',
              }}
              components={{
                IconLeft: () => <ChevronLeft className="h-3.5 w-3.5" />,
                IconRight: () => <ChevronRight className="h-3.5 w-3.5" />,
                DayContent: ({ date }: { date: Date }) => {
                  const key = format(date, 'yyyy-MM-dd');
                  const dayEvents = eventDates.get(key);
                  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                  return (
                    <span className="flex flex-col items-center justify-center leading-none">
                      <span className="text-[13px] tabular-nums">{date.getDate()}</span>
                      {dayEvents && dayEvents.length > 0 && (
                        <span className="mt-1 flex items-center gap-[3px]">
                          {dayEvents.slice(0, 3).map((ev, i) => (
                            <span
                              key={i}
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                isSelected ? 'bg-white/85 dark:bg-[#0c1118]/70' : STATUS_CONFIG[ev.status].dotClass
                              )}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                isSelected ? 'bg-white/60 dark:bg-[#0c1118]/50' : 'bg-[#a0aec0] dark:bg-[#3d5166]'
                              )}
                            />
                          )}
                        </span>
                      )}
                    </span>
                  );
                },
              }}
            />
            <div className="border-t border-[#e8e2da] px-4 py-2.5 dark:border-[#1c2d3d]">
              <p className="font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                {events.length} deadline{events.length === 1 ? '' : 's'} tracked · {eventDates.size} active day{eventDates.size === 1 ? '' : 's'}
              </p>
            </div>
          </section>

          {/* Selected day agenda */}
          <section className={cn(PANEL, 'min-w-0 overflow-hidden')}>
            <div className="border-b border-[#e8e2da] px-4 py-3.5 dark:border-[#1c2d3d]">
              <p className={EYEBROW}>Agenda</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-serif text-[19px] font-medium leading-snug text-[#18202e] dark:text-[#e2eaf4]">
                  {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : 'Select a date'}
                </h2>
                {selectedDate && (
                  <span className="font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                    {selectedEvents.length} item{selectedEvents.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center gap-2.5 rounded-[10px] border border-[#e8e2da] px-3.5 py-4 dark:border-[#1c2d3d]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0d7a6b] dark:text-[#2dd4bf]" />
                  <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">Loading calendar…</p>
                </div>
              ) : selectedEvents.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[#e8e2da] bg-[#faf8f4] px-4 py-8 text-center dark:border-[#1c2d3d] dark:bg-[#131c27]/40">
                  <CalendarDays className="mx-auto h-6 w-6 text-[#a0aec0] dark:text-[#3d5166]" />
                  <p className="mt-2 text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4]">Nothing scheduled</p>
                  <p className="mt-0.5 text-[12px] text-[#64748b] dark:text-[#6b8299]">
                    No paper deadlines fall on this date.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    return (
                      <li
                        key={ev.id}
                        className="flex items-start gap-3 rounded-[10px] border border-[#ece7df] px-3 py-2.5 transition-colors hover:bg-[#ede9e2]/50 dark:border-[#1c2d3d] dark:hover:bg-[#131c27]"
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]', cfg.tile)}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <p className="truncate text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
                              {ev.subjectName}
                            </p>
                            <span className="font-mono text-[11px] tabular-nums text-[#64748b] dark:text-[#6b8299]">
                              {ev.subjectCode}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-[#e8e2da] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#64748b] dark:border-[#1c2d3d] dark:text-[#6b8299]">
                              {EXAM_TYPE_LABELS[ev.examType] || ev.examType}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                              <Clock className="h-3 w-3" />
                              {format(ev.deadlineDate, 'd MMM yyyy')}
                            </span>
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', cfg.pill)}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* All upcoming events list */}
        <section className={cn(PANEL, 'overflow-hidden')}>
          <div className="border-b border-[#e8e2da] px-4 py-3.5 dark:border-[#1c2d3d]">
            <p className={EYEBROW}>All deadlines</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-serif text-[19px] font-medium leading-snug text-[#18202e] dark:text-[#e2eaf4]">
                All Paper Deadlines
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                {events.length} total
              </span>
            </div>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center gap-2.5 rounded-[10px] border border-[#e8e2da] px-3.5 py-4 dark:border-[#1c2d3d]">
                <Loader2 className="h-4 w-4 animate-spin text-[#0d7a6b] dark:text-[#2dd4bf]" />
                <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">Loading deadlines…</p>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[#e8e2da] bg-[#faf8f4] px-4 py-8 text-center dark:border-[#1c2d3d] dark:bg-[#131c27]/40">
                <Inbox className="mx-auto h-6 w-6 text-[#a0aec0] dark:text-[#3d5166]" />
                <p className="mt-2 text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4]">No deadlines yet</p>
                <p className="mt-0.5 text-[12px] text-[#64748b] dark:text-[#6b8299]">
                  No exam sessions or papers found for your department.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {events
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((ev) => {
                    const cfg = STATUS_CONFIG[ev.status];
                    const Icon = cfg.icon;
                    const active = selectedDate ? isSameDay(ev.date, selectedDate) : false;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedDate(ev.date)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-[10px] border border-[#ece7df] px-2.5 py-2 text-left transition-colors hover:bg-[#ede9e2]/60 dark:border-[#1c2d3d] dark:hover:bg-[#131c27]',
                          active && 'border-[#0d7a6b]/50 ring-1 ring-[#0d7a6b]/30 dark:border-[#2dd4bf]/40 dark:ring-[#2dd4bf]/25'
                        )}
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]', cfg.tile)}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">{ev.label}</p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#a0aec0] dark:text-[#3d5166]">
                            {format(ev.date, 'd MMM yyyy')}
                          </p>
                        </div>
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', cfg.dotClass)} />
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </div>
      </HodPageShell>
    </DashboardLayout>
  );
}
