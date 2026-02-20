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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

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

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  teacher: 'secondary',
  hod: 'default',
  exam_cell: 'outline',
  admin: 'destructive',
};

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
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'audit' | 'overview' | 'broadcast'>('users');

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
      setActiveTab('overview');
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
                <table className="w-full min-w-[840px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Department</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Joined</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
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
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
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
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments?.map((dept) => (
                  <div key={dept.id} className="p-5 rounded-xl border bg-secondary/30 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{dept.name}</h3>
                        <Badge variant="outline" className="mt-1">{dept.code}</Badge>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
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
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {dept.teachers_count} users
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        {dept.subjects_count} subjects
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <div className="bg-card rounded-2xl border p-6 shadow-card space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Recent Audit Logs</h2>
              <Badge variant="outline" className="gap-1.5">
                <Clock className="w-3 h-3" />
                Last 20 entries
              </Badge>
            </div>

            {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
              <div className="space-y-3">
                {stats.recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl border bg-secondary/30">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.user_name}</span>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                        <Badge variant="secondary" className="text-xs">{log.entity_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No audit logs recorded yet</p>
                <p className="text-sm mt-1">Actions like paper uploads, reviews, and approvals will appear here</p>
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
                <div className="space-y-3">
                  {stats.usersByRole.map(({ role, count }) => (
                    <div key={role} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-3 h-3 rounded-full',
                          role === 'admin' ? 'bg-destructive' : role === 'hod' ? 'bg-accent' : role === 'exam_cell' ? 'bg-warning' : 'bg-success'
                        )} />
                        <span className="font-medium text-sm">{roleLabels[role] || role}</span>
                      </div>
                      <span className="text-lg font-bold">{count}</span>
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
                <div className="space-y-3">
                  {stats.papersByStatus.map(({ status, count }) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <span className="font-medium text-sm">{statusLabels[status] || status}</span>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No papers submitted yet</p>
              )}
            </div>

            {/* System Settings */}
            <div className="bg-card rounded-2xl border p-6 shadow-card space-y-4 md:col-span-2">
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
    <tr className="border-b hover:bg-secondary/50 transition-colors">
      <td className="py-3 px-4 font-medium text-sm">{user.full_name}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{user.email}</td>
      <td className="py-3 px-4 text-sm">
        <Badge variant={user.role ? roleBadgeVariant[user.role] : 'secondary'}>
          {roleLabels[user.role || 'teacher'] || 'Unknown'}
        </Badge>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
        {user.department_name || '—'}
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </DialogTrigger>
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
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isSelf}>
                Delete
              </Button>
            </DialogTrigger>
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
        </div>
      </td>
    </tr>
  );
}
