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

      <p className="text-sm text-muted-foreground">
        Upload one paper per subject and exam type. Need variants? You can upload again later.
      </p>
    </div>
  );
}
