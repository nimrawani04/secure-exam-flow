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
  semester: number;
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
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSort, setTeacherSort] = useState<'name' | 'subjects'>('name');
  const [teacherToRemove, setTeacherToRemove] = useState<Teacher | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<'all' | number>('all');
  const [semesterSort, setSemesterSort] = useState<'newest' | 'oldest' | 'most-subjects' | 'least-subjects'>('newest');

  const teacherAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.teacher_id) || [];
      list.push(assignment.subject_id);
      map.set(assignment.teacher_id, list);
    });
    return map;
  }, [assignments]);

  const subjectAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.subject_id) || [];
      list.push(assignment.teacher_id);
      map.set(assignment.subject_id, list);
    });
    return map;
  }, [assignments]);

  const subjectsBySemester = useMemo(() => {
    const map = new Map<number, Subject[]>();
    subjects.forEach((subject) => {
      const list = map.get(subject.semester) || [];
      list.push(subject);
      map.set(subject.semester, list);
    });
    return map;
  }, [subjects]);

  const semesterOptions = useMemo(
    () => Array.from(subjectsBySemester.keys()).sort((a, b) => a - b),
    [subjectsBySemester]
  );

  const visibleSemesterEntries = useMemo(() => {
    let entries = Array.from(subjectsBySemester.entries());

    if (semesterFilter !== 'all') {
      entries = entries.filter(([semester]) => semester === semesterFilter);
    }

    return entries.sort((a, b) => {
      if (semesterSort === 'oldest') return a[0] - b[0];
      if (semesterSort === 'most-subjects') {
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        return b[0] - a[0];
      }
      if (semesterSort === 'least-subjects') {
        if (a[1].length !== b[1].length) return a[1].length - b[1].length;
        return a[0] - b[0];
      }
      return b[0] - a[0];
    });
  }, [subjectsBySemester, semesterFilter, semesterSort]);

  useEffect(() => {
    if (semesterFilter !== 'all' && !semesterOptions.includes(semesterFilter)) {
      setSemesterFilter('all');
    }
  }, [semesterFilter, semesterOptions]);

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
          .select('id, name, code, semester')
          .eq('department_id', profile.department_id)
          .order('semester', { ascending: true })
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

  const openSubjectAssignDialog = (subject: Subject) => {
    const assigned = new Set(subjectAssignments.get(subject.id) || []);
    setSelectedTeachers(assigned);
    setActiveSubject(subject);
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

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    const list = query
      ? teachers.filter((teacher) => {
          const name = teacher.full_name?.toLowerCase() || '';
          const email = teacher.email?.toLowerCase() || '';
          return name.includes(query) || email.includes(query);
        })
      : teachers;

    return [...list].sort((a, b) => {
      if (teacherSort === 'subjects') {
        const countA = teacherAssignments.get(a.id)?.length || 0;
        const countB = teacherAssignments.get(b.id)?.length || 0;
        if (countA !== countB) return countB - countA;
      }
      return a.full_name.localeCompare(b.full_name);
    });
  }, [teacherSearch, teacherSort, teachers, teacherAssignments]);

  const toggleExpandedTeacher = (teacherId: string) => {
    setExpandedTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
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

  const handleSaveSubjectAssignments = async () => {
    if (!activeSubject) return;
    setSaving(true);
    try {
      const current = new Set(subjectAssignments.get(activeSubject.id) || []);
      const toAdd = Array.from(selectedTeachers).filter((id) => !current.has(id));
      const toRemove = Array.from(current).filter((id) => !selectedTeachers.has(id));

      if (toAdd.length) {
        const { error } = await supabase.from('teacher_subjects').insert(
          toAdd.map((teacherId) => ({
            teacher_id: teacherId,
            subject_id: activeSubject.id,
          }))
        );
        if (error) throw error;
      }

      if (toRemove.length) {
        const { error } = await supabase
          .from('teacher_subjects')
          .delete()
          .eq('subject_id', activeSubject.id)
          .in('teacher_id', toRemove);
        if (error) throw error;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('teacher_subjects')
        .select('id, teacher_id, subject_id')
        .in('teacher_id', teachers.map((t) => t.id));
      if (assignmentError) throw assignmentError;

      setAssignments(assignmentData || []);
      toast({ title: 'Assignments updated', description: 'Teachers have been assigned successfully.' });
      setActiveSubject(null);
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
      setTeacherToRemove(null);
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
              <div className="space-y-4">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-end md:gap-6">
                    <div className="w-full md:max-w-xl">
                    <Label htmlFor="teacher-search">Search teachers</Label>
                    <Input
                      id="teacher-search"
                      value={teacherSearch}
                      onChange={(event) => setTeacherSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="mt-1 h-11 rounded-xl border-border bg-background px-4 text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                    />
                  </div>
                    <div className="w-full md:w-48 md:justify-self-end">
                    <Label htmlFor="teacher-sort">Sort by</Label>
                    <select
                      id="teacher-sort"
                      value={teacherSort}
                      onChange={(event) => setTeacherSort(event.target.value as 'name' | 'subjects')}
                      className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                    >
                      <option value="name">Name</option>
                      <option value="subjects">Subject count</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredTeachers.map((teacher) => {
                const assigned = (teacherAssignments.get(teacher.id) || [])
                  .map((subjectId) => subjects.find((s) => s.id === subjectId))
                  .filter(Boolean) as Subject[];
                const isExpanded = expandedTeachers.has(teacher.id);
                const visibleSubjects = assigned.slice(0, 3);
                const hiddenCount = Math.max(assigned.length - visibleSubjects.length, 0);

                return (
                  <div key={teacher.id} className="rounded-lg border bg-card">
                    <div
                      className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => toggleExpandedTeacher(teacher.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleExpandedTeacher(teacher.id);
                        }
                      }}
                    >
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">{teacher.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.email}</p>
                        <button
                          type="button"
                          className="mt-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpandedTeacher(teacher.id);
                          }}
                        >
                          {assigned.length} subjects • {isExpanded ? 'Hide details' : 'View details'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Dialog open={activeTeacher?.id === teacher.id} onOpenChange={(open) => !open && setActiveTeacher(null)}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                openAssignDialog(teacher);
                              }}
                              variant="default"
                              size="sm"
                            >
                              Assign
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-2xl p-0">
                            <div className="flex max-h-[85vh] flex-col">
                              <div className="px-6 pt-6">
                                <DialogHeader>
                                  <DialogTitle>Assign Subjects</DialogTitle>
                                </DialogHeader>
                              </div>
                              <div className="px-6 pt-4 text-sm text-muted-foreground">
                                Select the subjects this teacher should handle.
                              </div>
                              <div className="flex-1 overflow-y-auto px-6 pb-4 pt-3">
                                <div className="space-y-3">
                                  {subjects.map((subject) => (
                                    <label key={subject.id} className="flex items-start gap-3 text-sm leading-snug cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedSubjects.has(subject.id)}
                                        onChange={() => toggleSubject(subject.id)}
                                        className="mt-0.5 h-4 w-4"
                                      />
                                      <span className="min-w-0 break-words">
                                        {subject.name} ({subject.code})
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <DialogFooter className="border-t px-6 pb-6 pt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => setActiveTeacher(null)}
                                  className="w-full sm:w-auto"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveAssignments}
                                  disabled={saving}
                                  className="w-full sm:w-auto"
                                >
                                  {saving ? 'Saving...' : 'Save Assignments'}
                                </Button>
                              </DialogFooter>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setTeacherToRemove(teacher);
                          }}
                          disabled={removingTeacherId === teacher.id}
                          size="sm"
                        >
                          {removingTeacherId === teacher.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>

                    <div
                      className={`overflow-hidden border-t px-4 transition-all duration-200 ease-out ${
                        isExpanded ? 'max-h-24 py-3 opacity-100' : 'max-h-0 py-0 opacity-0'
                      }`}
                    >
                      <div className="flex flex-wrap gap-2">
                        {assigned.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No subjects assigned.</span>
                        ) : (
                          <>
                            {visibleSubjects.map((subject) => (
                              <Badge key={subject.id} variant="secondary">
                                {subject.name}
                              </Badge>
                            ))}
                            {hiddenCount > 0 && (
                              <span className="text-xs text-muted-foreground">+{hiddenCount} more</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog open={!!teacherToRemove} onOpenChange={(open) => !open && setTeacherToRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Teacher</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Remove {teacherToRemove?.full_name} from {departmentName}? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTeacherToRemove(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => teacherToRemove && handleRemoveTeacher(teacherToRemove)}
                disabled={removingTeacherId === teacherToRemove?.id}
              >
                {removingTeacherId === teacherToRemove?.id ? 'Removing...' : 'Remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Semester-wise Subjects</h2>
            <p className="text-sm text-muted-foreground">
              Assign teachers to subjects for paper creation by semester.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading subjects...
            </div>
          ) : subjects.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-muted-foreground">
              No subjects found for this department.
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="semester-filter">Semester</Label>
                    <select
                      id="semester-filter"
                      value={semesterFilter === 'all' ? 'all' : String(semesterFilter)}
                      onChange={(event) =>
                        setSemesterFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All Semesters</option>
                      {semesterOptions.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="semester-sort">Sort</Label>
                    <select
                      id="semester-sort"
                      value={semesterSort}
                      onChange={(event) =>
                        setSemesterSort(
                          event.target.value as 'newest' | 'oldest' | 'most-subjects' | 'least-subjects'
                        )
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="most-subjects">Most Subjects First</option>
                      <option value="least-subjects">Least Subjects First</option>
                    </select>
                  </div>
                </div>

              </div>

              {visibleSemesterEntries.map(([semester, semesterSubjects]) => (
                <div key={semester} id={`semester-${semester}`} className="rounded-2xl border bg-card p-4 sm:p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Semester {semester}</h3>
                    <Badge variant="secondary">{semesterSubjects.length} subjects</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {semesterSubjects.map((subject) => {
                      const assignedTeachers = (subjectAssignments.get(subject.id) || [])
                        .map((teacherId) => teachers.find((t) => t.id === teacherId))
                        .filter(Boolean) as Teacher[];

                      return (
                        <div key={subject.id} className="rounded-xl border bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{subject.name}</p>
                              <p className="text-xs text-muted-foreground">{subject.code}</p>
                            </div>
                            <Dialog open={activeSubject?.id === subject.id} onOpenChange={(open) => !open && setActiveSubject(null)}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openSubjectAssignDialog(subject)}>
                                  Assign
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Assign Teachers</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  {teachers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No teachers available.</p>
                                  ) : (
                                    teachers.map((teacher) => (
                                      <label key={teacher.id} className="flex items-center gap-3 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={selectedTeachers.has(teacher.id)}
                                          onChange={() => toggleTeacher(teacher.id)}
                                          className="h-4 w-4"
                                        />
                                        <span>{teacher.full_name} ({teacher.email})</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => setActiveSubject(null)}
                                    className="w-full sm:w-auto"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleSaveSubjectAssignments}
                                    disabled={saving}
                                    className="w-full sm:w-auto"
                                  >
                                    {saving ? 'Saving...' : 'Save Assignments'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {assignedTeachers.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No teachers assigned.</span>
                            ) : (
                              assignedTeachers.map((teacher) => (
                                <Badge key={teacher.id} variant="secondary">
                                  {teacher.full_name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
