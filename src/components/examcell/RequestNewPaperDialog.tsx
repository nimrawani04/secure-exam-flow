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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const REASONS = [
  'Paper Leak',
  'Error in Question Paper',
  'Duplicate Questions',
  'Printing Issue',
  'Other',
] as const;

const URGENCY_LEVELS = [
  { value: 'normal', label: 'Normal', color: 'bg-muted text-muted-foreground' },
  { value: 'urgent', label: 'Urgent', color: 'bg-warning/15 text-warning border-warning/20' },
  { value: 'critical', label: 'Critical', color: 'bg-destructive/15 text-destructive border-destructive/20' },
] as const;

interface RequestNewPaperDialogProps {
  examId: string;
  subjectId: string;
  subjectName: string;
  examType: string;
  departmentId: string;
  departmentName: string;
  trigger?: React.ReactNode;
}

export function RequestNewPaperDialog({
  examId,
  subjectId,
  subjectName,
  examType,
  departmentId,
  departmentName,
  trigger,
}: RequestNewPaperDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const examTypeLabel = examType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const canSubmit = reason && remarks.trim().length >= 10;

  const resetForm = () => {
    setReason('');
    setRemarks('');
    setUrgency('normal');
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    setIsSubmitting(true);
    try {
      // Insert paper request
      const { error: insertError } = await supabase
        .from('paper_requests')
        .insert({
          exam_id: examId,
          subject_id: subjectId,
          exam_type: examType as Database['public']['Enums']['exam_type'],
          department_id: departmentId,
          reason,
          remarks: remarks.trim(),
          urgency,
          requested_by: user.id,
        });

      if (insertError) {
        console.error('Error creating paper request:', insertError);
        toast.error('Failed to submit request');
        return;
      }

      // Update the locked paper's status to resubmission_requested
      const { error: updateError } = await supabase
        .from('exam_papers')
        .update({ status: 'resubmission_requested' as Database['public']['Enums']['paper_status'] })
        .eq('subject_id', subjectId)
        .eq('exam_type', examType as Database['public']['Enums']['exam_type'])
        .eq('is_selected', true)
        .in('status', ['locked', 'approved']);

      if (updateError) {
        console.error('Error updating paper status:', updateError);
      }

      // Notify HOD
      const urgencyPrefix = urgency === 'critical' ? '🚨 CRITICAL: ' : urgency === 'urgent' ? '⚠️ URGENT: ' : '';
      await supabase.from('notifications').insert({
        created_by: user.id,
        title: `${urgencyPrefix}New Paper Requested`,
        message: `Exam Cell has requested a new paper for "${subjectName}" (${examTypeLabel}). Reason: ${reason}. Remarks: ${remarks.trim()}`,
        target_roles: ['hod'],
        target_departments: [departmentId],
        type: urgency === 'critical' ? 'critical' : urgency === 'urgent' ? 'warning' : 'info',
        user_id: null,
      });

      // Send email to HOD
      await supabase.functions.invoke('send-registered-email', {
        body: {
          subject: `${urgencyPrefix}New Paper Requested – ${subjectName}`,
          message: `Exam Cell has requested a new question paper.\n\nSubject: ${subjectName}\nExam Type: ${examTypeLabel}\nDepartment: ${departmentName}\nReason: ${reason}\nUrgency: ${urgency.toUpperCase()}\n\nRemarks:\n${remarks.trim()}`,
          targetRoles: ['hod'],
          targetDepartments: [departmentId],
        },
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'request_new_paper',
        entity_type: 'paper',
        entity_id: examId,
        details: { reason, urgency, subjectName, examType },
      });

      toast.success('Request submitted to HOD');
      resetForm();
      setOpen(false);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
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
            className="h-8 w-8 text-muted-foreground/80 hover:text-destructive"
            title="Request new paper from HOD"
          >
            <AlertTriangle className="h-[18px] w-[18px]" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Request New Question Paper
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will notify the HOD to prepare a replacement paper. Use only when necessary.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Auto-filled fields */}
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

          {/* Reason dropdown */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Reason for Request <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Remarks <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain the issue clearly so the HOD can prepare a new paper..."
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{remarks.length}/500</p>
          </div>

          {/* Urgency */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Urgency Level</Label>
            <div className="flex gap-2">
              {URGENCY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgency(level.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                    urgency === level.value
                      ? level.color + ' ring-2 ring-offset-1 ring-current'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            variant="destructive"
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
