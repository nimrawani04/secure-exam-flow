import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import {
  Bell,
  ChevronRight,
  Command,
  Loader2,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface DashboardLayoutProps {
  children: ReactNode;
}

const routeTitles: Record<string, { section: string; page: string }> = {
  '/dashboard': { section: 'Dashboard', page: 'Overview' },
  '/upload': { section: 'Teacher', page: 'Upload Paper' },
  '/submissions': { section: 'Teacher', page: 'My Submissions' },
  '/subjects': { section: 'Teacher', page: 'Assigned Subjects' },
  '/review': { section: 'HOD', page: 'Review Papers' },
  '/department': { section: 'HOD', page: 'Department' },
  '/approved': { section: 'HOD', page: 'Approved Papers' },
  '/hod/alerts': { section: 'HOD', page: 'Teacher Alerts' },
  '/calendar': { section: 'Exam Cell', page: 'Exam Calendar' },
  '/exam-cell/sessions': { section: 'Exam Cell', page: 'Exam Sessions' },
  '/exam-cell/alerts': { section: 'Exam Cell', page: 'HOD Alerts' },
  '/inbox': { section: 'Exam Cell', page: 'Papers Inbox' },
  '/archive': { section: 'Exam Cell', page: 'Archive' },
  '/admin/users': { section: 'Admin', page: 'User Management' },
  '/admin/departments': { section: 'Admin', page: 'Departments' },
  '/admin/audit': { section: 'Admin', page: 'Audit Logs' },
  '/admin/broadcasts': { section: 'Admin', page: 'Broadcasts' },
  '/admin/security': { section: 'Admin', page: 'Security' },
  '/profile': { section: 'Account', page: 'Profile' },
};

const shortcuts = [
  { keys: 'G + D', label: 'Go to Dashboard', path: '/dashboard' },
  { keys: 'G + U', label: 'Go to Upload Paper', path: '/upload' },
  { keys: 'G + S', label: 'Go to Submissions', path: '/submissions' },
  { keys: 'G + R', label: 'Go to Review', path: '/review' },
  { keys: 'G + P', label: 'Go to Profile', path: '/profile' },
  { keys: '?', label: 'Open shortcuts', path: '' },
];

const notificationTypeConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'destructive' | 'success' }> = {
  info: { label: 'Info', variant: 'secondary' },
  warning: { label: 'Warning', variant: 'warning' },
  critical: { label: 'Critical', variant: 'destructive' },
  success: { label: 'Success', variant: 'success' },
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lastKey = useRef<{ key: string; time: number } | null>(null);
  const { data: notifications, isLoading: notificationsLoading } = useNotifications({
    userId: profile?.id,
    role: profile?.role ?? null,
    departmentId: profile?.department_id ?? null,
    limit: 6,
  });
  const notificationCount = notifications?.length || 0;

  const title = useMemo(() => {
    return routeTitles[location.pathname] || { section: 'Dashboard', page: 'Overview' };
  }, [location.pathname]);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      const now = Date.now();
      const key = event.key.toLowerCase();
      if (key === 'g') {
        lastKey.current = { key: 'g', time: now };
        return;
      }

      if (lastKey.current && lastKey.current.key === 'g' && now - lastKey.current.time < 1200) {
        if (key === 'd') navigate('/dashboard');
        if (key === 'u') navigate('/upload');
        if (key === 's') navigate('/submissions');
        if (key === 'r') navigate('/review');
        if (key === 'p') navigate('/profile');
        lastKey.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-lg px-6 animate-fade-in">
          <div className="rounded-2xl border bg-card p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Preparing your dashboard...</p>
            </div>
            <div className="space-y-4 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
              </div>
              <div className="h-24 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dashboard-bg))] dark:bg-[hsl(var(--dashboard-bg-dark))]">
      <div className="lg:hidden sticky top-0 z-40 border-b bg-background">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {profile?.full_name || 'Account'}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="truncate">{title.section}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="truncate font-medium text-foreground">{title.page}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-[320px] overflow-auto">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notificationsLoading ? (
                  <DropdownMenuItem className="text-sm text-muted-foreground">
                    Loading notifications...
                  </DropdownMenuItem>
                ) : notificationCount > 0 ? (
                  notifications?.map((notification) => {
                    const config = notificationTypeConfig[notification.type || 'info'] || notificationTypeConfig.info;
                    const messagePreview =
                      notification.message.length > 140
                        ? `${notification.message.slice(0, 140)}...`
                        : notification.message;

                    return (
                      <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 whitespace-normal">
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-medium">{notification.title}</span>
                          <Badge variant={config.variant} className="text-[10px] uppercase">
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{messagePreview}</p>
                        <span className="text-[11px] text-muted-foreground">
                          {notification.created_at
                            ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                            : 'Just now'}
                        </span>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <DropdownMenuItem className="text-sm text-muted-foreground">
                    No new notifications
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle className="h-9 w-9" compact />
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
            >
              {profile?.full_name?.split(' ').map((n) => n[0]).join('') || 'U'}
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <Sidebar isMobile />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <Sidebar
        className="hidden lg:flex"
        collapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />
      <main className={cn('min-h-screen', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="hidden lg:block sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{title.section}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium">{title.page}</span>
              </div>
              <p className="text-xs text-muted-foreground">Stay updated with important announcements</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="hidden gap-2 md:inline-flex">
                    <Command className="h-4 w-4" />
                    Shortcuts
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    {shortcuts.map((shortcut) => (
                      <div key={shortcut.label} className="flex items-center justify-between text-sm">
                        <span>{shortcut.label}</span>
                        <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                          {shortcut.keys}
                        </span>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Notifications" className="relative">
                    <Bell className="h-4 w-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[320px] overflow-auto">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationsLoading ? (
                    <DropdownMenuItem className="text-sm text-muted-foreground">
                      Loading notifications...
                    </DropdownMenuItem>
                  ) : notificationCount > 0 ? (
                    notifications?.map((notification) => {
                      const config = notificationTypeConfig[notification.type || 'info'] || notificationTypeConfig.info;
                      const messagePreview =
                        notification.message.length > 140
                          ? `${notification.message.slice(0, 140)}...`
                          : notification.message;

                      return (
                        <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 whitespace-normal">
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="text-sm font-medium">{notification.title}</span>
                            <Badge variant={config.variant} className="text-[10px] uppercase">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{messagePreview}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {notification.created_at
                              ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                              : 'Just now'}
                          </span>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem className="text-sm text-muted-foreground">
                      No new notifications
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <ThemeToggle className="hidden h-9 sm:inline-flex" compact />
              <Button variant="ghost" size="sm" className="gap-2 px-2 sm:px-3" onClick={() => navigate('/profile')}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {profile?.full_name?.split(' ').map((n) => n[0]).join('') || 'U'}
                </span>
                <span className="hidden sm:inline">{profile?.full_name || 'Profile'}</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
