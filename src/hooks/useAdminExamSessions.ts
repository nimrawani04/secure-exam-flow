import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ExamSession = Database['public']['Tables']['exam_sessions']['Row'];
export type ExamSessionInsert = Database['public']['Tables']['exam_sessions']['Insert'];
export type ExamSessionUpdate = Database['public']['Tables']['exam_sessions']['Update'];
export type ExamSessionMutationResult = { fallback?: boolean };

const isMissingExamDateColumn = (error: { message?: string } | null) => {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('exam_date') && message.includes('schema cache');
};

const stripExamDate = <T extends { exam_date?: string | null }>(input: T) => {
  const { exam_date: _examDate, ...rest } = input;
  return rest;
};

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
    mutationFn: async (input: ExamSessionInsert): Promise<ExamSessionMutationResult> => {
      const { error } = await supabase.from('exam_sessions').insert(input);
      if (!error) return { fallback: false };
      if (isMissingExamDateColumn(error)) {
        const { error: retryError } = await supabase.from('exam_sessions').insert(stripExamDate(input));
        if (retryError) throw retryError;
        return { fallback: true };
      }
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-sessions'] });
    },
  });
}

export function useUpdateExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ExamSessionUpdate }): Promise<ExamSessionMutationResult> => {
      const { error } = await supabase.from('exam_sessions').update(updates).eq('id', id);
      if (!error) return { fallback: false };
      if (isMissingExamDateColumn(error)) {
        const { error: retryError } = await supabase
          .from('exam_sessions')
          .update(stripExamDate(updates))
          .eq('id', id);
        if (retryError) throw retryError;
        return { fallback: true };
      }
      throw error;
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
