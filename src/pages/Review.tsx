import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
  isProcessing: boolean;
}

function ReviewCard({ paper, onApprove, onReject, onSelect, isProcessing }: ReviewCardProps) {
  const config = statusConfig[paper.status];

  return (
    <div className={cn(
      'group rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover',
      paper.isSelected && 'ring-2 ring-accent border-accent'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="rounded-lg bg-secondary p-3">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{paper.subjectName}</h3>
              <span className="text-sm text-muted-foreground">({paper.subjectCode})</span>
            </div>
            
            {/* Anonymous submission label */}
            <div className="flex items-center gap-2 mt-1">
              <img src="/cuk-favicon.png" alt="CUK Logo" className="h-4 w-4 object-contain" />
              <span className="text-sm font-medium text-accent">{paper.anonymousId}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 bg-secondary rounded-md text-sm">
                {examTypeLabels[paper.examType]}
              </span>
              <span className="text-sm text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">Set {paper.setName}</span>
              <span className="text-sm text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">v{paper.version}</span>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Deadline {paper.deadline.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <Badge variant={config.variant as any}>
            {paper.isSelected && <Lock className="h-3 w-3 mr-1" />}
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Actions for pending papers */}
      {paper.status === 'pending_review' && (
        <div className="mt-4 flex items-center gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button 
            variant="success" 
            size="sm" 
            onClick={onApprove} 
            disabled={isProcessing}
            className="gap-1.5"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onReject} 
            disabled={isProcessing}
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>
      )}

      {/* Actions for approved papers - can select */}
      {paper.status === 'approved' && !paper.isSelected && (
        <div className="mt-4 flex items-center gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button 
            variant="hero" 
            size="sm" 
            onClick={onSelect} 
            disabled={isProcessing}
            className="gap-1.5 ml-auto"
          >
            <CheckCircle className="h-4 w-4" />
            Select for Exam
          </Button>
        </div>
      )}
      
      {/* Locked papers */}
      {paper.status === 'locked' && paper.isSelected && (
        <div className="mt-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
          <div className="flex items-center gap-2 text-accent">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">This paper has been selected and locked for the exam</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Review() {
  const { papers, isLoading, error, refetch, approvePaper, rejectPaper, selectPaper } = useHODPapers();
  const [activeTab, setActiveTab] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; paper: HODPaper | null }>({
    open: false,
    paper: null,
  });
  const [rejectFeedback, setRejectFeedback] = useState('');

  const handleApprove = async (paper: HODPaper) => {
    setIsProcessing(true);
    await approvePaper(paper.id);
    setIsProcessing(false);
  };

  const handleRejectClick = (paper: HODPaper) => {
    setRejectDialog({ open: true, paper });
    setRejectFeedback('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog.paper || !rejectFeedback.trim()) return;
    
    setIsProcessing(true);
    await rejectPaper(rejectDialog.paper.id, rejectFeedback.trim());
    setRejectDialog({ open: false, paper: null });
    setRejectFeedback('');
    setIsProcessing(false);
  };

  const handleSelect = async (paper: HODPaper) => {
    setIsProcessing(true);
    await selectPaper(paper.id, paper.subjectId, paper.examType);
    setIsProcessing(false);
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold mt-1 text-warning">{stats.pending}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold mt-1 text-success">{stats.approved}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Selected & Locked</p>
            <p className="text-2xl font-bold mt-1 text-accent">{stats.selected}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{stats.rejected}</p>
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
                    onApprove={() => handleApprove(paper)}
                    onReject={() => handleRejectClick(paper)}
                    onSelect={() => handleSelect(paper)}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, paper: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Paper</DialogTitle>
              <DialogDescription>
                Please provide feedback explaining why this paper is being rejected. 
                The teacher will use this feedback to revise and resubmit.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Enter your feedback here..."
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, paper: null })}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRejectConfirm}
                disabled={!rejectFeedback.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Reject Paper
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
