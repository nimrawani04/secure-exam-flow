import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Exam } from '@/types';
import {
  Bell,
  Calendar,
  FileText,
  Download,
  Lock,
  Clock,
  Archive,
  AlertTriangle,
  Eye,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAdminDepartments } from '@/hooks/useAdminDepartments';
import { useAdminNotifications, useCreateNotification } from '@/hooks/useAdminNotifications';
import {
  ExamSession,
  ExamSessionMutationResult,
  ExamSessionUpdate,
  useCreateExamSession,
  useDeleteExamSession,
  useExamSessions,
  useUpdateExamSession,
} from '@/hooks/useAdminExamSessions';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

type ExamType = Database['public']['Enums']['exam_type'];
type PaperStatus = Database['public']['Enums']['paper_status'];
type ExamCellView = 'overview' | 'calendar' | 'sessions' | 'alerts' | 'inbox' | 'archive';
type ExamWithMeta = Exam & {
  subjectCode?: string;
  departmentId?: string | null;
  paperStatus?: PaperStatus | null;
  paperFilePath?: string | null;
};

const examTypeLabels: Record<ExamType, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
};

const examCellViewCopy: Record<ExamCellView, { title: string; subtitle: string }> = {
  overview: {
    title: 'Examination Cell Dashboard',
    subtitle: 'Manage exam schedules and access approved papers',
  },
  calendar: {
    title: 'Exam Calendar',
    subtitle: 'Review scheduled exams and access times',
  },
  sessions: {
    title: 'Exam Sessions',
    subtitle: 'Configure submission, review, and access windows',
  },
  alerts: {
    title: 'HOD Alerts',
    subtitle: 'Broadcast updates to department heads',
  },
  inbox: {
    title: 'Approved Papers Inbox',
    subtitle: 'Access approved and locked papers',
  },
  archive: {
    title: 'Exam Archive',
    subtitle: 'Browse past exams and archived papers',
  },
};

const notificationTypeOptions = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'success', label: 'Success' },
];

const notificationTypeVariant: Record<string, 'secondary' | 'warning' | 'destructive' | 'success'> = {
  info: 'secondary',
  warning: 'warning',
  critical: 'destructive',
  success: 'success',
};

const emptyPaperStats: Record<PaperStatus, number> = {
  draft: 0,
  submitted: 0,
  pending_review: 0,
  approved: 0,
  rejected: 0,
  locked: 0,
};

const toLocalInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatWindow = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 'Not configured';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Invalid dates';
  return `${format(startDate, 'MMM d, yyyy h:mm a')} -> ${format(endDate, 'MMM d, yyyy h:mm a')}`;
};

const formatSingleDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return format(date, 'MMM d, yyyy h:mm a');
};

const getTimelineIssue = (input: {
  submissionStart: string;
  submissionEnd: string;
  reviewStart: string;
  reviewEnd: string;
  accessStart: string;
  accessEnd: string;
}) => {
  const required: Array<{ label: string; value: string }> = [
    { label: 'Submission start', value: input.submissionStart },
    { label: 'Submission end', value: input.submissionEnd },
    { label: 'Review start', value: input.reviewStart },
    { label: 'Review end', value: input.reviewEnd },
    { label: 'Access start', value: input.accessStart },
    { label: 'Access end', value: input.accessEnd },
  ];

  for (const field of required) {
    if (!field.value) {
      return `${field.label} is required.`;
    }
    if (Number.isNaN(new Date(field.value).getTime())) {
      return `Invalid date/time for ${field.label.toLowerCase()}.`;
    }
  }

  const submissionStart = new Date(input.submissionStart);
  const submissionEnd = new Date(input.submissionEnd);
  const reviewStart = new Date(input.reviewStart);
  const reviewEnd = new Date(input.reviewEnd);
  const accessStart = new Date(input.accessStart);
  const accessEnd = new Date(input.accessEnd);

  if (submissionStart >= submissionEnd) return 'Submission start must be before submission end.';
  if (reviewStart >= reviewEnd) return 'Review start must be before review end.';
  if (accessStart >= accessEnd) return 'Access start must be before access end.';
  if (submissionEnd > reviewStart) return 'Submission must end before review starts.';
  if (reviewEnd > accessStart) return 'Review must end before access starts.';

  return null;
};

