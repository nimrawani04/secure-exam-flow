import { useMemo, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2 } from 'lucide-react';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { useUploadPaper } from '@/hooks/useUploadPaper';
import { useAuth } from '@/contexts/AuthContext';
import { PaperDetailsForm } from '@/components/upload/PaperDetailsForm';
import { FileUploadZone } from '@/components/upload/FileUploadZone';
import { UploadSidebar } from '@/components/upload/UploadSidebar';
import { UploadSuccess } from '@/components/upload/UploadSuccess';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type ExamType = Database['public']['Enums']['exam_type'];
type ExamSession = Database['public']['Tables']['exam_sessions']['Row'];

// Default deadline: 5 days from now
const getDefaultDeadline = () => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 5);
  deadline.setHours(23, 59, 59);
  return deadline;
};

export default function UploadPaper() {
  const { user } = useAuth();
  const { subjects, isLoading: isLoadingSubjects } = useTeacherSubjects();
  const { uploadPaper, isUploading, uploadProgress } = useUploadPaper();

  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExamType, setSelectedExamType] = useState<ExamType | ''>('');
  const [paperOption, setPaperOption] = useState<'single' | 'paper1' | 'paper2'>('single');
  const [file, setFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [examSchedule, setExamSchedule] = useState<{ subjectId: string; scheduledDate: Date }[]>([]);
  const [existingSetNames, setExistingSetNames] = useState<string[]>([]);

  const defaultDeadline = useMemo(() => getDefaultDeadline(), []);

  const semesters = useMemo(() => {
    const unique = new Set(subjects.map((subject) => subject.semester));
    return Array.from(unique).sort((a, b) => a - b);
  }, [subjects]);

  useEffect(() => {
    if (selectedSemester || semesters.length === 0) return;
    if (examSchedule.length === 0) {
      setSelectedSemester(semesters[0]);
      return;
    }
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const earliest = examSchedule
      .map((item) => ({ ...item, subject: subjectMap.get(item.subjectId) }))
      .filter((item) => item.subject)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())[0];
    if (earliest?.subject?.semester) {
      setSelectedSemester(earliest.subject.semester);
    } else {
      setSelectedSemester(semesters[0]);
    }
  }, [selectedSemester, semesters, examSchedule, subjects]);

  const filteredSubjects = useMemo(() => {
    if (!selectedSemester) return [];
    const scheduleMap = new Map<string, Date>();
    examSchedule.forEach((item) => scheduleMap.set(item.subjectId, item.scheduledDate));

    return subjects
      .filter((subject) => subject.semester === selectedSemester)
      .sort((a, b) => {
        const dateA = scheduleMap.get(a.id)?.getTime();
        const dateB = scheduleMap.get(b.id)?.getTime();
        if (dateA && dateB && dateA !== dateB) return dateA - dateB;
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [subjects, selectedSemester, examSchedule]);

  useEffect(() => {
    if (selectedSubject && !filteredSubjects.some((subject) => subject.id === selectedSubject)) {
      setSelectedSubject('');
    }
  }, [filteredSubjects, selectedSubject]);

  useEffect(() => {
    let isMounted = true;

    async function fetchSessions() {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, name, exam_type, submission_start, submission_end, is_active, exam_date')
        .order('submission_end', { ascending: true });

      if (!error && data && isMounted) {
        setSessions(data);
      }
    }

    fetchSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchExamSchedule() {
      if (subjects.length === 0) {
        setExamSchedule([]);
        return;
      }

      const subjectIds = subjects.map((subject) => subject.id);
      const { data, error } = await supabase
        .from('exams')
        .select('subject_id, scheduled_date')
        .in('subject_id', subjectIds)
        .order('scheduled_date', { ascending: true });

      if (!error && data && isMounted) {
        const mapped = data
          .map((row) => ({
            subjectId: row.subject_id,
            scheduledDate: new Date(row.scheduled_date),
          }))
          .filter((row) => !Number.isNaN(row.scheduledDate.getTime()));
        setExamSchedule(mapped);
      }
    }

    fetchExamSchedule();

    return () => {
      isMounted = false;
    };
  }, [subjects]);

  useEffect(() => {
    let isMounted = true;

    async function fetchExistingSets() {
      if (!selectedSubject || !selectedExamType || !user) {
        if (isMounted) setExistingSetNames([]);
        return;
      }

      const { data, error } = await supabase
        .from('exam_papers')
        .select('set_name')
        .eq('subject_id', selectedSubject)
        .eq('exam_type', selectedExamType)
        .eq('uploaded_by', user.id);

      if (!error && data && isMounted) {
        const unique = Array.from(new Set(data.map((row) => row.set_name)));
        setExistingSetNames(unique);
      }
    }

    fetchExistingSets();

    return () => {
      isMounted = false;
    };
  }, [selectedSubject, selectedExamType, user]);

  const dateSheet = useMemo(() => {
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    return examSchedule
      .map((item) => ({
        ...item,
        subject: subjectMap.get(item.subjectId),
      }))
      .filter((item) => item.subject)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }, [examSchedule, subjects]);

  const deadline = useMemo(() => {
    if (!selectedExamType) {
      return defaultDeadline;
    }

    const now = Date.now();
    const matching = sessions.filter(
      (session) => session.exam_type === selectedExamType && (session.is_active ?? true)
    );
    const upcoming = matching
      .map((session) => ({ session, end: new Date(session.submission_end) }))
      .filter((item) => !Number.isNaN(item.end.getTime()) && item.end.getTime() > now)
      .sort((a, b) => a.end.getTime() - b.end.getTime())[0];

    return upcoming ? upcoming.end : defaultDeadline;
  }, [selectedExamType, sessions, defaultDeadline]);

  const isFormValid = file && selectedSubject && selectedExamType;
  const existingSetLookup = useMemo(() => new Set(existingSetNames), [existingSetNames]);
  const hasSingle = existingSetLookup.has('Single');
  const hasPaper1 = existingSetLookup.has('Paper 1');
  const hasPaper2 = existingSetLookup.has('Paper 2');
  const allowSingle = !(hasPaper1 || hasPaper2);
  const allowPaper1 = !hasSingle;
  const allowPaper2 = !hasSingle;

  useEffect(() => {
    const isCurrentAllowed =
      (paperOption === 'single' && allowSingle) ||
      (paperOption === 'paper1' && allowPaper1) ||
      (paperOption === 'paper2' && allowPaper2);

    if (!isCurrentAllowed) {
      if (allowSingle) setPaperOption('single');
      else if (allowPaper1) setPaperOption('paper1');
      else if (allowPaper2) setPaperOption('paper2');
    }
  }, [paperOption, allowSingle, allowPaper1, allowPaper2]);

  const setNameForOption = (option: 'single' | 'paper1' | 'paper2') => {
    switch (option) {
      case 'paper1':
        return 'Paper 1';
      case 'paper2':
        return 'Paper 2';
      default:
        return 'Single';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !selectedSubject || !selectedExamType) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (paperOption === 'single' && !allowSingle) {
      toast.error('Single paper is not allowed when Paper 1 or Paper 2 already exists.');
      return;
    }

    if ((paperOption === 'paper1' || paperOption === 'paper2') && !allowPaper1) {
      toast.error('Paper 1 / Paper 2 are not allowed when a Single paper already exists.');
      return;
    }

    const result = await uploadPaper({
      subjectId: selectedSubject,
      examType: selectedExamType,
      setName: setNameForOption(paperOption),
      deadline,
      file,
    });

    if (result.success) {
      setUploadSuccess(true);
    } else {
      toast.error(result.error || 'Upload failed');
    }
  };

  const resetForm = () => {
    setSelectedSubject('');
    setSelectedExamType('');
    setPaperOption('single');
    setFile(null);
    setUploadSuccess(false);
  };

  if (uploadSuccess) {
    return (
      <DashboardLayout>
        <UploadSuccess onUploadAnother={resetForm} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6">
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-lg font-semibold sm:text-4xl sm:font-bold">Upload Exam Paper</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Submit your question paper securely for HOD review
          </p>
        </div>

        <div className="md:hidden space-y-5 pb-28">
          <form
            id="upload-paper-form-mobile"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <PaperDetailsForm
              subjects={filteredSubjects}
              semesters={semesters}
              selectedSemester={selectedSemester}
              setSelectedSemester={setSelectedSemester}
              isLoadingSubjects={isLoadingSubjects}
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              selectedExamType={selectedExamType}
              setSelectedExamType={setSelectedExamType}
              paperOption={paperOption}
              setPaperOption={setPaperOption}
              paperOptionDisabled={{
                single: !allowSingle,
                paper1: !allowPaper1,
                paper2: !allowPaper2,
              }}
            />

            <FileUploadZone
              file={file}
              setFile={setFile}
            />

            {isUploading && (
              <div className="rounded-md border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </form>

          <UploadSidebar deadline={deadline} />
        </div>

        <div className="hidden md:flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-stretch">
          <div className="space-y-5 sm:space-y-6 flex flex-col lg:flex-[2.2] lg:self-stretch">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 flex flex-col h-full">
              <PaperDetailsForm
                subjects={filteredSubjects}
                semesters={semesters}
                selectedSemester={selectedSemester}
                setSelectedSemester={setSelectedSemester}
                isLoadingSubjects={isLoadingSubjects}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedExamType={selectedExamType}
                setSelectedExamType={setSelectedExamType}
                paperOption={paperOption}
                setPaperOption={setPaperOption}
                paperOptionDisabled={{
                  single: !allowSingle,
                  paper1: !allowPaper1,
                  paper2: !allowPaper2,
                }}
              />

              <FileUploadZone
                file={file}
                setFile={setFile}
                action={
                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full sm:w-auto h-11 rounded-[10px] shadow-none sm:min-w-[240px] sm:h-10 sm:rounded-md"
                    disabled={!isFormValid || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit Paper for Review
                      </>
                    )}
                  </Button>
                }
              />

              {isUploading && (
                <div className="rounded-md border border-border/60 p-3 sm:p-5 sm:bg-card sm:rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </form>
          </div>

          <div className="flex flex-col gap-4 lg:flex-1 lg:self-stretch">
            <UploadSidebar deadline={deadline} />
            <div className="bg-card rounded-lg border p-5 space-y-3">
              <h3 className="text-base font-semibold">Date Sheet</h3>
              {dateSheet.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No exam dates available yet. Please check back later.
                </p>
              ) : (
                <div className="space-y-3">
                  {dateSheet.map((item) => (
                    <div
                      key={`${item.subjectId}-${item.scheduledDate.toISOString()}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {item.subject?.name} ({item.subject?.code})
                        </p>
                        <p className="text-muted-foreground">Semester {item.subject?.semester}</p>
                      </div>
                      <span className="text-muted-foreground">
                        {item.scheduledDate.toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 backdrop-blur md:hidden">
        <Button
          type="submit"
          form="upload-paper-form-mobile"
          variant="hero"
          className="h-11 w-full rounded-xl text-sm font-medium shadow-none"
          disabled={!isFormValid || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Submit Paper for Review
            </>
          )}
        </Button>
      </div>
    </DashboardLayout>
  );
}
