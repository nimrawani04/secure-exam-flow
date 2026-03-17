import { useState, useEffect, useCallback } from 'react';
import { startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomCalendarEntry {
  id: string;
  teacherId: string;
  subjectId: string | null;
  title: string;
  examType: string | null;
  examDate: Date | null;
  submissionDeadline: Date;
  status: 'pending' | 'submitted';
  notes: string | null;
  isCustom: true;
}

export interface CustomEntryInput {
  title: string;
  subjectId?: string;
  examType?: string;
  examDate?: Date;
  submissionDeadline: Date;
  status: 'pending' | 'submitted';
  notes?: string;
}

export function useTeacherCustomEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CustomCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('teacher_calendar_entries')
        .select('*')
        .eq('teacher_id', user.id)
        .order('submission_deadline', { ascending: true });

      if (error) {
        console.error('Error fetching custom entries:', error);
        setEntries([]);
        return;
      }

      setEntries(
        (data || []).map((d) => ({
          id: d.id,
          teacherId: d.teacher_id,
          subjectId: d.subject_id,
          title: d.title,
          examType: d.exam_type,
          examDate: d.exam_date ? new Date(d.exam_date) : null,
          submissionDeadline: new Date(d.submission_deadline),
          status: d.status as 'pending' | 'submitted',
          notes: d.notes,
          isCustom: true as const,
        }))
      );
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (input: CustomEntryInput) => {
    if (!user) return { success: false };

    const today = startOfDay(new Date());
    if (startOfDay(input.submissionDeadline) < today) {
      return { success: false, error: 'Deadline cannot be in the past' };
    }
    if (input.examDate && startOfDay(input.examDate) < today) {
      return { success: false, error: 'Exam date cannot be in the past' };
    }
    if (input.examDate && startOfDay(input.submissionDeadline) > startOfDay(input.examDate)) {
      return { success: false, error: 'Deadline must be on or before the exam date' };
    }

    const { error } = await supabase.from('teacher_calendar_entries').insert({
      teacher_id: user.id,
      title: input.title,
      subject_id: input.subjectId || null,
      exam_type: input.examType || null,
      exam_date: input.examDate?.toISOString() || null,
      submission_deadline: input.submissionDeadline.toISOString(),
      status: input.status,
      notes: input.notes || null,
    });
    if (error) {
      console.error('Error adding entry:', error);
      return { success: false, error };
    }
    await fetchEntries();
    return { success: true };
  };

  const updateEntry = async (id: string, input: Partial<CustomEntryInput>) => {
    if (!user) return { success: false };

    const today = startOfDay(new Date());
    if (input.submissionDeadline && startOfDay(input.submissionDeadline) < today) {
      return { success: false, error: 'Deadline cannot be in the past' };
    }
    if (input.examDate && startOfDay(input.examDate) < today) {
      return { success: false, error: 'Exam date cannot be in the past' };
    }
    if (input.examDate && input.submissionDeadline &&
        startOfDay(input.submissionDeadline) > startOfDay(input.examDate)) {
      return { success: false, error: 'Deadline must be on or before the exam date' };
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.subjectId !== undefined) updateData.subject_id = input.subjectId || null;
    if (input.examType !== undefined) updateData.exam_type = input.examType || null;
    if (input.examDate !== undefined) updateData.exam_date = input.examDate?.toISOString() || null;
    if (input.submissionDeadline !== undefined) updateData.submission_deadline = input.submissionDeadline.toISOString();
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes || null;

    const { error } = await supabase
      .from('teacher_calendar_entries')
      .update(updateData)
      .eq('id', id)
      .eq('teacher_id', user.id);

    if (error) {
      console.error('Error updating entry:', error);
      return { success: false, error };
    }
    await fetchEntries();
    return { success: true };
  };

  const deleteEntry = async (id: string) => {
    if (!user) return { success: false };
    const { error } = await supabase
      .from('teacher_calendar_entries')
      .delete()
      .eq('id', id)
      .eq('teacher_id', user.id);

    if (error) {
      console.error('Error deleting entry:', error);
      return { success: false, error };
    }
    await fetchEntries();
    return { success: true };
  };

  const toggleStatus = async (id: string, currentStatus: 'pending' | 'submitted') => {
    return updateEntry(id, { status: currentStatus === 'pending' ? 'submitted' : 'pending' });
  };

  return { entries, isLoading, refetch: fetchEntries, addEntry, updateEntry, deleteEntry, toggleStatus };
}
