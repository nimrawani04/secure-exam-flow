import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHODPapers, HODPaper } from '@/hooks/useHODPapers';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Loader2,
  Lock,
  Filter,
  ArrowUpDown,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PaperStatus = Database['public']['Enums']['paper_status'];

const statusConfig: Record<PaperStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'outline' },
  pending_review: { label: 'Pending Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  resubmission_requested: { label: 'Resubmission Requested', variant: 'warning' },
  locked: { label: 'Locked & Selected', variant: 'default' },
  review_requested: { label: 'Review Requested', variant: 'warning' },
};

import { EXAM_TYPE_LABELS } from '@/types';

/* Warm-paper status tints: pill + file-tile per status */
const statusWarm: Record<string, { pill: string; tile: string }> = {
  pending_review: {
    pill: 'border-[#f59e0b]/25 bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24]',
    tile: 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#d97706] dark:text-[#fbbf24]',
  },
  approved: {
    pill: 'border-[#10b981]/25 bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#065f46] dark:text-[#34d399]',
    tile: 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#059669] dark:text-[#34d399]',
  },
  locked: {
    pill: 'border-[#0d7a6b]/25 bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf]',
    tile: 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf]',
  },
  rejected: {
    pill: 'border-[#f43f5e]/25 bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#9f1239] dark:text-[#fb7185]',
    tile: 'bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#e11d48] dark:text-[#fb7185]',
  },
  review_requested: {
    pill: 'border-[#8b5cf6]/25 bg-[#f5f3ff] dark:bg-[rgba(139,92,246,0.08)] text-[#5b21b6] dark:text-[#a78bfa]',
    tile: 'bg-[#f5f3ff] dark:bg-[rgba(139,92,246,0.08)] text-[#7c3aed] dark:text-[#a78bfa]',
  },
};

function statusTint(status: string) {
  return (
    statusWarm[status] ?? {
      pill: 'border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] text-[#64748b] dark:text-[#6b8299]',
      tile: 'bg-[#f7f4ef] dark:bg-[#0a1019] text-[#64748b] dark:text-[#6b8299]',
    }
  );
}

const outlineBtn =
  'h-9 gap-1.5 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12.5px] font-medium text-[#18202e] dark:text-[#e2eaf4] hover:bg-[#ede9e2] dark:hover:bg-[#131c27] hover:text-[#18202e] dark:hover:text-[#e2eaf4]';
const primaryBtn =
  'h-9 gap-1.5 rounded-[9px] border-0 text-[12.5px] font-medium text-white shadow-none';
const primaryStyle = { background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)' } as const;


interface ReviewCardProps {
  paper: HODPaper;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
  onRequestReview: () => void;
  isProcessing: boolean;
}

