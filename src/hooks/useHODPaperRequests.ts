import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PaperRequest {
  id: string;
  examId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examType: string;
  departmentId: string;
  reason: string;
  remarks: string;
  urgency: string;
  status: string;
  requestedBy: string;
  createdAt: Date;
}

export function useHODPaperRequests() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<PaperRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user || !profile?.department_id) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('paper_requests')
        .select(`
          id,
          exam_id,
          subject_id,
          exam_type,
          department_id,
          reason,
          remarks,
          urgency,
          status,
          requested_by,
          created_at,
          subjects!inner (
            name,
            code
          )
        `)
        .eq('department_id', profile.department_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching paper requests:', error);
        return;
      }

      const mapped: PaperRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        examId: r.exam_id,
        subjectId: r.subject_id,
        subjectName: r.subjects?.name || 'Unknown',
        subjectCode: r.subjects?.code || '',
        examType: r.exam_type,
        departmentId: r.department_id,
        reason: r.reason,
        remarks: r.remarks,
        urgency: r.urgency,
        status: r.status,
        requestedBy: r.requested_by,
        createdAt: new Date(r.created_at),
      }));

      setRequests(mapped);
    } catch (err) {
      console.error('Error in fetchRequests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.department_id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const acknowledgeRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('paper_requests')
        .update({
          status: 'acknowledged',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error acknowledging request:', error);
        toast.error('Failed to acknowledge request');
        return false;
      }

      // Notify exam cell
      await supabase.from('notifications').insert({
        created_by: user.id,
        title: 'Paper Request Acknowledged',
        message: 'The HOD has acknowledged your paper request and will prepare a new paper.',
        target_roles: ['exam_cell'],
        target_departments: null,
        type: 'success',
        user_id: null,
      });

      toast.success('Request acknowledged — Exam Cell notified');
      await fetchRequests();
      return true;
    } catch (err) {
      console.error('Error in acknowledgeRequest:', err);
      toast.error('An unexpected error occurred');
      return false;
    }
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests, acknowledgeRequest };
}
