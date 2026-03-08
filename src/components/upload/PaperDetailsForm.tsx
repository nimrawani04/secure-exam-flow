import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeacherSubject } from '@/hooks/useTeacherSubjects';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type PaperOption = 'single' | 'paper1' | 'paper2';
export type UploadExamTypeOption =
  | 'cia_1'
  | 'cia_2'
  | 'end_semester'
  | 'external_practical'
  | 'internal_practical';

const examTypes: { id: UploadExamTypeOption; name: string }[] = [
  { id: 'cia_1', name: 'CIA 1' },
  { id: 'cia_2', name: 'CIA 2' },
  { id: 'end_semester', name: 'END SEMSTER' },
  { id: 'external_practical', name: 'EXTERNAL PRACTICAL' },
  { id: 'internal_practical', name: 'INTERNAL PRACTICAL' },
];

interface PaperDetailsFormProps {
  subjects: TeacherSubject[];
  semesters: number[];
  selectedSemester: number | '';
  setSelectedSemester: (value: number | '') => void;
  isLoadingSubjects: boolean;
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  selectedExamType: UploadExamTypeOption | '';
  setSelectedExamType: (value: UploadExamTypeOption | '') => void;
  paperOption: PaperOption;
  setPaperOption: (value: PaperOption) => void;
  paperOptionDisabled?: Partial<Record<PaperOption, boolean>>;
  paperOptionMuted?: Partial<Record<PaperOption, boolean>>;
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
  paperOptionMuted,
}: PaperDetailsFormProps) {
  return (
    <div className="space-y-3.5 sm:space-y-4 sm:bg-card sm:rounded-lg sm:border sm:p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold sm:text-lg">Paper Details</h2>
        <div className="h-px bg-border/60 sm:hidden mt-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2.5">
          <Label htmlFor="semester">Semester *</Label>
          <Select
            value={selectedSemester ? String(selectedSemester) : ''}
            onValueChange={(value) => setSelectedSemester(value ? Number(value) : '')}
          >
            <SelectTrigger id="semester">
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

        <div className="space-y-1.5 sm:space-y-2.5">
          <Label htmlFor="examType">Exam Type *</Label>
          <Select 
            value={selectedExamType} 
            onValueChange={(v) => setSelectedExamType(v as UploadExamTypeOption)}
          >
            <SelectTrigger id="examType">
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

      <div className="space-y-1.5 sm:space-y-2.5">
        <Label htmlFor="subject">Subject *</Label>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger id="subject">
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
          <p className="text-xs text-destructive">
            No subjects assigned in this semester. Contact your HOD.
          </p>
        )}
      </div>

      <div className="space-y-1.5 sm:space-y-2.5">
        <Label>Paper Option *</Label>
        <RadioGroup
          value={paperOption}
          onValueChange={(value) => setPaperOption(value as PaperOption)}
          className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:mt-0 sm:overflow-visible"
        >
          {([
            { value: 'single' as PaperOption, label: 'Single Paper', shortLabel: 'Single' },
            { value: 'paper1' as PaperOption, label: 'Paper 1', shortLabel: 'Paper 1' },
            { value: 'paper2' as PaperOption, label: 'Paper 2', shortLabel: 'Paper 2' },
          ] as const).map((opt) => {
            const isDisabled = paperOptionDisabled?.[opt.value];
            const isMuted = paperOptionMuted?.[opt.value] && paperOption !== opt.value;
            return (
              <div key={opt.value} className="shrink-0">
                <RadioGroupItem
                  value={opt.value}
                  id={`paper-option-${opt.value}`}
                  className="peer sr-only"
                  disabled={isDisabled}
                />
                <Label
                  htmlFor={`paper-option-${opt.value}`}
                  className={cn(
                    'flex h-9 min-w-[92px] items-center justify-center whitespace-nowrap rounded-full border border-border/60 bg-background px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors hover:border-accent/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-[state=checked]:bg-accent/10 peer-data-[state=checked]:border-accent/40 peer-data-[state=checked]:text-accent sm:h-10 sm:min-w-[96px]',
                    isMuted && !isDisabled && 'opacity-40'
                  )}
                >
                  <span className="sm:hidden">{opt.shortLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {paperOption === 'single'
            ? 'Single paper selected — Paper 1 & Paper 2 are unavailable.'
            : 'Paper 1 / Paper 2 mode — Single paper is unavailable.'}
        </p>
      </div>

      <p className="text-xs text-muted-foreground/70 mt-2">
        Upload a single paper or split as Paper 1 and Paper 2. You cannot upload three papers.
      </p>
    </div>
  );
}
