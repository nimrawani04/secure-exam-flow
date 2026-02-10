import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const teacherAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.teacher_id) || [];
      list.push(assignment.subject_id);
      map.set(assignment.teacher_id, list);
    });
    return map;
  }, [assignments]);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.department_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ data: subjectData, error: subjectError }, { data: profileData, error: profileError }] =
          await Promise.all([
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
          ]);

        if (subjectError) throw subjectError;
        if (profileError) throw profileError;

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

        setSubjects(subjectData || []);
        setTeachers(teacherList || []);
        setAssignments(assignmentData || []);
      } catch (error: any) {
        toast({ title: 'Error', description: error?.message || 'Failed to load data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.department_id, toast]);

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Department</h1>
          <p className="text-muted-foreground mt-2">
            Assign subjects to teachers in your department.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading department data…
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
