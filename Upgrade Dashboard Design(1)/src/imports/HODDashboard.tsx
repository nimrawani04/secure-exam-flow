import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useHODPapers } from '@/hooks/useHODPapers';
import { useHODPaperRequests, type PaperRequest } from '@/hooks/useHODPaperRequests';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Send,
  ArrowUpDown,
  ChevronRight,
  Inbox,
  FileText,
  GraduationCap,
  CalendarClock,
} from 'lucide-react';

/* ─────────────────── Constants ─────────────────── */

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeSpring = { type: 'spring' as const, stiffness: 420, damping: 42 };

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

/* ────── AnimatedNumber ────── */

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.8,
      ease: easeOut,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
}

/* ────── PulseDot ────── */

function PulseDot({ tone }: { tone: 'warning' | 'destructive' | 'success' }) {
  const colors: Record<string, string> = {
    warning: 'bg-amber-500',
    destructive: 'bg-rose-500',
    success: 'bg-emerald-500',
  };
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors[tone]} opacity-60`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colors[tone]}`} />
    </span>
  );
}

/* ────── StatTile ────── */

interface StatTileProps {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone: 'amber' | 'emerald' | 'rose' | 'violet';
}

const statConfig: Record<
  StatTileProps['tone'],
  { border: string; bg: string; iconBg: string; iconColor: string; dot: string }
> = {
  amber: {
    border: 'border-amber-200/60',
    bg: 'from-amber-50/80 to-amber-50/20',
    iconBg: 'bg-amber-100/80',
    iconColor: 'text-amber-600',
    dot: 'bg-amber-400',
  },
  emerald: {
    border: 'border-emerald-200/60',
    bg: 'from-emerald-50/80 to-emerald-50/20',
    iconBg: 'bg-emerald-100/80',
    iconColor: 'text-emerald-600',
    dot: 'bg-emerald-400',
  },
  rose: {
    border: 'border-rose-200/60',
    bg: 'from-rose-50/80 to-rose-50/20',
    iconBg: 'bg-rose-100/80',
    iconColor: 'text-rose-600',
    dot: 'bg-rose-400',
  },
  violet: {
    border: 'border-violet-200/60',
    bg: 'from-violet-50/80 to-violet-50/20',
    iconBg: 'bg-violet-100/80',
    iconColor: 'text-violet-600',
    dot: 'bg-violet-400',
  },
};

function StatTile({ label, value, hint, icon: Icon, tone }: StatTileProps) {
  const cfg = statConfig[tone];
  return (
    <motion.div
      variants={itemVariants}
      className={`group relative overflow-hidden rounded-2xl border ${cfg.border} bg-gradient-to-b ${cfg.bg} p-5 backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full ${cfg.iconBg} opacity-40 blur-xl transition-opacity duration-500 group-hover:opacity-70`}
      />
      <div className="relative flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.iconBg} ring-1 ring-inset ring-black/5`}>
          <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
        </div>
      </div>
      <div className="relative mt-5">
        <p className="font-mono text-[2rem] font-semibold tabular-nums leading-none tracking-tight text-foreground">
          <AnimatedNumber value={value} />
        </p>
        <p className="mt-1.5 text-[13px] font-medium text-foreground/80">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </motion.div>
  );
}

/* ────── Empty State ────── */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-inset ring-border/40">
        <Icon className="h-6 w-6 text-muted-foreground/70" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/* ────── Loading Skeletons ────── */

function PaperSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="flex animate-pulse items-center gap-4 border-b border-border/40 px-5 py-4 last:border-b-0"
        >
          <div className="h-9 w-9 shrink-0 rounded-lg bg-muted/70" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-44 rounded-md bg-muted/70" />
            <div className="h-2.5 w-28 rounded-md bg-muted/50" />
          </div>
          <div className="h-4 w-4 rounded bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Main Component ─────────────────── */

