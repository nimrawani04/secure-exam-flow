import { useEffect, useMemo, useState } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
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
import { ExamSession, ExamSessionUpdate, useCreateExamSession, useDeleteExamSession, useExamSessions, useUpdateExamSession } from '@/hooks/useAdminExamSessions';
import type { Database } from '@/integrations/supabase/types';
import { format, formatDistanceToNow } from 'date-fns';

// Mock data
const mockExams: Exam[] = [
  {
    id: '1',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    scheduledDate: new Date('2024-03-25T09:00:00'),
    unlockTime: new Date('2024-03-25T08:30:00'),
    paperId: 'p1',
    status: 'scheduled',
  },
  {
    id: '2',
    subjectId: 's2',
    subjectName: 'Algorithms',
    examType: 'mid_term',
    scheduledDate: new Date('2024-03-26T14:00:00'),
    unlockTime: new Date('2024-03-26T13:30:00'),
    paperId: 'p2',
    status: 'scheduled',
  },
  {
    id: '3',
    subjectId: 's3',
    subjectName: 'Database Systems',
    examType: 'end_term',
    scheduledDate: new Date('2024-03-27T09:00:00'),
    unlockTime: new Date('2024-03-27T08:30:00'),
    paperId: 'p3',
    status: 'scheduled',
  },
];

const calendarDays = Array.from({ length: 35 }, (_, i) => {
  const date = new Date('2024-03-01');
  date.setDate(date.getDate() + i - date.getDay());
  return date;
});

