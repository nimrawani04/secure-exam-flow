import { useMemo, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2 } from 'lucide-react';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { useUploadPaper } from '@/hooks/useUploadPaper';
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
  const { subjects, isLoading: isLoadingSubjects } = useTeacherSubjects();
  const { uploadPaper, isUploading, uploadProgress } = useUploadPaper();

  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExamType, setSelectedExamType] = useState<ExamType | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [examSchedule, setExamSchedule] = useState<{ subjectId: string; scheduledDate: Date }[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !selectedSubject || !selectedExamType) {
      toast.error('Please fill in all required fields');
      return;
    }

    const result = await uploadPaper({
      subjectId: selectedSubject,
      examType: selectedExamType,
      setName: 'A',
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
      <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Upload Exam Paper</h1>
          <p className="text-muted-foreground mt-1">
            Submit your question paper securely for HOD review
          </p>
        </div>

      <div className="grid xl:grid-cols-[2.2fr_1fr] gap-8">
        {/* Main Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              />

              <FileUploadZone file={file} setFile={setFile} />

              {/* Upload Progress */}
              {isUploading && (
                <div className="bg-card rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="hero"
                size="xl"
                className="w-full"
                disabled={!isFormValid || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Submit Paper for Review
                  </>
                )}
              </Button>
            </form>
          </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <UploadSidebar deadline={deadline} />
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-3">
            <h3 className="text-lg font-semibold">Date Sheet</h3>
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
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
