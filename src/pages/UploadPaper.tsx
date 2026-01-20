import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeadlineTimer } from '@/components/dashboard/DeadlineTimer';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Shield,
  Lock,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const subjects = [
  { id: 's1', name: 'Data Structures', code: 'CS201' },
  { id: 's2', name: 'Algorithms', code: 'CS301' },
  { id: 's3', name: 'Database Systems', code: 'CS302' },
];

const examTypes = [
  { id: 'mid_term', name: 'Mid Term Examination' },
  { id: 'end_term', name: 'End Term Examination' },
  { id: 'practical', name: 'Practical Examination' },
  { id: 'internal', name: 'Internal Assessment' },
];

const paperSets = ['A', 'B', 'C'];

const deadline = new Date();
deadline.setDate(deadline.getDate() + 5);
deadline.setHours(23, 59, 59);

export default function UploadPaper() {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === 'application/pdf') {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject || !selectedExamType || !selectedSet) return;

    setIsUploading(true);
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsUploading(false);
    setUploadSuccess(true);
  };

  const isFormValid = file && selectedSubject && selectedExamType && selectedSet;

  if (uploadSuccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Paper Uploaded Successfully!</h1>
          <p className="text-muted-foreground mb-8">
            Your paper has been encrypted and submitted for HOD review. 
            You'll receive a notification once it's reviewed.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" onClick={() => setUploadSuccess(false)}>
              Upload Another
            </Button>
            <Button variant="hero">View Submissions</Button>
          </div>
        </div>
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
              {/* Subject Selection */}
              <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
                <h2 className="text-lg font-semibold">Paper Details</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger id="subject" className="h-12">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name} ({subject.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="examType">Exam Type *</Label>
                    <Select value={selectedExamType} onValueChange={setSelectedExamType}>
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

              {/* File Upload */}
              <div className="bg-card rounded-2xl border p-6 shadow-card">
                <h2 className="text-lg font-semibold mb-4">Upload File</h2>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                    isDragging && 'border-accent bg-accent/5',
                    file && 'border-success bg-success/5'
                  )}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-success" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium mb-2">
                        Drag and drop your PDF here
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse files
                      </p>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Only PDF files are accepted. Maximum file size: 25MB</p>
                </div>
              </div>

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
                    <span className="animate-spin mr-2">⏳</span>
                    Encrypting & Uploading...
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
            {/* Deadline */}
            <DeadlineTimer deadline={deadline} label="Submission Deadline" />

            {/* Security Info */}
            <div className="bg-card rounded-xl border p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                Security Features
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>End-to-end encryption during upload</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>No direct file URL access</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>Auto-lock after deadline</span>
                </li>
              </ul>
            </div>

            {/* Guidelines */}
            <div className="bg-accent/10 rounded-xl border border-accent/20 p-4">
              <h4 className="font-semibold text-accent mb-3">📋 Guidelines</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Include clear instructions for students</li>
                <li>• Verify question count and marks</li>
                <li>• Check for typos and formatting</li>
                <li>• Ensure PDF is not password protected</li>
                <li>• Upload before deadline to avoid issues</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
