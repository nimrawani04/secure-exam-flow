import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DatesheetEditor } from '@/components/datesheet/DatesheetEditor';
import type { AnnotationStroke } from '@/components/datesheet/AnnotationCanvas';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  ArrowLeft,
  Save,
  Calendar,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Datesheet {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  annotations: Record<number, AnnotationStroke[]>;
  uploaded_by: string;
  created_at: string;
}

export default function DatesheetManagement() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDatesheet, setSelectedDatesheet] = useState<Datesheet | null>(null);
  const [editFileUrl, setEditFileUrl] = useState<string | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<Record<number, AnnotationStroke[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchDatesheets = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('datesheets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error:', error);
    } else {
      setDatesheets(
        (data || []).map((d) => ({
          ...d,
          annotations: (d.annotations as Record<number, AnnotationStroke[]>) || {},
        }))
      );
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDatesheets();
  }, [fetchDatesheets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF, Excel, Word, or image files.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'pdf';
      const filePath = `${user.id}/${fileId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('datesheets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        toast.error('Upload failed: ' + uploadError.message);
        return;
      }

      const { error: dbError } = await supabase.from('datesheets').insert({
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        uploaded_by: user.id,
        annotations: {},
      });

      if (dbError) {
        await supabase.storage.from('datesheets').remove([filePath]);
        toast.error('Failed to save record');
        return;
      }

      toast.success('Datesheet uploaded successfully');
      fetchDatesheets();
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (ds: Datesheet) => {
    await supabase.storage.from('datesheets').remove([ds.file_path]);
    await supabase.from('datesheets').delete().eq('id', ds.id);
    toast.success('Datesheet deleted');
    fetchDatesheets();
    if (selectedDatesheet?.id === ds.id) {
      setSelectedDatesheet(null);
      setEditFileUrl(null);
    }
  };

  const openEditor = async (ds: Datesheet) => {
    // Get signed URL for the file
    const { data } = await supabase.storage
      .from('datesheets')
      .createSignedUrl(ds.file_path, 3600);

    if (!data?.signedUrl) {
      toast.error('Failed to load file');
      return;
    }

    setSelectedDatesheet(ds);
    setEditFileUrl(data.signedUrl);
    setCurrentAnnotations(ds.annotations || {});
  };

  const saveAnnotations = async () => {
    if (!selectedDatesheet) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('datesheets')
      .update({ annotations: currentAnnotations as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', selectedDatesheet.id);

    if (error) {
      toast.error('Failed to save annotations');
    } else {
      toast.success('Annotations saved');
      setSelectedDatesheet({ ...selectedDatesheet, annotations: currentAnnotations });
      fetchDatesheets();
    }
    setIsSaving(false);
  };

  // Editor view
  if (selectedDatesheet && editFileUrl) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedDatesheet(null);
                  setEditFileUrl(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground">{selectedDatesheet.file_name}</h1>
                <p className="text-xs text-muted-foreground">
                  Uploaded {format(new Date(selectedDatesheet.created_at), 'd MMM yyyy, h:mm a')}
                </p>
              </div>
            </div>
            <Button onClick={saveAnnotations} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Annotations
            </Button>
          </div>

          <DatesheetEditor
            fileUrl={editFileUrl}
            fileType={selectedDatesheet.file_type}
            initialAnnotations={selectedDatesheet.annotations}
            onAnnotationsChange={setCurrentAnnotations}
          />
        </div>
      </DashboardLayout>
    );
  }

  // List view
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Datesheet Management</h1>
            <p className="text-muted-foreground mt-1">
              Upload, view, and annotate exam datesheets
            </p>
          </div>
          <div>
            <input
              type="file"
              id="datesheet-upload"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.webp"
              onChange={handleUpload}
            />
            <Button asChild disabled={isUploading}>
              <label htmlFor="datesheet-upload" className="cursor-pointer gap-1.5">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload Datesheet
              </label>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : datesheets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No datesheets uploaded</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Upload a PDF, Excel, or Word file to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {datesheets.map((ds) => {
              const hasAnnotations = Object.values(ds.annotations || {}).some(
                (strokes) => strokes && strokes.length > 0
              );
              return (
                <Card
                  key={ds.id}
                  className="group cursor-pointer transition-all hover:ring-2 hover:ring-ring/30"
                  onClick={() => openEditor(ds)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{ds.file_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(ds.created_at), 'd MMM yyyy')}
                          </div>
                          {hasAnnotations && (
                            <Badge variant="secondary" className="text-[10px]">
                              Annotated
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] mt-1.5">
                          {ds.file_type.includes('pdf')
                            ? 'PDF'
                            : ds.file_type.includes('sheet') || ds.file_type.includes('excel')
                            ? 'Excel'
                            : ds.file_type.includes('word') || ds.file_type.includes('document')
                            ? 'Word'
                            : 'Image'}
                        </Badge>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Datesheet</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{ds.file_name}" and all annotations. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(ds);
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
