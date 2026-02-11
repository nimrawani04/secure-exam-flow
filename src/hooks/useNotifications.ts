import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];

interface UseNotificationsInput {
  userId?: string | null;
  role?: AppRole | null;
  departmentId?: string | null;
  limit?: number;
}

export function useNotifications({
  userId,
  role,
  departmentId,
  limit = 6,
}: UseNotificationsInput) {
  return useQuery({
    queryKey: ['notifications', userId, role, departmentId, limit],
    enabled: !!role,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .contains('target_roles', [role!])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const now = Date.now();
      return (data || []).filter((notification) => {
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