export function HODDashboard() {
  const { profile } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const { papers, isLoading: isLoadingPapers, error, selectPaper } = useHODPapers();
  const { requests: paperRequests, acknowledgeRequest } = useHODPaperRequests();
  const [departmentName, setDepartmentName] = useState<string>('your department');
  const [sortBy, setSortBy] = useState<'deadline' | 'subject' | 'status'>('deadline');
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'selected'>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [replacementDialog, setReplacementDialog] = useState<PaperRequest | null>(null);
  const [replacementSort, setReplacementSort] = useState<'newest' | 'version' | 'set'>('newest');
  const [sendingReplacementId, setSendingReplacementId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [approving, setApproving] = useState(false);

/* ─── Preview ─── */

const handlePreviewPaper = async (filePath: string | null, title: string) => {
    if (!filePath) {
      toast.error('No file available for this paper');
      return;
    }
    const { data, error: urlError } = await supabase.storage
      .from('exam-papers')
      .createSignedUrl(filePath, 60 * 10);
    if (urlError || !data?.signedUrl) {
      toast.error('Could not generate preview');
      return;
    }
    setPreviewTitle(title);
    setPreviewUrl(data.signedUrl);
    setPreviewOpen(true);
  };

/* ─── Department name ─── */

useEffect(() => {
    const fetchDepartment = async () => {
      if (profile?.department_id) {
        const { data } = await supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id)
          .single();

if (data) setDepartmentName(data.name);
      }
    };
    fetchDepartment();
  }, [profile?.department_id]);

/* ─── Derive data ─── */

const papersForReview = useMemo(
    () => papers.filter((paper) => paper.status === 'pending_review'),
    [papers],
  );

const subjectsNeedingReview = useMemo(() => {
    const subjectMap = new Map<
      string,
      { id: string; name: string; papersCount: number; deadline: Date }
    >();
    papersForReview.forEach((paper) => {
      const existing = subjectMap.get(paper.subjectId);
      if (!existing) {
        subjectMap.set(paper.subjectId, {
          id: paper.subjectId,
          name: paper.subjectName,
          papersCount: 1,
          deadline: paper.deadline,
        });
      } else {
        existing.papersCount += 1;
        if (paper.deadline.getTime() < existing.deadline.getTime()) {
          existing.deadline = paper.deadline;
        }
      }
    });
    return Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [papersForReview]);

/* ─── Auto-select first subject ─── */

useEffect(() => {
    if (selectedSubject) return;
    if (subjectsNeedingReview.length > 0) {
      setSelectedSubject(subjectsNeedingReview[0].id);
    }
  }, [selectedSubject, subjectsNeedingReview]);

/* ─── Helpers ─── */

const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(selectedPaperId === paperId ? null : paperId);
  };

const isNearDeadline = (date: Date) => {
    const diffDays = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  };

const formatDueDate = (date: Date) =>
    date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

/* ─── Filter & sort ─── */

const visiblePapers = papersForReview
    .filter((paper) => (selectedSubject ? paper.subjectId === selectedSubject : true))
    .filter((paper) => {
      if (filterBy === 'pending') return paper.status === 'pending_review';
      if (filterBy === 'selected') return paper.id === selectedPaperId;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'subject') return a.subjectName.localeCompare(b.subjectName);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return a.deadline.getTime() - b.deadline.getTime();
    });

/* ─── Counts ─── */

const pendingReviewCount = papers.filter((p) => p.status === 'pending_review').length;
  const approvedCount = papers.filter((p) => p.status === 'approved').length;
  const rejectedCount = papers.filter((p) => p.status === 'rejected').length;
  const lockedCount = papers.filter((p) => p.status === 'locked').length;
  const selectedPaper = papersForReview.find((p) => p.id === selectedPaperId);

/* ─── Approve & lock ─── */

const handleApproveAndLock = async () => {
    if (!selectedPaper) return;
    setApproving(true);
    const success = await selectPaper(selectedPaper.id, selectedPaper.subjectId, selectedPaper.examType);
    setApproving(false);
    if (success) setSelectedPaperId(null);
  };

/* ─── Acknowledge request ─── */

const handleAcknowledgeRequest = async (req: PaperRequest) => {
    setAcknowledgingId(req.id);
    const success = await acknowledgeRequest(req.id);
    setAcknowledgingId(null);
    if (success) setReplacementDialog(req);
  };

/* ─── Send replacement ─── */

const handleSendReplacement = async (paperId: string, subjectId: string, examType: string, reason: string) => {
    setSendingReplacementId(paperId);
    const success = await selectPaper(
      paperId,
      subjectId,
      examType,
      `Replacement for paper request: ${reason}`,
    );
    setSendingReplacementId(null);
    if (success) setReplacementDialog(null);
  };

/* ─────────────────── Render ─────────────────── */

