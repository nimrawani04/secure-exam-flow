import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { Button } from '@/components/ui/button';
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
import { format, differenceInDays } from 'date-fns';
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

const PRIMARY_GRADIENT = 'linear-gradient(135deg,#0fa88f,#0d7a6b)';

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
    } as CreateSessionInput);
    setIsSubmitting(false);
    if (success) {
      resetForm();
      setCreateOpen(false);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active' && !isDatePast(s.examDate));
  const pastSessions = sessions.filter((s) => s.status !== 'active' || isDatePast(s.examDate));

  return (
    <DashboardLayout>
      <HodPageShell
        eyebrow="HOD · Sessions"
        title={<>Exam <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Sessions</em></>}
        description="Create and manage department exam paper submission sessions"
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-2 rounded-[9px] border-0 text-[13px] font-medium text-white"
            style={{ background: PRIMARY_GRADIENT }}
          >
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        }
      >
        <div className="space-y-8">

        {/* Active Sessions */}
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                Now collecting
              </p>
              <h2 className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                <Calendar className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                Active sessions
              </h2>
              <p className="mt-0.5 text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                Teachers can submit papers for these exams.
              </p>
            </div>
            <span className="mt-1 shrink-0 rounded-full border border-[#e8e2da] bg-white px-2 py-0.5 font-mono text-[11px] text-[#64748b] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#6b8299]">
              {activeSessions.length}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[#e8e2da] bg-white py-12 dark:border-[#1c2d3d] dark:bg-[#101820]">
              <Loader2 className="h-5 w-5 animate-spin text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span className="text-[13px] text-[#64748b] dark:text-[#6b8299]">Loading sessions…</span>
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#e8e2da] bg-white p-8 text-center dark:border-[#1c2d3d] dark:bg-[#101820]">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#0d7a6b]/15 bg-[#eaf6f4] text-[#0d7a6b] dark:border-[rgba(45,212,191,0.2)] dark:bg-[rgba(45,212,191,0.08)] dark:text-[#2dd4bf]">
                <Calendar className="h-4 w-4" />
              </div>
              <p className="mt-3 text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">No active sessions</p>
              <p className="mt-1 text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                Create a new session to notify teachers about upcoming exams.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={deleteSession} />
              ))}
            </div>
          )}
        </section>

        {/* Past Sessions */}
        {(pastSessions.length > 0 || (!isLoading && activeSessions.length > 0)) && pastSessions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  Archive
                </p>
                <h2 className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                  <Clock className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
                  Past
                </h2>
                <p className="mt-0.5 text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                  Prior sessions kept for reference.
                </p>
              </div>
              <span className="mt-1 shrink-0 rounded-full border border-[#e8e2da] bg-white px-2 py-0.5 font-mono text-[11px] text-[#64748b] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#6b8299]">
                {pastSessions.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={deleteSession} isPastSession />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) resetForm(); setCreateOpen(v); }}>
        <DialogContent className="rounded-[14px] border-[#e8e2da] bg-white sm:max-w-lg dark:border-[#1c2d3d] dark:bg-[#101820]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#0d7a6b]/15 bg-[#eaf6f4] text-[#0d7a6b] dark:border-[rgba(45,212,191,0.2)] dark:bg-[rgba(45,212,191,0.08)] dark:text-[#2dd4bf]">
                <Plus className="h-4 w-4" />
              </span>
              Create Exam Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Course selection */}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[#64748b] dark:text-[#6b8299]">
                Course <span className="text-rose-500">*</span>
              </Label>
              <Select value={subjectId} onValueChange={handleSubjectChange}>
                <SelectTrigger className="h-10 rounded-lg border-[#e8e2da] bg-white text-[13px] text-[#18202e] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#e2eaf4]">
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent className="rounded-[14px] border-[#e8e2da] bg-white dark:border-[#1c2d3d] dark:bg-[#101820]">
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
              <Label className="text-[12px] font-medium text-[#64748b] dark:text-[#6b8299]">
                Exam Type <span className="text-rose-500">*</span>
              </Label>
              <Select value={examType} onValueChange={(v) => setExamType(v as ExamType)}>
                <SelectTrigger className="h-10 rounded-lg border-[#e8e2da] bg-white text-[13px] text-[#18202e] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#e2eaf4]">
                  <SelectValue placeholder="Select exam type..." />
                </SelectTrigger>
                <SelectContent className="rounded-[14px] border-[#e8e2da] bg-white dark:border-[#1c2d3d] dark:bg-[#101820]">
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
              <Label className="text-[12px] font-medium text-[#64748b] dark:text-[#6b8299]">Semester</Label>
              <Input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                type="number"
                min={1}
                max={8}
                placeholder="Auto-filled from course"
                className="h-10 rounded-lg border-[#e8e2da] bg-white text-[13px] text-[#18202e] placeholder:text-[#a0aec0] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#e2eaf4]"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-[#64748b] dark:text-[#6b8299]">
                  Exam Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => handleExamDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-10 rounded-lg border-[#e8e2da] bg-white font-mono text-[13px] text-[#18202e] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#e2eaf4]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-[#64748b] dark:text-[#6b8299]">
                  Submission Deadline <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  max={examDate}
                  className="h-10 rounded-lg border-[#e8e2da] bg-white font-mono text-[13px] text-[#18202e] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#e2eaf4]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleCreate}
              disabled={!canSubmit || isSubmitting}
              className="h-9 gap-2 rounded-[9px] border-0 text-[13px] font-medium text-white disabled:opacity-60"
              style={{ background: PRIMARY_GRADIENT }}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create &amp; Notify Teachers
            </Button>
            <Button
              variant="outline"
              onClick={() => { resetForm(); setCreateOpen(false); }}
              className="h-9 rounded-[9px] border-[#e8e2da] bg-white text-[13px] text-[#64748b] hover:bg-[#ede9e2] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#6b8299] dark:hover:bg-[#131c27]"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </HodPageShell>
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
  const showUrgent = !isPastSession && (deadlinePassed || (daysLeft >= 0 && daysLeft <= 3));
  const allSubmitted = session.totalTeachers > 0 && session.submittedCount >= session.totalTeachers;

  return (
    <div
      className={`rounded-[14px] border border-[#e8e2da] bg-white p-4 transition-colors dark:border-[#1c2d3d] dark:bg-[#101820] ${
        isPastSession ? 'opacity-75' : 'hover:bg-[#ede9e2]/30 dark:hover:bg-[#131c27]/50'
      }`}
    >
      {/* Header: icon tile + subject + status/delete */}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${
            isPastSession
              ? 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-[#0d7a6b]/15 bg-[#eaf6f4] text-[#0d7a6b] dark:border-[rgba(45,212,191,0.2)] dark:bg-[rgba(45,212,191,0.08)] dark:text-[#2dd4bf]'
          }`}
        >
          {isPastSession ? <Clock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-tight text-[#18202e] dark:text-[#e2eaf4]">
            {session.subjectName}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
            {session.subjectCode} · Sem {session.semester}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isPastSession ? (
            <span className="rounded-full border border-[#e8e2da] bg-[#ede9e2]/60 px-2 py-0.5 text-[11px] font-medium text-[#64748b] dark:border-[#1c2d3d] dark:bg-[#131c27] dark:text-[#6b8299]">
              Past
            </span>
          ) : (
            <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Active
            </span>
          )}
          {!isPastSession && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label={`Delete ${session.subjectName}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0aec0] transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-[#3d5166] dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[14px] border-[#e8e2da] bg-white dark:border-[#1c2d3d] dark:bg-[#101820]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                    Delete this session?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                    This will remove the exam session for {session.subjectName}. Teachers will no longer see it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-[9px] border-[#e8e2da] bg-white text-[13px] text-[#64748b] hover:bg-[#ede9e2] dark:border-[#1c2d3d] dark:bg-[#101820] dark:text-[#6b8299] dark:hover:bg-[#131c27]">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(session.id)}
                    className="rounded-[9px] bg-rose-600 text-[13px] text-white hover:bg-rose-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Meta pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-[6px] border border-[#0d7a6b]/15 bg-[#eaf6f4] px-1.5 py-0.5 font-mono text-[11px] text-[#0d7a6b] dark:border-[rgba(45,212,191,0.2)] dark:bg-[rgba(45,212,191,0.08)] dark:text-[#2dd4bf]">
          {examLabel}
        </span>
        <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
          Sem {session.semester}
        </span>
        {showUrgent && (
          <span className="rounded-full border border-amber-200/70 bg-amber-50 px-1.5 py-px font-mono text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {deadlinePassed ? 'Overdue' : `${daysLeft}d left`}
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="mt-2.5 space-y-1.5 border-t border-[#e8e2da]/70 pt-2.5 text-[12px] dark:border-[#1c2d3d]/70">
        <div className="flex items-center gap-1.5 text-[#64748b] dark:text-[#6b8299]">
          <Calendar className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
          <span>Exam: <span className="font-mono">{format(session.examDate, 'dd MMM yyyy')}</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748b] dark:text-[#6b8299]">
          <Clock className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
          <span>
            Deadline: <span className={`font-mono ${deadlinePassed ? 'text-rose-600 dark:text-rose-400' : daysLeft <= 3 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{format(session.submissionDeadline, 'dd MMM yyyy')}</span>
          </span>
        </div>
      </div>

      {/* Submission status */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[#64748b] dark:text-[#6b8299]">
        <Users className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
        <span>
          <span className="font-mono">{session.submittedCount}/{session.totalTeachers}</span> submitted
        </span>
        {allSubmitted ? (
          <CheckCircle className="ml-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : session.totalTeachers > 0 ? (
          <AlertCircle className="ml-auto h-4 w-4 text-amber-500" />
        ) : null}
      </div>

      {/* Progress bar */}
      {session.totalTeachers > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ede9e2] dark:bg-[#131c27]">
          <div
            className={`h-full rounded-full transition-all ${allSubmitted ? 'bg-emerald-500' : ''}`}
            style={
              allSubmitted
                ? { width: `${Math.min(100, (session.submittedCount / session.totalTeachers) * 100)}%` }
                : { width: `${Math.min(100, (session.submittedCount / session.totalTeachers) * 100)}%`, background: PRIMARY_GRADIENT }
            }
          />
        </div>
      )}
    </div>
  );
}

function isDatePast(date: Date): boolean {
  return date.getTime() < Date.now();
}
