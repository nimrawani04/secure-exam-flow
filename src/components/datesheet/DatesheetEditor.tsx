import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationCanvas, type AnnotationStroke, type ToolType } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { Loader2 } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DatesheetEditorProps {
  fileUrl: string;
  fileType: string;
  initialAnnotations?: Record<number, AnnotationStroke[]>;
  onAnnotationsChange?: (annotations: Record<number, AnnotationStroke[]>) => void;
}

export function DatesheetEditor({
  fileUrl,
  fileType,
  initialAnnotations,
  onAnnotationsChange,
}: DatesheetEditorProps) {
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 800, height: 1100 });
  const [isRendering, setIsRendering] = useState(true);
  const [annotations, setAnnotations] = useState<Record<number, AnnotationStroke[]>>(
    initialAnnotations || {}
  );
  const [undoStack, setUndoStack] = useState<Record<number, AnnotationStroke[][]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, AnnotationStroke[][]>>({});

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStrokes = annotations[currentPage] || [];

  // Render PDF page to image
  const renderPdfPage = useCallback(async (pageNum: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;

    setIsRendering(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 }); // High-res render

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      setPageImage(canvas.toDataURL('image/png'));
      setPageSize({ width: viewport.width, height: viewport.height });
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  // Load PDF
  useEffect(() => {
    if (fileType !== 'application/pdf' && !fileType.includes('pdf')) return;

    let cancelled = false;
    const loadPdf = async () => {
      setIsRendering(true);
      try {
        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        await renderPdfPage(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setIsRendering(false);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl, fileType, renderPdfPage]);

  // Load image files
  useEffect(() => {
    if (fileType.startsWith('image/')) {
      setIsRendering(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setPageSize({ width: img.naturalWidth, height: img.naturalHeight });
        setPageImage(fileUrl);
        setTotalPages(1);
        setIsRendering(false);
      };
      img.onerror = () => setIsRendering(false);
      img.src = fileUrl;
    }
  }, [fileUrl, fileType]);

  // Page navigation
  useEffect(() => {
    if (pdfDocRef.current && currentPage >= 1) {
      renderPdfPage(currentPage);
    }
  }, [currentPage, renderPdfPage]);

  // Propagate annotation changes
  useEffect(() => {
    onAnnotationsChange?.(annotations);
  }, [annotations, onAnnotationsChange]);

  const handleStrokesChange = (newStrokes: AnnotationStroke[]) => {
    // Push current to undo stack
    setUndoStack((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), currentStrokes],
    }));
    setRedoStack((prev) => ({ ...prev, [currentPage]: [] }));

    setAnnotations((prev) => ({ ...prev, [currentPage]: newStrokes }));
  };

  const handleUndo = () => {
    const stack = undoStack[currentPage] || [];
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    setRedoStack((r) => ({
      ...r,
      [currentPage]: [...(r[currentPage] || []), currentStrokes],
    }));
    setUndoStack((u) => ({
      ...u,
      [currentPage]: stack.slice(0, -1),
    }));
    setAnnotations((a) => ({ ...a, [currentPage]: prev }));
  };

  const handleRedo = () => {
    const stack = redoStack[currentPage] || [];
    if (stack.length === 0) return;
    const next = stack[stack.length - 1];
    setUndoStack((u) => ({
      ...u,
      [currentPage]: [...(u[currentPage] || []), currentStrokes],
    }));
    setRedoStack((r) => ({
      ...r,
      [currentPage]: stack.slice(0, -1),
    }));
    setAnnotations((a) => ({ ...a, [currentPage]: next }));
  };

  const handleClear = () => {
    if (currentStrokes.length === 0) return;
    setUndoStack((u) => ({
      ...u,
      [currentPage]: [...(u[currentPage] || []), currentStrokes],
    }));
    setRedoStack((r) => ({ ...r, [currentPage]: [] }));
    setAnnotations((a) => ({ ...a, [currentPage]: [] }));
  };

  const handleExport = () => {
    // Merge page image + annotations into a single image
    const canvas = document.createElement('canvas');
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, pageSize.width, pageSize.height);

      // Draw annotations on top
      for (const stroke of currentStrokes) {
        if (stroke.points.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = stroke.opacity;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      const link = document.createElement('a');
      link.download = `annotated-page-${currentPage}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = pageImage || '';
  };

  const canUndo = (undoStack[currentPage] || []).length > 0;
  const canRedo = (redoStack[currentPage] || []).length > 0;

  return (
    <div className="flex flex-col gap-3">
      <AnnotationToolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onExport={handleExport}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.25, 3))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
      />

      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border bg-muted/30"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {isRendering ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Rendering page…</span>
          </div>
        ) : pageImage ? (
          <div
            className="relative mx-auto"
            style={{
              width: pageSize.width * zoom * 0.5,
              height: pageSize.height * zoom * 0.5,
            }}
          >
            <img
              src={pageImage}
              alt={`Page ${currentPage}`}
              className="w-full h-full select-none pointer-events-none"
              draggable={false}
            />
            <AnnotationCanvas
              width={pageSize.width}
              height={pageSize.height}
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              strokes={currentStrokes}
              onStrokesChange={handleStrokesChange}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            No preview available for this file type
          </div>
        )}
      </div>
    </div>
  );
}
