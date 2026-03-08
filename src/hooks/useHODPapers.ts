import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PaperStatus = Database['public']['Enums']['paper_status'];
type ExamType = Database['public']['Enums']['exam_type'];

export interface HODPaper {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examType: ExamType;
  setName: string;
  status: PaperStatus;
  deadline: Date;
  uploadedAt: Date;
  version: number;
  isSelected: boolean;
  filePath: string | null;
  // Anonymous label instead of teacher name
  anonymousId: string;
}

export function useHODPapers() {
  const { user, profile } = useAuth();
  const [papers, setPapers] = useState<HODPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPapers = useCallback(async () => {
    if (!user || !profile?.department_id) {
      setPapers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch papers from department's subjects
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
          version,
          is_selected,
          file_path,
          subjects!inner (
            id,
            name,
            code,
            department_id
          )
        `)
        .eq('subjects.department_id', profile.department_id)
        .in('status', ['pending_review', 'approved', 'rejected', 'resubmission_requested', 'locked'])
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching HOD papers:', fetchError);
        setError('Failed to load papers');
        return;
      }

      // Generate anonymous IDs for bias-free review
      const subjectGroups: Record<string, number> = {};
      
      const mappedPapers: HODPaper[] = (data || []).map((p) => {
        const subjectKey = `${p.subject_id}-${p.exam_type}`;
        if (!subjectGroups[subjectKey]) {
          subjectGroups[subjectKey] = 0;
        }
        subjectGroups[subjectKey]++;
        
        return {
          id: p.id,
          subjectId: p.subject_id,
          subjectName: (p.subjects as any)?.name || 'Unknown Subject',
          subjectCode: (p.subjects as any)?.code || '',
          examType: p.exam_type,
          setName: p.set_name,
          status: p.status,
          deadline: new Date(p.deadline),
          uploadedAt: new Date(p.uploaded_at),
          version: p.version,
          isSelected: p.is_selected || false,
          filePath: p.file_path,
          anonymousId: `Submission ${subjectGroups[subjectKey]}`,
        };
      });

      setPapers(mappedPapers);
      setError(null);
    } catch (err) {
      console.error('Error in fetchPapers:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.department_id]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const approvePaper = async (paperId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('exam_papers')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', paperId);

      if (updateError) {
        console.error('Error approving paper:', updateError);
        toast.error('Failed to approve paper');
        return false;
      }

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'approve',
        entity_type: 'paper',
        entity_id: paperId,
        details: { action: 'Paper approved by HOD' },
      });

      toast.success('Paper approved successfully');
      await fetchPapers();
      return true;
    } catch (err) {
      console.error('Error in approvePaper:', err);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  const rejectPaper = async (paperId: string, feedback: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('exam_papers')
        .update({
          status: 'rejected',
          feedback,
        })
        .eq('id', paperId);

      if (updateError) {
        console.error('Error rejecting paper:', updateError);
        toast.error('Failed to reject paper');
        return false;
      }

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'reject',
        entity_type: 'paper',
        entity_id: paperId,
        details: { action: 'Paper rejected by HOD', feedback },
      });

      toast.success('Paper rejected with feedback');
      await fetchPapers();
      return true;
    } catch (err) {
      console.error('Error in rejectPaper:', err);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  const selectPaper = async (
    paperId: string,
    subjectId: string,
    examType: ExamType,
    remark?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use server-side function to atomically select + reject
      const { error: rpcError } = await supabase.rpc(
        'select_paper_and_reject_others' as any,
        {
          _paper_id: paperId,
          _subject_id: subjectId,
          _exam_type: examType,
          _hod_id: user.id,
          _remark: remark?.trim() || null,
        }
      );

      if (rpcError) {
        console.error('Error selecting paper:', rpcError);
        toast.error('Failed to select paper');
        return false;
      }

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'select',
        entity_type: 'paper',
        entity_id: paperId,
        details: {
          action: 'Paper selected and locked by HOD',
          remark: remark?.trim() || null,
        },
      });

      // Notify Exam Cell that a paper is locked and ready, including optional HOD remark.
      const normalizedRemark = remark?.trim();
      await supabase.from('notifications').insert({
        created_by: user.id,
        title: 'Paper Locked by HOD',
        message: normalizedRemark
          ? `A paper has been locked and sent to Exam Cell. HOD remark: ${normalizedRemark}`
          : 'A paper has been locked and sent to Exam Cell.',
        target_roles: ['exam_cell'],
        target_departments: null,
        type: 'info',
        user_id: null,
      });

      // Also send email to registered Exam Cell addresses.
      await supabase.functions.invoke('send-registered-email', {
        body: {
          subject: 'Paper Locked by HOD',
          message: normalizedRemark
            ? `A paper has been locked and sent to Exam Cell.\n\nHOD remark: ${normalizedRemark}`
            : 'A paper has been locked and sent to Exam Cell.',
          targetRoles: ['exam_cell'],
        },
      });

      toast.success('Paper selected and locked');
      await fetchPapers();
      return true;
    } catch (err) {
      console.error('Error in selectPaper:', err);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  return { 
    papers, 
    isLoading, 
    error, 
    refetch: fetchPapers,
    approvePaper,
    rejectPaper,
    selectPaper,
  };
}
