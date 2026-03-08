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
  ],
  exam_cell: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
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

  // Fetch pending paper requests count for HOD
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  // Fetch pending calendar submissions count for teacher
  const [pendingCalendarCount, setPendingCalendarCount] = useState(0);
  // Fetch review_requested papers count for exam_cell
  const [reviewRequestedCount, setReviewRequestedCount] = useState(0);
  // Fetch unread notifications count for exam_cell (HOD Alerts)
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

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

  // Teacher: count pending sessions (sessions where teacher hasn't submitted a paper)
  useEffect(() => {
    if (profile?.role !== 'teacher') return;

    const fetchPendingCount = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      // Get teacher's subject IDs
      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', user.user.id);

      const subjectIds = (assignments || []).map((a) => a.subject_id);
      if (subjectIds.length === 0) { setPendingCalendarCount(0); return; }

      // Get active sessions for those subjects
      const { data: sessions } = await supabase
        .from('department_exam_sessions')
        .select('id, subject_id, exam_type, submission_deadline')
        .in('subject_id', subjectIds)
        .eq('status', 'active');

      if (!sessions || sessions.length === 0) { setPendingCalendarCount(0); return; }

      // Check which sessions have a paper uploaded by this teacher
      let pending = 0;
      const now = new Date();
      for (const s of sessions) {
        // Only count sessions with deadline in the future or within 1 day past
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

  // Exam cell: count review_requested papers
  useEffect(() => {
    if (profile?.role !== 'exam_cell') return;

    const fetchReviewCount = async () => {
      const { count } = await supabase
        .from('exam_papers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'review_requested');
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

  // Exam cell: count unread notifications (HOD Alerts)
  useEffect(() => {
    if (profile?.role !== 'exam_cell') return;

    const fetchUnreadAlerts = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, is_read')
        .contains('target_roles', ['exam_cell'])
        .eq('is_read', false);
      setUnreadAlertsCount(data?.length || 0);
    };

    fetchUnreadAlerts();

    const channel = supabase
      .channel('exam-cell-alerts-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
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
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground flex flex-col',
        isMobile
          ? 'w-full h-full'
          : cn('fixed left-0 top-0 h-screen z-40 transition-all duration-200', collapsed ? 'w-20' : 'w-64'),
        className
      )}
    >
      {/* Logo */}
      <div className="p-6 relative z-50">
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                className={cn(
                  'absolute -right-3.5 top-6 z-50 h-8 w-8 rounded-full border-2 border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-all',
                  'hover:bg-sidebar-accent hover:scale-110 hover:border-sidebar-primary'
                )}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4 mx-auto" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        )}

        <div className={cn('flex items-center gap-3', collapsed && !isMobile ? 'justify-center' : '')}>
          <div className="flex items-center justify-center">
            <img src="/cuk-favicon.png" alt="CUK Logo" className="w-10 h-10 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg">ExamSecure</h1>
              <p className="text-xs text-sidebar-foreground/60">Paper Management</p>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="p-4">
        <div className={cn('flex items-center gap-3', collapsed && !isMobile ? 'justify-center' : '')}>
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
            {getInitials()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{profile.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60">{getRoleBadge()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = (profile?.role === 'hod' && (item.path === '/dashboard' || item.path === '/review') && pendingRequestsCount > 0) ||
            (profile?.role === 'teacher' && item.path === '/teacher/calendar' && pendingCalendarCount > 0) ||
            (profile?.role === 'exam_cell' && item.path === '/inbox' && reviewRequestedCount > 0);
          const badgeCount = profile?.role === 'teacher' && item.path === '/teacher/calendar' ? pendingCalendarCount
            : profile?.role === 'exam_cell' && item.path === '/inbox' ? reviewRequestedCount
            : pendingRequestsCount;
          const link = (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative',
                collapsed && !isMobile ? 'justify-center px-0' : '',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <span className="relative">
                <item.icon className="w-5 h-5" />
                {showBadge && collapsed && !isMobile && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none px-1">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  <span>{item.label}</span>
                  {showBadge && (
                    <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none px-1">
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
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-2">
        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className="flex items-center justify-center px-0 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
              >
                <User className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Profile</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            to="/profile"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </Link>
        )}

        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center px-0 py-3 text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive"
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-3 text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
