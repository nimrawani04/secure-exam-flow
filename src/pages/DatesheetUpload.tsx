import { useState, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadDatesheetEntries, useDatesheetEntries, deleteDatesheetEntry, clearAllDatesheetEntries } from '@/hooks/useDatesheetEntries';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Calendar,
  Clock,
  LinkIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface ParsedRow {
  course_code: string;
  course_name?: string;
  exam_date: string;
  exam_time: string;
  semester?: number;
}

// Normalize column header names
function normalizeHeader(header: string): string {
  const h = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (h.includes('coursecode') || h.includes('subjectcode') || h === 'code') return 'course_code';
  if (h.includes('coursename') || h.includes('subjectname') || h === 'name' || h === 'subject') return 'course_name';
  if (h.includes('date') || h.includes('examdate')) return 'exam_date';
  if (h.includes('time') || h.includes('examtime')) return 'exam_time';
  if (h.includes('sem') || h.includes('semester')) return 'semester';
  return h;
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  // If it's already a Date object (XLSX auto-parses dates)
  if (value instanceof Date) {
    return value.toISOString();
  }
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d).toISOString();
    }
  }
  // Try parsing as string
  const str = String(value).trim();
  // Try common formats
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\\/\-\.]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(parseInt(y.length === 2 ? `20${y}` : y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          reject(new Error('No data found in file'));
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (jsonData.length === 0) {
          reject(new Error('File is empty'));
          return;
        }

        // Map headers
        const firstRow = jsonData[0] as Record<string, any>;
        const headerMap = new Map<string, string>();
        Object.keys(firstRow).forEach((key) => {
          headerMap.set(key, normalizeHeader(key));
        });

        const rows: ParsedRow[] = [];
        for (const rawRow of jsonData) {
          const row = rawRow as Record<string, any>;
          const mapped: Record<string, any> = {};
          for (const [originalKey, normalizedKey] of headerMap) {
            mapped[normalizedKey] = row[originalKey];
          }

          const courseCode = String(mapped.course_code || '').trim();
          if (!courseCode) continue;

          const examDate = parseExcelDate(mapped.exam_date);
          if (!examDate) continue;

          rows.push({
            course_code: courseCode,
            course_name: mapped.course_name ? String(mapped.course_name).trim() : undefined,
            exam_date: examDate,
            exam_time: String(mapped.exam_time || '').trim() || 'TBD',
            semester: mapped.semester ? parseInt(String(mapped.semester)) : undefined,
          });
        }

        if (rows.length === 0) {
          reject(new Error('No valid entries found. Ensure columns: Course Code, Date, Time'));
          return;
        }

        resolve(rows);
      } catch (err) {
        reject(new Error('Failed to parse file. Ensure it is a valid Excel or CSV file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export default function DatesheetUpload() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { entries, isLoading: entriesLoading, refetch } = useDatesheetEntries();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(selectedFile.type) && !['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setParseError('Only Excel (.xlsx, .xls) and CSV files are accepted');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setIsParsing(true);

    try {
      const rows = await parseFile(selectedFile);
      setParsedRows(rows);
    } catch (err: any) {
      setParseError(err.message);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleConfirmUpload = async () => {
    if (!profile?.id || parsedRows.length === 0) return;
    setIsUploading(true);
    try {
      await uploadDatesheetEntries(parsedRows, profile.id);
      toast({ title: 'Datesheet uploaded', description: `${parsedRows.length} entries added successfully.` });
      setFile(null);
      setParsedRows([]);
      refetch();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDatesheetEntry(id);
      toast({ title: 'Entry deleted' });
      refetch();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleClearAll = async () => {
    if (!profile?.id) return;
    try {
      await clearAllDatesheetEntries(profile.id);
      toast({ title: 'All entries cleared' });
      refetch();
    } catch (err: any) {
      toast({ title: 'Clear failed', description: err.message, variant: 'destructive' });
    }
  };

  const resetFile = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Upload Datesheet</h1>
          <p className="text-muted-foreground mt-1">
            Upload an Excel or CSV file to populate the exam calendar automatically.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="rounded-2xl border bg-white/70 dark:bg-card/70 backdrop-blur-md p-5 sm:p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Upload File</h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              'relative min-h-[140px] rounded-xl border-2 border-dashed p-6 transition-colors duration-200 text-center cursor-pointer',
              isDragging ? 'border-accent bg-accent/5' : 'border-border/70 bg-muted/20 hover:border-accent/50',
              file && 'cursor-default'
            )}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetFile}>
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Drop Excel/CSV file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required columns: Course Code, Date, Time. Optional: Course Name, Semester
                  </p>
                </div>
              </div>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              className={cn(file ? 'hidden' : 'absolute inset-0 opacity-0 cursor-pointer z-10')}
            />
          </div>

          {parseError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}

          {isParsing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing file...
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  Preview ({parsedRows.length} entries)
                </h3>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={isUploading}
                  variant="hero"
                  className="gap-2"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm & Upload
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium">Course Code</th>
                      <th className="px-4 py-2.5 text-left font-medium">Course Name</th>
                      <th className="px-4 py-2.5 text-left font-medium">Exam Date</th>
                      <th className="px-4 py-2.5 text-left font-medium">Time</th>
                      <th className="px-4 py-2.5 text-left font-medium">Semester</th>
                      <th className="px-4 py-2.5 text-left font-medium">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => {
                      const examDate = new Date(row.exam_date);
                      const deadline = new Date(examDate.getTime() - 3 * 24 * 60 * 60 * 1000);
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-2.5 font-mono font-medium">{row.course_code}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.course_name || '—'}</td>
                          <td className="px-4 py-2.5">{format(examDate, 'dd MMM yyyy')}</td>
                          <td className="px-4 py-2.5">{row.exam_time}</td>
                          <td className="px-4 py-2.5">{row.semester ?? '—'}</td>
                          <td className="px-4 py-2.5 text-warning">{format(deadline, 'dd MMM yyyy')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Existing Entries */}
        <div className="rounded-2xl border bg-white/70 dark:bg-card/70 backdrop-blur-md p-5 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Current Datesheet</h2>
            {entries.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            )}
          </div>

          {entriesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No datesheet entries yet</p>
              <p className="text-sm mt-1">Upload an Excel or CSV file to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium">Course Code</th>
                    <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                    <th className="px-4 py-2.5 text-left font-medium">Exam Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Time</th>
                    <th className="px-4 py-2.5 text-left font-medium">Sem</th>
                    <th className="px-4 py-2.5 text-left font-medium">Deadline</th>
                    <th className="px-4 py-2.5 text-left font-medium">Mapped</th>
                    <th className="px-4 py-2.5 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-mono font-medium">{entry.course_code}</td>
                      <td className="px-4 py-2.5">{entry.subject_name || entry.course_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {format(new Date(entry.exam_date), 'dd MMM yyyy')}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {entry.exam_time}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{entry.semester ?? '—'}</td>
                      <td className="px-4 py-2.5 text-warning font-medium">
                        {format(new Date(entry.deadline), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-2.5">
                        {entry.subject_id ? (
                          <Badge variant="success" className="gap-1">
                            <LinkIcon className="w-3 h-3" />
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unlinked</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
