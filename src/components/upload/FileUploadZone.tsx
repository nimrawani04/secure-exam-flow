import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface FileUploadZoneProps {
  file: File | null;
  setFile: (file: File | null) => void;
  action?: React.ReactNode;
}

export function FileUploadZone({ file, setFile, action }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    <div className="bg-card rounded-lg border p-5">
      <div className="pb-3 border-b border-border/60">
        <h2 className="text-lg font-semibold">Upload File</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a single PDF file for the selected paper option.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!file) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'relative border-2 border-dashed rounded-md p-5 text-center transition-colors duration-200 mt-4',
          !file && 'cursor-pointer',
          isDragging && 'border-accent/60 bg-accent/5',
          file && !error && 'border-success/40 bg-transparent',
          error && 'border-destructive/40 bg-transparent'
        )}
      >
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className={cn(
              'w-11 h-11 rounded-md flex items-center justify-center',
              error ? 'bg-destructive/10' : 'bg-success/10'
            )}>
              <FileText className={cn(
                'w-5 h-5',
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
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2.5" />
            <p className="font-medium mb-1.5">
              Drag and drop your PDF here
            </p>
            <p className="text-sm text-muted-foreground mb-2.5">
              or click to browse files
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Only PDF files are accepted. Maximum file size: 50MB</p>
      </div>

      {action && (
        <div className="mt-4 pt-4 border-t border-border/60 flex justify-end">
          {action}
        </div>
      )}
    </div>
  );
}
