import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      <HodPageShell
        eyebrow="HOD · Department"
        title={<>Department <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">overview</em></>}
        description={`Manage teachers and assign subjects for ${departmentName}.`}
        actions={
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">Add Teacher</Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
              <DialogHeader>
                <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Add Teacher</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teacherEmail" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Email</Label>
                  <Input
                    id="teacherEmail"
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="teacher@college.edu"
                    className="h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherName" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Full name (for new accounts)</Label>
                  <Input
                    id="teacherName"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="Full name"
                    className="h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherPassword" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Temporary password (leave empty to attach existing)</Label>
                  <Input
                    id="teacherPassword"
                    type="password"
                    value={newTeacherPassword}
                    onChange={(e) => setNewTeacherPassword(e.target.value)}
                    placeholder="Create a temporary password"
                    className="h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm"
                  />
                </div>
                <p className="text-xs text-[#a0aec0] dark:text-[#3d5166]">
                  If the teacher already has an account, leave the password empty to attach them to this department.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                  Cancel
                </Button>
                <Button onClick={handleAddTeacher} disabled={addingTeacher} className="rounded-[9px] text-white border-0" style={{ background: 'linear-gradient(135deg,#0fa88f,#0d7a6b)' }}>
                  {addingTeacher ? 'Adding...' : 'Add Teacher'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="space-y-8">

        {loading ? (
          <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-5 py-8 flex items-center gap-3 text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading department data...
          </div>
        ) : (
          <div className="grid gap-6">
            {teachers.length === 0 ? (
              <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-6 text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
                No teachers found in this department.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Faculty</p>
                    <span className="px-2 py-[3px] rounded-full bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] font-mono text-[10px]">
                      {filteredTeachers.length} of {teachers.length}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-end md:gap-6">
                    <div className="w-full md:max-w-xl">
                    <Label htmlFor="teacher-search" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Search teachers</Label>
                    <Input
                      id="teacher-search"
                      value={teacherSearch}
                      onChange={(event) => setTeacherSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="mt-1.5 h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-4 text-sm text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus-visible:ring-1 focus-visible:ring-[#0d7a6b]/40"
                    />
                  </div>
                  <div className="w-full md:w-48 md:justify-self-end">
                    <Label htmlFor="teacher-sort" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Sort by</Label>
                    <Select
                      value={teacherSort}
                      onValueChange={(value) => setTeacherSort(value as 'name' | 'subjects')}
                    >
                      <SelectTrigger id="teacher-sort" className="mt-1.5 h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm text-[#18202e] dark:text-[#e2eaf4]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[12px]">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="subjects">Subject count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </div>

                <div className="space-y-2">
                  {filteredTeachers.length === 0 ? (
                    <div className="rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-4 py-6 text-center text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
                      No teachers match your search.
                    </div>
                  ) : null}
                  {filteredTeachers.map((teacher) => {
                const assigned = (teacherAssignments.get(teacher.id) || [])
                  .map((subjectId) => subjects.find((s) => s.id === subjectId))
                  .filter(Boolean) as Subject[];
                const isExpanded = expandedTeachers.has(teacher.id);
                const visibleSubjects = assigned.slice(0, 3);
                const hiddenCount = Math.max(assigned.length - visibleSubjects.length, 0);
                const initials = teacher.full_name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase() || teacher.full_name.slice(0, 2).toUpperCase();

                return (
                  <div key={teacher.id} className={`relative overflow-hidden rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] ${isExpanded ? 'border-l-2 border-l-[#0d7a6b] dark:border-l-[#2dd4bf]' : ''}`}>
                    <div
                      className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-[#ede9e2] dark:hover:bg-[#131c27] sm:flex-row sm:items-center sm:justify-between cursor-pointer"
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
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] font-mono text-[11px] font-semibold text-[#0d7a6b] dark:text-[#2dd4bf]">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-[14px] font-medium text-[#18202e] dark:text-[#e2eaf4]">{teacher.full_name}</h3>
                            <span className="px-2 py-[2px] rounded-full bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] font-mono text-[10px]">
                              {assigned.length}
                            </span>
                          </div>
                          <p className="truncate text-[12px] text-[#a0aec0] dark:text-[#3d5166]">{teacher.email}</p>
                          <button
                            type="button"
                            className="mt-1 text-[12px] text-[#64748b] dark:text-[#6b8299] underline-offset-4 hover:underline hover:text-[#0d7a6b] dark:hover:text-[#2dd4bf]"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpandedTeacher(teacher.id);
                            }}
                          >
                            {assigned.length} subjects • {isExpanded ? 'Hide details' : 'View details'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Dialog open={activeTeacher?.id === teacher.id} onOpenChange={(open) => !open && setActiveTeacher(null)}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                openAssignDialog(teacher);
                              }}
                              size="sm"
                              className="rounded-[9px] text-white border-0 text-[12px] font-semibold"
                              style={{ background: 'linear-gradient(135deg,#0fa88f,#0d7a6b)' }}
                            >
                              Assign
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-2xl p-0 bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
                            <div className="flex max-h-[85vh] flex-col">
                              <div className="px-6 pt-6">
                                <DialogHeader>
                                  <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Assign Subjects</DialogTitle>
                                </DialogHeader>
                              </div>
                              <div className="px-6 pt-2 text-[12px] text-[#64748b] dark:text-[#6b8299]">
                                Select the subjects this teacher should handle.
                              </div>
                              <div className="flex-1 overflow-y-auto px-6 pb-4 pt-3">
                                <div className="space-y-2">
                                  {subjects.map((subject) => (
                                    <label key={subject.id} className="flex items-start gap-3 rounded-[9px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] px-3 py-2.5 text-sm leading-snug cursor-pointer hover:bg-[#ede9e2] dark:hover:bg-[#131c27] transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={selectedSubjects.has(subject.id)}
                                        onChange={() => toggleSubject(subject.id)}
                                        className="mt-0.5 h-4 w-4 accent-[#0d7a6b]"
                                      />
                                      <span className="min-w-0 break-words text-[13px] text-[#18202e] dark:text-[#e2eaf4]">
                                        {subject.name}{' '}
                                        <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">({subject.code})</span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <DialogFooter className="border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] px-6 pb-6 pt-4 flex flex-col gap-2 sm:flex-row sm:justify-end rounded-b-[14px]">
                                <Button
                                  variant="outline"
                                  onClick={() => setActiveTeacher(null)}
                                  className="w-full sm:w-auto rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveAssignments}
                                  disabled={saving}
                                  className="w-full sm:w-auto rounded-[9px] text-white border-0"
                                  style={{ background: 'linear-gradient(135deg,#0fa88f,#0d7a6b)' }}
                                >
                                  {saving ? 'Saving...' : 'Save Assignments'}
                                </Button>
                              </DialogFooter>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setTeacherToRemove(teacher);
                          }}
                          disabled={removingTeacherId === teacher.id}
                          size="sm"
                          className="rounded-[9px] border-[#f43f5e]/30 dark:border-[#fb7185]/30 bg-[#fef2f5] dark:bg-[rgba(251,113,133,0.08)] text-[#9f1239] dark:text-[#fb7185] hover:bg-[#f43f5e]/10 text-[12px] font-medium"
                        >
                          {removingTeacherId === teacher.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>

                    <div
                      className={`overflow-hidden border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] px-4 transition-all duration-200 ease-out ${
                        isExpanded ? 'max-h-40 py-3 opacity-100' : 'max-h-0 py-0 opacity-0 border-t-0'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {assigned.length === 0 ? (
                          <span className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No subjects assigned.</span>
                        ) : (
                          <>
                            {visibleSubjects.map((subject) => (
                              <Badge key={subject.id} className="rounded-full border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-2.5 py-1 font-mono text-[10.5px] font-medium text-[#64748b] dark:text-[#6b8299] hover:bg-white">
                                {subject.code}
                              </Badge>
                            ))}
                            {hiddenCount > 0 && (
                              <span className="text-[11px] text-[#a0aec0] dark:text-[#3d5166]">+{hiddenCount} more</span>
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
          <DialogContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
            <DialogHeader>
              <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Remove Teacher</DialogTitle>
            </DialogHeader>
            <p className="text-[13px] text-[#64748b] dark:text-[#6b8299]">
              Remove {teacherToRemove?.full_name} from {departmentName}? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTeacherToRemove(null)} className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => teacherToRemove && handleRemoveTeacher(teacherToRemove)}
                disabled={removingTeacherId === teacherToRemove?.id}
                className="rounded-[9px]"
              >
                {removingTeacherId === teacherToRemove?.id ? 'Removing...' : 'Remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Curriculum</p>
              <h2 className="mt-1 text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Semester-wise Subjects</h2>
              <p className="mt-0.5 text-[12px] text-[#64748b] dark:text-[#6b8299]">
                Assign teachers to subjects for paper creation by semester.
              </p>
            </div>
            <span className="px-2 py-[3px] rounded-full bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] font-mono text-[10px]">
              {subjects.length}
            </span>
          </div>

          {loading ? (
            <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-5 py-8 flex items-center gap-3 text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading subjects...
            </div>
          ) : subjects.length === 0 ? (
            <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-6 text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
              No subjects found for this department.
            </div>
          ) : (
            <>
              <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="semester-filter" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Semester</Label>
                    <Select
                      value={semesterFilter === 'all' ? 'all' : String(semesterFilter)}
                      onValueChange={(value) =>
                        setSemesterFilter(value === 'all' ? 'all' : Number(value))
                      }
                    >
                      <SelectTrigger id="semester-filter" className="h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm text-[#18202e] dark:text-[#e2eaf4]">
                        <SelectValue placeholder="All Semesters" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[12px]">
                        <SelectItem value="all">All Semesters</SelectItem>
                        {semesterOptions.map((semester) => (
                          <SelectItem key={semester} value={String(semester)}>
                            Semester {semester}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="semester-sort" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">Sort</Label>
                    <Select
                      value={semesterSort}
                      onValueChange={(value) =>
                        setSemesterSort(
                          value as 'newest' | 'oldest' | 'most-subjects' | 'least-subjects'
                        )
                      }
                    >
                      <SelectTrigger id="semester-sort" className="h-11 rounded-xl border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-sm text-[#18202e] dark:text-[#e2eaf4]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[12px]">
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="most-subjects">Most Subjects First</SelectItem>
                        <SelectItem value="least-subjects">Least Subjects First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              </div>

              {visibleSemesterEntries.length === 0 ? (
                <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-6 text-[13px] text-[#a0aec0] dark:text-[#3d5166]">
                  No semesters match the current filter.
                </div>
              ) : null}
              {visibleSemesterEntries.map(([semester, semesterSubjects]) => (
                <div key={semester} id={`semester-${semester}`} className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-[8px] bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf] font-mono text-[11px] font-semibold">
                        SEM {semester}
                      </span>
                      <h3 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Semester {semester}</h3>
                    </div>
                    <Badge className="rounded-full bg-[#ede9e2] dark:bg-[#131c27] px-2.5 py-1 font-mono text-[10px] font-medium text-[#64748b] dark:text-[#6b8299] hover:bg-[#ede9e2] border-0">{semesterSubjects.length} subjects</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {semesterSubjects.map((subject) => {
                      const assignedTeachers = (subjectAssignments.get(subject.id) || [])
                        .map((teacherId) => teachers.find((t) => t.id === teacherId))
                        .filter(Boolean) as Teacher[];

                      return (
                        <div key={subject.id} className="rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] p-4 transition-colors hover:bg-[#ede9e2] dark:hover:bg-[#131c27]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-[#18202e] dark:text-[#e2eaf4]">{subject.name}</p>
                              <p className="mt-0.5 font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">{subject.code}</p>
                            </div>
                            <Dialog open={activeSubject?.id === subject.id} onOpenChange={(open) => !open && setActiveSubject(null)}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openSubjectAssignDialog(subject)} className="shrink-0 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
                                  Assign
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
                                <DialogHeader>
                                  <DialogTitle className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Assign Teachers</DialogTitle>
                                </DialogHeader>
                                <p className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">{subject.code} · Semester {subject.semester}</p>
                                <div className="space-y-2">
                                  {teachers.length === 0 ? (
                                    <p className="text-[13px] text-[#a0aec0] dark:text-[#3d5166]">No teachers available.</p>
                                  ) : (
                                    teachers.map((teacher) => (
                                      <label key={teacher.id} className="flex items-center gap-3 rounded-[9px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef] dark:bg-[#0a1019] px-3 py-2.5 text-sm cursor-pointer hover:bg-[#ede9e2] dark:hover:bg-[#131c27] transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={selectedTeachers.has(teacher.id)}
                                          onChange={() => toggleTeacher(teacher.id)}
                                          className="h-4 w-4 accent-[#0d7a6b]"
                                        />
                                        <span className="text-[13px] text-[#18202e] dark:text-[#e2eaf4]">{teacher.full_name} <span className="text-[#a0aec0] dark:text-[#3d5166]">({teacher.email})</span></span>
                                      </label>
                                    ))
                                  )}
                                </div>
                                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => setActiveSubject(null)}
                                    className="w-full sm:w-auto rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleSaveSubjectAssignments}
                                    disabled={saving}
                                    className="w-full sm:w-auto rounded-[9px] text-white border-0"
                                    style={{ background: 'linear-gradient(135deg,#0fa88f,#0d7a6b)' }}
                                  >
                                    {saving ? 'Saving...' : 'Save Assignments'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {assignedTeachers.length === 0 ? (
                              <span className="text-[11px] text-[#a0aec0] dark:text-[#3d5166]">No teachers assigned.</span>
                            ) : (
                              assignedTeachers.map((teacher) => (
                                <Badge key={teacher.id} className="rounded-full border-0 bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] px-2.5 py-1 font-mono text-[10.5px] font-medium text-[#0d7a6b] dark:text-[#2dd4bf] hover:bg-[#eaf6f4]">
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
      </HodPageShell>
    </DashboardLayout>
  );
}
