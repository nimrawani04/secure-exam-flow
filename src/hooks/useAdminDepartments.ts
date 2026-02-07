import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DepartmentWithSubjects {
  id: string;
  name: string;
  code: string;
  created_at: string;
  subjects_count: number;
  teachers_count: number;
}

export function useAdminDepartments() {
  return useQuery({
    queryKey: ['admin-departments'],
    queryFn: async (): Promise<DepartmentWithSubjects[]> => {
      const { data: departments, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;

      const deptIds = departments?.map((d) => d.id) || [];

      const [{ data: subjects }, { data: profiles }] = await Promise.all([
        supabase.from('subjects').select('department_id').in('department_id', deptIds),
        supabase.from('profiles').select('department_id').in('department_id', deptIds),
      ]);

      const subjectCounts = new Map<string, number>();
      subjects?.forEach((s) => {
        subjectCounts.set(s.department_id, (subjectCounts.get(s.department_id) || 0) + 1);
      });

      const teacherCounts = new Map<string, number>();
      profiles?.forEach((p) => {
        if (p.department_id) {
          teacherCounts.set(p.department_id, (teacherCounts.get(p.department_id) || 0) + 1);
        }
      });

      return (departments || []).map((d) => ({
        ...d,
        subjects_count: subjectCounts.get(d.id) || 0,
        teachers_count: teacherCounts.get(d.id) || 0,
      }));
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, code }: { name: string; code: string }) => {
      const { error } = await supabase.from('departments').insert({ name, code });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}
