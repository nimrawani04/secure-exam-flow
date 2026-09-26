import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useHODPapers } from '@/hooks/useHODPapers';
import { useHODPaperRequests, type PaperRequest } from '@/hooks/useHODPaperRequests';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle,
  Eye,
  Lock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ArrowUpDown,
  FileCheck,
} from 'lucide-react';

/* ── helpers ── */
function daysLeft(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 864e5);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function fmtDateLong(d: Date) {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
function shortName(full?: string | null) {
  if (!full) return 'there';
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 2) return full;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/* ── Pulse dot (Figma: 7px + ping 1.6s) ── */
function Pulse({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-[7px] w-[7px] shrink-0">
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: color, animationDuration: '1.6s' }}
      />
      <span className="relative h-[7px] w-[7px] rounded-full" style={{ background: color }} />
    </span>
  );
}

/* ── Animated counter (Figma countUp) ── */
function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const [ran, setRan] = useState(false);
  useEffect(() => {
    if (ran) return;
    if (to <= 0) {
      setN(0);
      return;
    }
    setRan(true);
    let v = 0;
    const step = Math.max(1, Math.ceil(to / 18));
    const id = setInterval(() => {
      v = Math.min(v + step, to);
      setN(v);
      if (v >= to) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  useEffect(() => {
    if (ran) setN(to);
  }, [to, ran]);
  return <>{n}</>;
}

/* ── Stat strip: single panel, 4 cells, 2px top accent ── */
function StatRow({
  pending,
  approved,
  rejected,
  locked,
}: {
  pending: number;
  approved: number;
  rejected: number;
  locked: number;
}) {
  const stats = [
    {
      label: 'Pending review',
      value: pending,
      color: 'text-[#92400e] dark:text-[#fbbf24]',
      line: 'bg-[#f59e0b]',
      soft: 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)]',
      hint: 'Awaiting selection',
    },
    {
      label: 'Approved',
      value: approved,
      color: 'text-[#065f46] dark:text-[#34d399]',
      line: 'bg-[#10b981]',
      soft: 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)]',
    },
    {
      label: 'Rejected',
      value: rejected,
      color: 'text-[#9f1239] dark:text-[#fb7185]',
      line: 'bg-[#f43f5e]',
      soft: 'bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)]',
    },
    {
      label: 'Locked & sent',
      value: locked,
      color: 'text-[#5b21b6] dark:text-[#a78bfa]',
      line: 'bg-[#8b5cf6]',
      soft: 'bg-[#f5f3ff] dark:bg-[rgba(167,139,250,0.08)]',
      hint: 'Sent to exam cell',
    },
  ];
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden mb-7">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`relative overflow-hidden px-6 pt-5 pb-[22px] ${
            i < 2 ? 'border-b xl:border-b-0' : ''
          } ${i % 2 === 0 ? 'border-r' : 'xl:border-r'} ${
            i < 3 ? 'xl:border-r' : ''
          } border-[#e8e2da] dark:border-[#1c2d3d] ${i === 3 ? 'border-r-0' : ''}`}
        >
          <div className={`absolute top-0 left-6 right-6 h-[2px] rounded-b-[3px] opacity-70 ${s.line}`} />
          <div className={`absolute -top-5 -right-2.5 w-20 h-20 rounded-full blur-[20px] pointer-events-none ${s.soft}`} />
          <p className="text-[10.5px] font-semibold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.08em] uppercase mb-3">
            {s.label}
          </p>
          <p className={`font-mono text-[46px] font-normal leading-none tracking-[-0.04em] ${s.color}`}>
            <Counter to={s.value} />
          </p>
          {s.hint && <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-2">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Subject nav (Figma: 210px panel, left teal bar) ── */
function SubjectNav({
  subjects,
  active,
  onSelect,
}: {
  subjects: { id: string; name: string; code: string; count: number; deadline: Date }[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden lg:sticky lg:top-20 self-start">
      <div className="px-4 py-3 border-b border-[#e8e2da] dark:border-[#1c2d3d]">
        <p className="text-[10px] font-bold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.09em] uppercase">
          Subjects
        </p>
      </div>
      {subjects.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No subjects pending.</p>
      ) : (
        subjects.map((s, i) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full text-left px-4 py-[11px] relative transition-colors hover:bg-[#ede9e2] dark:hover:bg-[#131c27] ${
                i < subjects.length - 1 ? 'border-b border-[#e8e2da] dark:border-[#1c2d3d]' : ''
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[#0d7a6b] dark:bg-[#2dd4bf] rounded-r-[2px]" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-[12.5px] leading-[1.35] mb-[3px] truncate ${
                      isActive
                        ? 'font-medium text-[#0d7a6b] dark:text-[#2dd4bf]'
                        : 'font-normal text-[#18202e] dark:text-[#e2eaf4]'
                    }`}
                  >
                    {s.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-[#a0aec0] dark:text-[#3d5166]">{s.code}</span>
                    {daysLeft(s.deadline) <= 3 && (
                      <span className="text-[10px] text-[#92400e] dark:text-[#fbbf24] font-semibold">· Due soon</span>
                    )}
                  </div>
                </div>
                <span
                  className={`font-mono text-[10.5px] font-medium shrink-0 px-[7px] py-[2px] rounded-full mt-[1px] ${
                    isActive
                      ? 'bg-[rgba(13,122,107,0.10)] dark:bg-[rgba(45,212,191,0.14)] text-[#0d7a6b] dark:text-[#2dd4bf]'
                      : 'bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299]'
                  }`}
                >
                  {s.count}
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

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

  const handlePreviewPaper = async (filePath: string | null, title: string) => {
    if (!filePath) {
      toast.error('No file available for this paper');
      return;
    }
    const { data, error: urlError } = await supabase.storage.from('exam-papers').createSignedUrl(filePath, 60 * 10);
    if (urlError || !data?.signedUrl) {
      toast.error('Could not generate preview');
      return;
    }
    setPreviewTitle(title);
    setPreviewUrl(data.signedUrl);
    setPreviewOpen(true);
  };

  useEffect(() => {
    const fetchDepartment = async () => {
      if (profile?.department_id) {
        const { data } = await supabase.from('departments').select('name').eq('id', profile.department_id).single();
        if (data) setDepartmentName(data.name);
      }
    };
    fetchDepartment();
  }, [profile?.department_id]);

  const papersForReview = useMemo(() => papers.filter((p) => p.status === 'pending_review'), [papers]);

  const subjectsNeedingReview = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; count: number; deadline: Date }>();
    papersForReview.forEach((paper) => {
      const ex = map.get(paper.subjectId);
      if (!ex) {
        map.set(paper.subjectId, {
          id: paper.subjectId,
          name: paper.subjectName,
          code: paper.subjectCode,
          count: 1,
          deadline: paper.deadline,
        });
      } else {
        ex.count += 1;
        if (paper.deadline.getTime() < ex.deadline.getTime()) ex.deadline = paper.deadline;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [papersForReview]);

  useEffect(() => {
    if (selectedSubject) return;
    if (subjectsNeedingReview.length > 0) setSelectedSubject(subjectsNeedingReview[0].id);
  }, [selectedSubject, subjectsNeedingReview]);

  // Keep selection valid when subject list changes
  useEffect(() => {
    if (selectedSubject && !subjectsNeedingReview.some((s) => s.id === selectedSubject)) {
      setSelectedSubject(subjectsNeedingReview[0]?.id ?? null);
      setSelectedPaperId(null);
    }
  }, [subjectsNeedingReview, selectedSubject]);

  const visiblePapers = useMemo(
    () =>
      papersForReview
        .filter((p) => (selectedSubject ? p.subjectId === selectedSubject : true))
        .filter((p) => {
          if (filterBy === 'pending') return p.status === 'pending_review';
          if (filterBy === 'selected') return p.id === selectedPaperId;
          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'subject') return a.subjectName.localeCompare(b.subjectName);
          if (sortBy === 'status') return a.status.localeCompare(b.status);
          return a.deadline.getTime() - b.deadline.getTime();
        }),
    [papersForReview, selectedSubject, filterBy, sortBy, selectedPaperId]
  );

  const pendingReviewCount = papers.filter((p) => p.status === 'pending_review').length;
  const approvedCount = papers.filter((p) => p.status === 'approved').length;
  const rejectedCount = papers.filter((p) => p.status === 'rejected').length;
  const lockedCount = papers.filter((p) => p.status === 'locked').length;
  const selectedPaper = papersForReview.find((p) => p.id === selectedPaperId);

  const handleApproveAndLock = async () => {
    if (!selectedPaper) return;
    setApproving(true);
    const success = await selectPaper(selectedPaper.id, selectedPaper.subjectId, selectedPaper.examType);
    setApproving(false);
    if (success) setSelectedPaperId(null);
  };

  const handleAcknowledgeRequest = async (req: PaperRequest) => {
    setAcknowledgingId(req.id);
    const success = await acknowledgeRequest(req.id);
    setAcknowledgingId(null);
    if (success) setReplacementDialog(req);
  };

  const handleSendReplacement = async (paperId: string, subjectId: string, examType: string, reason: string) => {
    setSendingReplacementId(paperId);
    const success = await selectPaper(paperId, subjectId, examType as never, `Replacement for paper request: ${reason}`);
    setSendingReplacementId(null);
    if (success) setReplacementDialog(null);
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-9 pb-16">
        {/* Heading — Fraunces serif */}
        <div className="mb-8">
          <p className="text-[11px] font-semibold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.08em] uppercase mb-2">
            Good {greeting()}, {shortName(profile?.full_name)}
          </p>
          <h1 className="font-serif italic font-light text-[34px] sm:text-[46px] leading-[1.1] tracking-[-0.025em] mb-[14px]">
            {pendingReviewCount > 0 ? (
              <>
                {pendingReviewCount} paper{pendingReviewCount !== 1 ? 's' : ''} need{' '}
                <em className="not-italic">your eye</em>
              </>
            ) : (
              <>
                All <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">caught up</em>.
              </>
            )}
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-[#e8e2da] dark:bg-[#1c2d3d]" />
            <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">
              {subjectsNeedingReview.length} subject{subjectsNeedingReview.length !== 1 ? 's' : ''} pending ·{' '}
              {departmentName}
            </p>
          </div>
        </div>

        <StatRow pending={pendingReviewCount} approved={approvedCount} rejected={rejectedCount} locked={lockedCount} />

        {/* Anonymous review — violet */}
        <div className="flex items-start gap-2.5 px-[14px] py-[11px] rounded-[10px] bg-[#f5f3ff] dark:bg-[rgba(167,139,250,0.08)] border border-[#8b5cf6]/25 mb-5">
          <span className="text-[#5b21b6] dark:text-[#a78bfa] leading-none mt-[1px] shrink-0">
            <Eye className="h-[14px] w-[14px]" />
          </span>
          <p className="text-[12.5px] leading-[1.65] text-[#64748b] dark:text-[#6b8299]">
            <strong className="text-[#18202e] dark:text-[#e2eaf4] font-semibold">Anonymous review is active.</strong>{' '}
            Teacher identities are hidden — submission labels only until after locking.
          </p>
        </div>

        {/* Replacement requests — rose critical cards */}
        {paperRequests.length > 0 && (
          <div className="space-y-3 mb-5">
            {paperRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-[12px] overflow-hidden border border-[#f43f5e]/30 bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] relative"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#f43f5e]" />
                <div className="pl-5 pr-[18px] py-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <Pulse color="#f43f5e" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug">
                        Replacement needed — {req.subjectName} ({req.subjectCode})
                        <span className="ml-2 align-middle text-[10px] font-bold px-2 py-[2px] rounded-full bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#9f1239] dark:text-[#fb7185] tracking-[0.05em] uppercase border border-[#f43f5e]/40">
                          {req.urgency || 'Critical'}
                        </span>
                      </p>
                      <p className="text-[12px] text-[#64748b] dark:text-[#6b8299] mt-[2px] truncate">
                        {req.reason} — {req.remarks}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acknowledgingId === req.id}
                    onClick={() => handleAcknowledgeRequest(req)}
                    className="shrink-0 gap-1.5 rounded-lg bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] text-[12.5px] font-medium h-8"
                  >
                    {acknowledgingId === req.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Acknowledge <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-5 px-4 py-3 rounded-[10px] bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] border border-[#f43f5e]/30 text-[13px] text-[#9f1239] dark:text-[#fb7185]">
            {error}
          </div>
        )}

        {/* Two-column */}
        <div className="grid gap-5 lg:grid-cols-[210px_1fr] items-start">
          <SubjectNav
            subjects={subjectsNeedingReview}
            active={selectedSubject}
            onSelect={(id) => {
              setSelectedSubject(id);
              setSelectedPaperId(null);
            }}
          />

          <div className="min-w-0">
            {/* Filter / sort row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                {visiblePapers.length} submission{visiblePapers.length !== 1 ? 's' : ''} in view
              </p>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-0.5">
                  {(['all', 'pending', 'selected'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterBy(f)}
                      className={`rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                        filterBy === f
                          ? 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.14)] text-[#0d7a6b] dark:text-[#2dd4bf]'
                          : 'text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 w-40 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px]">
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

            <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
              <div className="hidden sm:grid px-4 py-[10px] border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] grid-cols-[40px_1fr_160px_30px] items-center">
                {['', 'Submission', 'Deadline', ''].map((h, i) => (
                  <p
                    key={i}
                    className="text-[10px] font-bold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.08em] uppercase"
                  >
                    {h}
                  </p>
                ))}
              </div>
              {isLoadingPapers ? (
                <div className="divide-y divide-[#f0ece6] dark:divide-[#172130]">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                      <div className="h-7 w-7 rounded-[7px] bg-[#ede9e2] dark:bg-[#131c27]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 rounded bg-[#ede9e2] dark:bg-[#131c27]" />
                        <div className="h-2 w-28 rounded bg-[#f0ece6] dark:bg-[#172130]" />
                      </div>
                      <div className="h-3 w-16 rounded bg-[#f0ece6] dark:bg-[#172130]" />
                    </div>
                  ))}
                </div>
              ) : visiblePapers.length === 0 ? (
                <div className="px-5 py-[52px] text-center">
                  <p className="text-[14px] font-medium text-[#64748b] dark:text-[#6b8299] mb-1">Nothing pending here</p>
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                    New submissions land here automatically.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#f0ece6] dark:divide-[#172130]">
                  {visiblePapers.map((paper) => {
                    const selected = selectedPaperId === paper.id;
                    const days = daysLeft(paper.deadline);
                    const urgent = days <= 3;
                    return (
                      <div
                        key={paper.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedPaperId(selected ? null : paper.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPaperId(selected ? null : paper.id);
                          }
                        }}
                        className={`relative grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_1fr_160px_30px] items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)]'
                            : 'hover:bg-[#ede9e2]/60 dark:hover:bg-[#131c27]/60'
                        }`}
                      >
                        {selected && (
                          <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[#0d7a6b] dark:bg-[#2dd4bf]" />
                        )}
                        <div
                          className={`w-7 h-7 rounded-[7px] border flex items-center justify-center ${
                            selected
                              ? 'bg-[rgba(13,122,107,0.10)] dark:bg-[rgba(45,212,191,0.14)] border-[rgba(13,122,107,0.2)] text-[#0d7a6b] dark:text-[#2dd4bf]'
                              : 'bg-[#ede9e2] dark:bg-[#131c27] border-[#e8e2da] dark:border-[#1c2d3d] text-[#64748b] dark:text-[#6b8299]'
                          }`}
                        >
                          <FileText className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{paper.anonymousId}</p>
                          <p className="font-mono text-[10.5px] text-[#a0aec0] dark:text-[#3d5166]">
                            Set {paper.setName} · {paper.subjectCode}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[12.5px] ${
                              urgent
                                ? 'text-[#92400e] dark:text-[#fbbf24] font-medium'
                                : 'text-[#64748b] dark:text-[#6b8299]'
                            }`}
                          >
                            {fmtDate(paper.deadline)}
                          </span>
                          {urgent && (
                            <span className="text-[9.5px] font-bold px-[7px] py-[2px] rounded-full bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24] tracking-[0.04em] uppercase">
                              {days <= 0 ? 'Overdue' : `${days}d`}
                            </span>
                          )}
                        </div>
                        <span
                          className={`hidden sm:block text-right ${
                            selected
                              ? 'text-[#0d7a6b] dark:text-[#2dd4bf]'
                              : 'text-[#a0aec0] dark:text-[#3d5166]'
                          }`}
                        >
                          <ChevronRight className="h-[13px] w-[13px] ml-auto" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Approve bar — teal */}
            {selectedPaper && (
              <div className="mt-[10px] px-[18px] py-[13px] rounded-[12px] border border-[#0d7a6b]/30 bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-[11px] min-w-0">
                  <div className="w-[30px] h-[30px] rounded-lg bg-[rgba(13,122,107,0.10)] dark:bg-[rgba(45,212,191,0.14)] flex items-center justify-center text-[#0d7a6b] dark:text-[#2dd4bf] shrink-0">
                    <CheckCircle className="h-[13px] w-[13px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{selectedPaper.anonymousId} selected</p>
                    <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299] truncate">
                      {selectedPaper.subjectName} · Set {selectedPaper.setName} · Due{' '}
                      {fmtDate(selectedPaper.deadline)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleApproveAndLock}
                    disabled={approving}
                    className="flex items-center gap-[7px] px-[18px] py-2 rounded-[9px] text-[13px] font-semibold text-white disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)',
                      boxShadow: '0 2px 8px rgba(13,122,107,0.25)',
                    }}
                  >
                    {approving ? (
                      <Loader2 className="h-[13px] w-[13px] animate-spin" />
                    ) : (
                      <Lock className="h-[13px] w-[13px]" />
                    )}
                    {approving ? 'Locking…' : 'Approve & lock'}
                  </button>
                  <button
                    onClick={() => setSelectedPaperId(null)}
                    className="px-[14px] py-2 rounded-[9px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[13px]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Lock warning — amber */}
            <div className="flex items-start gap-2.5 px-[14px] py-[11px] rounded-[10px] bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] border border-[#f59e0b]/25 mt-[14px]">
              <span className="text-[#92400e] dark:text-[#fbbf24] leading-none mt-[1px] shrink-0">
                <AlertTriangle className="h-[14px] w-[14px]" />
              </span>
              <p className="text-[12.5px] leading-[1.65] text-[#64748b] dark:text-[#6b8299]">
                <strong className="text-[#18202e] dark:text-[#e2eaf4] font-semibold">Locking is irreversible.</strong>{' '}
                Once approved, the paper goes to the Exam Cell and all other submissions for that subject are
                auto-rejected.
              </p>
            </div>
          </div>
        </div>

        {/* Replacement dialog */}
        <Dialog open={!!replacementDialog} onOpenChange={(open) => !open && setReplacementDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-[15px]">
                <span className="w-9 h-9 rounded-lg bg-[#f5f3ff] dark:bg-[rgba(167,139,250,0.08)] flex items-center justify-center text-[#5b21b6] dark:text-[#a78bfa]">
                  <FileCheck className="h-4 w-4" />
                </span>
                Select replacement paper
              </DialogTitle>
              <DialogDescription className="text-[13px]">
                Choose a paper for <strong>{replacementDialog?.subjectName}</strong> ({replacementDialog?.subjectCode})
                to replace the compromised paper.
              </DialogDescription>
            </DialogHeader>
            {replacementDialog &&
              (() => {
                const coursePapers = papers
                  .filter(
                    (p) =>
                      p.subjectId === replacementDialog.subjectId &&
                      (p.status === 'approved' || p.status === 'pending_review')
                  )
                  .sort((a, b) => {
                    if (replacementSort === 'version') return b.version - a.version;
                    if (replacementSort === 'set') return a.setName.localeCompare(b.setName);
                    return b.uploadedAt.getTime() - a.uploadedAt.getTime();
                  });
                return (
                  <div className="space-y-4 mt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">
                        {coursePapers.length} paper{coursePapers.length !== 1 ? 's' : ''} available
                      </p>
                      <Select
                        value={replacementSort}
                        onValueChange={(v) => setReplacementSort(v as typeof replacementSort)}
                      >
                        <SelectTrigger className="w-40 rounded-lg text-[12px] border-[#e8e2da] dark:border-[#1c2d3d]">
                          <ArrowUpDown className="mr-1.5 h-3 w-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest first</SelectItem>
                          <SelectItem value="version">Version (high→low)</SelectItem>
                          <SelectItem value="set">Set name (A→Z)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {coursePapers.length === 0 ? (
                      <p className="text-[13px] text-[#64748b] dark:text-[#6b8299] text-center py-8">
                        No approved papers available for this subject.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {coursePapers.map((paper) => (
                          <div
                            key={paper.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{paper.anonymousId}</span>
                                <Badge variant="outline" className="text-[11px] font-mono">
                                  Set {paper.setName}
                                </Badge>
                                <Badge
                                  className={`text-[11px] ${
                                    paper.status === 'approved'
                                      ? 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#065f46] dark:text-[#34d399] hover:bg-[#ecfdf5]'
                                      : 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24] hover:bg-[#fef8ee]'
                                  }`}
                                >
                                  {paper.status === 'approved' ? 'Approved' : 'Pending review'}
                                </Badge>
                              </div>
                              <div className="mt-1.5 flex gap-3 text-[12px] text-[#64748b] dark:text-[#6b8299]">
                                <span className="font-mono">v{paper.version}</span>
                                <span>Uploaded {paper.uploadedAt.toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {paper.filePath && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5 rounded-lg"
                                  onClick={() =>
                                    handlePreviewPaper(paper.filePath, `${paper.subjectName} - ${paper.anonymousId}`)
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Preview
                                </Button>
                              )}
                              <Button
                                size="sm"
                                disabled={sendingReplacementId === paper.id}
                                onClick={() =>
                                  handleSendReplacement(
                                    paper.id,
                                    paper.subjectId,
                                    paper.examType,
                                    replacementDialog.reason
                                  )
                                }
                                className="gap-1.5 rounded-lg text-white"
                                style={{ background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)' }}
                              >
                                {sendingReplacementId === paper.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5" />
                                )}
                                Select & lock
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

        {/* Preview dialog */}
        <Dialog
          open={previewOpen}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewOpen(false);
              setPreviewUrl('');
            }
          }}
        >
          <DialogContent className="max-w-5xl max-h-[92vh] bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-[15px]">
                <span className="w-8 h-8 rounded-lg bg-[#ede9e2] dark:bg-[#131c27] flex items-center justify-center text-[#64748b] dark:text-[#6b8299]">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="truncate">Preview: {previewTitle}</span>
              </DialogTitle>
              <DialogDescription>Signed URL expires in 10 minutes. Close and reopen to refresh.</DialogDescription>
            </DialogHeader>
            <div className="aspect-[4/3] w-full overflow-hidden rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0c1118]">
              <iframe src={previewUrl} title="PDF preview" className="h-full w-full" />
            </div>
            <p className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
              {selectedPaper ? `Due ${fmtDateLong(selectedPaper.deadline)}` : ''}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
