import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type PaperStatus = Database['public']['Enums']['paper_status'];
type ExamType = Database['public']['Enums']['exam_type'];

export interface TeacherPaper {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  department: string;
  examType: ExamType;
  setName: string;
  status: PaperStatus;
  uploadedBy: string;
  deadline: Date;
  uploadedAt: Date;
  version: number;
  feedback: string | null;
  approvedAt: Date | null;
}

export function useTeacherPapers() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<TeacherPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPapers = useCallback(async () => {
    if (!user) {
      setPapers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('exam_papers')
        .select(`
          id,
          subject_id,
          exam_type,
          set_name,
          status,
          deadline,
          uploaded_at,
          uploaded_by,
          version,
          feedback,
          approved_at,
          subjects (
            id,
            name,
            code,
            department_id
          )
        `)
        .eq('uploaded_by', user.id)
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching papers:', fetchError);
        setError(fetchError.message || 'Failed to load submissions');
        return;
      }

      const mappedPapers: TeacherPaper[] = (data || []).map((p) => ({
        id: p.id,
        subjectId: p.subject_id,
        subjectName: (p.subjects as any)?.name || 'Unknown Subject',
        subjectCode: (p.subjects as any)?.code || '',
        department: (p.subjects as any)?.department_id || 'Unknown Department',
        examType: p.exam_type,
        setName: p.set_name,
        status: p.status,
        uploadedBy: p.uploaded_by,
        deadline: new Date(p.deadline),
        uploadedAt: new Date(p.uploaded_at),
        version: p.version,
        feedback: p.feedback,
        approvedAt: p.approved_at ? new Date(p.approved_at) : null,
      }));

      setPapers(mappedPapers.filter((paper) => paper.status !== 'rejected'));
      setError(null);
    } catch (err) {
      console.error('Error in fetchPapers:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  return { papers, isLoading, error, refetch: fetchPapers };
}
