import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, MessageSquareWarning, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type PaperStatus = Database['public']['Enums']['paper_status'];

interface ReviewResponseDialogProps {
  paperId: string;
  subjectId: string;
  subjectName: string;
  examType: string;
  departmentId: string;
  departmentName: string;
  hodRemark?: string | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function ReviewResponseDialog({
  paperId,
  subjectId,
  subjectName,
  examType,
  departmentId,
  departmentName,
  hodRemark,
  onSuccess,
  trigger,
}: ReviewResponseDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'approve' | 'feedback' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const examTypeLabel = examType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const resetForm = () => {
    setMode(null);
    setFeedback('');
  };

  const handleApprove = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('exam_papers')
        .update({ status: 'locked' as PaperStatus })
        .eq('id', paperId);

      if (error) {
        console.error('Error approving paper:', error);
        toast.error('Failed to approve paper');
        return;
      }

      // Notify HOD
      await supabase.from('notifications').insert({
        created_by: user.id,
        title: '✅ Paper Approved by Exam Cell',
        message: `The paper for "${subjectName}" (${examTypeLabel}) has been reviewed and approved by the Exam Cell.`,
        target_roles: ['hod'],
        target_departments: [departmentId],
        type: 'success',
        user_id: null,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'approve_review_request',
        entity_type: 'paper',
        entity_id: paperId,
        details: { subjectName, examType },
      });

      toast.success('Paper approved successfully');
      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!user || !feedback.trim()) return;
    setIsSubmitting(true);
    try {
      // Update paper status back to pending_review with feedback
      const { error } = await supabase
        .from('exam_papers')
        .update({
          status: 'pending_review' as PaperStatus,
          feedback: feedback.trim(),
        })
        .eq('id', paperId);

      if (error) {
        console.error('Error sending feedback:', error);
        toast.error('Failed to send feedback');
        return;
      }

      // Notify HOD
      await supabase.from('notifications').insert({
        created_by: user.id,
        title: '📝 Exam Cell Feedback on Paper',
        message: `The Exam Cell has reviewed "${subjectName}" (${examTypeLabel}) and provided feedback: ${feedback.trim()}`,
        target_roles: ['hod'],
        target_departments: [departmentId],
        type: 'warning',
        user_id: null,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'feedback_review_request',
        entity_type: 'paper',
        entity_id: paperId,
        details: { subjectName, examType, feedback: feedback.trim() },
      });

      toast.success('Feedback sent to HOD');
      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-warning hover:text-warning hover:bg-warning/10"
            title="Respond to review request"
          >
            <MessageSquareWarning className="h-[18px] w-[18px]" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-warning" />
            Respond to Review Request
          </AlertDialogTitle>
          <AlertDialogDescription>
            The HOD has requested your review on this paper. You can approve it or send feedback.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Paper info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input value={subjectName} disabled className="bg-muted/50 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Exam Type</Label>
              <Input value={examTypeLabel} disabled className="bg-muted/50 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Department</Label>
            <Input value={departmentName} disabled className="bg-muted/50 text-sm" />
          </div>

          {/* HOD's remark */}
          {hodRemark?.trim() && (
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-1">
              <Label className="text-xs font-semibold text-warning">HOD's Remark</Label>
              <p className="text-sm text-foreground/80">{hodRemark}</p>
            </div>
          )}

          {/* Action selection */}
          {mode === null && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('approve')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-background p-4 transition-all hover:border-success/50 hover:bg-success/5"
              >
                <CheckCircle2 className="h-8 w-8 text-success" />
                <span className="text-sm font-semibold text-foreground">Approve Paper</span>
                <span className="text-xs text-muted-foreground text-center">Confirm the paper is ready</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('feedback')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-background p-4 transition-all hover:border-warning/50 hover:bg-warning/5"
              >
                <Send className="h-8 w-8 text-warning" />
                <span className="text-sm font-semibold text-foreground">Send Feedback</span>
                <span className="text-xs text-muted-foreground text-center">Request changes from HOD</span>
              </button>
            </div>
          )}

          {/* Approve confirmation */}
          {mode === 'approve' && (
            <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Confirm that this paper has been reviewed and is ready to proceed.
              </p>
              <p className="text-xs text-muted-foreground">
                The paper will be marked as locked and the HOD will be notified.
              </p>
            </div>
          )}

          {/* Feedback form */}
          {mode === 'feedback' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Your Feedback <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe the issues or changes needed..."
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{feedback.length}/500</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          {mode !== null && (
            <Button
              variant="ghost"
              onClick={() => setMode(null)}
              disabled={isSubmitting}
              className="mr-auto"
            >
              Back
            </Button>
          )}
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          {mode === 'approve' && (
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
          )}
          {mode === 'feedback' && (
            <Button
              onClick={handleSendFeedback}
              disabled={isSubmitting || !feedback.trim()}
              variant="default"
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Send Feedback
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
