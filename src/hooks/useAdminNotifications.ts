import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

interface CreateNotificationInput {
  createdBy: string;
  title: string;
  message: string;
  targetRoles: AppRole[];
  targetDepartments?: string[] | null;
  type?: string;
  expiresAt?: string | null;
  userId?: string | null;
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      const {
        createdBy,
        title,
        message,
        targetRoles,
        targetDepartments,
        type,
        expiresAt,
        userId,
      } = input;

      const { error } = await supabase.from('notifications').insert({
        created_by: createdBy,
        title,
        message,
        type: type ?? 'info',
        target_roles: targetRoles,
        target_departments: targetDepartments?.length ? targetDepartments : null,
        expires_at: expiresAt ?? null,
        user_id: userId ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });
}

export function useCreateBulkNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NotificationInsert[]) => {
      const { error } = await supabase.from('notifications').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });
}

export function useAdminNotifications(createdBy?: string | null, limit = 6) {
  return useQuery({
    queryKey: ['admin-notifications', createdBy, limit],
    enabled: !!createdBy,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('created_by', createdBy!)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}
