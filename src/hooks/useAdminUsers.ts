import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  department_name: string | null;
  role: AppRole | null;
  created_at: string;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get roles and departments
      const userIds = profiles?.map((p) => p.id) || [];
      const deptIds = [...new Set(profiles?.map((p) => p.department_id).filter(Boolean) || [])];

      const [{ data: roles }, { data: departments }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
        deptIds.length > 0
          ? supabase.from('departments').select('id, name').in('id', deptIds)
          : Promise.resolve({ data: [] }),
      ]);

      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role));

      const deptMap = new Map<string, string>();
      departments?.forEach((d) => deptMap.set(d.id, d.name));

      return (profiles || []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) || null,
        department_name: p.department_id ? deptMap.get(p.department_id) || null : null,
      }));
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Upsert: delete existing then insert
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useUpdateUserDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: departmentId })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
