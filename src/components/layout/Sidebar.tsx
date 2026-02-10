import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Upload,
  FileText,
  Users,
  Calendar,
  Settings,
  LogOut,
  Shield,
  FileCheck,
  Archive,
  ClipboardList,
  Building,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const roleNavItems = {
  teacher: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Upload, label: 'Upload Paper', path: '/upload' },
    { icon: FileText, label: 'My Submissions', path: '/submissions' },
    { icon: ClipboardList, label: 'Assigned Subjects', path: '/subjects' },
  ],
  hod: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileCheck, label: 'Review Papers', path: '/review' },
    { icon: Users, label: 'Department', path: '/department' },
    { icon: Archive, label: 'Approved Papers', path: '/approved' },
  ],
  exam_cell: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Exam Calendar', path: '/calendar' },
    { icon: FileText, label: 'Papers Inbox', path: '/inbox' },
    { icon: Archive, label: 'Archive', path: '/archive' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'User Management', path: '/admin/users' },
    { icon: Building, label: 'Departments', path: '/admin/departments' },
    { icon: Activity, label: 'Audit Logs', path: '/admin/audit' },
    { icon: ShieldCheck, label: 'Security', path: '/admin/security' },
  ],
};

export function Sidebar({
  className,
  isMobile = false,
}: {
  className?: string;
  isMobile?: boolean;
}) {
  const location = useLocation();
  const { profile, signOut } = useAuth();

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
        isMobile ? 'w-full h-full' : 'fixed left-0 top-0 h-screen w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">ExamSecure</h1>
            <p className="text-xs text-sidebar-foreground/60">Paper Management</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
            {getInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{profile.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60">{getRoleBadge()}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-4 py-3 text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
