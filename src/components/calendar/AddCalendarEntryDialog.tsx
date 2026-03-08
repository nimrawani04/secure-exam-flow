import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import type { CustomEntryInput } from '@/hooks/useTeacherCustomEntries';
import type { TeacherSubject } from '@/hooks/useTeacherSubjects';

const EXAM_TYPE_OPTIONS = [
  { value: 'cia_1', label: 'CIA 1' },
  { value: 'cia_2', label: 'CIA 2' },
  { value: 'end_term', label: 'End Semester' },
  { value: 'practical', label: 'Internal Practical' },
  { value: 'practical_external', label: 'External Practical' },
  { value: 'other', label: 'Other' },
];

interface AddCalendarEntryDialogProps {
  subjects: TeacherSubject[];
  onSave: (input: CustomEntryInput) => Promise<{ success: boolean }>;
  editEntry?: {
    id: string;
    title: string;
    subjectId: string | null;
    examType: string | null;
    examDate: Date | null;
    submissionDeadline: Date;
    status: 'pending' | 'submitted';
    notes: string | null;
  };
  onUpdate?: (id: string, input: Partial<CustomEntryInput>) => Promise<{ success: boolean }>;
  trigger?: React.ReactNode;
}

export function AddCalendarEntryDialog({
  subjects,
  onSave,
  editEntry,
  onUpdate,
  trigger,
}: AddCalendarEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(editEntry?.title || '');
  const [subjectId, setSubjectId] = useState(editEntry?.subjectId || '');
  const [examType, setExamType] = useState(editEntry?.examType || '');
  const [examDate, setExamDate] = useState<Date | undefined>(editEntry?.examDate || undefined);
  const [deadline, setDeadline] = useState<Date | undefined>(editEntry?.submissionDeadline || undefined);
  const [status, setStatus] = useState<'pending' | 'submitted'>(editEntry?.status || 'pending');
  const [notes, setNotes] = useState(editEntry?.notes || '');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editEntry;

  const resetForm = () => {
    if (!isEditing) {
      setTitle('');
      setSubjectId('');
      setExamType('');
      setExamDate(undefined);
      setDeadline(undefined);
      setStatus('pending');
      setNotes('');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!deadline) {
      toast.error('Please select a submission deadline');
      return;
    }

    setSaving(true);
    try {
      const input: CustomEntryInput = {
        title: title.trim(),
        subjectId: subjectId || undefined,
        examType: examType || undefined,
        examDate: examDate || undefined,
        submissionDeadline: deadline,
        status,
        notes: notes.trim() || undefined,
      };

      const result = isEditing && onUpdate
        ? await onUpdate(editEntry!.id, input)
        : await onSave(input);

      if (result.success) {
        toast.success(isEditing ? 'Entry updated' : 'Entry added to calendar');
        resetForm();
        setOpen(false);
      } else {
        toast.error('Failed to save entry');
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-fill title from subject selection
  const handleSubjectChange = (val: string) => {
    setSubjectId(val);
    if (!title.trim() && val) {
      const subj = subjects.find((s) => s.id === val);
      if (subj) setTitle(`${subj.name} (${subj.code})`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Calendar Entry' : 'Add Calendar Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-title">Title *</Label>
            <Input
              id="entry-title"
              placeholder="e.g. Mathematics Paper Submission"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Subject (optional) */}
          <div className="space-y-1.5">
            <Label>Course (optional)</Label>
            <Select value={subjectId} onValueChange={handleSubjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} – {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exam Type */}
          <div className="space-y-1.5">
            <Label>Exam Type (optional)</Label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger>
                <SelectValue placeholder="Select exam type" />
              </SelectTrigger>
              <SelectContent>
                {EXAM_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Submission Deadline */}
            <div className="space-y-1.5">
              <Label>Deadline *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !deadline && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Exam Date */}
            <div className="space-y-1.5">
              <Label>Exam Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !examDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {examDate ? format(examDate, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={examDate}
                    onSelect={setExamDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'pending' | 'submitted')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">🔴 Pending</SelectItem>
                <SelectItem value="submitted">🟢 Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Update' : 'Add to Calendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
