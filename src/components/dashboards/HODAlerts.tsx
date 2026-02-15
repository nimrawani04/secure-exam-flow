import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminNotifications, useCreateBulkNotifications, useCreateNotification } from '@/hooks/useAdminNotifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Subject {
  id: string;
  name: string;
  code: string;
}

type TargetMode = 'department' | 'subjects';

const notificationTypeOptions = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'success', label: 'Success' },
];

const notificationTypeVariant: Record<string, 'secondary' | 'warning' | 'destructive' | 'success'> = {
  info: 'secondary',
  warning: 'warning',
  critical: 'destructive',
  success: 'success',
};

export function HODAlerts() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const createBulkNotifications = useCreateBulkNotifications();
  const createNotification = useCreateNotification();
  const { data: recentNotifications, isLoading: notificationsLoading } = useAdminNotifications(profile?.id);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'warning' | 'critical' | 'success'>('info');
  const [targetMode, setTargetMode] = useState<TargetMode>('department');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const messageLimit = 500;

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!profile?.department_id) return;
      setSubjectsLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('department_id', profile.department_id)
        .order('name');
      setSubjectsLoading(false);
      if (error) {
        toast({ title: 'Error', description: 'Failed to load subjects.', variant: 'destructive' });
        return;
      }
      setSubjects(data || []);
    };

    fetchSubjects();
  }, [profile?.department_id, toast]);

  const hodTeacherNotifications = useMemo(() => {
    return (recentNotifications || []).filter((notification) => notification.target_roles.includes('teacher'));
  }, [recentNotifications]);

  const toggleSubject = (subjectId: string, checked: boolean | 'indeterminate') => {
    setSelectedSubjectIds((prev) => {
      if (checked) {
        return prev.includes(subjectId) ? prev : [...prev, subjectId];
      }
      return prev.filter((id) => id !== subjectId);
    });
  };

  const resolveTeacherIds = async () => {
    if (!profile?.department_id) return [];

    if (targetMode === 'subjects') {
      if (selectedSubjectIds.length === 0) return [];
      const { data: assignments, error } = await supabase
        .from('teacher_subjects')
        .select('teacher_id, subject_id')
        .in('subject_id', selectedSubjectIds);
      if (error) throw error;
      const ids = new Set<string>();
      (assignments || []).forEach((assignment) => ids.add(assignment.teacher_id));
      return Array.from(ids);
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('department_id', profile.department_id);
    if (profilesError) throw profilesError;

    const profileIds = (profiles || []).map((p) => p.id);
    if (profileIds.length === 0) return [];

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', profileIds)
      .eq('role', 'teacher');
    if (rolesError) throw rolesError;

    return (roles || []).map((role) => role.user_id);
  };

  const refreshRecipientCount = async () => {
    setCountLoading(true);
    try {
      const teacherIds = await resolveTeacherIds();
      setRecipientCount(teacherIds.length);
    } catch {
      setRecipientCount(null);
    } finally {
      setCountLoading(false);
    }
  };

  useEffect(() => {
    if (targetMode === 'subjects' && selectedSubjectIds.length === 0) {
      setRecipientCount(0);
      return;
    }
    if (!profile?.department_id) {
      setRecipientCount(null);
      return;
    }
    refreshRecipientCount();
  }, [targetMode, selectedSubjectIds, profile?.department_id]);

  const isFormValid =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (targetMode === 'department' || selectedSubjectIds.length > 0) &&
    !countLoading &&
    (recipientCount ?? 0) > 0;

  const handleBroadcast = async () => {
    if (!profile?.id || !profile.department_id) {
      toast({ title: 'Error', description: 'Profile not loaded. Please try again.', variant: 'destructive' });
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Error', description: 'Title and message are required.', variant: 'destructive' });
      return;
    }
    if (targetMode === 'subjects' && selectedSubjectIds.length === 0) {
      toast({ title: 'Error', description: 'Select at least one subject.', variant: 'destructive' });
      return;
    }

    try {
      const teacherIds = await resolveTeacherIds();
      if (teacherIds.length === 0) {
        toast({ title: 'No recipients', description: 'No teachers match the selected criteria.', variant: 'destructive' });
        return;
      }

      const notifications = teacherIds.map((teacherId) => ({
        created_by: profile.id,
        title: title.trim(),
        message: message.trim(),
        type: alertType,
        target_roles: ['teacher'],
        target_departments: [profile.department_id],
        user_id: teacherId,
      }));

      await createBulkNotifications.mutateAsync(notifications);
      toast({ title: 'Alert sent', description: `Notification sent to ${teacherIds.length} teachers.` });
      setTitle('');
      setMessage('');
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to send alerts.', variant: 'destructive' });
    }
  };

  const handlePreview = () => {
    if (!title.trim() && !message.trim()) {
      toast({ title: 'Preview not available', description: 'Add a title and message to preview.', variant: 'destructive' });
      return;
    }
    toast({
      title: title.trim() || 'Untitled alert',
      description: message.trim().slice(0, 200) + (message.trim().length > 200 ? '...' : ''),
    });
  };

  const handleDuplicate = (notification: (typeof hodTeacherNotifications)[number]) => {
    setTitle(notification.title);
    setMessage(notification.message);
    if (notification.type && ['info', 'warning', 'critical', 'success'].includes(notification.type)) {
      setAlertType(notification.type as typeof alertType);
    }
    titleRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (isFormValid && !createBulkNotifications.isPending) {
        handleBroadcast();
      }
    }
  };

  const handleResend = async (notification: (typeof hodTeacherNotifications)[number]) => {
    if (!profile?.id || !profile.department_id) {
      toast({ title: 'Error', description: 'Profile not loaded. Please try again.', variant: 'destructive' });
      return;
    }
    if (!notification.user_id) {
      handleDuplicate(notification);
      return;
    }
    try {
      await createNotification.mutateAsync({
        createdBy: profile.id,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        targetRoles: ['teacher'],
        targetDepartments: [profile.department_id],
        userId: notification.user_id,
      });
      toast({ title: 'Alert resent', description: 'Notification sent again to the selected recipient.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to resend alert.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Teacher Alerts</h1>
        <p className="text-muted-foreground text-sm">
          Send department or subject-based notifications to teachers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Compose Alert</h2>
                <p className="text-sm text-muted-foreground">
                  Notify all teachers in your department or specific subject groups.
                </p>
              </div>
              <Badge variant={notificationTypeVariant[alertType]} className="text-xs uppercase">
                {alertType}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                <Label htmlFor="alert-title">Title</Label>
                <Input
                  id="alert-title"
                  ref={titleRef}
                  placeholder="e.g. Final paper upload deadline"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
                <Label htmlFor="alert-message">Message</Label>
                <div className="space-y-2">
                  <Textarea
                    id="alert-message"
                    placeholder="Share instructions, deadlines, or clarifications."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={messageLimit}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Keep it clear and actionable.</span>
                    <span>{message.length}/{messageLimit}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={alertType} onValueChange={(value) => setAlertType(value as typeof alertType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      {notificationTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Target Mode</Label>
                    <span className="text-xs text-muted-foreground">
                      Recipients: {countLoading ? 'Calculating...' : recipientCount ?? 'N/A'}
                    </span>
                  </div>
                  <Select value={targetMode} onValueChange={(value) => setTargetMode(value as TargetMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="department">All Department Teachers</SelectItem>
                      <SelectItem value="subjects">Teachers by Subject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {targetMode === 'subjects' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Target Subjects</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedSubjectIds([])}
                      disabled={selectedSubjectIds.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  {subjectsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading subjects...</p>
                  ) : subjects.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {subjects.map((subject) => (
                        <label key={subject.id} className="flex items-start gap-3 rounded-lg border bg-secondary/20 p-3">
                          <Checkbox
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(checked) => toggleSubject(subject.id, checked)}
                          />
                          <div>
                            <p className="text-sm font-medium">{subject.name}</p>
                            <p className="text-xs text-muted-foreground">{subject.code}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No subjects assigned yet.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Press ⌘/Ctrl + Enter to send once ready.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  Preview
                </Button>
                <Button
                  variant="hero"
                  className="gap-2"
                  onClick={handleBroadcast}
                  disabled={!isFormValid || createBulkNotifications.isPending}
                >
                  {createBulkNotifications.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {createBulkNotifications.isPending ? 'Sending...' : 'Send Alert'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:h-full">
          <div className="bg-card rounded-lg border p-5 space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Recent Alerts</h3>
                <p className="text-xs text-muted-foreground">Latest alerts you sent.</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {hodTeacherNotifications.length}
              </Badge>
            </div>
            {notificationsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`alert-skeleton-${index}`} className="flex items-start gap-3 rounded-lg border p-4 animate-pulse">
                    <div className="h-9 w-9 rounded-md bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hodTeacherNotifications.length > 0 ? (
              <div className="divide-y border rounded-lg">
                {hodTeacherNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{notification.title}</span>
                        <Badge
                          variant={notificationTypeVariant[notification.type || 'info'] || 'secondary'}
                          className="text-[10px] uppercase"
                        >
                          {notification.type || 'info'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notification.message.length > 120 ? `${notification.message.slice(0, 120)}...` : notification.message}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {notification.created_at
                            ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                            : 'Just now'}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => handleDuplicate(notification)}>
                            Duplicate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => handleResend(notification)}
                            disabled={createNotification.isPending}
                          >
                            Resend
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed bg-secondary/10 p-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full border border-dashed flex items-center justify-center">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <div>
                  <p className="font-medium text-sm">No alerts sent yet</p>
                  <p className="text-xs text-muted-foreground">Compose an alert to notify teachers quickly.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => titleRef.current?.focus()}>
                  Send your first alert
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
