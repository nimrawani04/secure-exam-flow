import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard,
  Upload,
  FileText,
  Users,
  Calendar,
  LogOut,
  FileCheck,
  Archive,
  Clock,
  ClipboardList,
  Building,
  Activity,
  User,
  Bell,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const roleNavItems = {
  teacher: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Exam Calendar', path: '/teacher/calendar' },
    { icon: Upload, label: 'Upload Paper', path: '/upload' },
    { icon: FileText, label: 'My Submissions', path: '/submissions' },
    { icon: ClipboardList, label: 'Assigned Subjects', path: '/subjects' },
  ],
  hod: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Exam Sessions', path: '/hod/sessions' },
    { icon: Clock, label: 'Paper Calendar', path: '/hod/calendar' },
    { icon: FileCheck, label: 'Review Papers', path: '/review' },
    { icon: Users, label: 'Department', path: '/department' },
    { icon: Bell, label: 'Teacher Alerts', path: '/hod/alerts' },
    { icon: Archive, label: 'Approved Papers', path: '/approved' },
    { icon: UserCheck, label: 'Choose Panel', path: '/hod/panels' },
  ],
  exam_cell: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: UserCheck, label: 'Examiner Panels', path: '/exam-cell/panels' },
    { icon: FileCheck, label: 'Datesheets', path: '/exam-cell/datesheets' },
    { icon: Bell, label: 'HOD Alerts', path: '/exam-cell/alerts' },
    { icon: FileText, label: 'Papers Inbox', path: '/inbox' },
    { icon: Archive, label: 'Archive', path: '/archive' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'User Management', path: '/admin/users' },
    { icon: Building, label: 'Departments', path: '/admin/departments' },
    { icon: Activity, label: 'Audit Logs', path: '/admin/audit' },
    { icon: Bell, label: 'Broadcasts', path: '/admin/broadcasts' },
  ],
};

