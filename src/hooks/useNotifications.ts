import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export interface NotificationWithRead extends NotificationRow {
  is_read_by_user: boolean;
}

interface UseNotificationsInput {
  userId?: string | null;
  role?: AppRole | null;
  departmentId?: string | null;
  limit?: number;
  includeRead?: boolean;
}

export function useNotifications({
  userId,
  role,
  departmentId,
  limit = 6,
  includeRead = false,
}: UseNotificationsInput) {
  return useQuery({
    queryKey: ['notifications', userId, role, departmentId, limit, includeRead],
    enabled: !!role && !!userId,
    queryFn: async (): Promise<NotificationWithRead[]> => {
      // Fetch notifications and user's read state in parallel
      const [notifResult, readsResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .contains('target_roles', [role!])
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', userId!),
      ]);

      if (notifResult.error) throw notifResult.error;
      if (readsResult.error) throw readsResult.error;

      const readSet = new Set(
        (readsResult.data || []).map((r: any) => r.notification_id)
      );

      const now = Date.now();
      return (notifResult.data || [])
        .map((notification) => ({
          ...notification,
          is_read_by_user: readSet.has(notification.id),
        }))
        .filter((notification) => {
          if (!includeRead && notification.is_read_by_user) {
            return false;
          }
          if (notification.user_id && notification.user_id !== userId) {
            return false;
          }
          if (notification.expires_at && new Date(notification.expires_at).getTime() <= now) {
            return false;
          }
          if (!notification.target_departments || notification.target_departments.length === 0) {
            return true;
          }
          if (!departmentId) {
            return false;
          }
          return notification.target_departments.includes(departmentId);
        });
    },
  });
}

interface ToggleReadInput {
  notificationId: string;
  userId: string;
  markRead: boolean;
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const toggleRead = useMutation({
    mutationFn: async ({ notificationId, userId, markRead }: ToggleReadInput) => {
      if (markRead) {
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            { notification_id: notificationId, user_id: userId },
            { onConflict: 'notification_id,user_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_reads')
          .delete()
          .eq('notification_id', notificationId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  return {
    toggleRead: toggleRead.mutateAsync,
    isUpdating: toggleRead.isPending,
  };
}