export function ExamCellDashboard({ view = 'overview' }: { view?: ExamCellView }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: departments, isLoading: deptsLoading } = useAdminDepartments();
  const { data: sessions, isLoading: sessionsLoading } = useExamSessions();
  const createSession = useCreateExamSession();
  const updateSession = useUpdateExamSession();
  const deleteSession = useDeleteExamSession();
  const createNotification = useCreateNotification();
  const { data: recentNotifications, isLoading: notificationsLoading } = useAdminNotifications(profile?.id);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [exams, setExams] = useState<ExamWithMeta[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [paperStats, setPaperStats] = useState<Record<PaperStatus, number>>(emptyPaperStats);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionAcademicYear, setSessionAcademicYear] = useState('');
  const [sessionExamType, setSessionExamType] = useState<ExamType>('mid_term');
  const [submissionStart, setSubmissionStart] = useState('');
  const [submissionEnd, setSubmissionEnd] = useState('');
  const [reviewStart, setReviewStart] = useState('');
  const [reviewEnd, setReviewEnd] = useState('');
  const [accessStart, setAccessStart] = useState('');
  const [accessEnd, setAccessEnd] = useState('');
  const [examDate, setExamDate] = useState('');
  const [sessionIsActive, setSessionIsActive] = useState(true);
  const [sessionIsLocked, setSessionIsLocked] = useState(false);

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'critical' | 'success'>('info');
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<'all' | 'targeted'>('all');
  const [broadcastDepartments, setBroadcastDepartments] = useState<string[]>([]);
  const broadcastMessageLimit = 500;

  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments?.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  const hodNotifications = useMemo(() => {
    return (recentNotifications || []).filter((notification) => notification.target_roles.includes('hod'));
  }, [recentNotifications]);

  useEffect(() => {
    let isMounted = true;

    const fetchExams = async () => {
      setIsLoadingExams(true);
      setExamsError(null);

      const { data, error } = await supabase
        .from('exams')
        .select(
          `id,
          subject_id,
          exam_type,
          scheduled_date,
          unlock_time,
          status,
          selected_paper_id,
          subjects ( id, name, code, department_id ),
          exam_papers:exam_papers!exams_selected_paper_id_fkey ( id, status, file_path )`
        )
        .order('scheduled_date', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Error fetching exams:', error);
        setExamsError('Failed to load exams.');
        setExams([]);
        setIsLoadingExams(false);
        return;
      }

      const { data: selectedPapers, error: selectedPapersError } = await supabase
        .from('exam_papers')
        .select('id, subject_id, exam_type, status, is_selected, file_path')
        .eq('is_selected', true)
        .in('status', ['approved', 'locked']);

      if (selectedPapersError) {
        console.error('Error fetching selected papers:', selectedPapersError);
      }

      const selectedPaperByExamKey = new Map<string, { id: string; status: PaperStatus; filePath: string | null }>();
      (selectedPapers || []).forEach((paper: any) => {
        const key = `${paper.subject_id}-${paper.exam_type}`;
        if (!selectedPaperByExamKey.has(key)) {
          selectedPaperByExamKey.set(key, {
            id: paper.id,
            status: paper.status as PaperStatus,
            filePath: paper.file_path ?? null,
          });
        }
      });

      const mapped = (data || [])
        .map((row: any) => {
          const scheduledDate = new Date(row.scheduled_date);
          const unlockTime = new Date(row.unlock_time);
          if (Number.isNaN(scheduledDate.getTime()) || Number.isNaN(unlockTime.getTime())) {
            return null;
          }

          const examKey = `${row.subject_id}-${row.exam_type}`;
          const fallbackSelectedPaper = selectedPaperByExamKey.get(examKey);
          const resolvedPaperId = row.selected_paper_id ?? fallbackSelectedPaper?.id;
          const resolvedPaperStatus = row.exam_papers?.status ?? fallbackSelectedPaper?.status ?? null;
          const resolvedPaperFilePath = row.exam_papers?.file_path ?? fallbackSelectedPaper?.filePath ?? null;

          return {
            id: row.id,
            subjectId: row.subject_id,
            subjectName: row.subjects?.name ?? 'Unknown Subject',
            subjectCode: row.subjects?.code ?? '',
            departmentId: row.subjects?.department_id ?? null,
            examType: row.exam_type,
            scheduledDate,
            unlockTime,
            paperId: resolvedPaperId ?? undefined,
            paperStatus: resolvedPaperStatus,
            paperFilePath: resolvedPaperFilePath,
            status: row.status,
          } as ExamWithMeta;
        })
        .filter((row): row is ExamWithMeta => Boolean(row));

      setExams(mapped);
      setIsLoadingExams(false);
    };

    fetchExams();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPaperStats = async () => {
      const { data, error } = await supabase.from('exam_papers').select('status');
      if (!isMounted) return;

      if (error) {
        console.error('Error fetching paper stats:', error);
        setPaperStats(emptyPaperStats);
        return;
      }

      const nextStats = { ...emptyPaperStats };
      data?.forEach((paper: any) => {
        if (paper?.status && nextStats[paper.status as PaperStatus] !== undefined) {
          nextStats[paper.status as PaperStatus] += 1;
        }
      });
      setPaperStats(nextStats);
    };

    fetchPaperStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      const nextExamDate = exams.find((exam) => !Number.isNaN(exam.scheduledDate.getTime()))?.scheduledDate;
      setSelectedDate(nextExamDate ?? new Date());
      return;
    }

    setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [exams, selectedDate]);

  const calendarDays = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startDay = start.getDay();
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startDay);
    return Array.from({ length: totalCells }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [currentMonth]);

  const examDates = useMemo(
    () => new Set(exams.map((exam) => exam.scheduledDate.toDateString())),
    [exams]
  );

  const selectedExams = useMemo(() => {
    if (!selectedDate) return [];
    return exams.filter((exam) => exam.scheduledDate.toDateString() === selectedDate.toDateString());
  }, [exams, selectedDate]);

  const upcomingExamsCount = useMemo(() => {
    const now = Date.now();
    const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
    return exams.filter((exam) => {
      const time = exam.scheduledDate.getTime();
      return exam.status !== 'archived' && time >= now && time <= nextWeek;
    }).length;
  }, [exams]);

  const archivedExamsCount = useMemo(
    () => exams.filter((exam) => exam.status === 'archived').length,
    [exams]
  );

  const inboxExams = useMemo(
    () => exams.filter((exam) => exam.paperStatus === 'locked' || exam.paperStatus === 'approved'),
    [exams]
  );
  const papersReadyCount = inboxExams.length;
  const pendingPapersCount = paperStats.pending_review;

  const currentMonthLabel = useMemo(() => format(currentMonth, 'MMMM yyyy'), [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      setSelectedDate(next);
      return next;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      setSelectedDate(next);
      return next;
    });
  };

  const getPaperFileName = (exam: ExamWithMeta) => {
    if (exam.paperFilePath) {
      const chunks = exam.paperFilePath.split('/');
      const fileName = chunks[chunks.length - 1];
      if (fileName) return fileName;
    }
    const safeSubject = exam.subjectName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return `${safeSubject}_${exam.examType}.pdf`;
  };

  const handlePreviewPaper = async (exam: ExamWithMeta) => {
    if (!exam.paperFilePath) {
      toast({ title: 'No file available', description: 'This paper has no file path configured.', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase.storage
      .from('exam-papers')
      .createSignedUrl(exam.paperFilePath, 60 * 10);

    if (error || !data?.signedUrl) {
      toast({ title: 'Preview failed', description: error?.message || 'Could not generate preview link.', variant: 'destructive' });
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPaper = async (exam: ExamWithMeta) => {
    if (!exam.paperFilePath) {
      toast({ title: 'No file available', description: 'This paper has no file path configured.', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase.storage
      .from('exam-papers')
      .createSignedUrl(exam.paperFilePath, 60 * 10, { download: getPaperFileName(exam) });

    if (error || !data?.signedUrl) {
      toast({ title: 'Download failed', description: error?.message || 'Could not generate download link.', variant: 'destructive' });
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const getPaperBadge = (exam: ExamWithMeta) => {
    if (exam.paperStatus === 'locked' || exam.paperStatus === 'approved') {
      return { label: 'Ready', variant: 'success' as const };
    }
    if (exam.paperStatus === 'pending_review' || exam.paperStatus === 'submitted') {
      return { label: 'Pending', variant: 'warning' as const };
    }
    return { label: 'Not ready', variant: 'secondary' as const };
  };

  const resetSessionForm = () => {
    setSessionName('');
    setSessionAcademicYear('');
    setSessionExamType('mid_term');
    setSubmissionStart('');
    setSubmissionEnd('');
    setReviewStart('');
    setReviewEnd('');
    setAccessStart('');
    setAccessEnd('');
    setExamDate('');
    setSessionIsActive(true);
    setSessionIsLocked(false);
  };

  const handleCreateSession = async () => {
    if (!profile?.id) {
      toast({ title: 'Error', description: 'Profile not loaded. Please try again.', variant: 'destructive' });
      return;
    }
    if (!sessionName.trim() || !sessionAcademicYear.trim()) {
      toast({ title: 'Error', description: 'Session name and academic year are required.', variant: 'destructive' });
      return;
    }

    const timelineIssue = getTimelineIssue({
      submissionStart,
      submissionEnd,
      reviewStart,
      reviewEnd,
      accessStart,
      accessEnd,
    });
    if (timelineIssue) {
      toast({ title: 'Invalid timeline', description: timelineIssue, variant: 'destructive' });
      return;
    }

    const submissionStartIso = fromLocalInputValue(submissionStart);
    const submissionEndIso = fromLocalInputValue(submissionEnd);
    const reviewStartIso = fromLocalInputValue(reviewStart);
    const reviewEndIso = fromLocalInputValue(reviewEnd);
    const accessStartIso = fromLocalInputValue(accessStart);
    const accessEndIso = fromLocalInputValue(accessEnd);
    const examDateIso = fromLocalInputValue(examDate);

    if (!submissionStartIso || !submissionEndIso || !reviewStartIso || !reviewEndIso || !accessStartIso || !accessEndIso || !examDateIso) {
      toast({ title: 'Error', description: 'Please enter valid date/time values, including the exam date.', variant: 'destructive' });
      return;
    }

    try {
      const result = await createSession.mutateAsync({
        created_by: profile.id,
        name: sessionName.trim(),
        academic_year: sessionAcademicYear.trim(),
        exam_type: sessionExamType,
        submission_start: submissionStartIso,
        submission_end: submissionEndIso,
        review_start: reviewStartIso,
        review_end: reviewEndIso,
        access_start: accessStartIso,
        access_end: accessEndIso,
        exam_date: examDateIso,
        is_active: sessionIsActive,
        is_locked: sessionIsLocked,
      });
      if (result?.fallback) {
        toast({
          title: 'Saved without exam date',
          description: 'Your database is missing the exam_date column. Run the migration to store this field.',
          variant: 'destructive',
        });
      }
      toast({ title: 'Session created', description: `${sessionName.trim()} has been scheduled.` });
      resetSessionForm();
      setSessionDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to create session.', variant: 'destructive' });
    }
  };

  const handleDepartmentToggle = (departmentId: string, checked: boolean | 'indeterminate') => {
    setBroadcastDepartments((prev) => {
      if (checked) {
        return prev.includes(departmentId) ? prev : [...prev, departmentId];
      }
      return prev.filter((id) => id !== departmentId);
    });
  };

  const formatDepartmentTargets = (targets: string[] | null) => {
    if (!targets || targets.length === 0) return 'All departments';
    const names = targets
      .map((id) => departmentNameMap.get(id))
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return `${targets.length} departments`;
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`;
  };

  const handleBroadcast = async () => {
    if (!profile?.id) {
      toast({ title: 'Error', description: 'Profile not loaded. Please try again.', variant: 'destructive' });
      return;
    }
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast({ title: 'Error', description: 'Title and message are required.', variant: 'destructive' });
      return;
    }
    if (broadcastTargetMode === 'targeted' && broadcastDepartments.length === 0) {
      toast({ title: 'Error', description: 'Select at least one target department.', variant: 'destructive' });
      return;
    }

    try {
      await createNotification.mutateAsync({
        createdBy: profile.id,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetRoles: ['hod'],
        targetDepartments: broadcastTargetMode === 'targeted' ? broadcastDepartments : null,
        type: broadcastType,
      });
      toast({ title: 'Alert sent', description: 'HOD notification broadcasted successfully.' });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastTargetMode('all');
      setBroadcastDepartments([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to send alert.', variant: 'destructive' });
    }
  };

  const handlePreview = () => {
    if (!broadcastTitle.trim() && !broadcastMessage.trim()) {
      toast({ title: 'Preview not available', description: 'Add a title and message to preview.', variant: 'destructive' });
      return;
    }
    toast({
      title: broadcastTitle.trim() || 'Untitled alert',
      description:
        broadcastMessage.trim().slice(0, 200) + (broadcastMessage.trim().length > 200 ? '...' : ''),
    });
  };

  const handleBroadcastKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!createNotification.isPending) {
        handleBroadcast();
      }
    }
  };


  const headerCopy = examCellViewCopy[view];

  const sessionsSection = (
    <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Exam Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Define submission, review, and access windows for each session.
          </p>
        </div>
        <Dialog
          open={sessionDialogOpen}
          onOpenChange={(open) => {
            setSessionDialogOpen(open);
            if (!open) {
              resetSessionForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Exam Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Session Name</Label>
                  <Input
                    placeholder="e.g. Mid Term 2026"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input
                    placeholder="e.g. 2025-26"
                    value={sessionAcademicYear}
                    onChange={(e) => setSessionAcademicYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Exam Type</Label>
                  <Select value={sessionExamType} onValueChange={(value) => setSessionExamType(value as ExamType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(examTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Submission Window</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input type="datetime-local" value={submissionStart} onChange={(e) => setSubmissionStart(e.target.value)} />
                  <Input type="datetime-local" value={submissionEnd} onChange={(e) => setSubmissionEnd(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Review Window</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input type="datetime-local" value={reviewStart} onChange={(e) => setReviewStart(e.target.value)} />
                  <Input type="datetime-local" value={reviewEnd} onChange={(e) => setReviewEnd(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Access Window</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input type="datetime-local" value={accessStart} onChange={(e) => setAccessStart(e.target.value)} />
                  <Input type="datetime-local" value={accessEnd} onChange={(e) => setAccessEnd(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Exam Date</Label>
                <Input type="datetime-local" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-xl border bg-secondary/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Active Session</p>
                    <p className="text-xs text-muted-foreground">Visible to staff by default.</p>
                  </div>
                  <Switch checked={sessionIsActive} onCheckedChange={setSessionIsActive} />
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-secondary/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Lock Session</p>
                    <p className="text-xs text-muted-foreground">Prevent edits to this timeline.</p>
                  </div>
                  <Switch checked={sessionIsLocked} onCheckedChange={setSessionIsLocked} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSession} disabled={createSession.isPending}>
                {createSession.isPending ? 'Creating...' : 'Create Session'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sessionsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onUpdate={updateSession.mutateAsync}
              onDelete={deleteSession.mutateAsync}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No exam sessions configured</p>
          <p className="text-sm mt-1">Create a session to manage timelines.</p>
        </div>
      )}
    </div>
  );

  const alertsSection = (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Compose Alert</h2>
                <p className="text-sm text-muted-foreground">
                  Notify HODs across departments or targeted groups.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Review window opens Monday"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  onKeyDown={handleBroadcastKeyDown}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
                <Label>Message</Label>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Share any instructions or deadlines for HODs..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    rows={4}
                    maxLength={broadcastMessageLimit}
                    className="min-h-[120px]"
                    onKeyDown={handleBroadcastKeyDown}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Keep it clear and actionable.</span>
                    <span>{broadcastMessage.length}/{broadcastMessageLimit}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={broadcastType} onValueChange={(value) => setBroadcastType(value as typeof broadcastType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      {notificationTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Departments</Label>
                  <Select
                    value={broadcastTargetMode}
                    onValueChange={(value) => {
                      const mode = value as 'all' | 'targeted';
                      setBroadcastTargetMode(mode);
                      if (mode === 'all') {
                        setBroadcastDepartments([]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      <SelectItem value="targeted">Target department</SelectItem>
                    </SelectContent>
                  </Select>

                  {broadcastTargetMode === 'targeted' && (
                    <>
                      {deptsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading departments...</p>
                      ) : departments && departments.length > 0 ? (
                        <div className="pb-1 sm:-mx-1 sm:overflow-x-auto sm:px-1">
                          <div className="flex flex-wrap items-center gap-2 sm:min-w-max sm:flex-nowrap">
                            {departments.map((dept) => {
                              const isSelectedDept = broadcastDepartments.includes(dept.id);
                              return (
                                <label
                                  key={dept.id}
                                  style={
                                    isSelectedDept
                                      ? {
                                          borderColor: 'var(--theme-color)',
                                          backgroundColor: 'var(--theme-color-soft)',
                                        }
                                      : undefined
                                  }
                                  className="inline-flex max-w-full items-center gap-2 rounded-[10px] border bg-secondary/20 px-3 py-2"
                                >
                                  <Checkbox
                                    checked={isSelectedDept}
                                    onCheckedChange={(checked) => handleDepartmentToggle(dept.id, checked)}
                                  />
                                  <span className="max-w-[132px] truncate text-xs font-medium sm:max-w-none sm:text-sm">{dept.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No departments available.</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Choose one or more departments for targeted delivery.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Button variant="outline" size="sm" className="h-[38px] w-full sm:w-auto" onClick={handlePreview}>
                  Preview
                </Button>
                <Button
                  variant="hero"
                  className="h-[38px] w-full gap-2 sm:w-auto"
                  onClick={handleBroadcast}
                  disabled={createNotification.isPending}
                >
                  <Bell className="w-4 h-4" />
                  {createNotification.isPending ? 'Sending...' : 'Send Alert'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:self-start">
          <div className="bg-card rounded-lg border p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Recent HOD Alerts</h3>
                <p className="text-xs text-muted-foreground">Latest alerts you sent.</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {hodNotifications.length}
              </Badge>
            </div>

            {notificationsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`hod-alert-skeleton-${index}`} className="flex items-start gap-3 rounded-lg border p-3 sm:p-4 animate-pulse">
                    <div className="h-9 w-9 rounded-md bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hodNotifications.length > 0 ? (
              <div className="divide-y border rounded-lg">
                {hodNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-3 p-3 sm:p-4">
                    <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{notification.title}</span>
                        <Badge
                          variant={notificationTypeVariant[notification.type || 'info'] || 'secondary'}
                          className="text-[10px] uppercase"
                        >
                          {notification.type || 'info'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notification.message.length > 120 ? `${notification.message.slice(0, 120)}...` : notification.message}
                      </p>
                      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {notification.created_at
                            ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                            : 'Just now'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDepartmentTargets(notification.target_departments)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-secondary/10 px-4 py-7 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full border border-dashed flex items-center justify-center">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <div>
                  <p className="font-medium text-sm">No alerts sent yet</p>
                  <p className="text-xs text-muted-foreground">Compose an alert to notify HODs quickly.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  Send your first alert
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const calendarSection = (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Exam Calendar</h2>
            <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <Button variant="outline" size="sm" className="h-9 px-3 sm:h-10 sm:px-4" onClick={handlePrevMonth}>
                Previous
              </Button>
              <span className="px-2 text-center font-medium sm:px-4">{currentMonthLabel}</span>
              <Button variant="outline" size="sm" className="h-9 px-3 sm:h-10 sm:px-4" onClick={handleNextMonth}>
                Next
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground sm:text-sm">
                {day}
              </div>
            ))}
            {calendarDays.map((date, index) => {
              const hasExam = examDates.has(date.toDateString());
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isCurrentMonth =
                date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date)}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'var(--theme-color)',
                          color: 'white',
                          borderRadius: '12px',
                        }
                      : hasExam
                        ? {
                            backgroundColor: 'var(--theme-color-soft)',
                            color: 'var(--theme-color)',
                          }
                        : undefined
                  }
                  className={cn(
                    'flex h-[64px] w-full flex-col items-center justify-center rounded-lg border border-transparent text-xs transition-colors duration-150 sm:h-[72px] sm:text-sm',
                    !isCurrentMonth && 'text-muted-foreground/20',
                    isSelected && 'font-medium',
                    hasExam && !isSelected && 'font-medium',
                    !isSelected && 'hover:bg-[var(--theme-color-soft)]'
                  )}
                >
                  <span>{date.getDate()}</span>
                  {hasExam && (
                    <span className={cn(
                      'mt-1 h-2 w-2 rounded-full',
                      isSelected ? 'bg-white' : 'bg-[var(--theme-color)]'
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t pt-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--theme-color)]" />
              <span className="text-muted-foreground">Exam scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Paper ready</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Paper pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">
            {(selectedDate ?? currentMonth)?.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>

          {isLoadingExams ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin" />
              <p>Loading exams...</p>
            </div>
          ) : examsError ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{examsError}</p>
            </div>
          ) : selectedExams.length > 0 ? (
            <div className="space-y-4">
              {selectedExams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-4 rounded-xl border bg-secondary/50 space-y-3"
                >
                  {(() => {
                    const badge = getPaperBadge(exam);
                    return (
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{exam.subjectName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {exam.examType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                        </div>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {exam.scheduledDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Lock className="w-4 h-4" />
                      Unlocks at {exam.unlockTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 pt-2">
                    <Button variant="outline" size="default" className="flex-1 h-10 gap-1.5">
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    <Button variant="hero" size="default" className="flex-1 h-10 gap-1.5" disabled>
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No exams scheduled</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h4 className="font-semibold">Emergency Actions</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Use only if paper leak is suspected
          </p>
          <Button variant="destructive" size="sm" className="w-full gap-2">
            <Lock className="w-4 h-4" />
            Emergency Re-lock Paper
          </Button>
        </div>
      </div>
    </div>
  );

  const inboxSection = (
    <div className="bg-card rounded-2xl border p-6 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold">Approved Papers Inbox</h2>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <Archive className="w-4 h-4" />
          View Archive
        </Button>
      </div>

      <div className="overflow-x-auto">
        {isLoadingExams ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin" />
            <p>Loading approved papers...</p>
          </div>
        ) : examsError ? (
          <div className="text-center py-10 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{examsError}</p>
          </div>
        ) : inboxExams.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No approved papers yet</p>
            <p className="text-sm mt-1">Approved and locked papers will appear here.</p>
          </div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Subject</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exam Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Department</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exam Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inboxExams.map((exam) => {
                const departmentName = exam.departmentId ? departmentNameMap.get(exam.departmentId) : null;
                const statusLabel = exam.paperStatus === 'locked' ? 'Locked' : 'Approved';
                return (
                  <tr key={exam.id} className="border-b hover:bg-secondary/50 transition-colors">
                    <td className="py-4 px-4 font-medium">{exam.subjectName}</td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {exam.examType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {departmentName ?? 'Unknown Department'}
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {exam.scheduledDate.toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="success">
                        <Lock className="w-3 h-3 mr-1" />
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handlePreviewPaper(exam)} title="Preview paper">
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPaper(exam)} title="Download paper">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const archiveSection = (
    <div className="bg-card rounded-2xl border p-6 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold">Exam Archive</h2>
        <Badge variant="outline" className="text-xs">Past sessions</Badge>
      </div>
      <div className="text-center py-12 text-muted-foreground">
        <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No archived exams yet</p>
        <p className="text-sm mt-1">Archived sessions will appear here.</p>
      </div>
    </div>
  );


  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{headerCopy.title}</h1>
        <p className="text-muted-foreground mt-1">
          {headerCopy.subtitle}
        </p>
      </div>

      {view === 'overview' && (
        <>
          <div className="rounded-[12px] border border-border/40 bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:border-r sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 sm:h-10 sm:w-10">
                    <Calendar className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Upcoming Exams</p>
                    <p className="mt-1 text-xs text-muted-foreground">Next 7 days</p>
                  </div>
                </div>
                <p className="text-[28px] font-semibold leading-none">{isLoadingExams ? '—' : upcomingExamsCount}</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:border-r-0 sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 sm:h-10 sm:w-10">
                    <FileText className="h-4 w-4 text-success sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Papers Ready</p>
                    <p className="mt-1 text-xs text-muted-foreground">Approved & locked</p>
                  </div>
                </div>
                <p className="text-[28px] font-semibold leading-none">{isLoadingExams ? '—' : papersReadyCount}</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:border-b-0 sm:border-r sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 sm:h-10 sm:w-10">
                    <Clock className="h-4 w-4 text-warning sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Pending Papers</p>
                    <p className="mt-1 text-xs text-muted-foreground">Awaiting HOD approval</p>
                  </div>
                </div>
                <p className="text-[28px] font-semibold leading-none">{isLoadingExams ? '—' : pendingPapersCount}</p>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary sm:h-10 sm:w-10">
                    <Archive className="h-4 w-4 text-foreground/70 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Archived</p>
                    <p className="mt-1 text-xs text-muted-foreground">Past exams</p>
                  </div>
                </div>
                <p className="text-[28px] font-semibold leading-none">{isLoadingExams ? '—' : archivedExamsCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-secondary/30 p-6 text-sm text-muted-foreground">
            Choose a section from the sidebar to manage sessions, alerts, calendar, inbox, or archive details.
          </div>
        </>
      )}

      {view === 'sessions' && sessionsSection}
      {view === 'alerts' && alertsSection}
      {view === 'calendar' && calendarSection}
      {view === 'inbox' && inboxSection}
      {view === 'archive' && archiveSection}
    </div>
  );
}

function SessionCard({
  session,
  onUpdate,
  onDelete,
}: {
  session: ExamSession;
  onUpdate: (input: { id: string; updates: ExamSessionUpdate }) => Promise<ExamSessionMutationResult>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [academicYear, setAcademicYear] = useState(session.academic_year);
  const [examType, setExamType] = useState<ExamType>(session.exam_type);
  const [localSubmissionStart, setLocalSubmissionStart] = useState(toLocalInputValue(session.submission_start));
  const [localSubmissionEnd, setLocalSubmissionEnd] = useState(toLocalInputValue(session.submission_end));
  const [localReviewStart, setLocalReviewStart] = useState(toLocalInputValue(session.review_start));
  const [localReviewEnd, setLocalReviewEnd] = useState(toLocalInputValue(session.review_end));
  const [localAccessStart, setLocalAccessStart] = useState(toLocalInputValue(session.access_start));
  const [localAccessEnd, setLocalAccessEnd] = useState(toLocalInputValue(session.access_end));
  const [localExamDate, setLocalExamDate] = useState(toLocalInputValue(session.exam_date));
  const [isActive, setIsActive] = useState(Boolean(session.is_active));
  const [isLocked, setIsLocked] = useState(Boolean(session.is_locked));

  useEffect(() => {
    if (open) {
      setName(session.name);
      setAcademicYear(session.academic_year);
      setExamType(session.exam_type);
      setLocalSubmissionStart(toLocalInputValue(session.submission_start));
      setLocalSubmissionEnd(toLocalInputValue(session.submission_end));
      setLocalReviewStart(toLocalInputValue(session.review_start));
      setLocalReviewEnd(toLocalInputValue(session.review_end));
      setLocalAccessStart(toLocalInputValue(session.access_start));
      setLocalAccessEnd(toLocalInputValue(session.access_end));
      setLocalExamDate(toLocalInputValue(session.exam_date));
      setIsActive(Boolean(session.is_active));
      setIsLocked(Boolean(session.is_locked));
    }
  }, [open, session]);

  const handleUpdate = async () => {
    if (!name.trim() || !academicYear.trim()) {
      toast({ title: 'Error', description: 'Session name and academic year are required.', variant: 'destructive' });
      return;
    }

    const timelineIssue = getTimelineIssue({
      submissionStart: localSubmissionStart,
      submissionEnd: localSubmissionEnd,
      reviewStart: localReviewStart,
      reviewEnd: localReviewEnd,
      accessStart: localAccessStart,
      accessEnd: localAccessEnd,
    });

    if (timelineIssue) {
      toast({ title: 'Invalid timeline', description: timelineIssue, variant: 'destructive' });
      return;
    }

    const submissionStartIso = fromLocalInputValue(localSubmissionStart);
    const submissionEndIso = fromLocalInputValue(localSubmissionEnd);
    const reviewStartIso = fromLocalInputValue(localReviewStart);
    const reviewEndIso = fromLocalInputValue(localReviewEnd);
    const accessStartIso = fromLocalInputValue(localAccessStart);
    const accessEndIso = fromLocalInputValue(localAccessEnd);
    const examDateIso = fromLocalInputValue(localExamDate);

    if (!submissionStartIso || !submissionEndIso || !reviewStartIso || !reviewEndIso || !accessStartIso || !accessEndIso || !examDateIso) {
      toast({ title: 'Error', description: 'Please enter valid date/time values, including the exam date.', variant: 'destructive' });
      return;
    }

    try {
      const result = await onUpdate({
        id: session.id,
        updates: {
          name: name.trim(),
          academic_year: academicYear.trim(),
          exam_type: examType,
          submission_start: submissionStartIso,
          submission_end: submissionEndIso,
          review_start: reviewStartIso,
          review_end: reviewEndIso,
          access_start: accessStartIso,
          access_end: accessEndIso,
          exam_date: examDateIso,
          is_active: isActive,
          is_locked: isLocked,
        },
      });
      if (result?.fallback) {
        toast({
          title: 'Saved without exam date',
          description: 'Your database is missing the exam_date column. Run the migration to store this field.',
          variant: 'destructive',
        });
      }
      toast({ title: 'Session updated', description: 'Timeline changes have been saved.' });
      setOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to update session.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(session.id);
      toast({ title: 'Session deleted', description: 'The session has been removed.' });
      setConfirmOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to delete session.', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-2xl border bg-secondary/30 p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold">{session.name}</h3>
            <Badge variant="outline" className="text-xs">
              {examTypeLabels[session.exam_type]}
            </Badge>
            {session.is_active && (
              <Badge variant="success" className="text-xs">
                Active
              </Badge>
            )}
            {session.is_locked && (
              <Badge variant="warning" className="text-xs">
                Locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Academic Year: {session.academic_year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Exam Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Session Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Exam Type</Label>
                    <Select value={examType} onValueChange={(value) => setExamType(value as ExamType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(examTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Submission Window</Label>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input type="datetime-local" value={localSubmissionStart} onChange={(e) => setLocalSubmissionStart(e.target.value)} />
                    <Input type="datetime-local" value={localSubmissionEnd} onChange={(e) => setLocalSubmissionEnd(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Review Window</Label>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input type="datetime-local" value={localReviewStart} onChange={(e) => setLocalReviewStart(e.target.value)} />
                    <Input type="datetime-local" value={localReviewEnd} onChange={(e) => setLocalReviewEnd(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Access Window</Label>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input type="datetime-local" value={localAccessStart} onChange={(e) => setLocalAccessStart(e.target.value)} />
                    <Input type="datetime-local" value={localAccessEnd} onChange={(e) => setLocalAccessEnd(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Exam Date</Label>
                  <Input type="datetime-local" value={localExamDate} onChange={(e) => setLocalExamDate(e.target.value)} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-xl border bg-secondary/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Active Session</p>
                      <p className="text-xs text-muted-foreground">Visible to staff by default.</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border bg-secondary/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Lock Session</p>
                      <p className="text-xs text-muted-foreground">Prevent edits to this timeline.</p>
                    </div>
                    <Switch checked={isLocked} onCheckedChange={setIsLocked} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete exam session?</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">
                This will remove the session and its configured timelines. This action cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete Session
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 text-sm">
        <div className="rounded-xl border bg-background/60 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Submission Window</p>
          <p className="font-medium">{formatWindow(session.submission_start, session.submission_end)}</p>
        </div>
        <div className="rounded-xl border bg-background/60 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Review Window</p>
          <p className="font-medium">{formatWindow(session.review_start, session.review_end)}</p>
        </div>
        <div className="rounded-xl border bg-background/60 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Access Window</p>
          <p className="font-medium">{formatWindow(session.access_start, session.access_end)}</p>
        </div>
        <div className="rounded-xl border bg-background/60 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Exam Date</p>
          <p className="font-medium">{formatSingleDate(session.exam_date)}</p>
        </div>
      </div>
    </div>
  );
}
