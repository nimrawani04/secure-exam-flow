import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface FileUploadZoneProps {
  file: File | null;
  setFile: (file: File | null) => void;
}

export function FileUploadZone({ file, setFile }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (selectedFile: File): boolean => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are accepted');
      return false;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 50MB');
      return false;
    }
    setError(null);
    return true;
  };

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
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-card">
      <h2 className="text-lg font-semibold mb-4">Upload File</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          isDragging && 'border-accent bg-accent/5',
          file && !error && 'border-success bg-success/5',
          error && 'border-destructive bg-destructive/5'
        )}
      >
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center',
              error ? 'bg-destructive/20' : 'bg-success/20'
            )}>
              <FileText className={cn(
                'w-6 h-6',
                error ? 'text-destructive' : 'text-success'
              )} />
            </div>
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
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
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Only PDF files are accepted. Maximum file size: 50MB</p>
      </div>
    </div>
  );
}