return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-0"
    >
      {/* ── Header ── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-5 border-b border-border/50 pb-7 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {departmentName}
          </div>
          <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.25rem]">
            Paper review
          </h1>
          <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">
            {papersForReview.length > 0
              ? `${papersForReview.length} submission${papersForReview.length === 1 ? '' : 's'} waiting on your decision across ${subjectsNeedingReview.length} subject${subjectsNeedingReview.length === 1 ? '' : 's'}.`
              : 'Every submission has been reviewed. New papers will land here automatically.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-border/40 bg-card/60 px-4 py-2.5 text-[12px] text-muted-foreground backdrop-blur-sm">
          <PulseDot tone={pendingReviewCount > 0 ? 'warning' : 'success'} />
          {pendingReviewCount > 0
            ? `${pendingReviewCount} awaiting review`
            : 'All caught up'}
        </div>
      </motion.div>

      {/* ── Stat Tiles ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Pending review"
          value={pendingReviewCount}
          hint="Awaiting your selection"
          icon={Clock}
          tone="amber"
        />
        <StatTile
          label="Approved"
          value={approvedCount}
          icon={CheckCircle}
          tone="emerald"
        />
        <StatTile
          label="Rejected"
          value={rejectedCount}
          icon={XCircle}
          tone="rose"
        />
        <StatTile
          label="Locked"
          value={lockedCount}
          hint="Ready for exam"
          icon={Lock}
          tone="violet"
        />
      </div>

{/* ── Anonymous Review Banner ── */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3 rounded-xl border border-violet-200/60 bg-violet-50/60 px-4 py-3.5 backdrop-blur-sm"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100/80">
          <Eye className="h-4 w-4 text-violet-600" />
        </div>
        <p className="text-[13px] leading-relaxed text-violet-800/80">
          <span className="font-semibold text-violet-900">Anonymous review is on.</span>{' '}
          Teacher identities are hidden — submissions are labeled Submission 1, Submission 2, and so on.
        </p>
      </motion.div>

{/* ── Main Content Grid ── */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Subject Sidebar ── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Subjects</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {subjectsNeedingReview.length} need a decision
              </p>
            </div>
            {subjectsNeedingReview.length > 0 && (
              <span className="rounded-full bg-muted/60 px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                {subjectsNeedingReview.length}
              </span>
            )}
          </div>

{error ? (
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 p-4 text-[13px] text-rose-700">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : subjectsNeedingReview.length > 0 ? (
            <nav className="-mx-1 space-y-0.5">
              {subjectsNeedingReview.map((subject) => (
                <SubjectNavItem
                  key={subject.id}
                  subject={subject}
                  active={selectedSubject === subject.id}
                  onClick={() => setSelectedSubject(subject.id)}
                />
              ))}
            </nav>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No subjects pending"
              description="All subjects have been reviewed. New submissions will appear here automatically."
            />
          )}
        </aside>

{/* ── Content Area ── */}
        <div className="min-w-0 space-y-6">
          {/* ── Papers Section ── */}
          <section className="space-y-4">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Pending papers</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {papersForReview.length}{' '}
                  {papersForReview.length === 1 ? 'paper requires' : 'papers require'} selection
                </p>
              </div>

<div className="flex flex-wrap items-center gap-2">
                {/* Filter Pills */}
                <div className="inline-flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5">
                  {(['all', 'pending', 'selected'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterBy(f)}
                      className={`relative rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-all duration-200 \${
                        filterBy === f
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {filterBy === f && (
                        <motion.span
                          layoutId="filter-pill"
                          className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-inset ring-border/30"
                          transition={easeSpring}
                        />
                      )}
                      <span className="relative">{f}</span>
                    </button>
                  ))}
                </div>

{/* Sort Select */}
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as typeof sortBy)}
                >
                  <SelectTrigger className="h-8 w-40 rounded-lg border-border/40 text-[12px]">
                    <ArrowUpDown className="mr-1.5 h-3 w-3" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deadline">Nearest deadline</SelectItem>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

{/* Papers List */}
            {isLoadingPapers ? (
              <PaperSkeletons count={3} />
            ) : visiblePapers.length === 0 ? (
              <EmptyState
                icon={FileCheck}
                title="No pending papers"
                description="You are all caught up. New submissions will appear here for your review."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm">
                <AnimatePresence initial={false}>
                  {visiblePapers.map((paper) => (
                    <PaperRow
                      key={paper.id}
                      paper={paper}
                      selected={selectedPaperId === paper.id}
                      onClick={() => handleSelectPaper(paper.id)}
                      onPreview={() =>
                        handlePreviewPaper(
                          paper.filePath,
                          `${paper.subjectName} - ${paper.anonymousId}`,
                        )
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

{/* ── Approve & Lock Action Bar ── */}
          <AnimatePresence>
            {selectedPaperId && selectedPaper && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 8, height: 0 }}
                transition={{ duration: 0.3, ease: easeOut }}
                className="flex flex-col gap-3 overflow-hidden rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedPaper.anonymousId} selected
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      For {selectedPaper.subjectName} · Due{' '}
                      {formatDueDate(selectedPaper.deadline)}
                    </p>
                  </div>
                </div>

<div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={approving}
                    onClick={handleApproveAndLock}
                  >
                    {approving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    Approve &amp; lock
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setSelectedPaperId(null)}
                  >
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

{/* ── Replacement Requests Section ── */}
          {paperRequests.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100/80">
                  <Inbox className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Requests from Exam Cell
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    {paperRequests.length} replacement request
                    {paperRequests.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

<div className="space-y-3">
                {paperRequests.map((req) => {
                  const barTone =
                    req.urgency === 'critical'
                      ? 'bg-rose-500'
                      : req.urgency === 'urgent'
                        ? 'bg-amber-500'
                        : 'bg-border';
                  const badgeStyle =
                    req.urgency === 'critical'
                      ? 'bg-rose-50 text-rose-700 ring-rose-200/60'
                      : req.urgency === 'urgent'
                        ? 'bg-amber-50 text-amber-700 ring-amber-200/60'
                        : 'bg-muted text-muted-foreground ring-border/40';
                  const examTypeLabel = req.examType
                    .replace('_', ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase());

return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm transition-shadow hover:shadow-md"
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-1 rounded-r-full ${barTone}`}
                      />
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {req.urgency === 'critical' && (
                              <PulseDot tone="destructive" />
                            )}
                            <h3 className="font-semibold text-foreground">
                              {req.subjectName}
                            </h3>
                            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {req.subjectCode}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset ${badgeStyle}`}
                            >
                              {req.urgency}
                            </span>
                          </div>
                          <p className="text-[13px] text-muted-foreground">
                            {examTypeLabel} ·{' '}
                            <span className="text-foreground/80">{req.reason}</span>
                          </p>
                          <div className="rounded-lg border border-border/40 bg-muted/30 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground/75">
                            {req.remarks}
                          </div>
                          <p className="text-[11px] text-muted-foreground/70">
                            Requested{' '}
                            {req.createdAt.toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                            {' · '}
                            {req.createdAt.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 gap-2 rounded-lg"
                          disabled={acknowledgingId === req.id}
                          onClick={() => handleAcknowledgeRequest(req)}
                        >
                          {acknowledgingId === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Acknowledge &amp; select replacement
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

{/* ── Lock Warning ── */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-[13px] leading-relaxed text-amber-800/80">
              <span className="font-semibold text-amber-900">Locking is final.</span>{' '}
              Once a paper is approved and locked, it's forwarded to the Examination Cell
              and every other submission for that subject is automatically rejected.
            </p>
          </div>
        </div>
      </motion.div>

{/* ─────────────────── Replacement Dialog ─────────────────── */}
      <Dialog
        open={!!replacementDialog}
        onOpenChange={(open) => !open && setReplacementDialog(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100/80">
                <Send className="h-4 w-4 text-violet-600" />
              </div>
              <span>Select replacement paper</span>
            </DialogTitle>
            <DialogDescription className="mt-2">
              Choose an approved paper for{' '}
              <strong>{replacementDialog?.subjectName}</strong> (
              {replacementDialog?.subjectCode}) to replace the compromised paper.
            </DialogDescription>
          </DialogHeader>

{replacementDialog &&
            (() => {
              const coursePapers = papers
                .filter(
                  (p) =>
                    p.subjectId === replacementDialog.subjectId &&
                    (p.status === 'approved' || p.status === 'pending_review'),
                )
                .sort((a, b) => {
                  if (replacementSort === 'version')
                    return b.version - a.version;
                  if (replacementSort === 'set')
                    return a.setName.localeCompare(b.setName);
                  return b.uploadedAt.getTime() - a.uploadedAt.getTime();
                });

return (
                <div className="space-y-5">
                  {/* Sort & Count */}
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-muted-foreground">
                      {coursePapers.length} paper
                      {coursePapers.length !== 1 ? 's' : ''} available
                    </p>
                    <Select
                      value={replacementSort}
                      onValueChange={(v) =>
                        setReplacementSort(v as typeof replacementSort)
                      }
                    >
                      <SelectTrigger className="w-40 rounded-lg text-[12px]">
                        <ArrowUpDown className="mr-1.5 h-3 w-3" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="version">
                          Version (high→low)
                        </SelectItem>
                        <SelectItem value="set">Set name (A→Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

{coursePapers.length === 0 ? (
                    <EmptyState
                      icon={FileCheck}
                      title="No approved papers available"
                      description="No approved papers exist for this subject. Teachers may need to submit new papers first."
                    />
                  ) : (
                    <div className="space-y-2">
                      {coursePapers.map((paper) => (
                        <div
                          key={paper.id}
                          className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/40 p-4 transition-all duration-200 hover:border-border hover:bg-muted/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {paper.anonymousId}
                              </span>
                              <Badge variant="outline" className="text-[11px]">
                                Set {paper.setName}
                              </Badge>
                              <Badge
                                variant={paper.status === 'approved' ? 'default' : 'secondary'}
                                className={`text-[11px] ${
                                  paper.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                {paper.status === 'approved' ? 'Approved' : 'Pending review'}
                              </Badge>
                            </div>
                            <div className="mt-1.5 flex gap-3 text-[12px] text-muted-foreground">
                              <span className="font-mono">v{paper.version}</span>
                              <span>
                                Uploaded {paper.uploadedAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {paper.filePath && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 rounded-lg"
                                onClick={() =>
                                  handlePreviewPaper(
                                    paper.filePath,
                                    `${paper.subjectName} - ${paper.anonymousId}`,
                                  )
                                }
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Preview
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5 rounded-lg"
                              disabled={sendingReplacementId === paper.id}
                              onClick={() =>
                                handleSendReplacement(
                                  paper.id,
                                  paper.subjectId,
                                  paper.examType,
                                  replacementDialog.reason,
                                )
                              }
                            >
                              {sendingReplacementId === paper.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" />
                              )}
                              Select &amp; lock
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

{/* ─────────────────── Preview Dialog ─────────────────── */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOpen(false);
            setPreviewUrl('');
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/80">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <span>Preview: {previewTitle}</span>
            </DialogTitle>
            <DialogDescription>
              Signed URL expires in 10 minutes. Close and reopen to refresh.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20">
            <iframe
              src={previewUrl}
              title="PDF preview"
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ────── SubjectNavItem Sub-component ────── */

function SubjectNavItem({
  subject,
  active,
  onClick,
}: {
  subject: { id: string; name: string; papersCount: number; deadline: Date };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200 hover:bg-muted/60"
    >
      {active && (
        <motion.span
          layoutId="subject-pill"
          className="absolute inset-0 rounded-xl bg-accent/8 ring-1 ring-inset ring-accent/20"
          transition={easeSpring}
        />
      )}

<span className="relative flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
            active
              ? 'bg-accent/15 text-accent'
              : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-[13px] font-medium ${
              active ? 'text-accent' : 'text-foreground'
            }`}
          >
            {subject.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            Due{' '}
            {subject.deadline.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </span>
      </span>

<span
        className={`relative shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
          active ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        {subject.papersCount}
      </span>
    </button>
  );
}

/* ────── PaperRow Sub-component ────── */

function PaperRow({
  paper,
  selected,
  onClick,
  onPreview,
}: {
  paper: {
    id: string;
    subjectName: string;
    anonymousId: string;
    deadline: Date;
    filePath: string | null;
  };
  selected: boolean;
  onClick: () => void;
  onPreview: () => void;
}) {
  const diffMs = paper.deadline.getTime() - Date.now();
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dueSoon = remainingDays <= 3;

return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex cursor-pointer items-center justify-between gap-4 border-b border-border/40 px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/30 ${
        selected ? 'bg-accent/[0.03]' : 'bg-transparent'
      }`}
    >
      {selected && (
        <motion.span
          layoutId="paper-bar"
          className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-accent"
          transition={easeSpring}
        />
      )}

<div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selected
              ? 'bg-accent/10 text-accent'
              : 'bg-muted/40 text-muted-foreground group-hover:bg-muted'
          }`}
        >
          <FileText className="h-4 w-4" />
        </div>

<div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {paper.subjectName}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
              {paper.anonymousId}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Due{' '}
              {paper.deadline.toLocaleDateString(undefined, {
                day: '2-digit',
                month: 'short',
              })}
            </span>
            {dueSoon && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/60">
                <span className="h-1 w-1 rounded-full bg-amber-500" />
                {remainingDays <= 0 ? 'Overdue' : `${remainingDays}d left`}
              </span>
            )}
          </div>
        </div>
      </div>

<div className="flex shrink-0 items-center gap-1">
        {paper.filePath && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg opacity-0 transition-all duration-200 group-hover:opacity-100"
            title="Preview paper"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${
            selected
              ? 'rotate-90 text-accent'
              : 'group-hover:text-muted-foreground'
          }`}
        />
      </div>
    </motion.div>
  );
}
