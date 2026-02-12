import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ExamSession = Database['public']['Tables']['exam_sessions']['Row'];
export type ExamSessionInsert = Database['public']['Tables']['exam_sessions']['Insert'];
export type ExamSessionUpdate = Database['public']['Tables']['exam_sessions']['Update'];

export function useExamSessions() {
  return useQuery({
    queryKey: ['admin-exam-sessions'],
    queryFn: async (): Promise<ExamSession[]> => {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ExamSessionInsert) => {
      const { error } = await supabase.from('exam_sessions').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-sessions'] });
    },
  });
}

export function useUpdateExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ExamSessionUpdate }) => {
      const { error } = await supabase.from('exam_sessions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-sessions'] });
    },
  });
}

export function useDeleteExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-sessions'] });
    },
  });
}
