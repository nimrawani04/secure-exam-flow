import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  locked: { label: 'Locked & Selected', variant: 'default' },
};

const examTypeLabels: Record<string, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
};

interface ReviewCardProps {
  paper: HODPaper;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
  isProcessing: boolean;
}

function ReviewCard({ paper, onPreview, onApprove, onReject, onSelect, isProcessing }: ReviewCardProps) {
  const config = statusConfig[paper.status];
  const formattedDeadline = paper.deadline.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <div className="md:hidden rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{paper.subjectName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{paper.subjectCode}</p>
          </div>
          <Badge
            variant={config.variant as any}
            className="h-7 rounded-full px-3 text-xs font-medium shrink-0"
          >
            {paper.isSelected && <Lock className="mr-1 h-3 w-3" />}
            {config.label}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Submission</p>
            <p className="font-medium">{paper.anonymousId}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            {examTypeLabels[paper.examType]} &bull; Set: {paper.setName} &bull; v{paper.version}
          </p>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Deadline {formattedDeadline}</span>
          </div>
        </div>

        {paper.status === 'pending_review' && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full gap-1.5"
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
              className="h-10 w-full gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isProcessing}
              className="h-10 w-full gap-1.5 border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {paper.status === 'approved' && !paper.isSelected && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full gap-1.5"
              onClick={onPreview}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={onSelect}
              disabled={isProcessing}
              className="h-10 w-full gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              Select for Exam
            </Button>
          </div>
        )}

        {paper.status === 'locked' && paper.isSelected && (
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-3">
            <div className="flex items-center gap-2 text-accent">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">This paper has been selected and locked for the exam</span>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <div
          className={cn(
            'group rounded-[14px] border bg-card p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="rounded-[10px] bg-secondary p-2.5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <h3 className="font-semibold text-[17px]">{paper.subjectName}</h3>
                  <span className="text-sm text-muted-foreground">({paper.subjectCode})</span>
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground/90">{paper.anonymousId}</span>
                  <span>&bull;</span>
                  <span>{examTypeLabels[paper.examType]}</span>
                  <span>&bull;</span>
                  <span>Set {paper.setName}</span>
                  <span>&bull;</span>
                  <span>v{paper.version}</span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Deadline {paper.deadline.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={config.variant as any}
                className="mt-[2px] h-6 rounded-full px-2.5 text-[11px] font-medium shadow-none"
              >
                {paper.isSelected && <Lock className="h-3 w-3 mr-1" />}
                {config.label}
              </Badge>
            </div>
          </div>

          {paper.status === 'pending_review' && (
            <div className="mt-3 flex flex-col gap-3 pt-4 border-t sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-10 w-full border-border/70 text-foreground/80 hover:border-accent/50 hover:text-foreground sm:w-auto"
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
                className="gap-1.5 h-10 w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={isProcessing}
                className="gap-1.5 h-10 w-full border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10 sm:w-auto"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
          )}

          {paper.status === 'approved' && !paper.isSelected && (
            <div className="mt-3 flex flex-col gap-3 pt-4 border-t sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-10 w-full border-border/70 text-foreground/80 hover:border-accent/50 hover:text-foreground sm:w-auto"
                onClick={onPreview}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={onSelect}
                disabled={isProcessing}
                className="gap-1.5 h-10 w-full sm:w-auto sm:ml-auto"
              >
                <CheckCircle className="h-4 w-4" />
                Select for Exam
              </Button>
            </div>
          )}

          {paper.status === 'locked' && paper.isSelected && (
            <div className="mt-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
              <div className="flex items-center gap-2 text-accent">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">This paper has been selected and locked for the exam</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Review() {
  const { papers, isLoading, error, refetch, approvePaper, rejectPaper, selectPaper } = useHODPapers();
  const [activeTab, setActiveTab] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

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

  const handleSelect = async (paper: HODPaper) => {
    setIsProcessing(true);
    await selectPaper(paper.id, paper.subjectId, paper.examType);
    setIsProcessing(false);
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

  const filteredPapers = papers.filter((paper) => {
    if (activeTab === 'pending') return paper.status === 'pending_review';
    if (activeTab === 'approved') return paper.status === 'approved';
    if (activeTab === 'selected') return paper.status === 'locked' && paper.isSelected;
    if (activeTab === 'rejected') return paper.status === 'rejected';
    return true;
  });

  const stats = {
    pending: papers.filter((p) => p.status === 'pending_review').length,
    approved: papers.filter((p) => p.status === 'approved').length,
    selected: papers.filter((p) => p.status === 'locked' && p.isSelected).length,
    rejected: papers.filter((p) => p.status === 'rejected').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Review Papers</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve exam papers from your department
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} className="w-full gap-1.5 sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Anonymous Review Notice */}
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
          <img
            src="/cuk-favicon.png"
            alt="CUK Logo"
            className="h-5 w-5 object-contain flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="font-medium text-accent">Anonymous Review Mode</p>
            <p className="text-sm text-muted-foreground mt-1">
              Teacher identities are hidden to ensure unbiased paper selection. 
              Papers are labeled as "Submission 1", "Submission 2", etc.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-border/60">
            <div className="divide-y divide-border/60">
              <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Pending Review</p>
                    <p className="text-xs text-muted-foreground">Papers awaiting selection</p>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-foreground">{stats.pending}</p>
              </div>
              <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <XCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Rejected</p>
                    <p className="text-xs text-muted-foreground">Needs revision</p>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-foreground">{stats.rejected}</p>
              </div>
            </div>
            <div className="divide-y divide-border/60">
              <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <CheckCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Approved</p>
                    <p className="text-xs text-muted-foreground">Approved papers</p>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-foreground">{stats.approved}</p>
              </div>
              <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Lock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Selected & Locked</p>
                    <p className="text-xs text-muted-foreground">Ready for exam</p>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-foreground">{stats.selected}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-1 overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-4 sm:gap-2">
            <TabsTrigger value="pending" className="w-full">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="approved" className="w-full">Approved ({stats.approved})</TabsTrigger>
            <TabsTrigger value="selected" className="w-full">Selected ({stats.selected})</TabsTrigger>
            <TabsTrigger value="rejected" className="w-full">Rejected ({stats.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-lg font-medium">Failed to load papers</p>
                <p className="text-muted-foreground mt-1">{error}</p>
                <Button variant="outline" onClick={refetch} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No papers found</p>
                <p className="text-muted-foreground mt-1">
                  {activeTab === 'pending' 
                    ? "No papers are currently pending review." 
                    : `No ${activeTab} papers found.`}
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
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Preview: {previewTitle}</DialogTitle>
            </DialogHeader>
            {previewUrl ? (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border">
                <iframe
                  src={previewUrl}
                  title="Paper preview"
                  className="h-full w-full"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No preview available.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
