import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ExamType = Database['public']['Enums']['exam_type'];

export interface DepartmentExamSession {
  id: string;
  departmentId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examType: ExamType;
  semester: number;
  examDate: Date;
  submissionDeadline: Date;
  status: string;
  createdAt: Date;
  // Submission tracking
  totalTeachers: number;
  submittedCount: number;
}

export interface CreateSessionInput {
  subjectId: string;
  examType: ExamType;
  semester: number;
  examDate: string;
  submissionDeadline: string;
}

export function useHODExamSessions() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<DepartmentExamSession[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string; semester: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!user || !profile?.department_id) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch sessions with subject info
      const { data, error } = await supabase
        .from('department_exam_sessions')
        .select(`
          *,
          subjects!inner (name, code)
        `)
        .eq('department_id', profile.department_id)
        .order('exam_date', { ascending: true });

      if (error) {
        console.error('Error fetching sessions:', error);
        toast.error('Failed to load exam sessions');
        return;
      }

      // For each session, count assigned teachers and submitted papers
      const mapped: DepartmentExamSession[] = await Promise.all(
        (data || []).map(async (s) => {
          // Count assigned teachers
          const { count: teacherCount } = await supabase
            .from('teacher_subjects')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', s.subject_id);

          // Count submitted papers for this subject + exam type
          const { count: paperCount } = await supabase
            .from('exam_papers')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', s.subject_id)
            .eq('exam_type', s.exam_type)
            .in('status', ['pending_review', 'approved', 'locked', 'submitted']);

          return {
            id: s.id,
            departmentId: s.department_id,
            subjectId: s.subject_id,
            subjectName: (s.subjects as any)?.name || 'Unknown',
            subjectCode: (s.subjects as any)?.code || '',
            examType: s.exam_type,
            semester: s.semester,
            examDate: new Date(s.exam_date),
            submissionDeadline: new Date(s.submission_deadline),
            status: s.status,
            createdAt: new Date(s.created_at),
            totalTeachers: teacherCount || 0,
            submittedCount: paperCount || 0,
          };
        })
      );

      setSessions(mapped);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.department_id]);

  const fetchSubjects = useCallback(async () => {
    if (!profile?.department_id) return;
    const { data } = await supabase
      .from('subjects')
      .select('id, name, code, semester')
      .eq('department_id', profile.department_id)
      .order('semester')
      .order('name');
    setSubjects(data || []);
  }, [profile?.department_id]);

  useEffect(() => {
    fetchSessions();
    fetchSubjects();
  }, [fetchSessions, fetchSubjects]);

  const createSession = async (input: CreateSessionInput): Promise<boolean> => {
    if (!user || !profile?.department_id) return false;

    try {
      const { error: insertError } = await supabase
        .from('department_exam_sessions')
        .insert({
          department_id: profile.department_id,
          subject_id: input.subjectId,
          exam_type: input.examType,
          semester: input.semester,
          exam_date: input.examDate,
          submission_deadline: input.submissionDeadline,
          created_by: user.id,
        });

      if (insertError) {
        console.error('Error creating session:', insertError);
        toast.error('Failed to create exam session');
        return false;
      }

      // Find the subject info
      const subject = subjects.find((s) => s.id === input.subjectId);
      const examLabel = input.examType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      // Get assigned teachers for this subject
      const { data: teacherLinks } = await supabase
        .from('teacher_subjects')
        .select('teacher_id')
        .eq('subject_id', input.subjectId);

      const teacherIds = (teacherLinks || []).map((t) => t.teacher_id);

      // Send notification to each assigned teacher
      if (teacherIds.length > 0) {
        const notifications = teacherIds.map((teacherId) => ({
          created_by: user.id,
          title: 'New Exam Session Created',
          message: `Course: ${subject?.name || 'Unknown'} (${subject?.code || ''})\nExam Type: ${examLabel}\nExam Date: ${new Date(input.examDate).toLocaleDateString()}\nSubmission Deadline: ${new Date(input.submissionDeadline).toLocaleDateString()}`,
          target_roles: ['teacher' as const],
          type: 'info',
          user_id: teacherId,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      // Also send email notifications
      await supabase.functions.invoke('send-registered-email', {
        body: {
          subject: `New Exam Session – ${subject?.name || 'Unknown'} (${examLabel})`,
          message: `A new exam session has been created.\n\nCourse: ${subject?.name} (${subject?.code})\nExam Type: ${examLabel}\nExam Date: ${new Date(input.examDate).toLocaleDateString()}\nSubmission Deadline: ${new Date(input.submissionDeadline).toLocaleDateString()}\n\nPlease upload your question paper before the deadline.`,
          targetUserIds: teacherIds,
        },
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'create_exam_session',
        entity_type: 'exam_session',
        entity_id: input.subjectId,
        details: { subjectName: subject?.name, examType: input.examType, examDate: input.examDate },
      });

      toast.success('Exam session created & teachers notified');
      await fetchSessions();
      return true;
    } catch (err) {
      console.error('Error:', err);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  const deleteSession = async (sessionId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('department_exam_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) {
      toast.error('Failed to delete session');
      return false;
    }
    toast.success('Session deleted');
    await fetchSessions();
    return true;
  };

  return { sessions, subjects, isLoading, refetch: fetchSessions, createSession, deleteSession };
}
