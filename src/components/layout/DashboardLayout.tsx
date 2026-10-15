import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ChatBubble } from '@/components/chatbot/ChatBubble';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import {
  Bell,
  ChevronRight,
  Command as CommandIcon,
  Loader2,
  Menu,
  Search,
  LayoutDashboard,
  User,
  Settings as SettingsIcon,
  UserCheck,
  BookOpen,
  FileCheck,
  Upload,
  FileText,
  Calendar,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificationActions, useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface DashboardLayoutProps {
  children: ReactNode;
}

const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';

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
  '/hod/panels': { section: 'HOD', page: 'Examiner Panels' },
  '/hod/subjects': { section: 'HOD', page: 'Subject Catalog' },
  '/exam-cell/panels': { section: 'Exam Cell', page: 'Examiner Panels' },
  '/exam-cell/datesheets': { section: 'Exam Cell', page: 'Datesheets' },
  '/profile': { section: 'Account', page: 'Profile' },
  '/settings': { section: 'Account', page: 'Settings' },
};

const getShortcutList = (role?: string) => [
  {
    category: 'General',
    items: [
      { keys: [modKey, 'K'], label: 'Open Search & Command Palette' },
      { keys: ['?'], label: 'View Keyboard Shortcuts Cheatsheet' },
      { keys: ['N'], label: 'Toggle Notification Panel' },
      { keys: [modKey, 'B'], label: 'Toggle Sidebar Collapse' },
      { keys: ['Esc'], label: 'Close Dialogs or Cancel Key Chord' },
    ],
  },
  {
    category: 'Navigation (Press G, then...)',
    items: [
      { keys: ['G', 'D'], label: 'Go to Dashboard', path: '/dashboard' },
      { keys: ['G', 'P'], label: 'Go to Profile', path: '/profile' },
      { keys: ['G', 'S'], label: 'Go to Settings', path: '/settings' },
      ...(role === 'hod'
        ? [
            { keys: ['G', 'E'], label: 'Go to Examiner Panels', path: '/hod/panels' },
            { keys: ['G', 'C'], label: 'Go to Subject Catalog', path: '/hod/subjects' },
            { keys: ['G', 'R'], label: 'Go to Review Papers', path: '/review' },
            { keys: ['G', 'M'], label: 'Go to Department', path: '/department' },
          ]
        : []),
      ...(role === 'teacher'
        ? [
            { keys: ['G', 'U'], label: 'Go to Upload Paper', path: '/upload' },
            { keys: ['G', 'M'], label: 'Go to My Submissions', path: '/submissions' },
            { keys: ['G', 'A'], label: 'Go to Exam Calendar', path: '/teacher/calendar' },
          ]
        : []),
      ...(role === 'exam_cell'
        ? [
            { keys: ['G', 'E'], label: 'Go to Examiner Panels', path: '/exam-cell/panels' },
            { keys: ['G', 'T'], label: 'Go to Datesheets', path: '/exam-cell/datesheets' },
            { keys: ['G', 'I'], label: 'Go to Papers Inbox', path: '/inbox' },
          ]
        : []),
    ],
  },
];

const notificationTypeConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'destructive' | 'success' }> = {
  info: { label: 'Info', variant: 'secondary' },
  warning: { label: 'Warning', variant: 'warning' },
  critical: { label: 'Critical', variant: 'destructive' },
  success: { label: 'Success', variant: 'success' },
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, profile, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chordActive, setChordActive] = useState(false);
  const lastKey = useRef<{ key: string; time: number } | null>(null);
  const chordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notifications for display
  const { data: notifications, isLoading: notificationsLoading } = useNotifications({
    userId: profile?.id,
    role: profile?.role ?? null,
    departmentId: profile?.department_id ?? null,
    limit: 6,
    includeRead: showRead,
  });

  // Always fetch unread notifications count
  const { data: unreadNotifications } = useNotifications({
    userId: profile?.id,
    role: profile?.role ?? null,
    departmentId: profile?.department_id ?? null,
    limit: 100,
    includeRead: false,
  });

  const { toggleRead } = useNotificationActions();
  const notificationCount = unreadNotifications?.length || 0;

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

  // Keyboard shortcut listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const key = event.key ? event.key.toLowerCase() : '';
      const code = event.code || '';

      // Global Command Palette (Cmd+K / Ctrl+K) - works everywhere!
      if ((event.metaKey || event.ctrlKey) && (key === 'k' || code === 'KeyK')) {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Sidebar Toggle (Cmd+B / Ctrl+B)
      if ((event.metaKey || event.ctrlKey) && (key === 'b' || code === 'KeyB')) {
        event.preventDefault();
        setIsCollapsed((prev) => !prev);
        return;
      }

      // Escape key cancels chord or dismisses open overlays
      if (key === 'escape' || code === 'Escape') {
        if (chordActive) {
          lastKey.current = null;
          setChordActive(false);
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
          return;
        }
      }

      // If user is actively typing in an editable field, DO NOT trigger single-key navigation chords
      if (isEditable) {
        return;
      }

      // Help / Shortcuts: '?' or Shift + '/'
      if (event.key === '?' || (event.shiftKey && (key === '/' || code === 'Slash'))) {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // 'N' for notifications (single key, not holding meta/ctrl/alt)
      if (!event.metaKey && !event.ctrlKey && !event.altKey && (key === 'n' || code === 'KeyN') && !chordActive) {
        event.preventDefault();
        setNotificationsOpen((prev) => !prev);
        return;
      }

      const now = Date.now();

      // First key: 'G' chord start
      if (!event.metaKey && !event.ctrlKey && !event.altKey && (key === 'g' || code === 'KeyG') && !chordActive) {
        event.preventDefault();
        lastKey.current = { key: 'g', time: now };
        setChordActive(true);

        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        chordTimerRef.current = setTimeout(() => {
          lastKey.current = null;
          setChordActive(false);
        }, 2800);
        return;
      }

      // Second key: following 'G' within 2800ms
      if (lastKey.current && lastKey.current.key === 'g' && now - lastKey.current.time < 2800) {
        event.preventDefault();
        lastKey.current = null;
        setChordActive(false);
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

        // Core routes
        if (key === 'd' || code === 'KeyD') { navigate('/dashboard'); return; }
        if (key === 'p' || code === 'KeyP') { navigate('/profile'); return; }
        if (key === 's' || code === 'KeyS') { navigate('/settings'); return; }

        // Role-tailored routes
        if (key === 'r' || code === 'KeyR') { navigate('/review'); return; }
        if (key === 'e' || code === 'KeyE') {
          navigate(profile?.role === 'exam_cell' ? '/exam-cell/panels' : '/hod/panels');
          return;
        }
        if (key === 'c' || code === 'KeyC') {
          navigate(profile?.role === 'hod' ? '/hod/subjects' : '/calendar');
          return;
        }
        if (key === 'u' || code === 'KeyU') { navigate('/upload'); return; }
        if (key === 'm' || code === 'KeyM') {
          navigate(profile?.role === 'hod' ? '/department' : '/submissions');
          return;
        }
        if (key === 't' || code === 'KeyT') { navigate('/exam-cell/datesheets'); return; }
        if (key === 'i' || code === 'KeyI') { navigate('/inbox'); return; }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, [navigate, profile?.role, chordActive]);

  // Support programmatic events
  useEffect(() => {
    const handleOpenShortcuts = () => setShortcutsOpen(true);
    const handleOpenCommand = () => setCommandPaletteOpen(true);
    window.addEventListener('open-shortcuts', handleOpenShortcuts);
    window.addEventListener('open-command-palette', handleOpenCommand);
    return () => {
      window.removeEventListener('open-shortcuts', handleOpenShortcuts);
      window.removeEventListener('open-command-palette', handleOpenCommand);
    };
  }, []);

  const handleReadToggle = async (notificationId: string, markRead: boolean) => {
    if (!profile?.id) return;
    await toggleRead({ notificationId, userId: profile.id, markRead });
  };

  const handleMarkAllRead = async () => {
    if (!profile?.id || !unreadNotifications?.length) return;
    await Promise.all(
      unreadNotifications.map((n) =>
        toggleRead({ notificationId: n.id, userId: profile.id, markRead: true })
      )
    );
    toast({
      title: 'All notifications marked as read',
      description: `${unreadNotifications.length} notification${unreadNotifications.length !== 1 ? 's' : ''} marked as read.`,
    });
  };

  const renderNotificationsContent = () => (
    <DropdownMenuContent align="end" className="w-80 max-h-[360px] overflow-auto z-50">
      <div className="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
        {notificationCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-primary hover:text-primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleMarkAllRead();
            }}
          >
            Mark all read
          </Button>
        )}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        checked={showRead}
        onCheckedChange={(checked) => setShowRead(Boolean(checked))}
      >
        Show read
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      {notificationsLoading ? (
        <DropdownMenuItem className="text-sm text-muted-foreground">
          Loading notifications...
        </DropdownMenuItem>
      ) : notifications && notifications.length > 0 ? (
        notifications.map((notification) => {
          const config = notificationTypeConfig[notification.type || 'info'] || notificationTypeConfig.info;
          const messagePreview =
            notification.message.length > 140
              ? `${notification.message.slice(0, 140)}...`
              : notification.message;
          const isRead = Boolean((notification as any).is_read_by_user);

          return (
            <DropdownMenuItem
              key={notification.id}
              onSelect={(event) => {
                event.preventDefault();
                if (!isRead) {
                  handleReadToggle(notification.id, true);
                }
              }}
              className={cn(
                "flex flex-col items-start gap-1 whitespace-normal",
                isRead && "opacity-60"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium">{notification.title}</span>
                <Badge variant={config.variant} className="text-[10px] uppercase">
                  {config.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{messagePreview}</p>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {notification.created_at
                    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                    : 'Just now'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleReadToggle(notification.id, !isRead);
                  }}
                >
                  {isRead ? 'Mark unread' : 'Mark read'}
                </Button>
              </div>
            </DropdownMenuItem>
          );
        })
      ) : (
        <DropdownMenuItem className="text-sm text-muted-foreground">
          {showRead ? 'No notifications' : 'No new notifications'}
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );

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
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dashboard-bg))] dark:bg-[hsl(var(--dashboard-bg-dark))]">
      {/* Mobile Top Header */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/90 dark:bg-[#0c1118]/90 backdrop-blur-[16px]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">
              {profile?.full_name || 'Account'}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="truncate">{title.section}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-foreground">{title.page}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mobile Command Palette Trigger */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search & Command Menu"
              onClick={() => setCommandPaletteOpen(true)}
              className="h-8 w-8 text-[#64748b] dark:text-[#a0aec0]"
              title={`Command Palette (${modKey}+K)`}
            >
              <Search className="w-4 h-4" />
            </Button>

            {/* Mobile Shortcuts Trigger */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Keyboard Shortcuts"
              onClick={() => setShortcutsOpen(true)}
              className="h-8 w-8 text-[#64748b] dark:text-[#a0aec0]"
              title="Keyboard Shortcuts (?)"
            >
              <CommandIcon className="w-4 h-4" />
            </Button>

            {/* Mobile Notifications */}
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              {renderNotificationsContent()}
            </DropdownMenu>

            <ThemeToggle className="h-8 w-8" compact />
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
            >
              {profile?.full_name?.split(' ').map((n) => n[0]).join('') || 'U'}
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="h-8 w-8">
                  <Menu className="w-4 h-4" />
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

      <main className={cn('min-h-screen relative overflow-x-hidden', isCollapsed ? 'lg:ml-20' : 'lg:ml-[232px]')}>
        {/* Desktop Top Header */}
        <div className="hidden lg:block sticky top-0 z-30 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/90 dark:bg-[#0c1118]/90 backdrop-blur-[16px]">
          <div className="flex h-[52px] px-4 sm:px-6 lg:px-10 items-center justify-between gap-3">
            <nav className="flex items-center gap-1.5 text-[12px]">
              <span className="text-[#a0aec0] dark:text-[#3d5166]">{title.section}</span>
              <span className="text-[#a0aec0] dark:text-[#3d5166]">/</span>
              <span className="font-medium text-[#18202e] dark:text-[#e2eaf4]">{title.page}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Search & Command Palette Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:inline-flex h-8 gap-2 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] text-[#64748b] dark:text-[#a0aec0] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
              >
                <Search className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                <span>Search / Commands</span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0c1118] px-1.5 font-mono text-[9px] font-medium text-[#64748b] dark:text-[#a0aec0]">
                  {modKey}K
                </kbd>
              </Button>

              {/* Shortcuts Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:inline-flex h-8 gap-1.5 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] text-[#64748b] dark:text-[#a0aec0] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
                title="Keyboard shortcuts (?)"
              >
                <CommandIcon className="h-3.5 w-3.5" />
                <span>Shortcuts</span>
                <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0c1118] px-1 font-mono text-[9px] font-medium text-[#64748b] dark:text-[#a0aec0]">
                  ?
                </kbd>
              </Button>

              {/* Notifications */}
              <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Notifications"
                    className="relative h-8 w-8 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#f43f5e] px-1 font-mono text-[10px] font-medium text-white">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                {renderNotificationsContent()}
              </DropdownMenu>

              <ThemeToggle className="hidden h-8 w-8 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] sm:inline-flex" compact />
              
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-[8px] bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] border border-[rgba(13,122,107,0.2)] px-1 font-mono text-[10px] font-medium text-[#0d7a6b] dark:text-[#2dd4bf]"
                title={profile?.full_name || 'Profile'}
              >
                {profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-6 lg:p-8 pb-24 sm:pb-8">
          {children}
        </div>
      </main>

      {/* Floating Chord HUD Indicator */}
      {chordActive && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] text-white px-4 py-2.5 rounded-full text-[12px] font-sans shadow-2xl flex items-center gap-2.5 border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] font-bold border border-slate-700">
              G
            </kbd>
            <span className="text-slate-300">then press:</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
            <span><strong className="text-white">D</strong> Dashboard</span>
            <span>•</span>
            <span><strong className="text-white">P</strong> Profile</span>
            <span>•</span>
            <span><strong className="text-white">S</strong> Settings</span>
            {profile?.role === 'hod' && (
              <>
                <span>•</span>
                <span><strong className="text-white">E</strong> Panels</span>
                <span>•</span>
                <span><strong className="text-white">C</strong> Catalog</span>
                <span>•</span>
                <span><strong className="text-white">R</strong> Review</span>
              </>
            )}
            {profile?.role === 'teacher' && (
              <>
                <span>•</span>
                <span><strong className="text-white">U</strong> Upload</span>
                <span>•</span>
                <span><strong className="text-white">M</strong> Submissions</span>
              </>
            )}
            {profile?.role === 'exam_cell' && (
              <>
                <span>•</span>
                <span><strong className="text-white">E</strong> Panels</span>
                <span>•</span>
                <span><strong className="text-white">T</strong> Datesheets</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              lastKey.current = null;
              setChordActive(false);
            }}
            className="text-slate-400 hover:text-white text-[11px] ml-1 pl-2 border-l border-slate-700 cursor-pointer"
          >
            Esc to cancel
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog - Mounted at Root */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 rounded-[12px] overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xl font-sans">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 text-left">
            <div>
              <DialogTitle className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Keyboard Shortcuts
              </DialogTitle>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                Press shortcut keys to quickly navigate across the application.
              </p>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
            {getShortcutList(profile?.role).map((section) => (
              <div key={section.category} className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.category}
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  {section.items.map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between px-3.5 py-2.5 text-[13px]"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{shortcut.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {shortcut.keys.map((k, idx) => (
                          <kbd
                            key={idx}
                            className="inline-flex min-w-[20px] h-5 items-center justify-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Tip: Press <kbd className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300">?</kbd> anywhere to open this cheatsheet</span>
            <span className="font-mono text-[10px]">Esc to close</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Command Palette Dialog - Mounted at Root */}
      <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <CommandInput placeholder="Search pages, tools, or type a command..." />
        <CommandList>
          <CommandEmpty>No matching results.</CommandEmpty>
          
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => {
                navigate('/dashboard');
                setCommandPaletteOpen(false);
              }}
            >
              <LayoutDashboard className="mr-2 h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span>Dashboard Overview</span>
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                navigate('/profile');
                setCommandPaletteOpen(false);
              }}
            >
              <User className="mr-2 h-4 w-4" />
              <span>User Profile</span>
              <CommandShortcut>G P</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                navigate('/settings');
                setCommandPaletteOpen(false);
              }}
            >
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Account &amp; Privacy Settings</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>

            {profile?.role === 'hod' && (
              <>
                <CommandItem
                  onSelect={() => {
                    navigate('/hod/panels');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <UserCheck className="mr-2 h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                  <span>Examiner Panels</span>
                  <CommandShortcut>G E</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    navigate('/hod/subjects');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <BookOpen className="mr-2 h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                  <span>Subject Catalog Management</span>
                  <CommandShortcut>G C</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    navigate('/review');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <FileCheck className="mr-2 h-4 w-4" />
                  <span>Review Question Papers</span>
                  <CommandShortcut>G R</CommandShortcut>
                </CommandItem>
              </>
            )}

            {profile?.role === 'teacher' && (
              <>
                <CommandItem
                  onSelect={() => {
                    navigate('/upload');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  <span>Upload Question Paper</span>
                  <CommandShortcut>G U</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    navigate('/submissions');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>My Submissions</span>
                  <CommandShortcut>G M</CommandShortcut>
                </CommandItem>
              </>
            )}

            {profile?.role === 'exam_cell' && (
              <>
                <CommandItem
                  onSelect={() => {
                    navigate('/exam-cell/panels');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  <span>Examiner Panels Approval</span>
                  <CommandShortcut>G E</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    navigate('/exam-cell/datesheets');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Datesheet Management</span>
                  <CommandShortcut>G T</CommandShortcut>
                </CommandItem>
              </>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false);
                setNotificationsOpen(true);
              }}
            >
              <Bell className="mr-2 h-4 w-4" />
              <span>Notifications Panel</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false);
                setShortcutsOpen(true);
              }}
            >
              <CommandIcon className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts Cheatsheet</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={async () => {
                setCommandPaletteOpen(false);
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="mr-2 h-4 w-4 text-rose-500" />
              <span className="text-rose-600 dark:text-rose-400">Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <ChatBubble />
    </div>
  );
}
