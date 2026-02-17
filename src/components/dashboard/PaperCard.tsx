import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExamPaper, PaperStatus } from '@/types';
import { FileText, Clock, Eye, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaperCardProps {
  paper: ExamPaper;
  showActions?: boolean;
  isAnonymous?: boolean;
  hideStatus?: boolean;
  hideFeedback?: boolean;
  anonymousLabel?: string;
  onView?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

const statusConfig: Record<PaperStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'pending' | 'rejected' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'pending' },
  pending_review: { label: 'Pending Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'rejected' },
  locked: { label: 'Locked', variant: 'default' },
};

export function PaperCard({
  paper,
  showActions = false,
  isAnonymous = false,
  hideStatus = false,
  hideFeedback = false,
  anonymousLabel,
  onView,
  onApprove,
  onReject,
  onSelect,
  isSelected = false,
}: PaperCardProps) {
  const status = statusConfig[paper.status];
  const examTypeLabels = {
    mid_term: 'Mid Term',
    end_term: 'End Term',
    practical: 'Practical',
    internal: 'Internal',
  };

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card px-5 py-4 shadow-card transition-all duration-200 hover:shadow-card-hover',
        isSelected && 'ring-2 ring-accent border-accent'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-[10px] bg-secondary/80 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-[17px]">{paper.subjectName}</h3>
            <p className="text-[13px] text-muted-foreground">{paper.subjectCode}</p>
            {isAnonymous ? (
              <p className="text-xs text-accent font-medium">{anonymousLabel}</p>
            ) : (
              <span className="inline-flex h-6 items-center rounded-full bg-accent/10 px-3 text-xs font-medium text-accent">
                {examTypeLabels[paper.examType]} • v{paper.version}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Uploaded{' '}
                {paper.uploadedAt.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
        {!hideStatus && <Badge variant={status.variant}>{status.label}</Badge>}
      </div>

      {!hideFeedback && paper.feedback && paper.status === 'rejected' && (
        <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <p className="text-sm text-destructive">
            <strong>Feedback:</strong> {paper.feedback}
          </p>
        </div>
      )}

      {showActions && (
        <div className="mt-4 flex flex-col gap-2 pt-4 border-t sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={onView} className="gap-1.5 w-full sm:w-auto">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          {onApprove && (
            <Button variant="success" size="sm" onClick={onApprove} className="gap-1.5 w-full sm:w-auto">
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
          )}
          {onReject && (
            <Button variant="destructive" size="sm" onClick={onReject} className="gap-1.5 w-full sm:w-auto">
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          )}
          {onSelect && (
            <Button
              variant={isSelected ? 'hero' : 'outline'}
              size="sm"
              onClick={onSelect}
              className="w-full sm:w-auto sm:ml-auto"
            >
              {isSelected ? 'Selected' : 'Select Paper'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

