import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TeacherSubject } from '@/hooks/useTeacherSubjects';
import type { Database } from '@/integrations/supabase/types';

type ExamType = Database['public']['Enums']['exam_type'];

const examTypes: { id: ExamType; name: string }[] = [
  { id: 'mid_term', name: 'Mid Term Examination' },
  { id: 'end_term', name: 'End Term Examination' },
  { id: 'practical', name: 'Practical Examination' },
  { id: 'internal', name: 'Internal Assessment' },
];

const paperSets = ['A', 'B', 'C'];

interface PaperDetailsFormProps {
  subjects: TeacherSubject[];
  isLoadingSubjects: boolean;
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  selectedExamType: ExamType | '';
  setSelectedExamType: (value: ExamType | '') => void;
  selectedSet: string;
  setSelectedSet: (value: string) => void;
}

export function PaperDetailsForm({
  subjects,
  isLoadingSubjects,
  selectedSubject,
  setSelectedSubject,
  selectedExamType,
  setSelectedExamType,
  selectedSet,
  setSelectedSet,
}: PaperDetailsFormProps) {
  return (
    <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
      <h2 className="text-lg font-semibold">Paper Details</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger id="subject" className="h-12">
              <SelectValue 
                placeholder={isLoadingSubjects ? 'Loading subjects...' : 'Select subject'} 
              />
            </SelectTrigger>
            <SelectContent>
              {subjects.length === 0 && !isLoadingSubjects ? (
                <SelectItem value="none" disabled>
                  No subjects assigned
                </SelectItem>
              ) : (
                subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {subjects.length === 0 && !isLoadingSubjects && (
            <p className="text-sm text-destructive">
              No subjects assigned to you. Contact your HOD.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="examType">Exam Type *</Label>
          <Select 
            value={selectedExamType} 
            onValueChange={(v) => setSelectedExamType(v as ExamType)}
          >
            <SelectTrigger id="examType" className="h-12">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {examTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Paper Set *</Label>
        <div className="flex gap-3">
          {paperSets.map((set) => (
            <button
              key={set}
              type="button"
              onClick={() => setSelectedSet(set)}
              className={cn(
                'w-16 h-12 rounded-lg border-2 font-semibold transition-all duration-200',
                selectedSet === set
                  ? 'border-accent bg-accent/10 text-accent shadow-glow'
                  : 'border-border hover:border-accent/50'
              )}
            >
              Set {set}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          You can upload multiple paper sets for the same subject
        </p>
      </div>
    </div>
  );
}
