import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ExamType = Database['public']['Enums']['exam_type'];
type PaperStatus = Database['public']['Enums']['paper_status'];

export type TeacherSessionStatus = 'pending' | 'submitted';

export interface TeacherCalendarEvent {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examType: ExamType;
  semester: number;
  examDate: Date;
  submissionDeadline: Date;
  status: TeacherSessionStatus;
  paperId?: string;
}

function deriveStatus(paperStatus?: PaperStatus | null): TeacherSessionStatus {
  if (!paperStatus) return 'pending';
  switch (paperStatus) {
    case 'draft':
    case 'rejected':
    case 'resubmission_requested':
      return 'pending';
    default:
      // submitted, pending_review, approved, locked all mean "submitted" to the teacher
      return 'submitted';
  }
}

export function useTeacherCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TeacherCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get teacher's assigned subject IDs
      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', user.id);

      const subjectIds = (assignments || []).map((a) => a.subject_id);
      if (subjectIds.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      // Get department exam sessions for those subjects
      const { data: sessions, error } = await supabase
        .from('department_exam_sessions')
        .select(`
          id,
          subject_id,
          exam_type,
          semester,
          exam_date,
          submission_deadline,
          status,
          subjects!inner (name, code)
        `)
        .in('subject_id', subjectIds)
        .eq('status', 'active')
        .order('exam_date', { ascending: true });

      if (error) {
        console.error('Error fetching teacher calendar:', error);
        setEvents([]);
        setIsLoading(false);
        return;
      }

      // For each session, check if teacher has submitted a paper
      const mapped: TeacherCalendarEvent[] = await Promise.all(
        (sessions || []).map(async (s) => {
          // Find teacher's best paper for this subject+exam_type
          const { data: papers } = await supabase
            .from('exam_papers')
            .select('id, status')
            .eq('subject_id', s.subject_id)
            .eq('uploaded_by', user.id)
            .order('version', { ascending: false })
            .limit(1);

          const latestPaper = papers?.[0];

          return {
            id: s.id,
            subjectId: s.subject_id,
            subjectName: (s.subjects as any)?.name || 'Unknown',
            subjectCode: (s.subjects as any)?.code || '',
            examType: s.exam_type,
            semester: s.semester,
            examDate: new Date(s.exam_date),
            submissionDeadline: new Date(s.submission_deadline),
            status: deriveStatus(latestPaper?.status),
            paperId: latestPaper?.id,
          };
        })
      );

      setEvents(mapped);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, refetch: fetchEvents };
}
