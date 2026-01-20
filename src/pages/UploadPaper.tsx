import { useState } from 'react';
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

type ExamType = Database['public']['Enums']['exam_type'];

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

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExamType, setSelectedExamType] = useState<ExamType | ''>('');
  const [selectedSet, setSelectedSet] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const deadline = getDefaultDeadline();
  const isFormValid = file && selectedSubject && selectedExamType && selectedSet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !selectedSubject || !selectedExamType || !selectedSet) {
      toast.error('Please fill in all required fields');
      return;
    }

    const result = await uploadPaper({
      subjectId: selectedSubject,
      examType: selectedExamType,
      setName: selectedSet,
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
    setSelectedSet('');
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Upload Exam Paper</h1>
          <p className="text-muted-foreground mt-1">
            Submit your question paper securely for HOD review
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <PaperDetailsForm
                subjects={subjects}
                isLoadingSubjects={isLoadingSubjects}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedExamType={selectedExamType}
                setSelectedExamType={setSelectedExamType}
                selectedSet={selectedSet}
                setSelectedSet={setSelectedSet}
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
          <UploadSidebar deadline={deadline} />
        </div>
      </div>
    </DashboardLayout>
  );
}
