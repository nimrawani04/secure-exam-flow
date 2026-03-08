import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useHODExamSessions, type CreateSessionInput } from '@/hooks/useHODExamSessions';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  FileText,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type ExamType = Database['public']['Enums']['exam_type'];

const EXAM_TYPE_OPTIONS: { value: ExamType; label: string }[] = [
  { value: 'cia_1', label: 'CIA 1' },
  { value: 'cia_2', label: 'CIA 2' },
  { value: 'mid_term', label: 'Mid Term' },
  { value: 'end_term', label: 'End Semester' },
  { value: 'internal', label: 'Internal' },
  { value: 'practical', label: 'Practical Internal' },
  { value: 'practical_external', label: 'Practical External' },
];

export default function HODExamSessions() {
  const { sessions, subjects, isLoading, createSession, deleteSession } = useHODExamSessions();
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [subjectId, setSubjectId] = useState('');
  const [examType, setExamType] = useState<ExamType | ''>('');
  const [semester, setSemester] = useState('');
  const [examDate, setExamDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');

  const resetForm = () => {
    setSubjectId('');
    setExamType('');
    setSemester('');
    setExamDate('');
    setSubmissionDeadline('');
  };

  // Auto-set semester when subject is selected
  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    const subj = subjects.find((s) => s.id === id);
    if (subj) setSemester(String(subj.semester));
  };

  // Auto-set deadline when exam date changes (3 days before)
  const handleExamDateChange = (date: string) => {
    setExamDate(date);
    if (date) {
      const d = new Date(date);
      d.setDate(d.getDate() - 3);
      setSubmissionDeadline(d.toISOString().split('T')[0]);
    }
  };

  const canSubmit = subjectId && examType && semester && examDate && submissionDeadline;

  const handleCreate = async () => {
    if (!canSubmit || !examType) return;
    setIsSubmitting(true);
    const success = await createSession({
      subjectId,
      examType: examType as ExamType,
      semester: parseInt(semester),
      examDate: new Date(examDate).toISOString(),
      submissionDeadline: new Date(submissionDeadline).toISOString(),
    });
    setIsSubmitting(false);
    if (success) {
      resetForm();
      setCreateOpen(false);
    }
  };

  const now = new Date();
  const activeSessions = sessions.filter((s) => s.status === 'active' && !isDatePast(s.examDate));
  const pastSessions = sessions.filter((s) => s.status !== 'active' || isDatePast(s.examDate));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exam Sessions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage department exam paper submission sessions
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Active Sessions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Active Sessions
            {activeSessions.length > 0 && (
              <Badge variant="secondary">{activeSessions.length}</Badge>
            )}
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No active sessions</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Create a new session to notify teachers about upcoming exams
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={deleteSession} />
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Past Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={deleteSession} isPastSession />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) resetForm(); setCreateOpen(v); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create Exam Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Course selection */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Course <span className="text-destructive">*</span>
              </Label>
              <Select value={subjectId} onValueChange={handleSubjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code}) – Sem {s.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exam type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Exam Type <span className="text-destructive">*</span>
              </Label>
              <Select value={examType} onValueChange={(v) => setExamType(v as ExamType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam type..." />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Semester (auto-filled) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Semester</Label>
              <Input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                type="number"
                min={1}
                max={8}
                placeholder="Auto-filled from course"
                className="bg-muted/50"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Exam Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => handleExamDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Submission Deadline <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  max={examDate}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit || isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create & Notify Teachers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function SessionCard({
  session,
  onDelete,
  isPastSession = false,
}: {
  session: import('@/hooks/useHODExamSessions').DepartmentExamSession;
  onDelete: (id: string) => Promise<boolean>;
  isPastSession?: boolean;
}) {
  const examLabel = session.examType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const deadlinePassed = isDatePast(session.submissionDeadline);
  const daysLeft = differenceInDays(session.submissionDeadline, new Date());
  const allSubmitted = session.totalTeachers > 0 && session.submittedCount >= session.totalTeachers;

  return (
    <div
      className={`rounded-xl border p-5 space-y-3 transition-all ${
        isPastSession ? 'bg-muted/30 opacity-70' : 'bg-card hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground leading-tight">{session.subjectName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.subjectCode} · Sem {session.semester}
          </p>
        </div>
        <Badge variant={isPastSession ? 'secondary' : 'default'} className="text-xs">
          {examLabel}
        </Badge>
      </div>

      {/* Dates */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Exam: {format(session.examDate, 'dd MMM yyyy')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={deadlinePassed ? 'text-destructive' : daysLeft <= 2 ? 'text-warning font-medium' : 'text-muted-foreground'}>
            Deadline: {format(session.submissionDeadline, 'dd MMM yyyy')}
            {!deadlinePassed && daysLeft >= 0 && (
              <span className="ml-1">({daysLeft}d left)</span>
            )}
          </span>
        </div>
      </div>

      {/* Submission status */}
      <div className="flex items-center gap-2 text-sm">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          {session.submittedCount}/{session.totalTeachers} submitted
        </span>
        {allSubmitted ? (
          <CheckCircle className="h-4 w-4 text-success ml-auto" />
        ) : session.totalTeachers > 0 ? (
          <AlertCircle className="h-4 w-4 text-warning ml-auto" />
        ) : null}
      </div>

      {/* Progress bar */}
      {session.totalTeachers > 0 && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${allSubmitted ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, (session.submittedCount / session.totalTeachers) * 100)}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {!isPastSession && (
        <div className="pt-1 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-8 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the exam session for {session.subjectName}. Teachers will no longer see it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(session.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function isDatePast(date: Date): boolean {
  return date.getTime() < Date.now();
}
