import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminStats {
  totalUsers: number;
  totalDepartments: number;
  totalSubjects: number;
  totalPapers: number;
  usersByRole: { role: string; count: number }[];
  papersByStatus: { status: string; count: number }[];
  recentAuditLogs: {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    created_at: string;
    details: any;
    user_name?: string;
  }[];
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      const [
        { count: totalUsers },
        { count: totalDepartments },
        { count: totalSubjects },
        { count: totalPapers },
        { data: roles },
        { data: papers },
        { data: auditLogs },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('subjects').select('*', { count: 'exact', head: true }),
        supabase.from('exam_papers').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
        supabase.from('exam_papers').select('status'),
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      // Aggregate roles
      const roleMap = new Map<string, number>();
      roles?.forEach((r) => {
        roleMap.set(r.role, (roleMap.get(r.role) || 0) + 1);
      });
      const usersByRole = Array.from(roleMap.entries()).map(([role, count]) => ({ role, count }));

      // Aggregate paper statuses
      const statusMap = new Map<string, number>();
      papers?.forEach((p) => {
        statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
      });
      const papersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

      // Enrich audit logs with user names
      const userIds = [...new Set(auditLogs?.map((l) => l.user_id) || [])];
      let userNameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profiles?.forEach((p) => userNameMap.set(p.id, p.full_name));
      }

      const recentAuditLogs = (auditLogs || []).map((log) => ({
        ...log,
        user_name: userNameMap.get(log.user_id) || 'Unknown',
      }));

      return {
        totalUsers: totalUsers || 0,
        totalDepartments: totalDepartments || 0,
        totalSubjects: totalSubjects || 0,
        totalPapers: totalPapers || 0,
        usersByRole,
        papersByStatus,
        recentAuditLogs,
      };
    },
  });
}
