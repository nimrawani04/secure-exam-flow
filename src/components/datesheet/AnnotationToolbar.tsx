import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  Palette,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ToolType } from './AnnotationCanvas';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#000000', // black
  '#6b7280', // gray
  '#ffffff', // white
];

interface AnnotationToolbarProps {
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function AnnotationToolbar({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  onClear,
  onExport,
  canUndo,
  canRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: AnnotationToolbarProps) {
  const tools: { type: ToolType; icon: typeof Pen; label: string }[] = [
    { type: 'pen', icon: Pen, label: 'Pen' },
    { type: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    { type: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-card p-2 shadow-sm">
      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
        {tools.map(({ type, icon: Icon, label }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={tool === type ? 'default' : 'ghost'}
                className="h-8 w-8 p-0"
                onClick={() => setTool(type)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Color picker */}
      {tool !== 'eraser' && (
        <div className="flex items-center gap-1 border-r pr-2 mr-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <div
                  className="h-5 w-5 rounded-full border-2 border-border"
                  style={{ backgroundColor: color }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      color === c ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Stroke width */}
      <div className="flex items-center gap-2 border-r pr-2 mr-1 min-w-[100px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {strokeWidth}px
              </span>
              <Slider
                value={[strokeWidth]}
                onValueChange={([v]) => setStrokeWidth(v)}
                min={1}
                max={20}
                step={1}
                className="w-16"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Stroke Width</TooltipContent>
        </Tooltip>
      </div>

      {/* Undo / Redo / Clear */}
      <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={onClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear All</TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>

      {/* Page Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[50px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Export */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onExport}>
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export Annotated</TooltipContent>
      </Tooltip>
    </div>
  );
}