function ReviewCard({ paper, onPreview, onApprove, onReject, onSelect, onRequestReview, isProcessing }: ReviewCardProps) {
  const config = statusConfig[paper.status];
  const tint = statusTint(paper.status);
  const formattedDate = paper.uploadedAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <div className="md:hidden rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2.5">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', tint.tile)}>
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-tight text-[#18202e] dark:text-[#e2eaf4]">{paper.subjectName}</h3>
              <p className="mt-0.5 font-mono text-xs text-[#64748b] dark:text-[#6b8299]">{paper.subjectCode}</p>
            </div>
          </div>
          <Badge
            variant={config.variant as any}
            className={cn('h-6 shrink-0 rounded-full border px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] shadow-none', tint.pill)}
          >
            {paper.isSelected && <Lock className="mr-1 h-3 w-3" />}
            {config.label}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Submission</p>
            <p className="mt-0.5 font-mono text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4]">{paper.anonymousId}</p>
          </div>

          <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">
            {EXAM_TYPE_LABELS[paper.examType]} &bull; <span className="font-mono">Set {paper.setName}</span> &bull; <span className="font-mono">v{paper.version}</span>
          </p>

          <div className="flex items-center gap-2 text-[13px] text-[#64748b] dark:text-[#6b8299]">
            <Clock className="h-4 w-4" />
            <span>Submitted on <span className="font-mono">{formattedDate}</span></span>
          </div>
        </div>

        {paper.status === 'pending_review' && (
          <div className="space-y-2 border-t border-[#f0ece6] dark:border-[#172130] pt-4">
            <Button
              variant="outline"
              size="sm"
              className={cn(outlineBtn, 'h-10 w-full')}
              onClick={onPreview}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onApprove}
              disabled={isProcessing}
              className={cn(primaryBtn, 'h-10 w-full')}
              style={primaryStyle}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isProcessing}
              className="h-10 w-full gap-1.5 rounded-lg border-[#f43f5e]/30 bg-white dark:bg-[#101820] text-[12.5px] font-medium text-[#9f1239] dark:text-[#fb7185] hover:bg-[#fef2f5] dark:hover:bg-[rgba(251,113,133,0.08)] hover:text-[#9f1239] dark:hover:text-[#fb7185]"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestReview}
              disabled={isProcessing}
              className="h-10 w-full gap-1.5 rounded-lg border-[#8b5cf6]/30 bg-white dark:bg-[#101820] text-[12.5px] font-medium text-[#5b21b6] dark:text-[#a78bfa] hover:bg-[#f5f3ff] dark:hover:bg-[rgba(139,92,246,0.08)] hover:text-[#5b21b6] dark:hover:text-[#a78bfa]"
            >
              <Send className="h-4 w-4" />
              Request Exam Cell Review
            </Button>
          </div>
        )}

        {paper.status === 'approved' && !paper.isSelected && (
          <div className="space-y-2 border-t border-[#f0ece6] dark:border-[#172130] pt-4">
            <Button
              variant="outline"
              size="sm"
              className={cn(outlineBtn, 'h-10 w-full')}
              onClick={onPreview}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onSelect}
              disabled={isProcessing}
              className={cn(primaryBtn, 'h-10 w-full')}
              style={primaryStyle}
            >
              <CheckCircle className="h-4 w-4" />
              Select for Exam
            </Button>
          </div>
        )}

        {paper.status === 'locked' && paper.isSelected && (
          <div className="rounded-[12px] border border-[#10b981]/25 bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] p-3">
            <div className="flex items-center gap-2 text-[#065f46] dark:text-[#34d399]">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="text-[12.5px] font-medium">This paper has been selected and locked for the exam</span>
            </div>
          </div>
        )}

        {paper.status === 'review_requested' && (
          <div className="rounded-[12px] border border-[#f59e0b]/25 bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] p-3">
            <div className="flex items-center gap-2 text-[#92400e] dark:text-[#fbbf24]">
              <Send className="h-4 w-4 shrink-0" />
              <span className="text-[12.5px] font-medium">Sent to Exam Cell for review</span>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <div
          className={cn(
            'rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-6 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', tint.tile)}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-semibold text-[16px] text-[#18202e] dark:text-[#e2eaf4]">{paper.subjectName}</h3>
                  <span className="font-mono text-[13px] text-[#64748b] dark:text-[#6b8299]">({paper.subjectCode})</span>
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[13px] text-[#64748b] dark:text-[#6b8299]">
                  <span className="font-mono font-medium text-[#18202e] dark:text-[#e2eaf4]">{paper.anonymousId}</span>
                  <span className="text-[#a0aec0] dark:text-[#3d5166]">&bull;</span>
                  <span>{EXAM_TYPE_LABELS[paper.examType]}</span>
                  <span className="text-[#a0aec0] dark:text-[#3d5166]">&bull;</span>
                  <span className="font-mono">Set {paper.setName}</span>
                  <span className="text-[#a0aec0] dark:text-[#3d5166]">&bull;</span>
                  <span className="font-mono">v{paper.version}</span>
                  <span className="text-[#a0aec0] dark:text-[#3d5166]">&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Submitted on <span className="font-mono">{paper.uploadedAt.toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={config.variant as any}
                className={cn('mt-[2px] h-6 rounded-full border px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] shadow-none', tint.pill)}
              >
                {paper.isSelected && <Lock className="h-3 w-3 mr-1" />}
                {config.label}
              </Badge>
            </div>
          </div>

          {paper.status === 'pending_review' && (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-[#f0ece6] dark:border-[#172130] pt-4 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                className={cn(outlineBtn, 'w-full sm:w-auto')}
                onClick={onPreview}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onApprove}
                disabled={isProcessing}
                className={cn(primaryBtn, 'w-full sm:w-auto')}
                style={primaryStyle}
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={isProcessing}
                className="gap-1.5 h-9 w-full rounded-lg border-[#f43f5e]/30 bg-white dark:bg-[#101820] text-[12.5px] font-medium text-[#9f1239] dark:text-[#fb7185] hover:bg-[#fef2f5] dark:hover:bg-[rgba(251,113,133,0.08)] hover:text-[#9f1239] dark:hover:text-[#fb7185] sm:w-auto"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestReview}
                disabled={isProcessing}
                className="gap-1.5 h-9 w-full rounded-lg border-[#8b5cf6]/30 bg-white dark:bg-[#101820] text-[12.5px] font-medium text-[#5b21b6] dark:text-[#a78bfa] hover:bg-[#f5f3ff] dark:hover:bg-[rgba(139,92,246,0.08)] hover:text-[#5b21b6] dark:hover:text-[#a78bfa] sm:w-auto sm:ml-auto"
              >
                <Send className="h-4 w-4" />
                Request Exam Cell Review
              </Button>
            </div>
          )}

          {paper.status === 'approved' && !paper.isSelected && (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-[#f0ece6] dark:border-[#172130] pt-4 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                className={cn(outlineBtn, 'w-full sm:w-auto')}
                onClick={onPreview}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onSelect}
                disabled={isProcessing}
                className={cn(primaryBtn, 'w-full sm:w-auto sm:ml-auto')}
                style={primaryStyle}
              >
                <CheckCircle className="h-4 w-4" />
                Select for Exam
              </Button>
            </div>
          )}

          {paper.status === 'locked' && paper.isSelected && (
            <div className="mt-4 rounded-[12px] border border-[#10b981]/25 bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] p-3">
              <div className="flex items-center gap-2 text-[#065f46] dark:text-[#34d399]">
                <Lock className="h-4 w-4 shrink-0" />
                <span className="text-[12.5px] font-medium">This paper has been selected and locked for the exam</span>
              </div>
            </div>
          )}

          {paper.status === 'review_requested' && (
            <div className="mt-4 rounded-[12px] border border-[#f59e0b]/25 bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] p-3">
              <div className="flex items-center gap-2 text-[#92400e] dark:text-[#fbbf24]">
                <Send className="h-4 w-4 shrink-0" />
                <span className="text-[12.5px] font-medium">Sent to Exam Cell for review</span>
              </div>
              {paper.filePath && (
                <p className="mt-1 text-xs text-[#92400e]/70 dark:text-[#fbbf24]/70">The Exam Cell will review and respond.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Review() {
  const { papers, isLoading, error, refetch, approvePaper, rejectPaper, selectPaper, requestReview } = useHODPapers();
  const [activeTab, setActiveTab] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [selectedPaperForSend, setSelectedPaperForSend] = useState<HODPaper | null>(null);
  const [hodRemark, setHodRemark] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewPaper, setReviewPaper] = useState<HODPaper | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'subject' | 'version'>('date');

  // Unique subjects for filter dropdown
  const subjectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    papers.forEach((p) => {
      if (!map.has(p.subjectId)) {
        map.set(p.subjectId, { id: p.subjectId, name: p.subjectName, code: p.subjectCode });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [papers]);

  const handleApprove = async (paper: HODPaper) => {
    setIsProcessing(true);
    await approvePaper(paper.id);
    setIsProcessing(false);
  };

  const handleReject = async (paper: HODPaper) => {
    setIsProcessing(true);
    await rejectPaper(paper.id, '');
    setIsProcessing(false);
  };

  const handleRequestReview = (paper: HODPaper) => {
    setReviewPaper(paper);
    setReviewComment('');
    setReviewDialogOpen(true);
  };

  const handleConfirmRequestReview = async () => {
    if (!reviewPaper) return;
    setIsProcessing(true);
    const success = await requestReview(reviewPaper.id, reviewComment);
    setIsProcessing(false);
    if (success) {
      setReviewDialogOpen(false);
      setReviewPaper(null);
      setReviewComment('');
    }
  };

  const handleSelect = async (paper: HODPaper) => {
    setSelectedPaperForSend(paper);
    setHodRemark('');
    setSelectDialogOpen(true);
  };

  const handleConfirmSelect = async () => {
    if (!selectedPaperForSend) return;

    setIsProcessing(true);
    const success = await selectPaper(
      selectedPaperForSend.id,
      selectedPaperForSend.subjectId,
      selectedPaperForSend.examType,
      hodRemark
    );
    setIsProcessing(false);

    if (success) {
      setSelectDialogOpen(false);
      setSelectedPaperForSend(null);
      setHodRemark('');
    }
  };

  const handlePreview = async (paper: HODPaper) => {
    if (!paper.filePath) {
      toast.error('No file available for preview');
      return;
    }

    const { data, error: previewError } = await supabase.storage
      .from('exam-papers')
      .createSignedUrl(paper.filePath, 60 * 10);

    if (previewError || !data?.signedUrl) {
      toast.error(previewError?.message || 'Failed to load preview');
      return;
    }

    setPreviewTitle(`${paper.subjectName} (${paper.subjectCode})`);
    setPreviewUrl(data.signedUrl);
    setPreviewOpen(true);
  };

  const filteredPapers = useMemo(() => {
    let result = papers.filter((paper) => {
      if (activeTab === 'pending') return paper.status === 'pending_review';
      if (activeTab === 'approved') return paper.status === 'approved';
      if (activeTab === 'selected') return paper.status === 'locked' && paper.isSelected;
      if (activeTab === 'rejected') return paper.status === 'rejected';
      if (activeTab === 'review_requested') return paper.status === 'review_requested';
      return true;
    });

    // Apply subject filter
    if (subjectFilter !== 'all') {
      result = result.filter((p) => p.subjectId === subjectFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'subject') return a.subjectName.localeCompare(b.subjectName) || b.uploadedAt.getTime() - a.uploadedAt.getTime();
      if (sortBy === 'version') return b.version - a.version || a.subjectName.localeCompare(b.subjectName);
      return b.uploadedAt.getTime() - a.uploadedAt.getTime(); // date desc
    });

    return result;
  }, [papers, activeTab, subjectFilter, sortBy]);

  const stats = {
    pending: papers.filter((p) => p.status === 'pending_review').length,
    approved: papers.filter((p) => p.status === 'approved').length,
    selected: papers.filter((p) => p.status === 'locked' && p.isSelected).length,
    rejected: papers.filter((p) => p.status === 'rejected').length,
    reviewRequested: papers.filter((p) => p.status === 'review_requested').length,
  };

  const statCells = [
    {
      key: 'pending',
      label: 'Pending',
      hint: 'Awaiting decision',
      value: stats.pending,
      accent: 'bg-[#f59e0b]',
      glow: 'bg-[#f59e0b]/15',
      number: 'text-[#d97706] dark:text-[#fbbf24]',
    },
    {
      key: 'approved',
      label: 'Approved',
      hint: 'Cleared by HOD',
      value: stats.approved,
      accent: 'bg-[#10b981]',
      glow: 'bg-[#10b981]/15',
      number: 'text-[#059669] dark:text-[#34d399]',
    },
    {
      key: 'selected',
      label: 'Selected',
      hint: 'Locked for exam',
      value: stats.selected,
      accent: 'bg-[#0d7a6b] dark:bg-[#2dd4bf]',
      glow: 'bg-[#0d7a6b]/15 dark:bg-[#2dd4bf]/15',
      number: 'text-[#0d7a6b] dark:text-[#2dd4bf]',
    },
    {
      key: 'rejected',
      label: 'Rejected',
      hint: 'Needs revision',
      value: stats.rejected,
      accent: 'bg-[#f43f5e]',
      glow: 'bg-[#f43f5e]/15',
      number: 'text-[#e11d48] dark:text-[#fb7185]',
    },
    {
      key: 'review',
      label: 'Review req.',
      hint: 'With exam cell',
      value: stats.reviewRequested,
      accent: 'bg-[#8b5cf6]',
      glow: 'bg-[#8b5cf6]/15',
      number: 'text-[#7c3aed] dark:text-[#a78bfa]',
    },
  ];

  return (
    <DashboardLayout>
      <HodPageShell
        eyebrow="HOD · Review"
        title={<>Review <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Papers</em></>}
        description="Review and approve exam papers from your department"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            className="gap-1.5 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12.5px]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      >
      <div className="space-y-6">

        {/* Anonymous Review Notice — violet banner */}
        <div className="flex items-start gap-3 rounded-[12px] border border-[#8b5cf6]/25 bg-[#f5f3ff] dark:bg-[rgba(139,92,246,0.08)] p-4">
          <img
            src="/cuk-favicon.png"
            alt="CUK Logo"
            className="h-5 w-5 object-contain flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b21b6] dark:text-[#a78bfa]">Anonymous review mode</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#5b21b6]/80 dark:text-[#a78bfa]/80">
              Teacher identities are hidden to ensure unbiased paper selection.
              Papers are labeled as <span className="font-mono">"Submission 1", "Submission 2"</span>, etc.
            </p>
          </div>
        </div>

        {/* Stats — single warm panel, 5 cells */}
        <div className="overflow-hidden rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
          <div className="grid grid-cols-2 gap-px bg-[#f0ece6] dark:bg-[#172130] md:grid-cols-5">
            {statCells.map((s) => (
              <div key={s.key} className="relative overflow-hidden bg-white dark:bg-[#101820] px-5 pb-5 pt-5">
                <span className={cn('absolute inset-x-0 top-0 h-[2px]', s.accent)} />
                <span className={cn('pointer-events-none absolute -top-6 right-3 h-16 w-16 rounded-full blur-2xl', s.glow)} />
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">{s.label}</p>
                <p className={cn('mt-2 font-mono text-[32px] font-semibold leading-none', s.number)}>{s.value}</p>
                <p className="mt-1.5 text-[12px] text-[#64748b] dark:text-[#6b8299]">{s.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-0.5 sm:grid sm:grid-cols-5 sm:overflow-visible">
            <TabsTrigger value="pending" className="w-full rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] dark:text-[#6b8299] data-[state=active]:bg-[#eaf6f4] dark:data-[state=active]:bg-[rgba(45,212,191,0.08)] data-[state=active]:text-[#0d7a6b] dark:data-[state=active]:text-[#2dd4bf] data-[state=active]:shadow-none">Pending <span className="font-mono">({stats.pending})</span></TabsTrigger>
            <TabsTrigger value="approved" className="w-full rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] dark:text-[#6b8299] data-[state=active]:bg-[#eaf6f4] dark:data-[state=active]:bg-[rgba(45,212,191,0.08)] data-[state=active]:text-[#0d7a6b] dark:data-[state=active]:text-[#2dd4bf] data-[state=active]:shadow-none">Approved <span className="font-mono">({stats.approved})</span></TabsTrigger>
            <TabsTrigger value="selected" className="w-full rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] dark:text-[#6b8299] data-[state=active]:bg-[#eaf6f4] dark:data-[state=active]:bg-[rgba(45,212,191,0.08)] data-[state=active]:text-[#0d7a6b] dark:data-[state=active]:text-[#2dd4bf] data-[state=active]:shadow-none">Selected <span className="font-mono">({stats.selected})</span></TabsTrigger>
            <TabsTrigger value="rejected" className="w-full rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] dark:text-[#6b8299] data-[state=active]:bg-[#eaf6f4] dark:data-[state=active]:bg-[rgba(45,212,191,0.08)] data-[state=active]:text-[#0d7a6b] dark:data-[state=active]:text-[#2dd4bf] data-[state=active]:shadow-none">Rejected <span className="font-mono">({stats.rejected})</span></TabsTrigger>
            <TabsTrigger value="review_requested" className="w-full rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#64748b] dark:text-[#6b8299] data-[state=active]:bg-[#eaf6f4] dark:data-[state=active]:bg-[rgba(45,212,191,0.08)] data-[state=active]:text-[#0d7a6b] dark:data-[state=active]:text-[#2dd4bf] data-[state=active]:shadow-none">Review Req. <span className="font-mono">({stats.reviewRequested})</span></TabsTrigger>
          </TabsList>

          {/* Subject Filter & Sort Controls */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="h-4 w-4 text-[#a0aec0] dark:text-[#3d5166] shrink-0" />
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="h-8 w-full rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] text-[#18202e] dark:text-[#e2eaf4] sm:w-[250px]">
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-[#a0aec0] dark:text-[#3d5166] shrink-0" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'subject' | 'version')}>
                <SelectTrigger className="h-8 w-full rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] text-[#18202e] dark:text-[#e2eaf4] sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                  <SelectItem value="date">Latest First</SelectItem>
                  <SelectItem value="subject">Subject Name</SelectItem>
                  <SelectItem value="version">Version (High → Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#a0aec0] dark:text-[#3d5166]" />
                <p className="font-mono text-[12px] text-[#a0aec0] dark:text-[#3d5166]">loading submissions…</p>
              </div>
            ) : error ? (
              <div className="rounded-[14px] border border-[#f43f5e]/25 bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] py-12 text-center">
                <AlertCircle className="h-10 w-10 text-[#e11d48] dark:text-[#fb7185] mx-auto mb-4" />
                <p className="text-[13px] font-semibold text-[#9f1239] dark:text-[#fb7185]">Failed to load papers</p>
                <p className="mt-1 font-mono text-[12px] text-[#9f1239]/70 dark:text-[#fb7185]/70">{error}</p>
                <Button variant="outline" onClick={refetch} className={cn(outlineBtn, 'mt-4')}>
                  Try Again
                </Button>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] py-12 text-center">
                <FileText className="h-10 w-10 text-[#a0aec0] dark:text-[#3d5166] mx-auto mb-4" />
                <p className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">No papers found</p>
                <p className="mt-1 font-mono text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                  {activeTab === 'pending'
                    ? 'no pending submissions'
                    : `no ${activeTab} papers found`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPapers.map((paper) => (
                  <ReviewCard
                    key={paper.id}
                    paper={paper}
                    onPreview={() => handlePreview(paper)}
                    onApprove={() => handleApprove(paper)}
                    onReject={() => handleReject(paper)}
                    onSelect={() => handleSelect(paper)}
                    onRequestReview={() => handleRequestReview(paper)}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl rounded-[14px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Preview: <span className="font-mono font-medium">{previewTitle}</span></DialogTitle>
            </DialogHeader>
            {previewUrl ? (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019]">
                <iframe
                  src={previewUrl}
                  title="Paper preview"
                  className="h-full w-full"
                />
              </div>
            ) : (
              <p className="font-mono text-[12px] text-[#a0aec0] dark:text-[#3d5166]">no preview available</p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={selectDialogOpen}
          onOpenChange={(open) => {
            setSelectDialogOpen(open);
            if (!open && !isProcessing) {
              setSelectedPaperForSend(null);
              setHodRemark('');
            }
          }}
        >
          <DialogContent className="rounded-[14px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Send selected paper to Exam Cell</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-[12px] border border-[#f59e0b]/25 bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] p-3">
                <p className="text-[12.5px] leading-relaxed text-[#92400e] dark:text-[#fbbf24]">
                  {selectedPaperForSend
                    ? <><span className="font-mono font-medium">{selectedPaperForSend.anonymousId}</span> will be locked and sent to Exam Cell. This action is final.</>
                    : 'This paper will be locked and sent to Exam Cell. This action is final.'}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="hod-remark" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  HOD remark (optional)
                </label>
                <Textarea
                  id="hod-remark"
                  value={hodRemark}
                  onChange={(event) => setHodRemark(event.target.value)}
                  placeholder="Add any note for Exam Cell..."
                  rows={4}
                  maxLength={500}
                  className="rounded-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectDialogOpen(false)}
                disabled={isProcessing}
                className={outlineBtn}
              >
                Cancel
              </Button>
              <Button type="button" variant="default" onClick={handleConfirmSelect} disabled={isProcessing} className={primaryBtn} style={primaryStyle}>
                {isProcessing ? 'Sending...' : 'Lock & Send to Exam Cell'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Review Dialog */}
        <Dialog
          open={reviewDialogOpen}
          onOpenChange={(open) => {
            setReviewDialogOpen(open);
            if (!open && !isProcessing) {
              setReviewPaper(null);
              setReviewComment('');
            }
          }}
        >
          <DialogContent className="rounded-[14px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Request Exam Cell review</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-[#64748b] dark:text-[#6b8299]">
                {reviewPaper
                  ? <>Send <span className="font-medium text-[#18202e] dark:text-[#e2eaf4]">{reviewPaper.subjectName}</span> <span className="font-mono">({reviewPaper.subjectCode})</span> to the Exam Cell for additional review and verification.</>
                  : 'Send this paper to the Exam Cell for review.'}
              </p>

              <div className="space-y-2">
                <label htmlFor="review-comment" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  Comment (optional)
                </label>
                <Textarea
                  id="review-comment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="e.g. Please verify formatting and marking scheme before final approval."
                  rows={4}
                  maxLength={500}
                  className="rounded-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewDialogOpen(false)}
                disabled={isProcessing}
                className={outlineBtn}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirmRequestReview}
                disabled={isProcessing}
                className={cn(primaryBtn, 'gap-1.5')}
                style={primaryStyle}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isProcessing ? 'Sending...' : 'Send for Review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </HodPageShell>
    </DashboardLayout>
  );
}
