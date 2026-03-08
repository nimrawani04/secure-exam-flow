import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

export type ToolType = 'pen' | 'highlighter' | 'eraser';

export interface AnnotationStroke {
  tool: ToolType;
  color: string;
  width: number;
  opacity: number;
  points: { x: number; y: number }[];
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  strokes: AnnotationStroke[];
  onStrokesChange: (strokes: AnnotationStroke[]) => void;
  className?: string;
}

export function AnnotationCanvas({
  width,
  height,
  tool,
  color,
  strokeWidth,
  strokes,
  onStrokesChange,
  className,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<AnnotationStroke | null>(null);

  const getToolConfig = useCallback(
    (t: ToolType, c: string, w: number) => {
      switch (t) {
        case 'pen':
          return { color: c, width: w, opacity: 1, composite: 'source-over' as GlobalCompositeOperation };
        case 'highlighter':
          return { color: c, width: w * 3, opacity: 0.3, composite: 'source-over' as GlobalCompositeOperation };
        case 'eraser':
          return { color: '#ffffff', width: w * 2, opacity: 1, composite: 'destination-out' as GlobalCompositeOperation };
      }
    },
    []
  );

  // Redraw all strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      const cfg = getToolConfig(stroke.tool, stroke.color, stroke.width);
      ctx.save();
      ctx.globalAlpha = cfg.opacity;
      ctx.globalCompositeOperation = cfg.composite;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = cfg.width;
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
  }, [strokes, width, height, getToolConfig]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoords(e);
    const cfg = getToolConfig(tool, color, strokeWidth);
    currentStrokeRef.current = {
      tool,
      color: cfg.color,
      width: cfg.width,
      opacity: cfg.opacity,
      points: [coords],
    };
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    e.preventDefault();
    const coords = getCoords(e);
    currentStrokeRef.current.points.push(coords);
    redraw();
  };

  const stopDrawing = () => {
    if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
      onStrokesChange([...strokes, currentStrokeRef.current]);
    }
    currentStrokeRef.current = null;
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn('absolute inset-0 cursor-crosshair touch-none', className)}
      style={{ width: '100%', height: '100%' }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
}
