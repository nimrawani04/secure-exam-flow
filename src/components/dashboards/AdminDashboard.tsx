import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useAdminUsers, AdminUser } from '@/hooks/useAdminUsers';
import { useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/useAdminUserActions';
import { useAdminDepartments, useCreateDepartment, useDeleteDepartment } from '@/hooks/useAdminDepartments';
import { useAdminNotifications, useCreateNotification } from '@/hooks/useAdminNotifications';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Users,
  Bell,
  Building,
  FileText,
  Activity,
  Plus,
  Search,
  Trash2,
  Loader2,
  BookOpen,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<string, string> = {
  teacher: 'Teacher',
  hod: 'Head of Dept',
  exam_cell: 'Exam Cell',
  admin: 'Admin',
};

const broadcastRoleOptions: { value: AppRole; description: string }[] = [
  { value: 'teacher', description: 'Faculty submitting papers' },
  { value: 'hod', description: 'Department reviewers' },
  { value: 'exam_cell', description: 'Exam cell operations' },
  { value: 'admin', description: 'System administrators' },
];

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  locked: 'Locked',
};

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

type DepartmentPaperSummary = {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
  lastActivity: string | null;
};

type UserPaperSummary = {
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  lastActivity: string | null;
};

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-slate-200 text-slate-800 border-slate-300',
  hod: 'bg-accent/15 text-accent border-accent/30',
  teacher: 'bg-secondary/60 text-foreground/80 border-border/60',
  exam_cell: 'bg-warning/10 text-warning border-warning/30',
};

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: departments, isLoading: deptsLoading } = useAdminDepartments();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const createNotification = useCreateNotification();
  const { toast } = useToast();
  const { profile } = useAuth();
  const location = useLocation();
  const { data: recentNotifications } = useAdminNotifications(profile?.id);

  const [userSearch, setUserSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [departmentPaperStats, setDepartmentPaperStats] = useState<Record<string, DepartmentPaperSummary>>({});
  const [userPaperStats, setUserPaperStats] = useState<Record<string, UserPaperSummary>>({});
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'audit' | 'overview' | 'broadcast' | 'security'>('users');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('teacher');
  const [newUserDepartment, setNewUserDepartment] = useState<string>('');

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'critical' | 'success'>('info');
  const [broadcastRoles, setBroadcastRoles] = useState<AppRole[]>([]);
  const [broadcastDepartments, setBroadcastDepartments] = useState<string[]>([]);
  const [auditFilter, setAuditFilter] = useState<'all' | 'approve' | 'reject' | 'upload' | 'select'>('all');

  const filteredUsers = users?.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments?.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  const recipientCount = useMemo(() => {
    if (!users || broadcastRoles.length === 0) return 0;
    return users.filter((user) => {
      if (!user.role || !broadcastRoles.includes(user.role)) return false;
      if (broadcastDepartments.length === 0) return true;
      if (!user.department_id) return false;
      return broadcastDepartments.includes(user.department_id);
    }).length;
  }, [users, broadcastRoles, broadcastDepartments]);

  const maxRoleCount = useMemo(() => {
    if (!stats?.usersByRole || stats.usersByRole.length === 0) return 0;
    return Math.max(...stats.usersByRole.map((item) => item.count));
  }, [stats?.usersByRole]);

  const maxStatusCount = useMemo(() => {
    if (!stats?.papersByStatus || stats.papersByStatus.length === 0) return 0;
    return Math.max(...stats.papersByStatus.map((item) => item.count));
  }, [stats?.papersByStatus]);

  const filteredAuditLogs = useMemo(() => {
    const logs = stats?.recentAuditLogs || [];
    if (auditFilter === 'all') return logs;
    return logs.filter((log) => log.action.toLowerCase().includes(auditFilter));
  }, [stats?.recentAuditLogs, auditFilter]);

  const getAuditKind = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized.includes('approve')) return 'approve';
    if (normalized.includes('reject')) return 'reject';
    if (normalized.includes('upload')) return 'upload';
    if (normalized.includes('select')) return 'select';
    return 'other';
  };

  const getAuditVerb = (action: string) => {
    const kind = getAuditKind(action);
    if (kind === 'approve') return 'approved';
    if (kind === 'reject') return 'rejected';
    if (kind === 'upload') return 'uploaded';
    if (kind === 'select') return 'selected';
    return action.toLowerCase();
  };

  const getAuditAccent = (action: string) => {
    const kind = getAuditKind(action);
    if (kind === 'approve') return 'border-l-success text-success';
    if (kind === 'reject') return 'border-l-destructive text-destructive';
    if (kind === 'upload') return 'border-l-accent text-accent';
    if (kind === 'select') return 'border-l-warning text-warning';
    return 'border-l-border text-muted-foreground';
  };

  useEffect(() => {
    if (!departments || departments.length === 0) {
      setSelectedDepartmentId('');
      return;
    }
    if (!selectedDepartmentId || !departments.some((dept) => dept.id === selectedDepartmentId)) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments, selectedDepartmentId]);

  useEffect(() => {
    let isMounted = true;

    const fetchDepartmentAnalytics = async () => {
      if (!departments || departments.length === 0) {
        if (isMounted) {
          setDepartmentPaperStats({});
          setUserPaperStats({});
        }
        return;
      }

      const { data, error } = await supabase
        .from('exam_papers')
        .select('uploaded_by, status, updated_at, subjects(department_id)');

      if (error) {
        console.error('Error loading department analytics:', error);
        return;
      }

      const deptStats: Record<string, DepartmentPaperSummary> = {};
      const userStats: Record<string, UserPaperSummary> = {};

      (data || []).forEach((row: any) => {
        const subjectData = row?.subjects;
        const deptId = Array.isArray(subjectData) ? subjectData[0]?.department_id : subjectData?.department_id;
        if (!deptId) return;

        const status = row.status as string;
        const updatedAt = row.updated_at as string | null;
        const uploader = row.uploaded_by as string | null;

        if (!deptStats[deptId]) {
          deptStats[deptId] = { approved: 0, pending: 0, rejected: 0, total: 0, lastActivity: null };
        }

        deptStats[deptId].total += 1;
        if (status === 'approved' || status === 'locked') deptStats[deptId].approved += 1;
        else if (status === 'rejected') deptStats[deptId].rejected += 1;
        else deptStats[deptId].pending += 1;

        if (
          updatedAt &&
          (!deptStats[deptId].lastActivity ||
            new Date(updatedAt).getTime() > new Date(deptStats[deptId].lastActivity as string).getTime())
        ) {
          deptStats[deptId].lastActivity = updatedAt;
        }

        if (uploader) {
          if (!userStats[uploader]) {
            userStats[uploader] = { submitted: 0, pending: 0, approved: 0, rejected: 0, lastActivity: null };
          }

          userStats[uploader].submitted += 1;
          if (status === 'approved' || status === 'locked') userStats[uploader].approved += 1;
          else if (status === 'rejected') userStats[uploader].rejected += 1;
          else userStats[uploader].pending += 1;

          if (
            updatedAt &&
            (!userStats[uploader].lastActivity ||
              new Date(updatedAt).getTime() > new Date(userStats[uploader].lastActivity as string).getTime())
          ) {
            userStats[uploader].lastActivity = updatedAt;
          }
        }
      });

      if (isMounted) {
        setDepartmentPaperStats(deptStats);
        setUserPaperStats(userStats);
      }
    };

    fetchDepartmentAnalytics();

    return () => {
      isMounted = false;
    };
  }, [departments]);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveTab('overview');
    } else if (location.pathname.startsWith('/admin/users')) {
      setActiveTab('users');
    } else if (location.pathname.startsWith('/admin/departments')) {
      setActiveTab('departments');
    } else if (location.pathname.startsWith('/admin/audit')) {
      setActiveTab('audit');
    } else if (location.pathname.startsWith('/admin/broadcasts')) {
      setActiveTab('broadcast');
    } else if (location.pathname.startsWith('/admin/security')) {
      setActiveTab('security');
    } else {
      setActiveTab('overview');
    }
  }, [location.pathname]);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim() || !newDeptCode.trim()) return;
    try {
      await createDepartment.mutateAsync({ name: newDeptName.trim(), code: newDeptCode.trim().toUpperCase() });
      toast({ title: 'Department created', description: `${newDeptName} has been added.` });
      setNewDeptName('');
      setNewDeptCode('');
    } catch {
      toast({ title: 'Error', description: 'Failed to create department.', variant: 'destructive' });
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    try {
      await deleteDepartment.mutateAsync(id);
      toast({ title: 'Department deleted', description: `${name} has been removed.` });
    } catch {
      toast({ title: 'Error', description: 'Cannot delete department with linked users or subjects.', variant: 'destructive' });
    }
  };

  const handleDepartmentAction = (action: 'add_teacher' | 'change_hod' | 'view_papers') => {
    const labels: Record<typeof action, string> = {
      add_teacher: 'Add Teacher',
      change_hod: 'Change HOD',
      view_papers: 'View Papers',
    };
    toast({ title: labels[action], description: 'This workflow will be connected next.' });
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast({ title: 'Error', description: 'Name, email, and password are required.', variant: 'destructive' });
      return;
    }
    if (newUserRole !== 'exam_cell' && !newUserDepartment) {
      toast({ title: 'Error', description: 'Please select a department.', variant: 'destructive' });
      return;
    }
    try {
      await createUser.mutateAsync({
        fullName: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
        departmentId: newUserRole !== 'exam_cell' ? newUserDepartment : undefined,
      });
      toast({ title: 'User created', description: `${newUserName} has been added.` });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('teacher');
      setNewUserDepartment('');
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to create user.', variant: 'destructive' });
    }
  };

  const handleRoleToggle = (role: AppRole, checked: boolean | 'indeterminate') => {
    setBroadcastRoles((prev) => {
      if (checked) {
        return prev.includes(role) ? prev : [...prev, role];
      }
      return prev.filter((r) => r !== role);
    });
  };

  const handleDepartmentToggle = (departmentId: string, checked: boolean | 'indeterminate') => {
    setBroadcastDepartments((prev) => {
      if (checked) {
        return prev.includes(departmentId) ? prev : [...prev, departmentId];
      }
      return prev.filter((id) => id !== departmentId);
    });
  };

  const formatDepartmentTargets = (targets: string[] | null) => {
    if (!targets || targets.length === 0) return 'All departments';
    const names = targets
      .map((id) => departmentNameMap.get(id))
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return `${targets.length} departments`;
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`;
  };

  const handleBroadcast = async () => {
    if (!profile?.id) {
      toast({ title: 'Error', description: 'Profile not loaded. Please try again.', variant: 'destructive' });
      return;
    }
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast({ title: 'Error', description: 'Title and message are required.', variant: 'destructive' });
      return;
    }
    if (broadcastRoles.length === 0) {
      toast({ title: 'Error', description: 'Select at least one role to notify.', variant: 'destructive' });
      return;
    }
    if (users && recipientCount === 0) {
      toast({ title: 'No recipients', description: 'No users match the selected roles and departments.', variant: 'destructive' });
      return;
    }

    try {
      await createNotification.mutateAsync({
        createdBy: profile.id,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetRoles: broadcastRoles,
        targetDepartments: broadcastDepartments.length > 0 ? broadcastDepartments : null,
        type: broadcastType,
      });
      toast({ title: 'Notification sent', description: `Broadcast sent to ${recipientCount} users.` });
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to send notification.', variant: 'destructive' });
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          System configuration, user management & security monitoring
        </p>
      </div>

      {activeTab === 'overview' && (
        <div className="rounded-[12px] border border-border/40 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:border-r sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 sm:h-10 sm:w-10">
                  <Users className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Total Users</p>
                  <p className="mt-1 text-xs text-muted-foreground">Registered accounts</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats?.totalUsers || 0}</p>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary sm:h-10 sm:w-10">
                  <Building className="h-4 w-4 text-foreground/70 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Departments</p>
                  <p className="mt-1 text-xs text-muted-foreground">Active departments</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats?.totalDepartments || 0}</p>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:border-b-0 sm:border-r sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary sm:h-10 sm:w-10">
                  <BookOpen className="h-4 w-4 text-foreground/70 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Subjects</p>
                  <p className="mt-1 text-xs text-muted-foreground">Configured subjects</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats?.totalSubjects || 0}</p>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 sm:h-10 sm:w-10">
                  <FileText className="h-4 w-4 text-success sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Exam Papers</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total submissions</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats?.totalPapers || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} className="space-y-6">

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="hero" className="gap-2 w-full sm:w-auto">
                      <Plus className="w-4 h-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          placeholder="Dr. John Smith"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="user@university.edu"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Temporary Password</Label>
                        <Input
                          type="password"
                          placeholder="Set a temporary password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as AppRole)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="hod">Head of Dept</SelectItem>
                            <SelectItem value="exam_cell">Exam Cell</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newUserRole !== 'exam_cell' && (
                        <div className="space-y-2">
                          <Label>Department</Label>
                          <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments?.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name} ({dept.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button onClick={handleCreateUser} disabled={createUser.isPending}>
                          {createUser.isPending ? 'Creating...' : 'Create User'}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-sm">Name</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-sm">Email</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-sm">Role</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-sm">Department</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-sm">Joined</th>
                      <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers?.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        departments={departments || []}
                        onUpdate={updateUser.mutateAsync}
                        onDelete={deleteUser.mutateAsync}
                        isSelf={profile?.id === user.id}
                      />
                    ))}
                    {filteredUsers?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Department Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="hero" className="gap-2 w-full sm:w-auto">
                    <Plus className="w-4 h-4" />
                    Add Department
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Department</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Department Name</Label>
                      <Input
                        placeholder="e.g. Computer Science"
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department Code</Label>
                      <Input
                        placeholder="e.g. CS"
                        value={newDeptCode}
                        onChange={(e) => setNewDeptCode(e.target.value)}
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={handleCreateDepartment} disabled={!newDeptName.trim() || !newDeptCode.trim()}>
                        Create
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {deptsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 space-y-3">
                  {departments && departments.length > 0 ? (
                    departments.map((dept) => {
                      const deptUsers = (users || []).filter((u) => u.department_id === dept.id);
                      const hod = deptUsers.find((u) => u.role === 'hod');
                      const teachers = deptUsers.filter((u) => u.role === 'teacher');
                      const isSelected = selectedDepartmentId === dept.id;
                      const paperStats = departmentPaperStats[dept.id] || {
                        approved: 0,
                        pending: 0,
                        rejected: 0,
                        total: 0,
                        lastActivity: null,
                      };

                      return (
                        <div
                          key={dept.id}
                          className={cn(
                            'rounded-xl border p-3.5 transition-colors',
                            isSelected
                              ? 'bg-secondary/30 border-border border-l-[3px] border-l-primary'
                              : 'bg-secondary/20 hover:bg-secondary/30 border-border/70'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-left flex-1"
                                  onClick={() => setSelectedDepartmentId(dept.id)}
                                >
                                  <h3 className="font-semibold leading-tight">{dept.name}</h3>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline">{dept.code}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {hod ? `HOD: ${hod.full_name}` : 'HOD: Not assigned'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {teachers.length} Teachers - {paperStats.total} Papers
                                  </p>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p>Total Teachers: {teachers.length}</p>
                                <p>Active Papers: {paperStats.total}</p>
                                <p>
                                  Last Activity:{' '}
                                  {paperStats.lastActivity
                                    ? formatDistanceToNow(new Date(paperStats.lastActivity), { addSuffix: true })
                                    : 'No activity'}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            <div className="flex items-center gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete {dept.name}?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-muted-foreground">
                                    This will remove the department. Users and subjects linked to it must be reassigned first.
                                  </p>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                      <Button variant="destructive" onClick={() => handleDeleteDepartment(dept.id, dept.name)}>
                                        Delete
                                      </Button>
                                    </DialogClose>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No departments available.</p>
                  )}
                </div>

                <div className="lg:col-span-7 rounded-xl border bg-card p-5">
                  {selectedDepartmentId ? (
                    (() => {
                      const selectedDept = departments?.find((dept) => dept.id === selectedDepartmentId);
                      const selectedUsers = (users || []).filter((u) => u.department_id === selectedDepartmentId);
                      const selectedHod = selectedUsers.find((u) => u.role === 'hod');
                      const selectedTeachers = selectedUsers.filter((u) => u.role === 'teacher');
                      const selectedDeptStats = departmentPaperStats[selectedDepartmentId] || {
                        approved: 0,
                        pending: 0,
                        rejected: 0,
                        total: 0,
                        lastActivity: null,
                      };
                      const selectedMax = Math.max(selectedDeptStats.approved, selectedDeptStats.pending, selectedDeptStats.rejected, 1);

                      return (
                        <div className="space-y-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                            <h3 className="text-lg font-semibold">{selectedDept?.name || 'Department'}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {selectedDept?.code || '--'} - {selectedTeachers.length} teachers
                            </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {selectedDeptStats.approved} Approved - {selectedDeptStats.pending} Pending - {selectedDeptStats.rejected} Rejected
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleDepartmentAction('add_teacher')}>
                                Add Teacher
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleDepartmentAction('change_hod')}>
                                Change HOD
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleDepartmentAction('view_papers')}>
                                View Papers
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-3.5">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Head of Department</p>
                            {selectedHod ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">{selectedHod.full_name}</p>
                                      <Badge variant="outline" className={cn('text-[10px]', roleBadgeClass.hod)}>
                                        HOD
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{selectedHod.email}</p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  <p>Joined: {format(new Date(selectedHod.created_at), 'MMM d, yyyy')}</p>
                                  <p>Papers Approved: {userPaperStats[selectedHod.id]?.approved || 0}</p>
                                  <p>Papers Rejected: {userPaperStats[selectedHod.id]?.rejected || 0}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">No HOD assigned</p>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleDepartmentAction('change_hod')}>
                                  Assign HOD
                                </Button>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Teachers</p>
                              <Badge variant="secondary" className="text-xs">
                                {selectedTeachers.length}
                              </Badge>
                            </div>
                            {usersLoading ? (
                              <p className="text-sm text-muted-foreground">Loading users...</p>
                            ) : selectedTeachers.length > 0 ? (
                              <div className="divide-y divide-border/50 rounded-lg border">
                                {selectedTeachers.map((teacher) => (
                                  <Tooltip key={teacher.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-secondary/20 transition-colors text-left"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-sm truncate">{teacher.full_name}</p>
                                          <p className="text-xs text-muted-foreground truncate">{teacher.email}</p>
                                        </div>
                                        <Badge variant="outline" className={cn('text-[10px]', roleBadgeClass.teacher)}>
                                          Teacher
                                        </Badge>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      <p>Papers Submitted: {userPaperStats[teacher.id]?.submitted || 0}</p>
                                      <p>Pending Review: {userPaperStats[teacher.id]?.pending || 0}</p>
                                      <p>
                                        Last Activity:{' '}
                                        {userPaperStats[teacher.id]?.lastActivity
                                          ? formatDistanceToNow(new Date(userPaperStats[teacher.id].lastActivity as string), {
                                              addSuffix: true,
                                            })
                                          : 'No activity'}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No teachers assigned to this department.</p>
                            )}
                          </div>

                          <div className="rounded-lg border bg-secondary/20 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Department Analytics</p>
                              <Badge variant="outline" className="text-[10px]">
                                Total: {selectedDeptStats.total}
                              </Badge>
                            </div>
                            {[
                              { label: 'Approved', value: selectedDeptStats.approved, bar: 'bg-success' },
                              { label: 'Pending', value: selectedDeptStats.pending, bar: 'bg-warning' },
                              { label: 'Rejected', value: selectedDeptStats.rejected, bar: 'bg-destructive' },
                            ].map((item) => (
                              <div key={item.label}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{item.label}</span>
                                  <span className="font-medium">
                                    {item.value} ({selectedDeptStats.total > 0 ? Math.round((item.value / selectedDeptStats.total) * 100) : 0}%)
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-secondary/70">
                                  <div
                                    className={cn('h-1.5 rounded-full', item.bar)}
                                    style={{
                                      width: `${Math.max((item.value / selectedMax) * 100, item.value > 0 ? 8 : 0)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                            <p className="text-xs text-muted-foreground">
                              Last Activity:{' '}
                              {selectedDeptStats.lastActivity
                                ? formatDistanceToNow(new Date(selectedDeptStats.lastActivity), { addSuffix: true })
                                : 'No activity'}
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a department to view role mapping.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Recent Audit Logs</h2>
              <div className="flex items-center gap-2">
                <Select value={auditFilter} onValueChange={(value) => setAuditFilter(value as typeof auditFilter)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="approve">Approvals</SelectItem>
                    <SelectItem value="reject">Rejections</SelectItem>
                    <SelectItem value="upload">Uploads</SelectItem>
                    <SelectItem value="select">Selections</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="w-3 h-3" />
                  Last 20 entries
                </Badge>
              </div>
            </div>

            {filteredAuditLogs.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                {filteredAuditLogs.map((log) => {
                  const verb = getAuditVerb(log.action);
                  const accent = getAuditAccent(log.action);
                  const object = log.entity_type.toLowerCase() === 'paper' ? 'a paper' : `a ${log.entity_type}`;
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-border/60 border-l-2 bg-card',
                        accent
                      )}
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium text-foreground">{log.user_name}</span>{' '}
                        <span className="font-medium">{verb}</span>{' '}
                        <span className="text-foreground/90">{object}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{auditFilter === 'all' ? 'No audit logs recorded yet' : 'No logs match this filter'}</p>
                <p className="text-sm mt-1">Actions like uploads, reviews, and approvals will appear here</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Broadcasts Tab */}
        <TabsContent value="broadcast">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Broadcast Notification</h2>
                  <p className="text-sm text-muted-foreground">
                    Send role-based or department-based alerts to staff.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Recipients: {users ? recipientCount : 'N/A'}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Mid-term upload window closes Friday"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Write a clear instruction or alert for the selected recipients..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={broadcastType} onValueChange={(value) => setBroadcastType(value as typeof broadcastType)}>
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
                <div className="space-y-3">
                  <Label>Target Roles</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {broadcastRoleOptions.map((option) => (
                      <label key={option.value} className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-3">
                        <Checkbox
                          checked={broadcastRoles.includes(option.value)}
                          onCheckedChange={(checked) => handleRoleToggle(option.value, checked)}
                        />
                        <div>
                          <p className="text-sm font-medium">{roleLabels[option.value]}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Target Departments (optional)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setBroadcastDepartments([])}
                      disabled={broadcastDepartments.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  {deptsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading departments...</p>
                  ) : departments && departments.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {departments.map((dept) => (
                        <label key={dept.id} className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-3">
                          <Checkbox
                            checked={broadcastDepartments.includes(dept.id)}
                            onCheckedChange={(checked) => handleDepartmentToggle(dept.id, checked)}
                          />
                          <div>
                            <p className="text-sm font-medium">{dept.name}</p>
                            <p className="text-xs text-muted-foreground">{dept.code}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No departments available.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Leave empty to notify all departments. Exam cell users are not department-scoped.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {broadcastRoles.length === 0 ? 'Select at least one role.' : 'Ready to broadcast.'}
                </div>
                <Button
                  variant="hero"
                  className="gap-2"
                  onClick={handleBroadcast}
                  disabled={createNotification.isPending}
                >
                  <Bell className="w-4 h-4" />
                  {createNotification.isPending ? 'Sending...' : 'Send Notification'}
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Broadcasts</h2>
                <Badge variant="outline" className="text-xs">
                  {recentNotifications?.length || 0} latest
                </Badge>
              </div>

              {recentNotifications && recentNotifications.length > 0 ? (
                <div className="space-y-3">
                  {recentNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-start gap-4 rounded-xl border bg-secondary/30 p-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{notification.title}</span>
                          <Badge variant={notificationTypeVariant[notification.type || 'info'] || 'secondary'} className="text-[10px] uppercase">
                            {notification.type || 'info'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notification.message.length > 140 ? `${notification.message.slice(0, 140)}...` : notification.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            Roles: {notification.target_roles.map((role) => roleLabels[role] || role).join(', ')}
                          </span>
                          <span>Departments: {formatDepartmentTargets(notification.target_departments)}</span>
                          <span>
                            {notification.created_at
                              ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                              : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No broadcasts sent yet</p>
                  <p className="text-sm mt-1">Send a notification to see it logged here.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Roles Distribution */}
            <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4">
              <h3 className="text-lg font-semibold">Users by Role</h3>
              {stats?.usersByRole && stats.usersByRole.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {stats.usersByRole.map(({ role, count }) => (
                    <div key={role} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              'w-2.5 h-2.5 rounded-full',
                              role === 'admin'
                                ? 'bg-destructive'
                                : role === 'hod'
                                  ? 'bg-accent'
                                  : role === 'exam_cell'
                                    ? 'bg-warning'
                                    : 'bg-success'
                            )}
                          />
                          <span className="text-sm text-foreground/85">{roleLabels[role] || role}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            role === 'admin'
                              ? 'bg-destructive'
                              : role === 'hod'
                                ? 'bg-accent'
                                : role === 'exam_cell'
                                  ? 'bg-warning'
                                  : 'bg-success'
                          )}
                          style={{
                            width: `${maxRoleCount > 0 ? Math.max((count / maxRoleCount) * 100, count > 0 ? 8 : 0) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No role data available</p>
              )}
            </div>

            {/* Papers by Status */}
            <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4">
              <h3 className="text-lg font-semibold">Papers by Status</h3>
              {stats?.papersByStatus && stats.papersByStatus.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {stats.papersByStatus.map(({ status, count }) => (
                    <div key={status} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground/85">{statusLabels[status] || status}</span>
                        <span className="text-sm font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            status === 'approved' || status === 'locked'
                              ? 'bg-success'
                              : status === 'pending_review' || status === 'submitted'
                                ? 'bg-warning'
                                : status === 'rejected'
                                  ? 'bg-destructive'
                                  : 'bg-accent'
                          )}
                          style={{
                            width: `${maxStatusCount > 0 ? Math.max((count / maxStatusCount) * 100, count > 0 ? 8 : 0) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No papers submitted yet</p>
              )}
            </div>

          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Security Reminder</h3>
            </div>
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
              <p className="text-sm text-muted-foreground">
                As an Admin, you have system-wide management access but are <strong>cryptographically restricted from viewing, previewing, or downloading exam paper content</strong> to maintain academic confidentiality and separation of duties.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <div className="p-4 rounded-xl border bg-secondary/30 text-center">
                <p className="text-2xl font-bold">10 MB</p>
                <p className="text-sm text-muted-foreground">Max File Size</p>
              </div>
              <div className="p-4 rounded-xl border bg-secondary/30 text-center">
                <p className="text-2xl font-bold">30 min</p>
                <p className="text-sm text-muted-foreground">Session Timeout</p>
              </div>
              <div className="p-4 rounded-xl border bg-secondary/30 text-center">
                <p className="text-2xl font-bold">PDF Only</p>
                <p className="text-sm text-muted-foreground">Allowed Files</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* User Row Sub-component */
function UserRow({
  user,
  departments,
  onUpdate,
  onDelete,
  isSelf,
}: {
  user: AdminUser;
  departments: { id: string; name: string }[];
  onUpdate: (input: { userId: string; email: string; fullName: string; role: AppRole; departmentId?: string | null }) => Promise<unknown>;
  onDelete: (userId: string) => Promise<unknown>;
  isSelf?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AppRole>((user.role as AppRole) || 'teacher');
  const [departmentId, setDepartmentId] = useState<string>(user.department_id || '');
  const initials = useMemo(() => {
    return user.full_name
      .trim()
      .split(/\s+/)
      .map((name) => name[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user.full_name]);
  const joinedDate = useMemo(() => {
    const date = new Date(user.created_at);
    return Number.isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy');
  }, [user.created_at]);
  const joinedRelative = useMemo(() => {
    const date = new Date(user.created_at);
    return Number.isNaN(date.getTime()) ? '' : formatDistanceToNow(date, { addSuffix: true });
  }, [user.created_at]);

  useEffect(() => {
    if (open) {
      setFullName(user.full_name);
      setEmail(user.email);
      setRole((user.role as AppRole) || 'teacher');
      setDepartmentId(user.department_id || '');
    }
  }, [open, user]);

  const handleSave = async () => {
    try {
      const updatedDepartment = role === 'exam_cell' ? null : departmentId || null;
      await onUpdate({
        userId: user.id,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        departmentId: updatedDepartment,
      });
      toast({ title: 'User updated', description: 'Changes saved successfully.' });
      setOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to update user.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(user.id);
      toast({ title: 'User deleted', description: 'The account has been removed.' });
      setConfirmOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to delete user.', variant: 'destructive' });
    }
  };

  return (
    <tr className="border-b hover:bg-secondary/20 transition-colors">
      <td className="py-2.5 px-4 text-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-secondary/70 text-xs font-semibold text-foreground/80 flex items-center justify-center">
            {initials || 'U'}
          </div>
          <span className="font-medium">{user.full_name}</span>
        </div>
      </td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{user.email}</td>
      <td className="py-2.5 px-4 text-sm">
        <Badge variant="outline" className="bg-secondary/40 text-foreground border-border/60">
          {roleLabels[user.role || 'teacher'] || 'Unknown'}
        </Badge>
      </td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{user.department_name || '--'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground" title={joinedRelative}>
        {joinedDate}
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="flex items-center justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="hod">Head of Dept</SelectItem>
                      <SelectItem value="exam_cell">Exam Cell</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {role !== 'exam_cell' && (
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete user?</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">
                This will disable and remove the user from the portal. This action cannot be undone.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setOpen(true)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                disabled={isSelf}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
