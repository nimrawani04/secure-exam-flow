import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ExamType = Database['public']['Enums']['exam_type'];

interface UploadPaperParams {
  subjectId: string;
  examType: ExamType;
  setName: string;
  deadline: Date;
  file: File;
}

interface UploadResult {
  success: boolean;
  paperId?: string;
  error?: string;
}

export function useUploadPaper() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadPaper = async (params: UploadPaperParams): Promise<UploadResult> => {
    if (!user) {
      return { success: false, error: 'You must be logged in to upload papers' };
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path: userId/paperId.pdf
      const paperId = crypto.randomUUID();
      const filePath = `${user.id}/${paperId}.pdf`;

      setUploadProgress(20);

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('exam-papers')
        .upload(filePath, params.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return { success: false, error: 'Failed to upload file. Please try again.' };
      }

      setUploadProgress(60);

      // Create exam_papers record
      const { data: paper, error: dbError } = await supabase
        .from('exam_papers')
        .insert({
          id: paperId,
          subject_id: params.subjectId,
          exam_type: params.examType,
          set_name: params.setName,
          deadline: params.deadline.toISOString(),
          file_path: filePath,
          uploaded_by: user.id,
          status: 'pending_review',
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        // Try to clean up the uploaded file
        await supabase.storage.from('exam-papers').remove([filePath]);
        return { success: false, error: 'Failed to save paper record. Please try again.' };
      }

      setUploadProgress(80);

      // Create audit log entry
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'upload',
        entity_type: 'paper',
        entity_id: paperId,
        details: {
          subject_id: params.subjectId,
          exam_type: params.examType,
          set_name: params.setName,
          file_name: params.file.name,
          file_size: params.file.size,
        },
      });

      setUploadProgress(100);
      toast.success('Paper uploaded successfully!');

      return { success: true, paperId: paper.id };
    } catch (err) {
      console.error('Upload error:', err);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadPaper,
    isUploading,
    uploadProgress,
  };
}
