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
        'group rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover',
        isSelected && 'ring-2 ring-accent border-accent'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-secondary p-3">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{paper.subjectName}</h3>
            {isAnonymous ? (
              <p className="text-sm text-accent font-medium">{anonymousLabel}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Set {paper.setName} - v{paper.version}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 bg-secondary rounded-md">{examTypeLabels[paper.examType]}</span>
            </div>
          </div>
        </div>
        {!hideStatus && <Badge variant={status.variant}>{status.label}</Badge>}
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>
            Due {paper.deadline.toLocaleDateString()}
          </span>
        </div>
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

