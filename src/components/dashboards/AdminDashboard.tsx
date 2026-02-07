import { useState } from 'react';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useAdminUsers, useUpdateUserRole, useUpdateUserDepartment, AdminUser } from '@/hooks/useAdminUsers';
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
  const updateRole = useUpdateUserRole();
  const updateDepartment = useUpdateUserDepartment();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const { toast } = useToast();

  const [userSearch, setUserSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const filteredUsers = users?.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRole.mutateAsync({ userId, role: role as AppRole });
      toast({ title: 'Role updated', description: 'User role has been changed successfully.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update role.', variant: 'destructive' });
    }
  };

  const handleDepartmentChange = async (userId: string, departmentId: string) => {
    try {
      await updateDepartment.mutateAsync({
        userId,
        departmentId: departmentId === 'none' ? null : departmentId,
      });
      toast({ title: 'Department updated', description: 'User department has been changed.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update department.', variant: 'destructive' });
    }
  };

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
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
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
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card border">
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Department</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers?.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        departments={departments || []}
                        onRoleChange={handleRoleChange}
                        onDepartmentChange={handleDepartmentChange}
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Department Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="hero" className="gap-2">
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
            <div className="flex items-center justify-between">
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
  onRoleChange,
  onDepartmentChange,
}: {
  user: AdminUser;
  departments: { id: string; name: string }[];
  onRoleChange: (userId: string, role: string) => void;
  onDepartmentChange: (userId: string, departmentId: string) => void;
}) {
  return (
    <tr className="border-b hover:bg-secondary/50 transition-colors">
      <td className="py-3 px-4 font-medium text-sm">{user.full_name}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{user.email}</td>
      <td className="py-3 px-4">
        <Select defaultValue={user.role || ''} onValueChange={(v) => onRoleChange(user.id, v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="No role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="hod">Head of Dept</SelectItem>
            <SelectItem value="exam_cell">Exam Cell</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-4">
        <Select
          defaultValue={user.department_id || 'none'}
          onValueChange={(v) => onDepartmentChange(user.id, v)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="No department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No department</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
      </td>
    </tr>
  );
}
