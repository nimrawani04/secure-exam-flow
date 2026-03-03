import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DatesheetEntry {
  id: string;
  course_code: string;
  course_name: string | null;
  exam_date: string;
  exam_time: string;
  semester: number | null;
  subject_id: string | null;
  deadline: string;
  created_by: string;
  created_at: string;
  subject_name?: string;
}

export function useDatesheetEntries() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<DatesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('datesheet_entries')
      .select('*, subjects(name)')
      .order('exam_date', { ascending: true });

    if (fetchError) {
      console.error('Error fetching datesheet entries:', fetchError);
      setError('Failed to load datesheet entries');
      setEntries([]);
    } else {
      setEntries(
        (data || []).map((row: any) => ({
          ...row,
          subject_name: row.subjects?.name ?? row.course_name ?? null,
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (profile) fetchEntries();
  }, [profile]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('datesheet-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'datesheet_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { entries, isLoading, error, refetch: fetchEntries };
}

export async function uploadDatesheetEntries(
  entries: Array<{
    course_code: string;
    course_name?: string;
    exam_date: string;
    exam_time: string;
    semester?: number;
  }>,
  userId: string
) {
  // First, try to match course codes with subjects
  const codes = entries.map((e) => e.course_code);
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, code, name')
    .in('code', codes);

  const subjectMap = new Map<string, { id: string; name: string }>();
  (subjects || []).forEach((s: any) => subjectMap.set(s.code, { id: s.id, name: s.name }));

  const rows = entries.map((entry) => {
    const matched = subjectMap.get(entry.course_code);
    return {
      course_code: entry.course_code,
      course_name: entry.course_name || matched?.name || null,
      exam_date: entry.exam_date,
      exam_time: entry.exam_time,
      semester: entry.semester || null,
      subject_id: matched?.id || null,
      deadline: entry.exam_date, // trigger will override this
      created_by: userId,
    };
  });

  const { data, error } = await supabase.from('datesheet_entries').insert(rows).select();

  if (error) throw error;
  return data;
}

export async function deleteDatesheetEntry(id: string) {
  const { error } = await supabase.from('datesheet_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function clearAllDatesheetEntries(userId: string) {
  const { error } = await supabase.from('datesheet_entries').delete().eq('created_by', userId);
  if (error) throw error;
}
