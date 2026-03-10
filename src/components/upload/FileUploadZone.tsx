import { useRef, useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, X, AlertCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
}

function PdfPreviewDialog({ open, onClose, file }: PdfPreviewDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const renderPage = useCallback(async (pageNum: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const page = await doc.getPage(pageNum);
    const containerWidth = canvas.parentElement?.clientWidth || 360;
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }, []);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;

    const loadPdf = async () => {
      const arrayBuffer = await file.arrayBuffer();
      if (cancelled) return;
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (cancelled) return;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setCurrentPage(1);
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [open, file]);

  useEffect(() => {
    if (open && totalPages > 0) {
      renderPage(currentPage);
    }
  }, [open, currentPage, totalPages, renderPage]);

  useEffect(() => {
    if (!open) {
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
      setTotalPages(0);
      setCurrentPage(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm truncate">Preview: {file?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-lg border bg-muted/30">
          {totalPages > 0 ? (
            <canvas ref={canvasRef} className="mx-auto block" />
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-muted-foreground">Loading preview…</p>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button" variant="outline" size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button" variant="outline" size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FileUploadZoneProps {
  file: File | null;
  setFile: (file: File | null) => void;
  action?: React.ReactNode;
}

export function FileUploadZone({ file, setFile, action }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const replaceFile = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const previewFile = () => {
    if (!file) return;
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
  };

  return (
    <div className="space-y-4 sm:bg-card sm:rounded-lg sm:border sm:p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold sm:text-lg">Upload File</h2>
        <div className="h-px bg-border/60 mt-2 sm:hidden" />
        <p className="text-xs text-muted-foreground/70">
          Upload one PDF for the selected paper option.
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
          'relative min-h-[124px] rounded-xl border-2 border-dashed border-border/70 bg-muted/40 p-6 transition-colors duration-200 focus-within:border-accent focus-within:bg-accent/5 sm:min-h-[72px] sm:border sm:bg-muted/20 sm:p-4',
          !file && 'cursor-pointer',
          isDragging && 'border-accent bg-accent/5',
          file && !error && 'border-success/40 bg-transparent',
          error && 'border-destructive/40 bg-transparent'
        )}
      >
        {file ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4">
              <div
                className={cn(
                  'w-11 h-11 rounded-md flex items-center justify-center',
                  error ? 'bg-destructive/10' : 'bg-success/10'
                )}
              >
                <FileText
                  className={cn(
                    'w-5 h-5',
                    error ? 'text-destructive' : 'text-success'
                  )}
                />
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
                title="Cancel paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={previewFile}>
                <Eye className="w-4 h-4" />
                Preview PDF
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={replaceFile}>
                Replace
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={removeFile}>
                Cancel Paper
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:justify-start sm:text-left">
              <div className="w-9 h-9 rounded-lg bg-background/70 flex items-center justify-center border border-border/60">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Upload PDF</p>
                <p className="text-xs text-muted-foreground/70">
                  Tap to select or drag file
                </p>
              </div>
            </div>
          </>
        )}
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className={cn(
            file ? 'hidden' : 'absolute inset-0 opacity-0 cursor-pointer z-10'
          )}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground/70">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>PDF only - Max 50MB</p>
      </div>

      {action && (
        <div className="mt-4 hidden justify-end sm:flex sm:border-t sm:border-border/60 sm:pt-4">
          {action}
        </div>
      )}

      {/* Preview Dialog - Canvas-based for mobile compatibility */}
      <PdfPreviewDialog
        open={previewOpen}
        onClose={closePreview}
        file={file}
      />
    </div>
  );
}