type ExamType = Database['public']['Enums']['exam_type'];
type ExamCellView = 'overview' | 'calendar' | 'sessions' | 'alerts' | 'inbox' | 'archive';

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
  const { data: recentNotifications } = useAdminNotifications(profile?.id);

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date('2024-03-25'));
  const [exams] = useState<Exam[]>(mockExams);

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
  const [sessionIsActive, setSessionIsActive] = useState(true);
  const [sessionIsLocked, setSessionIsLocked] = useState(false);

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'critical' | 'success'>('info');
  const [broadcastDepartments, setBroadcastDepartments] = useState<string[]>([]);

  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments?.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  const hodNotifications = useMemo(() => {
    return (recentNotifications || []).filter((notification) => notification.target_roles.includes('hod'));
  }, [recentNotifications]);

  const examDates = new Set(exams.map(e => e.scheduledDate.toDateString()));

  const getExamsForDate = (date: Date) => {
    return exams.filter(e => e.scheduledDate.toDateString() === date.toDateString());
  };

  const selectedExams = selectedDate ? getExamsForDate(selectedDate) : [];

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

    if (!submissionStartIso || !submissionEndIso || !reviewStartIso || !reviewEndIso || !accessStartIso || !accessEndIso) {
      toast({ title: 'Error', description: 'Please enter valid date/time values.', variant: 'destructive' });
      return;
    }

    try {
      await createSession.mutateAsync({
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
        is_active: sessionIsActive,
        is_locked: sessionIsLocked,
      });
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

    try {
      await createNotification.mutateAsync({
        createdBy: profile.id,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetRoles: ['hod'],
        targetDepartments: broadcastDepartments.length > 0 ? broadcastDepartments : null,
        type: broadcastType,
      });
      toast({ title: 'Alert sent', description: 'HOD notification broadcasted successfully.' });
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to send alert.', variant: 'destructive' });
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
      <div className="bg-card rounded-2xl border p-6 shadow-card space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">HOD Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Broadcast updates to HODs by department or campus-wide.
            </p>
          </div>
          <Badge variant={notificationTypeVariant[broadcastType]} className="text-xs uppercase">
            {broadcastType}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Review window opens Monday"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Share any instructions or deadlines for HODs..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={4}
            />
          </div>
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Target Departments (optional)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setBroadcastDepartments([])}
                disabled={broadcastDepartments.length === 0}
              >
                Clear
              </Button>
            </div>
            {deptsLoading ? (
              <p className="text-sm text-muted-foreground">Loading departments...</p>
            ) : departments && departments.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-3">
                    <Checkbox
                      checked={broadcastDepartments.includes(dept.id)}
                      onCheckedChange={(checked) => handleDepartmentToggle(dept.id, checked)}
                    />
                    <div>
                      <p className="text-sm font-medium">{dept.name}</p>
                      <p className="text-xs text-muted-foreground">{dept.code}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No departments available.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to notify all HODs across departments.
            </p>
          </div>
        </div>

        <Button variant="hero" className="gap-2" onClick={handleBroadcast} disabled={createNotification.isPending}>
          <Bell className="w-4 h-4" />
          {createNotification.isPending ? 'Sending...' : 'Send Alert'}
        </Button>
      </div>

      <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent HOD Alerts</h3>
          <Badge variant="outline" className="text-xs">
            {hodNotifications.length}
          </Badge>
        </div>

        {hodNotifications.length > 0 ? (
          <div className="space-y-3">
            {hodNotifications.map((notification) => (
              <div key={notification.id} className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-4">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{notification.title}</span>
                    <Badge variant={notificationTypeVariant[notification.type || 'info'] || 'secondary'} className="text-[10px] uppercase">
                      {notification.type || 'info'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.message.length > 120 ? `${notification.message.slice(0, 120)}...` : notification.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Departments: {formatDepartmentTargets(notification.target_departments)}</span>
                    <span>
                      {notification.created_at
                        ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No alerts sent yet</p>
          </div>
        )}
      </div>
    </div>
  );

  const calendarSection = (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="bg-card rounded-2xl border p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold">Exam Calendar</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm">Previous</Button>
              <span className="font-medium px-4">March 2024</span>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {calendarDays.map((date, index) => {
              const hasExam = examDates.has(date.toDateString());
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isCurrentMonth = date.getMonth() === 2;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all duration-200',
                    !isCurrentMonth && 'text-muted-foreground/40',
                    isSelected && 'bg-accent text-accent-foreground shadow-glow',
                    hasExam && !isSelected && 'bg-accent/20 text-accent font-medium',
                    !hasExam && !isSelected && 'hover:bg-secondary'
                  )}
                >
                  <span>{date.getDate()}</span>
                  {hasExam && (
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1',
                      isSelected ? 'bg-accent-foreground' : 'bg-accent'
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-muted-foreground">Exam scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-success" />
              <span className="text-muted-foreground">Paper ready</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-warning" />
              <span className="text-muted-foreground">Paper pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-2xl border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">
            {selectedDate?.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>

          {selectedExams.length > 0 ? (
            <div className="space-y-4">
              {selectedExams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-4 rounded-xl border bg-secondary/50 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{exam.subjectName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {exam.examType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <Badge variant="success">Ready</Badge>
                  </div>

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
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    <Button variant="hero" size="sm" className="flex-1 gap-1.5" disabled>
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

        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h4 className="font-semibold text-destructive">Emergency Actions</h4>
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
            {exams.map((exam) => (
              <tr key={exam.id} className="border-b hover:bg-secondary/50 transition-colors">
                <td className="py-4 px-4 font-medium">{exam.subjectName}</td>
                <td className="py-4 px-4 text-muted-foreground">
                  {exam.examType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </td>
                <td className="py-4 px-4 text-muted-foreground">Computer Science</td>
                <td className="py-4 px-4 text-muted-foreground">
                  {exam.scheduledDate.toLocaleDateString()}
                </td>
                <td className="py-4 px-4">
                  <Badge variant="success">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Upcoming Exams"
              value={12}
              subtitle="Next 7 days"
              icon={Calendar}
              variant="accent"
            />
            <StatsCard
              title="Papers Ready"
              value={10}
              subtitle="Approved & locked"
              icon={FileText}
              variant="success"
            />
            <StatsCard
              title="Pending Papers"
              value={2}
              subtitle="Awaiting HOD approval"
              icon={Clock}
              variant="warning"
            />
            <StatsCard
              title="Archived"
              value={156}
              subtitle="Past exams"
              icon={Archive}
            />
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
  onUpdate: (input: { id: string; updates: ExamSessionUpdate }) => Promise<unknown>;
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

    if (!submissionStartIso || !submissionEndIso || !reviewStartIso || !reviewEndIso || !accessStartIso || !accessEndIso) {
      toast({ title: 'Error', description: 'Please enter valid date/time values.', variant: 'destructive' });
      return;
    }

    try {
      await onUpdate({
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
          is_active: isActive,
          is_locked: isLocked,
        },
      });
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

      <div className="grid md:grid-cols-3 gap-4 text-sm">
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
      </div>
    </div>
  );
}


