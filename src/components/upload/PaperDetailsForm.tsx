import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeacherSubject } from '@/hooks/useTeacherSubjects';
import type { Database } from '@/integrations/supabase/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ExamType = Database['public']['Enums']['exam_type'];
type PaperOption = 'single' | 'paper1' | 'paper2';

const examTypes: { id: ExamType; name: string }[] = [
  { id: 'mid_term', name: 'Mid Term Examination' },
  { id: 'end_term', name: 'End Term Examination' },
  { id: 'practical', name: 'Practical Examination' },
  { id: 'internal', name: 'Internal Assessment' },
];

interface PaperDetailsFormProps {
  subjects: TeacherSubject[];
  semesters: number[];
  selectedSemester: number | '';
  setSelectedSemester: (value: number | '') => void;
  isLoadingSubjects: boolean;
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  selectedExamType: ExamType | '';
  setSelectedExamType: (value: ExamType | '') => void;
  paperOption: PaperOption;
  setPaperOption: (value: PaperOption) => void;
  paperOptionDisabled?: Partial<Record<PaperOption, boolean>>;
}

export function PaperDetailsForm({
  subjects,
  semesters,
  selectedSemester,
  setSelectedSemester,
  isLoadingSubjects,
  selectedSubject,
  setSelectedSubject,
  selectedExamType,
  setSelectedExamType,
  paperOption,
  setPaperOption,
  paperOptionDisabled,
}: PaperDetailsFormProps) {
  return (
    <div className="bg-card rounded-lg border p-5 space-y-4">
      <div className="pb-3 border-b border-border/60">
        <h2 className="text-lg font-semibold">Paper Details</h2>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="semester">Semester *</Label>
        <Select
          value={selectedSemester ? String(selectedSemester) : ''}
          onValueChange={(value) => setSelectedSemester(value ? Number(value) : '')}
        >
          <SelectTrigger id="semester" className="h-10">
            <SelectValue placeholder={isLoadingSubjects ? 'Loading semesters...' : 'Select semester'} />
          </SelectTrigger>
          <SelectContent>
            {semesters.length === 0 && !isLoadingSubjects ? (
              <SelectItem value="none" disabled>
                No semesters available
              </SelectItem>
            ) : (
              semesters.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>
                  Semester {semester}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <Label htmlFor="subject">Subject *</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger id="subject" className="h-10">
              <SelectValue 
                placeholder={isLoadingSubjects ? 'Loading subjects...' : 'Select subject'} 
              />
            </SelectTrigger>
            <SelectContent>
              {subjects.length === 0 && !isLoadingSubjects ? (
                <SelectItem value="none" disabled>
                  No subjects for this semester
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
              No subjects assigned in this semester. Contact your HOD.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="examType">Exam Type *</Label>
          <Select 
            value={selectedExamType} 
            onValueChange={(v) => setSelectedExamType(v as ExamType)}
          >
            <SelectTrigger id="examType" className="h-10">
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

      <div className="space-y-2.5">
        <Label>Paper Option *</Label>
        <RadioGroup
          value={paperOption}
          onValueChange={(value) => setPaperOption(value as PaperOption)}
          className="grid gap-2 sm:grid-cols-3"
        >
          <div>
            <RadioGroupItem
              value="single"
              id="paper-option-single"
              className="peer sr-only"
              disabled={paperOptionDisabled?.single}
            />
            <Label
              htmlFor="paper-option-single"
              className="flex items-center justify-center rounded-md border border-border/60 px-3 py-2 text-sm font-medium cursor-pointer transition-colors hover:border-accent/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-[state=checked]:text-accent peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-accent/40"
            >
              Single Paper
            </Label>
          </div>
          <div>
            <RadioGroupItem
              value="paper1"
              id="paper-option-1"
              className="peer sr-only"
              disabled={paperOptionDisabled?.paper1}
            />
            <Label
              htmlFor="paper-option-1"
              className="flex items-center justify-center rounded-md border border-border/60 px-3 py-2 text-sm font-medium cursor-pointer transition-colors hover:border-accent/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-[state=checked]:text-accent peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-accent/40"
            >
              Paper 1
            </Label>
          </div>
          <div>
            <RadioGroupItem
              value="paper2"
              id="paper-option-2"
              className="peer sr-only"
              disabled={paperOptionDisabled?.paper2}
            />
            <Label
              htmlFor="paper-option-2"
              className="flex items-center justify-center rounded-md border border-border/60 px-3 py-2 text-sm font-medium cursor-pointer transition-colors hover:border-accent/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-[state=checked]:text-accent peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-accent/40"
            >
              Paper 2
            </Label>
          </div>
        </RadioGroup>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload either a Single paper or two papers as Paper 1 and Paper 2. You cannot upload three papers.
      </p>
    </div>
  );
}
