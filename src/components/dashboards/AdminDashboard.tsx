import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useAdminUsers, AdminUser } from '@/hooks/useAdminUsers';
import { useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/useAdminUserActions';
import { useAdminDepartments, useCreateDepartment, useDeleteDepartment } from '@/hooks/useAdminDepartments';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Building,
  FileText,
  ShieldCheck,
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

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: departments, isLoading: deptsLoading } = useAdminDepartments();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const { toast } = useToast();
  const { profile } = useAuth();
  const location = useLocation();

  const [userSearch, setUserSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'audit' | 'overview'>('users');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('teacher');
  const [newUserDepartment, setNewUserDepartment] = useState<string>('');

  const filteredUsers = users?.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  useEffect(() => {
    if (location.pathname.startsWith('/admin/departments')) {
      setActiveTab('departments');
    } else if (location.pathname.startsWith('/admin/audit')) {
      setActiveTab('audit');
    } else if (location.pathname.startsWith('/admin/security')) {
      setActiveTab('overview');
    } else {
      setActiveTab('users');
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Users" value={stats?.totalUsers || 0} subtitle="Registered accounts" icon={Users} variant="accent" />
        <StatsCard title="Departments" value={stats?.totalDepartments || 0} subtitle="Active departments" icon={Building} />
        <StatsCard title="Subjects" value={stats?.totalSubjects || 0} subtitle="Configured subjects" icon={BookOpen} />
        <StatsCard title="Exam Papers" value={stats?.totalPapers || 0} subtitle="Total submissions" icon={FileText} variant="success" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
        <TabsList className="bg-card border flex flex-wrap gap-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building className="w-4 h-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            Overview
          </TabsTrigger>
        </TabsList>

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
