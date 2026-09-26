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
import { Bell, Loader2, Search, ArrowUpDown, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { HodPageShell } from '@/components/layout/HodPageShell';

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
}

type TargetMode = 'department' | 'subjects';

const notificationTypeOptions = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'success', label: 'Success' },
];

const alertPillStyles: Record<string, string> = {
  info: 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf] border-[#0d7a6b]/25',
  warning: 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24] border-[#f59e0b]/30',
  critical: 'bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#9f1239] dark:text-[#fb7185] border-[#f43f5e]/30',
  success: 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#065f46] dark:text-[#34d399] border-[#10b981]/30',
};

const alertTileStyles: Record<string, string> = {
  info: 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf] border-[#0d7a6b]/20',
  warning: 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24] border-[#f59e0b]/25',
  critical: 'bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#9f1239] dark:text-[#fb7185] border-[#f43f5e]/25',
  success: 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#065f46] dark:text-[#34d399] border-[#10b981]/25',
};

const inputWarm =
  'h-10 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus-visible:ring-[#0d7a6b]/30 focus-visible:border-[#0d7a6b]/50';
const eyebrowWarm =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]';

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
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectSort, setSubjectSort] = useState<'name' | 'code' | 'semester'>('name');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  const availableSemesters = useMemo(() => {
    const sems = [...new Set(subjects.map((s) => s.semester))].sort((a, b) => a - b);
    return sems;
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    let list = [...subjects];
    // Semester filter
    if (semesterFilter !== 'all') {
      list = list.filter((s) => s.semester === Number(semesterFilter));
    }
    // Search
    if (subjectSearch.trim()) {
      const q = subjectSearch.trim().toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
      );
    }
    // Sort
    list.sort((a, b) => {
      if (subjectSort === 'semester') return a.semester - b.semester;
      if (subjectSort === 'code') return a.code.localeCompare(b.code);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [subjects, subjectSearch, subjectSort, semesterFilter]);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!profile?.department_id) return;
      setSubjectsLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, semester')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        target_roles: ['teacher'] as ('teacher' | 'hod' | 'exam_cell' | 'admin')[],
        target_departments: [profile.department_id],
        user_id: teacherId,
      }));

      await createBulkNotifications.mutateAsync(notifications);
      toast({ title: 'Alert sent', description: `Notification sent to ${teacherIds.length} teachers.` });
      setTitle('');
      setMessage('');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: 'Error', description: err?.message || 'Failed to send alerts.', variant: 'destructive' });
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: 'Error', description: err?.message || 'Failed to resend alert.', variant: 'destructive' });
    }
  };

  return (
    <HodPageShell
      eyebrow="HOD · Alerts"
      title={<>Teacher <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Alerts</em></>}
      description="Send department or subject-based notifications to teachers."
    >
      <div className="grid gap-5 lg:grid-cols-[2.2fr_1fr] items-start">
        {/* ── Compose card ── */}
        <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={eyebrowWarm}>Compose</p>
              <h2 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-1">Compose alert</h2>
              <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-1 leading-relaxed">
                Notify all teachers in your department or specific subject groups.
              </p>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2.5 py-1 border ${alertPillStyles[alertType]}`}
            >
              {alertType}
            </Badge>
          </div>

          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="alert-title" className={eyebrowWarm}>Title</Label>
              <Input
                id="alert-title"
                ref={titleRef}
                placeholder="e.g. Final paper upload deadline"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputWarm}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-message" className={eyebrowWarm}>Message</Label>
              <Textarea
                id="alert-message"
                placeholder="Share instructions, deadlines, or clarifications."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={messageLimit}
                onKeyDown={handleKeyDown}
                className="min-h-[110px] rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] leading-relaxed text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus-visible:ring-[#0d7a6b]/30 focus-visible:border-[#0d7a6b]/50"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#a0aec0] dark:text-[#3d5166]">Keep it clear and actionable.</span>
                <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
                  {message.length}/{messageLimit}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className={eyebrowWarm}>Alert type</Label>
                <Select value={alertType} onValueChange={(value) => setAlertType(value as typeof alertType)}>
                  <SelectTrigger className={inputWarm}>
                    <SelectValue placeholder="Select alert type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[10px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                    {notificationTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className={eyebrowWarm}>Target mode</Label>
                  <span className="font-mono text-[11px] px-2 py-[3px] rounded-full bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] whitespace-nowrap">
                    {countLoading ? '…' : `${recipientCount ?? '—'} to receive`}
                  </span>
                </div>
                <Select value={targetMode} onValueChange={(value) => setTargetMode(value as TargetMode)}>
                  <SelectTrigger className={inputWarm}>
                    <SelectValue placeholder="Select target mode" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[10px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                    <SelectItem value="department">All Department Teachers</SelectItem>
                    <SelectItem value="subjects">Teachers by Subject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetMode === 'subjects' && (
              <div className="space-y-3 rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/50 dark:bg-[#0a1019]/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className={eyebrowWarm}>Target subjects</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-[#64748b] dark:text-[#6b8299] hover:text-[#0d7a6b] dark:hover:text-[#2dd4bf] hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)] rounded-lg"
                    onClick={() => setSelectedSubjectIds([])}
                    disabled={selectedSubjectIds.length === 0}
                  >
                    Clear
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166] pointer-events-none" />
                    <Input
                      placeholder="Search by name or code..."
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      className={`${inputWarm} pl-9`}
                    />
                  </div>
                  <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                    <SelectTrigger className={`${inputWarm} w-full sm:w-[150px]`}>
                      <span className="flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
                        <SelectValue placeholder="Semester" />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="rounded-[10px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                      <SelectItem value="all">All Semesters</SelectItem>
                      {availableSemesters.map((sem) => (
                        <SelectItem key={sem} value={String(sem)}>
                          Semester {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={subjectSort} onValueChange={(v) => setSubjectSort(v as typeof subjectSort)}>
                    <SelectTrigger className={`${inputWarm} w-full sm:w-[150px]`}>
                      <span className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
                        <SelectValue placeholder="Sort" />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="rounded-[10px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                      <SelectItem value="name">Name A–Z</SelectItem>
                      <SelectItem value="code">Course Code</SelectItem>
                      <SelectItem value="semester">Semester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {subjectsLoading ? (
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">Loading subjects...</p>
                ) : filteredSubjects.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {filteredSubjects.map((subject) => {
                      const checked = selectedSubjectIds.includes(subject.id);
                      return (
                        <label
                          key={subject.id}
                          className={`flex items-start gap-3 rounded-[10px] border p-3 cursor-pointer transition-colors ${
                            checked
                              ? 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] border-[#0d7a6b]/40'
                              : 'bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] hover:bg-[#ede9e2]/50 dark:hover:bg-[#131c27]/60'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleSubject(subject.id, c)}
                            className="mt-0.5 border-[#e8e2da] dark:border-[#1c2d3d] data-[state=checked]:bg-[#0d7a6b] data-[state=checked]:border-[#0d7a6b] dark:data-[state=checked]:bg-[#2dd4bf] dark:data-[state=checked]:border-[#2dd4bf]"
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4] leading-snug">{subject.name}</p>
                            <p className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-0.5">
                              {subject.code} · Sem {subject.semester}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : subjects.length > 0 ? (
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No subjects match your search or filter.</p>
                ) : (
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No subjects assigned yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/50 dark:bg-[#0a1019]/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
              Press <span className="font-mono">⌘/Ctrl + Enter</span> to send once ready.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                className="rounded-[9px] h-9 border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4] hover:bg-[#ede9e2] dark:hover:bg-[#131c27]"
              >
                Preview
              </Button>
              <Button
                onClick={handleBroadcast}
                disabled={!isFormValid || createBulkNotifications.isPending}
                className="rounded-[9px] h-9 px-[18px] text-[13px] font-semibold text-white border-0 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)',
                  boxShadow: '0 2px 8px rgba(13,122,107,0.25)',
                }}
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

        {/* ── Recent alerts column ── */}
        <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden h-full flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={eyebrowWarm}>History</p>
              <h3 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-1">Recent alerts</h3>
              <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-1">Latest alerts you sent.</p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 font-mono text-[11px] rounded-full px-2.5 py-1 border-[#e8e2da] dark:border-[#1c2d3d] bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299]"
            >
              {hodTeacherNotifications.length}
            </Badge>
          </div>

          <div className="p-4 flex-1">
            {notificationsLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`alert-skeleton-${index}`} className="flex items-start gap-3 rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] p-4 animate-pulse">
                    <div className="h-8 w-8 rounded-[8px] bg-[#ede9e2] dark:bg-[#131c27]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 rounded bg-[#ede9e2] dark:bg-[#131c27]" />
                      <div className="h-3 w-full rounded bg-[#f0ece6] dark:bg-[#172130]" />
                      <div className="h-3 w-24 rounded bg-[#f0ece6] dark:bg-[#172130]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hodTeacherNotifications.length > 0 ? (
              <div className="divide-y divide-[#f0ece6] dark:divide-[#172130] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[12px] overflow-hidden">
                {hodTeacherNotifications.map((notification) => {
                  const t = notification.type || 'info';
                  return (
                    <div key={notification.id} className="flex items-start gap-3 p-4 hover:bg-[#ede9e2]/40 dark:hover:bg-[#131c27]/50 transition-colors">
                      <div className={`w-8 h-8 rounded-[8px] border flex items-center justify-center flex-shrink-0 ${alertTileStyles[t] ?? alertTileStyles.info}`}>
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4] truncate">{notification.title}</span>
                          <Badge
                            variant="outline"
                            className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-[2px] border ${alertPillStyles[t] ?? alertPillStyles.info}`}
                          >
                            {t}
                          </Badge>
                        </div>
                        <p className="text-[12px] leading-relaxed text-[#64748b] dark:text-[#6b8299]">
                          {notification.message.length > 120 ? `${notification.message.slice(0, 120)}...` : notification.message}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
                            {notification.created_at
                              ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                              : 'Just now'}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#0d7a6b] dark:hover:text-[#2dd4bf] hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)] rounded-md"
                              onClick={() => handleDuplicate(notification)}
                            >
                              Duplicate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#0d7a6b] dark:hover:text-[#2dd4bf] hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)] rounded-md"
                              onClick={() => handleResend(notification)}
                              disabled={createNotification.isPending}
                            >
                              Resend
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 rounded-[12px] border border-dashed border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/60 dark:bg-[#0a1019]/40 p-6 text-center flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full border border-dashed border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#a0aec0] dark:text-[#3d5166]" />
                </div>
                <div>
                  <p className="font-medium text-[13px] text-[#18202e] dark:text-[#e2eaf4]">No alerts sent yet</p>
                  <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-1">Compose an alert to notify teachers quickly.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => titleRef.current?.focus()}
                  className="rounded-[9px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
                >
                  Send your first alert
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </HodPageShell>
  );
}
