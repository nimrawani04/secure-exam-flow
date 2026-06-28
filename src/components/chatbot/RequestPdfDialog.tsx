import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  correlationId?: string;
};

const DOC_TYPES = ['Syllabus', 'Scheme', 'Previous question paper', 'Notes / Study material', 'Notification', 'Other'];

export function RequestPdfDialog({ open, onOpenChange, query, correlationId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [docType, setDocType] = useState('Syllabus');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to submit a request.');
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('pdf_requests').insert({
      user_id: user.id,
      query,
      department: department.trim() || null,
      course: course.trim() || null,
      semester: semester.trim() || null,
      document_type: docType,
      notes: notes.trim() || null,
      correlation_id: correlationId ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not submit request', { description: error.message });
      return;
    }
    toast.success('Request submitted', { description: 'The exam cell will be notified.' });
    onOpenChange(false);
    setDepartment(''); setCourse(''); setSemester(''); setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Request this PDF
          </DialogTitle>
          <DialogDescription className="text-xs">
            We couldn't find an exact match. Send the exam cell what you need and we'll follow up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your query:</span> {query}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="rp-dept" className="text-xs">Department</Label>
              <Input id="rp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Computer Science" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-course" className="text-xs">Course / Programme</Label>
              <Input id="rp-course" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. B.Tech CSE" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-sem" className="text-xs">Semester</Label>
              <Input id="rp-sem" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. 6th" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-type" className="text-xs">Document type</Label>
              <select
                id="rp-type"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-notes" className="text-xs">Additional details (optional)</Label>
            <Textarea id="rp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything that helps us find the exact document…" className="text-xs min-h-[60px]" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Submitting…</> : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
