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
}: PaperDetailsFormProps) {
  return (
    <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
      <h2 className="text-lg font-semibold">Paper Details</h2>

      <div className="space-y-2">
        <Label htmlFor="semester">Semester *</Label>
        <Select
          value={selectedSemester ? String(selectedSemester) : ''}
          onValueChange={(value) => setSelectedSemester(value ? Number(value) : '')}
        >
          <SelectTrigger id="semester" className="h-12">
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

      <div className="space-y-3">
        <Label>Paper Option *</Label>
        <RadioGroup
          value={paperOption}
          onValueChange={(value) => setPaperOption(value as PaperOption)}
          className="grid gap-3 md:grid-cols-3"
        >
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <RadioGroupItem value="single" />
            <span className="text-sm font-medium">Single Paper</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <RadioGroupItem value="paper1" />
            <span className="text-sm font-medium">Paper 1</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <RadioGroupItem value="paper2" />
            <span className="text-sm font-medium">Paper 2</span>
          </label>
        </RadioGroup>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload one paper per subject and exam type. To submit two papers, upload Paper 1 and Paper 2 separately.
      </p>
    </div>
  );
}