export function Sidebar({
  className,
  isMobile = false,
  collapsed = false,
  onToggleCollapse,
}: {
  className?: string;
  isMobile?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingCalendarCount, setPendingCalendarCount] = useState(0);
  const [reviewRequestedCount, setReviewRequestedCount] = useState(0);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [departmentName, setDepartmentName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.department_id) {
      setDepartmentName(null);
      return;
    }
    const fetchDept = async () => {
      const { data } = await supabase.from('departments').select('name').eq('id', profile.department_id!).single();
      if (data) setDepartmentName(data.name);
    };
    fetchDept();
  }, [profile?.department_id]);

  useEffect(() => {
    if (profile?.role !== 'hod' || !profile?.department_id) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from('paper_requests')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', profile.department_id!)
        .eq('status', 'pending');
      setPendingRequestsCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('hod-paper-requests-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paper_requests' }, () => {
        fetchCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role, profile?.department_id]);

  useEffect(() => {
    if (profile?.role !== 'teacher') return;

    const fetchPendingCount = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', user.user.id);

      const subjectIds = (assignments || []).map((a) => a.subject_id);
      if (subjectIds.length === 0) { setPendingCalendarCount(0); return; }

      const { data: sessions } = await supabase
        .from('department_exam_sessions')
        .select('id, subject_id, exam_type, submission_deadline')
        .in('subject_id', subjectIds)
        .eq('status', 'active');

      if (!sessions || sessions.length === 0) { setPendingCalendarCount(0); return; }

      let pending = 0;
      const now = new Date();
      for (const s of sessions) {
        const deadline = new Date(s.submission_deadline);
        if (deadline.getTime() < now.getTime() - 86400000) continue;

        const { count } = await supabase
          .from('exam_papers')
          .select('id', { count: 'exact', head: true })
          .eq('subject_id', s.subject_id)
          .eq('exam_type', s.exam_type)
          .eq('uploaded_by', user.user.id)
          .in('status', ['pending_review', 'submitted', 'approved', 'locked']);

        if (!count || count === 0) pending++;
      }

      setPendingCalendarCount(pending);
    };

    fetchPendingCount();

    const channel = supabase
      .channel('teacher-calendar-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_papers' }, () => {
        fetchPendingCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_exam_sessions' }, () => {
        fetchPendingCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== 'exam_cell') return;

    const fetchReviewCount = async () => {
      const { count } = await supabase
        .from('exam_papers')
        .select('id', { count: 'exact', head: true })
        .in('status', ['locked', 'review_requested']);
      setReviewRequestedCount(count || 0);
    };

    fetchReviewCount();

    const channel = supabase
      .channel('exam-cell-review-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_papers' }, () => {
        fetchReviewCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== 'exam_cell') return;

    const fetchUnreadAlerts = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const [notifResult, readsResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('id')
          .contains('target_roles', ['exam_cell']),
        supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', user.user.id),
      ]);

      const readSet = new Set((readsResult.data || []).map((r) => r.notification_id));
      const unreadCount = (notifResult.data || []).filter((n) => !readSet.has(n.id)).length;
      setUnreadAlertsCount(unreadCount);
    };

    fetchUnreadAlerts();

    const channel = supabase
      .channel('exam-cell-alerts-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadAlerts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_reads' }, () => {
        fetchUnreadAlerts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role]);

  if (!profile?.role) return null;

  const navItems = roleNavItems[profile.role] || [];

  const getRoleBadge = () => {
    switch (profile.role) {
      case 'teacher':
        return 'Teacher';
      case 'hod':
        return 'Head of Department';
      case 'exam_cell':
        return 'Examination Cell';
      case 'admin':
        return 'Administrator';
      default:
        return '';
    }
  };

  const getInitials = () => {
    const parts = (profile.full_name || 'U').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 bg-white dark:bg-[#0d1420] text-[#18202e] dark:text-[#e2eaf4] border-r border-[#e8e2da] dark:border-[#1c2d3d]',
        isMobile
          ? 'w-full h-full'
          : cn('fixed left-0 top-0 h-screen z-40 transition-all duration-200', collapsed ? 'w-20' : 'w-[232px]'),
        className
      )}
    >
      {/* Brand */}
      <div className={cn('relative pt-[22px] pb-[18px]', collapsed && !isMobile ? 'px-3' : 'px-4')}>
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="absolute -right-3.5 top-6 z-50 h-8 w-8 rounded-full border-2 border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#0d1420] shadow-xl transition-all hover:scale-110 hover:border-[#0d7a6b] dark:hover:border-[#2dd4bf]"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4 mx-auto" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        )}

        <div className={cn('flex items-center gap-2.5 mb-4', collapsed && !isMobile && 'justify-center mb-0')}>
          <div className="w-9 h-9 rounded-[10px] shrink-0 overflow-hidden border border-[#e8e2da] dark:border-[#1c2d3d] bg-white flex items-center justify-center">
            <img src="/cuk-favicon.png" alt="CUK Logo" className="w-8 h-8 object-contain" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="font-serif text-[16px] leading-[1.2] tracking-[-0.02em] truncate">ExamSecure</p>
              <p className="text-[10.5px] text-[#a0aec0] dark:text-[#3d5166] tracking-[0.04em]">
                {profile.role === 'hod' ? 'HOD Portal' : getRoleBadge()}
              </p>
            </div>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <div
            className="px-3 py-[9px] rounded-[8px] border transition-colors"
            style={{
              backgroundColor: 'var(--accent-soft, rgba(13,122,107,0.1))',
              borderColor: 'var(--accent-ring, rgba(13,122,107,0.2))',
            }}
          >
            <p className="text-[9px] font-bold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.1em] uppercase mb-[3px]">
              {departmentName ? 'Department' : 'Role'}
            </p>
            <p
              className="text-[11.5px] font-medium leading-[1.4] line-clamp-2"
              style={{ color: 'var(--accent-color, #0d7a6b)' }}
            >
              {departmentName || getRoleBadge()}
            </p>
          </div>
        )}
      </div>

      <div className="h-px bg-[#e8e2da] dark:bg-[#1c2d3d] mx-3" />

      {/* Nav */}
      <nav className="flex-1 px-[10px] py-3 overflow-y-auto">
        {(!collapsed || isMobile) && (
          <p className="text-[9.5px] font-bold tracking-[0.1em] text-[#a0aec0] dark:text-[#3d5166] uppercase px-[10px] pb-2">
            Workspace
          </p>
        )}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = (profile?.role === 'hod' && (item.path === '/dashboard' || item.path === '/review') && pendingRequestsCount > 0) ||
            (profile?.role === 'teacher' && item.path === '/teacher/calendar' && pendingCalendarCount > 0) ||
            (profile?.role === 'exam_cell' && item.path === '/inbox' && reviewRequestedCount > 0) ||
            (profile?.role === 'exam_cell' && item.path === '/exam-cell/alerts' && unreadAlertsCount > 0);
          const badgeCount = profile?.role === 'teacher' && item.path === '/teacher/calendar' ? pendingCalendarCount
            : profile?.role === 'exam_cell' && item.path === '/inbox' ? reviewRequestedCount
            : profile?.role === 'exam_cell' && item.path === '/exam-cell/alerts' ? unreadAlertsCount
            : pendingRequestsCount;
          const link = (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'w-full flex items-center gap-[9px] px-[10px] py-[8.5px] rounded-[8px] mb-[1px] text-left relative transition-colors',
                collapsed && !isMobile && 'justify-center px-0',
                isActive
                  ? 'font-medium'
                  : 'text-[#64748b] dark:text-[#6b8299] hover:bg-[#ede9e2] dark:hover:bg-[#131c27] hover:text-[#18202e] dark:hover:text-[#e2eaf4]'
              )}
              style={isActive ? { color: 'var(--accent-color, #0d7a6b)', background: 'transparent' } : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[18px] rounded-r-[2px]"
                  style={{ backgroundColor: 'var(--accent-color, #0d7a6b)' }}
                />
              )}
              <span className="relative leading-none">
                <item.icon className="w-[14px] h-[14px]" />
                {showBadge && collapsed && !isMobile && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#f43f5e] text-white text-[10px] font-bold leading-none px-1">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>
              {(!collapsed || isMobile) && (
                <span className="flex-1 flex items-center justify-between min-w-0">
                  <span className={cn('text-[13px] tracking-[-0.01em] truncate', isActive ? 'font-medium' : 'font-normal')}>
                    {item.label}
                  </span>
                  {showBadge && (
                    <span
                      className="font-mono text-[10px] font-medium px-[7px] py-[2px] rounded-full min-w-[22px] text-center"
                      style={{
                        backgroundColor: 'var(--accent-soft, rgba(13,122,107,0.1))',
                        color: 'var(--accent-color, #0d7a6b)',
                      }}
                    >
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );

          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}

        {(!collapsed || isMobile) && (
          <>
            <div className="h-px bg-[#e8e2da] dark:bg-[#1c2d3d] my-[10px] mx-[10px]" />
            <p className="text-[9.5px] font-bold tracking-[0.1em] text-[#a0aec0] dark:text-[#3d5166] uppercase px-[10px] pb-2">
              Account
            </p>
            <Link
              to="/profile"
              className={cn(
                'w-full flex items-center gap-[9px] px-[10px] py-[8.5px] rounded-[8px] mb-[1px] text-[13px] transition-colors',
                location.pathname === '/profile'
                  ? 'font-medium'
                  : 'text-[#64748b] dark:text-[#6b8299] hover:bg-[#ede9e2] dark:hover:bg-[#131c27] hover:text-[#18202e] dark:hover:text-[#e2eaf4]'
              )}
              style={location.pathname === '/profile' ? { color: 'var(--accent-color, #0d7a6b)' } : undefined}
            >
              <User className="w-[14px] h-[14px]" />
              <span className="tracking-[-0.01em]">Profile</span>
            </Link>
          </>
        )}
      </nav>

      {/* User footer */}
      {collapsed && !isMobile ? (
        <div className="p-3 space-y-2 border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className="flex items-center justify-center py-2 rounded-[8px] text-[#64748b] dark:text-[#6b8299] hover:bg-[#ede9e2] dark:hover:bg-[#131c27] transition-colors"
              >
                <User className="w-[14px] h-[14px]" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Profile</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center px-0 py-2 h-auto text-[#a0aec0] dark:text-[#3d5166] hover:bg-transparent hover:text-[#9f1239] dark:hover:text-[#fb7185]"
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
              >
                <LogOut className="w-[13px] h-[13px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="px-3 pt-3 pb-[14px] border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019]">
          <div className="flex items-center gap-[9px]">
            <div
              className="w-8 h-8 rounded-[8px] shrink-0 border flex items-center justify-center font-mono text-[10px] font-medium tracking-[0.05em]"
              style={{
                backgroundColor: 'var(--accent-soft, rgba(13,122,107,0.1))',
                borderColor: 'var(--accent-ring, rgba(13,122,107,0.2))',
                color: 'var(--accent-color, #0d7a6b)',
              }}
            >
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium truncate">{profile.full_name}</p>
              <p className="text-[10.5px] text-[#a0aec0] dark:text-[#3d5166] mt-[1px]">{getRoleBadge()}</p>
            </div>
            <button
              className="bg-transparent border-none cursor-pointer text-[#a0aec0] dark:text-[#3d5166] p-[5px] rounded-[6px] leading-none hover:text-[#9f1239] dark:hover:text-[#fb7185] transition-colors"
              title="Sign out"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="w-[13px] h-[13px]" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
