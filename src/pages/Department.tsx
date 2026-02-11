import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

interface Assignment {
  id: string;
  teacher_id: string;
  subject_id: string;
}

export default function Department() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [departmentName, setDepartmentName] = useState('your department');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null);

  const teacherAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.teacher_id) || [];
      list.push(assignment.subject_id);
      map.set(assignment.teacher_id, list);
    });
    return map;
  }, [assignments]);

  const loadData = useCallback(async () => {
    if (!profile?.department_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        { data: subjectData, error: subjectError },
        { data: profileData, error: profileError },
        { data: departmentData, error: departmentError },
      ] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('department_id', profile.department_id)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('department_id', profile.department_id)
          .order('full_name'),
        supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id)
          .single(),
      ]);

      if (subjectError) throw subjectError;
      if (profileError) throw profileError;
      if (departmentError) throw departmentError;

      const userIds = (profileData || []).map((p) => p.id);
      const { data: roleData, error: roleError } = userIds.length
        ? await supabase.from('user_roles').select('user_id, role').in('user_id', userIds)
        : { data: [], error: null };
      if (roleError) throw roleError;

      const roleMap = new Map<string, string>();
      roleData?.forEach((role) => roleMap.set(role.user_id, role.role));

      const teacherList = (profileData || []).filter((p) => roleMap.get(p.id) === 'teacher');

      const teacherIds = teacherList.map((t) => t.id);
      const { data: assignmentData, error: assignmentError } = teacherIds.length
        ? await supabase
            .from('teacher_subjects')
            .select('id, teacher_id, subject_id')
            .in('teacher_id', teacherIds)
        : { data: [], error: null };
      if (assignmentError) throw assignmentError;

      setDepartmentName(departmentData?.name || 'your department');
      setSubjects(subjectData || []);
      setTeachers(teacherList || []);
      setAssignments(assignmentData || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to load data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [profile?.department_id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAssignDialog = (teacher: Teacher) => {
    const assigned = new Set(teacherAssignments.get(teacher.id) || []);
    setSelectedSubjects(assigned);
    setActiveTeacher(teacher);
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!activeTeacher) return;
    setSaving(true);
    try {
      const current = new Set(teacherAssignments.get(activeTeacher.id) || []);
      const toAdd = Array.from(selectedSubjects).filter((id) => !current.has(id));
      const toRemove = Array.from(current).filter((id) => !selectedSubjects.has(id));

      if (toAdd.length) {
        const { error } = await supabase.from('teacher_subjects').insert(
          toAdd.map((subjectId) => ({
            teacher_id: activeTeacher.id,
            subject_id: subjectId,
          }))
        );
        if (error) throw error;
      }

      if (toRemove.length) {
        const { error } = await supabase
          .from('teacher_subjects')
          .delete()
          .eq('teacher_id', activeTeacher.id)
          .in('subject_id', toRemove);
        if (error) throw error;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('teacher_subjects')
        .select('id, teacher_id, subject_id')
        .in('teacher_id', teachers.map((t) => t.id));
      if (assignmentError) throw assignmentError;

      setAssignments(assignmentData || []);
      toast({ title: 'Assignments updated', description: 'Subjects have been assigned successfully.' });
      setActiveTeacher(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to update assignments.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeacher = async () => {
    const email = newTeacherEmail.trim();
    const fullName = newTeacherName.trim();
    const password = newTeacherPassword.trim();

    if (!email) {
      toast({ title: 'Missing email', description: 'Please enter a teacher email.', variant: 'destructive' });
      return;
    }

    if (password && !fullName) {
      toast({ title: 'Missing name', description: 'Full name is required when creating a new account.', variant: 'destructive' });
      return;
    }

    setAddingTeacher(true);
    try {
      const { data, error } = await supabase.functions.invoke('hod-teachers', {
        body: {
          action: 'add',
          email,
          fullName: fullName || null,
          password: password || null,
        },
      });

      if (error) throw error;

      const statusLabel = data?.status === 'attached' ? 'attached to your department' : 'created';
      toast({ title: 'Teacher added', description: `Teacher ${statusLabel} successfully.` });
      setNewTeacherName('');
      setNewTeacherEmail('');
      setNewTeacherPassword('');
      setAddDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to add teacher.', variant: 'destructive' });
    } finally {
      setAddingTeacher(false);
    }
  };

  const handleRemoveTeacher = async (teacher: Teacher) => {
    if (!confirm(`Remove ${teacher.full_name} from ${departmentName}?`)) return;
    setRemovingTeacherId(teacher.id);
    try {
      const { error } = await supabase.functions.invoke('hod-teachers', {
        body: {
          action: 'remove',
          teacherId: teacher.id,
        },
      });
      if (error) throw error;
      toast({ title: 'Teacher removed', description: 'Teacher has been removed from your department.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to remove teacher.', variant: 'destructive' });
    } finally {
      setRemovingTeacherId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Department</h1>
            <p className="text-muted-foreground mt-2">
              Manage teachers and assign subjects for {departmentName}.
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Teacher</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Teacher</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teacherEmail">Email</Label>
                  <Input
                    id="teacherEmail"
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="teacher@college.edu"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherName">Full name (for new accounts)</Label>
                  <Input
                    id="teacherName"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherPassword">Temporary password (leave empty to attach existing)</Label>
                  <Input
                    id="teacherPassword"
                    type="password"
                    value={newTeacherPassword}
                    onChange={(e) => setNewTeacherPassword(e.target.value)}
                    placeholder="Create a temporary password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  If the teacher already has an account, leave the password empty to attach them to this department.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTeacher} disabled={addingTeacher}>
                  {addingTeacher ? 'Adding...' : 'Add Teacher'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading department data...
          </div>
        ) : (
          <div className="grid gap-6">
            {teachers.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-muted-foreground">
                No teachers found in this department.
              </div>
            ) : (
              teachers.map((teacher) => {
                const assigned = (teacherAssignments.get(teacher.id) || [])
                  .map((subjectId) => subjects.find((s) => s.id === subjectId))
                  .filter(Boolean) as Subject[];

                return (
                  <div key={teacher.id} className="rounded-2xl border bg-card p-6 shadow-card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{teacher.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Dialog open={activeTeacher?.id === teacher.id} onOpenChange={(open) => !open && setActiveTeacher(null)}>
                          <DialogTrigger asChild>
                            <Button onClick={() => openAssignDialog(teacher)} variant="outline">
                              Assign Subjects
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Subjects</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              {subjects.map((subject) => (
                                <label key={subject.id} className="flex items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedSubjects.has(subject.id)}
                                    onChange={() => toggleSubject(subject.id)}
                                    className="h-4 w-4"
                                  />
                                  <span>{subject.name} ({subject.code})</span>
                                </label>
                              ))}
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setActiveTeacher(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleSaveAssignments} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Assignments'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          onClick={() => handleRemoveTeacher(teacher)}
                          disabled={removingTeacherId === teacher.id}
                        >
                          {removingTeacherId === teacher.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {assigned.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No subjects assigned.</span>
                      ) : (
                        assigned.map((subject) => (
                          <Badge key={subject.id} variant="secondary">
                            {subject.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
