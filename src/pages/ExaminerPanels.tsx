import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  useExaminerPanels,
  emptyMember,
  type PanelMember,
  type PanelHeaderInput,
  type ExaminerPanel,
} from '@/hooks/useExaminerPanels';
import {
  downloadPanelTemplate,
  parsePanelWorkbookWithHeader,
  exportPanelPdf,
  exportPanelsPdf,
  exportCombinedSemesterPdf,
  exportAllCombinedSemestersPdf,
  exportPanelExcel,
  exportPanelsExcel,
  formatSemesterSheetName,
} from '@/lib/panelExport';
import {
  IT_DEPARTMENT,
  IT_PROGRAMMES,
  IT_SCHOOL,
  SESSION_OPTIONS,
  DEFAULT_TEACHER_POOL,
  isSemesterMatchingSession,
  courseKey,
} from '@/lib/itCatalog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  FileDown,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Check,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  GripVertical,
  Search,
  Filter,
  FilterX,
  ArrowUpDown,
  Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PoolTeacher {
  id: string;
  name: string;
  designation: string | null;
  specialization: string | null;
  postal_address: string | null;
  contact_details: string | null;
  status: string | null;
}

const emptyHeader: PanelHeaderInput = {
  school: IT_SCHOOL,
  department_label: IT_DEPARTMENT,
  programme: '',
  semester: '',
  session_label: '',
  course_title: '',
  course_code: '',
  credits: '4',
  course_nature: 'Major',
  regular_backlog: 'Regular',
  batch: '',
  teacher_incharge_name: '',
  head_name: '',
  dean_name: '',
  notes: '',
};

const NATURE_OPTIONS = [
  'Major',
  'Minor',
  'Lab',
  'MDC',
  'VAC',
  'SEC',
  'AEC',
  'OGE',
  'MOOCs',
  'Core',
  'Elective',
];

const REGULAR_BACKLOG_OPTIONS = ['Regular', 'Backlog', 'Both'];

export default function ExaminerPanels() {
  const { profile, user } = useAuth();
  const { panels, isLoading, savePanel, sendToExamCell, deletePanel } = useExaminerPanels();
  const isHod = profile?.role === 'hod';

  const [header, setHeader] = useState<PanelHeaderInput>(emptyHeader);
  // Default to 5 preference rows to match the official template format
  const [members, setMembers] = useState<PanelMember[]>([1, 2, 3, 4, 5].map(emptyMember));
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [pool, setPool] = useState<PoolTeacher[]>([]);
  const [viewPanelId, setViewPanelId] = useState<string | null>(null);

  // Drag & Drop state for teacher swapping
  const [draggedMemberIndex, setDraggedMemberIndex] = useState<number | null>(null);
  const [dragOverMemberIndex, setDragOverMemberIndex] = useState<number | null>(null);
  const [draggedPoolTeacher, setDraggedPoolTeacher] = useState<PoolTeacher | null>(null);

  // Panel filter states (Semester-wise, Programme, Status, Search)
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [selectedProgrammeFilter, setSelectedProgrammeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileRef = useRef<HTMLInputElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const loadPool = async () => {
    try {
      const { data } = await supabase.from('panel_examiner_pool').select('*').order('created_at');
      const dbPool = (data as PoolTeacher[]) || [];
      const dbNames = new Set(dbPool.map((t) => t.name.trim().toLowerCase()));

      const defaultsToAdd: PoolTeacher[] = DEFAULT_TEACHER_POOL.filter(
        (dt) => !dbNames.has(dt.name.trim().toLowerCase())
      ).map((dt, idx) => ({
        id: `default-${idx}`,
        name: dt.name,
        designation: dt.designation,
        specialization: dt.specialization,
        postal_address: dt.postal_address,
        contact_details: dt.contact_details,
        status: dt.status || null,
      }));

      const fullPool = [...dbPool, ...defaultsToAdd];
      fullPool.sort((a, b) => {
        const cleanA = a.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
        const cleanB = b.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
        return cleanA.localeCompare(cleanB, undefined, { sensitivity: 'base' });
      });

      setPool(fullPool);
    } catch (e) {
      console.warn('Using default teacher list:', e);
      const sortedDefaults = DEFAULT_TEACHER_POOL.map((dt, idx) => ({
        id: `default-${idx}`,
        name: dt.name,
        designation: dt.designation,
        specialization: dt.specialization,
        postal_address: dt.postal_address,
        contact_details: dt.contact_details,
        status: dt.status || null,
      })).sort((a, b) => {
        const cleanA = a.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
        const cleanB = b.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
        return cleanA.localeCompare(cleanB, undefined, { sensitivity: 'base' });
      });
      setPool(sortedDefaults);
    }
  };

  useEffect(() => {
    if (isHod) loadPool();
  }, [isHod]);

  const programme = IT_PROGRAMMES.find((p) => p.name === header.programme);

  const availableSemesters = useMemo(() => {
    if (!programme || programme.manual) return [];
    return programme.semesters.filter((s) =>
      isSemesterMatchingSession(s.label, header.session_label)
    );
  }, [programme, header.session_label]);

  useEffect(() => {
    if (header.semester && !programme?.manual && availableSemesters.length > 0) {
      const exists = availableSemesters.some((s) => s.label === header.semester);
      if (!exists) {
        setHeader((h) => ({ ...h, semester: '', course_code: '', course_title: '' }));
      }
    }
  }, [availableSemesters, header.semester, programme?.manual]);

  const doneKeys = useMemo(() => {
    const set = new Set<string>();
    panels.forEach((p) => {
      if (p.id === editingId) return;
      if (p.session_label === header.session_label && p.programme === header.programme)
        set.add(`${p.semester}|${courseKey(p.course_code, p.course_title)}`);
    });
    return set;
  }, [panels, header.session_label, header.programme, editingId]);

  const semesterInfo = useMemo(() => {
    if (!programme) return [];
    const stats = availableSemesters.map((s) => {
      const totalCourses = s.courses.length;
      const doneCourses = s.courses.filter((x) =>
        doneKeys.has(`${s.label}|${courseKey(x.code, x.title)}`)
      ).length;
      const complete = totalCourses > 0 && doneCourses === totalCourses;
      const inProgress = doneCourses > 0 && !complete;
      return { label: s.label, totalCourses, doneCourses, complete, inProgress };
    });
    const inProgressSem = stats.find((st) => st.inProgress);
    return stats.map((st) => {
      let unlocked = inProgressSem ? st.label === inProgressSem.label : !st.complete;
      if (editingId && header.semester === st.label) unlocked = true;
      return { label: st.label, complete: st.complete, inProgress: st.inProgress, unlocked };
    });
  }, [programme, availableSemesters, doneKeys, editingId, header.semester]);

  const remainingCourses = useMemo(() => {
    const sem =
      availableSemesters.find((s) => s.label === header.semester) ||
      programme?.semesters.find((s) => s.label === header.semester);
    if (!sem) return [];
    return sem.courses.filter((x) => !doneKeys.has(`${sem.label}|${courseKey(x.code, x.title)}`));
  }, [availableSemesters, programme, header.semester, doneKeys]);

  // Unique lists for Filtering Saved Panels
  const availableSemestersList = useMemo(() => {
    const set = new Set<string>();
    panels.forEach((p) => {
      if (p.semester) set.add(p.semester);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [panels]);

  const availableProgrammesList = useMemo(() => {
    const set = new Set<string>();
    panels.forEach((p) => {
      if (p.programme) set.add(p.programme);
    });
    return Array.from(set).sort();
  }, [panels]);

  const filteredPanels = useMemo(() => {
    return panels.filter((p) => {
      // Semester filter
      if (selectedSemesterFilter !== 'all' && p.semester !== selectedSemesterFilter) {
        return false;
      }
      // Programme filter
      if (selectedProgrammeFilter !== 'all' && p.programme !== selectedProgrammeFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'all' && p.status !== selectedStatusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (p.course_title || '').toLowerCase().includes(q);
        const matchCode = (p.course_code || '').toLowerCase().includes(q);
        const matchTeacher = (p.teacher_incharge_name || '').toLowerCase().includes(q);
        const matchSem = (p.semester || '').toLowerCase().includes(q);
        const matchProg = (p.programme || '').toLowerCase().includes(q);
        const matchMembers = p.members.some(
          (m) =>
            (m.name || '').toLowerCase().includes(q) ||
            (m.designation || '').toLowerCase().includes(q) ||
            (m.specialization || '').toLowerCase().includes(q)
        );
        if (!matchTitle && !matchCode && !matchTeacher && !matchSem && !matchProg && !matchMembers) {
          return false;
        }
      }
      return true;
    });
  }, [panels, selectedSemesterFilter, selectedProgrammeFilter, selectedStatusFilter, searchQuery]);

  const semesterGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; panels: ExaminerPanel[] }>();
    const sourcePanels = selectedSemesterFilter === 'all' ? panels : filteredPanels;
    sourcePanels.forEach((p) => {
      if (!p.semester) return;
      const key = `${p.session_label}|${p.programme}|${p.semester}`;
      const label = [p.programme, `Sem ${p.semester}`, p.session_label].filter(Boolean).join(' · ');
      if (!map.has(key)) map.set(key, { key, label, panels: [] });
      map.get(key)!.panels.push(p);
    });
    return [...map.values()];
  }, [panels, filteredPanels, selectedSemesterFilter]);

  const sortedPool = useMemo(() => {
    return [...pool].sort((a, b) => {
      const cleanA = a.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
      const cleanB = b.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
      return cleanA.localeCompare(cleanB, undefined, { sensitivity: 'base' });
    });
  }, [pool]);

  // Drag & Drop Handlers for Swapping Teachers within Panel
  const handleDragStartMember = (e: React.DragEvent, index: number) => {
    setDraggedMemberIndex(index);
    setDraggedPoolTeacher(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `member-${index}`);
  };

  const handleDragStartPool = (e: React.DragEvent, teacher: PoolTeacher) => {
    setDraggedPoolTeacher(teacher);
    setDraggedMemberIndex(null);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `pool-${teacher.id}`);
  };

  const handleDragOverMember = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedPoolTeacher ? 'copy' : 'move';
    if (dragOverMemberIndex !== index) {
      setDragOverMemberIndex(index);
    }
  };

  const handleDragLeaveMember = () => {
    setDragOverMemberIndex(null);
  };

  const handleDropOnMember = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverMemberIndex(null);

    // If dragging a teacher chip from the pool onto a row
    if (draggedPoolTeacher) {
      const t = draggedPoolTeacher;
      const existingIndex = members.findIndex(
        (m) => m.name.trim().toLowerCase() === t.name.trim().toLowerCase()
      );
      if (existingIndex >= 0 && existingIndex !== targetIndex) {
        // Swap existing teacher slot with target slot
        setMembers((prev) => {
          const next = [...prev];
          const temp = next[targetIndex];
          next[targetIndex] = { ...next[existingIndex], position: targetIndex + 1 };
          next[existingIndex] = { ...temp, position: existingIndex + 1 };
          return next;
        });
        toast.success(`Swapped ${t.name} to Preference #${targetIndex + 1}`);
      } else {
        // Assign new expert to target slot
        const newExpert: PanelMember = {
          position: targetIndex + 1,
          name: t.name,
          designation: t.designation || '',
          specialization: t.specialization || '',
          postal_address: t.postal_address || '',
          contact_details: t.contact_details || '',
          status: t.status || '',
        };
        setMembers((prev) => prev.map((m, i) => (i === targetIndex ? newExpert : m)));
        toast.success(`Assigned ${t.name} to Preference #${targetIndex + 1}`);
      }
      setDraggedPoolTeacher(null);
      return;
    }

    // If swapping two member rows in the panel
    if (draggedMemberIndex !== null && draggedMemberIndex !== targetIndex) {
      const sourceIndex = draggedMemberIndex;
      setMembers((prev) => {
        const next = [...prev];
        const temp = next[targetIndex];
        next[targetIndex] = { ...next[sourceIndex], position: targetIndex + 1 };
        next[sourceIndex] = { ...temp, position: sourceIndex + 1 };
        return next;
      });

      const sourceName = members[sourceIndex].name.trim() || `Slot #${sourceIndex + 1}`;
      const targetName = members[targetIndex].name.trim() || `Slot #${targetIndex + 1}`;
      toast.success(
        `Swapped ${sourceName} (Pref #${sourceIndex + 1}) ↔ ${targetName} (Pref #${targetIndex + 1})`
      );
    }
    setDraggedMemberIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedMemberIndex(null);
    setDragOverMemberIndex(null);
    setDraggedPoolTeacher(null);
  };

  const addFromPool = (t: PoolTeacher) => {
    if (members.some((m) => m.name.trim().toLowerCase() === t.name.trim().toLowerCase())) {
      toast.info(`${t.name} is already in the panel`);
      return;
    }
    const newExpert: PanelMember = {
      position: 1,
      name: t.name,
      designation: t.designation || '',
      specialization: t.specialization || '',
      postal_address: t.postal_address || '',
      contact_details: t.contact_details || '',
      status: t.status || '',
    };
    setMembers((rows) => {
      const blankIndex = rows.findIndex((r) => !r.name.trim());
      let next: PanelMember[];
      if (blankIndex >= 0) {
        next = rows.map((r, i) => (i === blankIndex ? { ...newExpert, position: i + 1 } : r));
      } else {
        next = [...rows, { ...newExpert, position: rows.length + 1 }];
      }
      return next.map((r, i) => ({ ...r, position: i + 1 }));
    });
    toast.success(`Assigned ${t.name}`);
  };

  const saveToPool = async (m: PanelMember) => {
    if (!m.name.trim() || !profile?.department_id) {
      toast.error('Enter a name first');
      return;
    }
    if (pool.some((t) => t.name.trim().toLowerCase() === m.name.trim().toLowerCase())) {
      toast.info('Already in your teacher list');
      return;
    }
    const { error } = await supabase.from('panel_examiner_pool').insert({
      department_id: profile.department_id,
      created_by: user?.id,
      name: m.name.trim(),
      designation: m.designation || null,
      specialization: m.specialization || null,
      postal_address: m.postal_address || null,
      contact_details: m.contact_details || null,
      status: m.status || null,
    });
    if (error) toast.error('Could not save the teacher');
    else {
      toast.success('Teacher saved to your list');
      loadPool();
    }
  };

  const setField = (key: keyof PanelHeaderInput, value: string) =>
    setHeader((h) => ({ ...h, [key]: value }));

  const updateMember = (index: number, key: keyof PanelMember, value: string) =>
    setMembers((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [key]: value } : member
      )
    );

  const moveMember = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= members.length) return;
    setMembers((current) => {
      const next = [...current];
      const [member] = next.splice(index, 1);
      next.splice(destination, 0, member);
      return next.map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const clearOrRemoveMember = (index: number) => {
    setMembers((current) => {
      if (current.length > 5) {
        return current.filter((_, i) => i !== index).map((r, i) => ({ ...r, position: i + 1 }));
      }
      return current.map((r, i) => (i === index ? emptyMember(i + 1) : r));
    });
  };

  const resetForm = () => {
    setHeader((h) => ({
      ...emptyHeader,
      session_label: h.session_label,
      programme: h.programme,
      semester: h.semester,
      teacher_incharge_name: '',
      head_name: h.head_name,
      dean_name: h.dean_name,
    }));
    setMembers([1, 2, 3, 4, 5].map(emptyMember));
    setEditingId(undefined);
  };

  const handleUpload = async (file: File) => {
    try {
      const { members: parsed, header: parsedHeader } = await parsePanelWorkbookWithHeader(file);
      if (parsed.length === 0) {
        toast.error('No examiner rows found in that file');
        return;
      }
      const padded =
        parsed.length >= 5
          ? parsed
          : [
              ...parsed,
              ...Array.from({ length: 5 - parsed.length }, (_, i) =>
                emptyMember(parsed.length + i + 1)
              ),
            ];
      setMembers(padded);
      if (parsedHeader) {
        setHeader((h) => ({
          ...h,
          ...Object.fromEntries(Object.entries(parsedHeader).filter(([_, v]) => Boolean(v))),
        }));
      }
      toast.success(`${parsed.length} examiners loaded from the file`);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file');
    }
  };

  const handleSave = async () => {
    if (!header.session_label || !header.programme || !header.semester || !header.course_title) {
      toast.error('Choose the session, programme, semester and course first');
      return;
    }
    if (!header.teacher_incharge_name.trim()) {
      toast.error('Teacher In-charge Name is required (compulsory)');
      return;
    }
    if (!header.head_name.trim()) {
      toast.error('Head / Coordinator Name is required (compulsory)');
      return;
    }
    if (!header.dean_name.trim()) {
      toast.error('Dean of School Name is required (compulsory)');
      return;
    }
    setSaving(true);
    const id = await savePanel(header, members, editingId);
    setSaving(false);
    if (id) resetForm();
  };

  const handleSendCurrent = async () => {
    if (members.filter((m) => m.name.trim()).length === 0) {
      toast.error('Add at least one examiner first');
      return;
    }
    if (!header.session_label || !header.programme || !header.semester || !header.course_title) {
      toast.error('Choose the session, programme, semester and course first');
      return;
    }
    if (!header.teacher_incharge_name.trim() || !header.head_name.trim() || !header.dean_name.trim()) {
      toast.error('Please fill in Teacher In-charge, Head/Coordinator, and Dean of School names (all compulsory)');
      return;
    }
    setSending(true);
    try {
      if (editingId) {
        const panel = panels.find((p) => p.id === editingId);
        if (!panel) {
          toast.error('Save the panel first');
          return;
        }
        const ok = await sendToExamCell(panel);
        if (ok) resetForm();
      } else {
        const id = await savePanel(header, members, undefined);
        if (!id) return;
        const clean = members
          .filter((m) => m.name.trim())
          .map((m, i) => ({ ...m, position: i + 1 }));
        const ok = await sendToExamCell({
          id,
          department_id: profile?.department_id || '',
          school: header.school,
          department_label: header.department_label,
          programme: header.programme,
          semester: header.semester,
          session_label: header.session_label,
          course_title: header.course_title,
          course_code: header.course_code,
          credits: header.credits,
          course_nature: header.course_nature,
          regular_backlog: header.regular_backlog,
          batch: header.batch,
          status: 'draft',
          teacher_incharge_name: header.teacher_incharge_name,
          head_name: header.head_name,
          dean_name: header.dean_name,
          notes: header.notes,
          sent_at: null,
          created_at: new Date().toISOString(),
          members: clean,
        });
        if (ok) resetForm();
      }
    } finally {
      setSending(false);
    }
  };

  const loadForEdit = (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId);
    if (!panel) return;
    setEditingId(panel.id);
    setHeader({
      school: panel.school || '',
      department_label: panel.department_label || '',
      programme: panel.programme || '',
      semester: panel.semester || '',
      session_label: panel.session_label || '',
      course_title: panel.course_title || '',
      course_code: panel.course_code || '',
      credits: panel.credits || '4',
      course_nature: panel.course_nature || 'Major',
      regular_backlog: panel.regular_backlog || 'Regular',
      batch: panel.batch || '',
      teacher_incharge_name: panel.teacher_incharge_name || '',
      head_name: panel.head_name || '',
      dean_name: panel.dean_name || '',
      notes: panel.notes || '',
    });
    const loadedMembers = panel.members.length ? panel.members : [];
    const padded =
      loadedMembers.length >= 5
        ? loadedMembers
        : [
            ...loadedMembers,
            ...Array.from({ length: 5 - loadedMembers.length }, (_, i) =>
              emptyMember(loadedMembers.length + i + 1)
            ),
          ];
    setMembers(padded);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPreviewPdf = () => {
    const cleanMembers = members
      .filter((m) => m.name.trim())
      .map((m, i) => ({ ...m, position: i + 1 }));
    exportPanelPdf({
      id: editingId || 'preview',
      department_id: profile?.department_id || '',
      school: header.school || IT_SCHOOL,
      department_label: header.department_label || IT_DEPARTMENT,
      programme: header.programme || '',
      semester: header.semester || '',
      session_label: header.session_label || '',
      course_title: header.course_title || 'Course Title',
      course_code: header.course_code || 'Course Code',
      credits: header.credits || '4',
      course_nature: header.course_nature || 'Major',
      regular_backlog: header.regular_backlog || 'Regular',
      batch: header.batch || '',
      status: 'draft',
      teacher_incharge_name: header.teacher_incharge_name || '',
      head_name: header.head_name || '',
      dean_name: header.dean_name || '',
      notes: header.notes || '',
      sent_at: null,
      created_at: new Date().toISOString(),
      members: cleanMembers.length > 0 ? cleanMembers : members,
    });
  };

  const filledCount = useMemo(() => members.filter((m) => m.name.trim()).length, [members]);

  const renderFilterBar = () => {
    const hasActiveFilters =
      selectedSemesterFilter !== 'all' ||
      selectedProgrammeFilter !== 'all' ||
      selectedStatusFilter !== 'all' ||
      searchQuery.trim() !== '';

    return (
      <div className="rounded-[12px] border border-[#d0d7de] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] p-4 shadow-xs mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#a0aec0] dark:text-[#3d5166]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search panels by subject, code, teacher, semester..."
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[12px] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] outline-none focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#a0aec0] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Programme Filter */}
          {availableProgrammesList.length > 0 && (
            <select
              value={selectedProgrammeFilter}
              onChange={(e) => setSelectedProgrammeFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[12px] font-medium outline-none focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)]"
            >
              <option value="all">All Programmes ({panels.length})</option>
              {availableProgrammesList.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[12px] font-medium outline-none focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent to Exam Cell</option>
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSemesterFilter('all');
                setSelectedProgrammeFilter('all');
                setSelectedStatusFilter('all');
                setSearchQuery('');
              }}
              className="h-9 px-3 text-[11.5px] text-[#64748b] dark:text-[#889cb0] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
            >
              <FilterX className="w-3.5 h-3.5 mr-1 text-[#9f1239] dark:text-[#fb7185]" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Semester Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[#e2e8f0] dark:border-[#1e2a38]">
          <span className="text-[10.5px] font-bold text-[#a0aec0] dark:text-[#3d5166] uppercase tracking-[0.08em] mr-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[var(--accent-color,#0d7a6b)]" /> Semester Filter:
          </span>

          <button
            type="button"
            onClick={() => setSelectedSemesterFilter('all')}
            className={cn(
              'h-7 px-3 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5',
              selectedSemesterFilter === 'all'
                ? 'bg-[var(--accent-color,#0d7a6b)] text-white font-semibold shadow-xs'
                : 'bg-[#f1f5f9] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] hover:bg-[#e2e8f0] dark:hover:bg-[#1e2a38] hover:text-[#18202e] dark:hover:text-[#e2eaf4]'
            )}
          >
            <span>All Panels</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                selectedSemesterFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#e2e8f0] dark:bg-[#1c2d3d] text-[#475569] dark:text-[#94a3b8]'
              )}
            >
              {panels.length}
            </span>
          </button>

          {availableSemestersList.map((sem) => {
            const semCount = panels.filter((p) => p.semester === sem).length;
            const isSelected = selectedSemesterFilter === sem;

            return (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSemesterFilter(sem)}
                className={cn(
                  'h-7 px-3 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5',
                  isSelected
                    ? 'bg-[var(--accent-color,#0d7a6b)] text-white font-semibold shadow-xs'
                    : 'bg-[#f1f5f9] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299] hover:bg-[#e2e8f0] dark:hover:bg-[#1e2a38] hover:text-[#18202e] dark:hover:text-[#e2eaf4]'
                )}
              >
                <span>Sem {sem}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#e2e8f0] dark:bg-[#1c2d3d] text-[#475569] dark:text-[#94a3b8]'
                  )}
                >
                  {semCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Exam Cell View
  if (!isHod) {
    return (
      <DashboardLayout>
        <div className="-m-4 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)]">
          <main className="px-4 sm:px-10 pt-[34px] pb-16">
            <div className="w-full max-w-[1280px] mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <p className="mb-[7px] text-[#a0aec0] dark:text-[#3d5166] text-[10.5px] font-semibold tracking-[0.09em] uppercase">
                    Examination Cell · Confidential Panel Records
                  </p>
                  <h1 className="m-0 font-serif italic font-light text-[32px] sm:text-[43px] leading-[1.1] tracking-[-0.025em]">
                    Panel of <em className="not-italic text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]">Examiners</em>
                  </h1>
                  <p className="mt-[10px] text-[12.5px] text-[#64748b] dark:text-[#6b8299]">
                    Confidential examiner panels submitted by academic departments. Filter semester-wise below.
                  </p>
                </div>
                {panels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ExportAllDropdown
                      panels={selectedSemesterFilter === 'all' ? panels : filteredPanels}
                      label={selectedSemesterFilter !== 'all' ? `Export Sem ${selectedSemesterFilter}` : undefined}
                    />
                    {semesterGroups.map((g) => (
                      <SemesterDownloadMenu key={g.key} group={g} />
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Controls for Exam Cell */}
              {panels.length > 0 && renderFilterBar()}

              <div className="space-y-6">
                {isLoading ? (
                  <div className="p-8 text-center text-[13px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820] rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d]">
                    Loading confidential panels…
                  </div>
                ) : filteredPanels.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820] rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] space-y-2">
                    <p>No examiner panels found matching the selected semester/search criteria.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSemesterFilter('all');
                        setSelectedProgrammeFilter('all');
                        setSelectedStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-xs"
                    >
                      Reset All Filters
                    </Button>
                  </div>
                ) : (
                  filteredPanels.map((panel) => (
                    <OfficialPanelCard
                      key={panel.id}
                      panel={panel}
                      isHod={false}
                      onDownloadPdf={() => exportPanelPdf(panel)}
                    />
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </DashboardLayout>
    );
  }

  // HOD View
  return (
    <DashboardLayout>
      <div className="-m-4 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)] overflow-x-hidden">
        <main className="w-full px-4 sm:px-10 pt-[34px] pb-16">
          <div className="w-full max-w-[1280px] mx-auto">
            {/* Hero Header */}
            <div className="mb-[26px] flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <p className="mb-[7px] text-[#a0aec0] dark:text-[#3d5166] text-[10.5px] font-semibold tracking-[0.09em] uppercase">
                  Confidential · Examination Cycle 2025
                </p>
                <h1 className="m-0 font-serif italic font-light text-[32px] sm:text-[43px] leading-[1.1] tracking-[-0.025em]">
                  Panel of <em className="not-italic text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]">Examiners</em>
                </h1>
                <p className="mt-[10px] text-[12.5px] text-[#64748b] dark:text-[#6b8299]">
                  Official format for submitting expert examiner preferences. Drag & drop teachers to swap order.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={downloadPanelTemplate}
                  className="h-9 px-[13px] flex items-center gap-[7px] rounded-[8px] border border-[#d0d7de] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" /> Official Excel format
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-9 px-[13px] flex items-center gap-[7px] rounded-[8px] border border-[#d0d7de] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium hover:opacity-90"
                >
                  <Upload className="h-3.5 w-3.5" /> Bulk upload Excel
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* Official Panel Form Card */}
            <section className="w-full rounded-[14px] border border-[#d0d7de] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] shadow-sm overflow-hidden mb-8">
              {/* Card top toolbar */}
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif italic text-[16px] font-medium">
                      {editingId ? 'Edit Panel of Examiners' : 'New Panel of Examiners'}
                    </span>
                    <Badge variant={editingId ? 'outline' : 'secondary'} className="text-[10px] uppercase font-mono">
                      {editingId ? 'Editing' : 'New Draft'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#6b8299]">
                    Official unified format. Drag teacher rows or pool chips to swap examiner preference order.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2.5 py-1 rounded-full font-mono text-[10px] font-medium"
                    style={{
                      backgroundColor: 'var(--accent-soft, rgba(13,122,107,0.08))',
                      color: 'var(--accent-color, #0d7a6b)',
                    }}
                  >
                    {filledCount} of {members.length} preferences set
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPreviewPdf}
                    className="h-8 text-[11.5px] border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820]"
                  >
                    <FileDown className="w-3.5 h-3.5 mr-1.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    Preview PDF
                  </Button>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* 1. Header Information Block */}
                <div className="rounded-[12px] border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] p-4 sm:p-5 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1e2a38] pb-2.5">
                    <div>
                      <h3 className="text-[13px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                        Panel Course & Academic Particulars
                      </h3>
                      <p className="text-[11px] text-[#64748b] dark:text-[#889cb0]">
                        Select academic session, programme, and semester in sequential order to populate catalog courses.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Department */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        Name of the Department offering the courses:
                      </label>
                      <input
                        value={header.department_label}
                        onChange={(e) => setField('department_label', e.target.value)}
                        placeholder="Department offering the courses"
                        className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                      />
                    </div>

                    {/* 2. School */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        School:
                      </label>
                      <input
                        value={header.school}
                        onChange={(e) => setField('school', e.target.value)}
                        placeholder="School name"
                        className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                      />
                    </div>

                    {/* 3. Session */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        Session:
                      </label>
                      <select
                        value={header.session_label}
                        onChange={(e) =>
                          setHeader((h) => ({
                            ...h,
                            session_label: e.target.value,
                            programme: '',
                            semester: '',
                            course_code: '',
                            course_title: '',
                          }))
                        }
                        className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                      >
                        <option value="">Choose session</option>
                        {SESSION_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Programme */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        Programme:
                      </label>
                      <select
                        value={header.programme}
                        disabled={!header.session_label}
                        onChange={(e) =>
                          setHeader((h) => ({
                            ...h,
                            programme: e.target.value,
                            semester: '',
                            course_code: '',
                            course_title: '',
                          }))
                        }
                        className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] disabled:opacity-50 focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                      >
                        <option value="">Choose programme</option>
                        {IT_PROGRAMMES.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Semester */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        Semester:
                      </label>
                      {programme?.manual ? (
                        <input
                          value={header.semester}
                          placeholder="Semester (e.g. I, III, V)"
                          onChange={(e) => setField('semester', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                        />
                      ) : (
                        <select
                          value={header.semester}
                          disabled={!programme}
                          onChange={(e) =>
                            setHeader((h) => ({ ...h, semester: e.target.value, course_code: '', course_title: '' }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] disabled:opacity-50 focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                        >
                          <option value="">Choose semester</option>
                          {semesterInfo.map((s) => (
                            <option key={s.label} value={s.label} disabled={!s.unlocked}>
                              {s.label}
                              {s.complete ? ' (done)' : !s.unlocked ? ' (locked)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* 6. Batch */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                        Batch:
                      </label>
                      <input
                        value={header.batch}
                        placeholder="e.g. 2023"
                        onChange={(e) => setField('batch', e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Quick-assign Teacher Chips with Drag & Drop capability */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-[#1c2430] dark:text-[#e6edf3] flex items-center gap-1.5">
                        <span>Teacher Directory · Drag or Click to Swap</span>
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-[var(--accent-soft,rgba(13,122,107,0.1))] text-[var(--accent-color,#0d7a6b)] font-mono">
                          Drag & Drop Active
                        </span>
                      </p>
                      <p className="text-[10.5px] text-[#a0aec0] dark:text-[#3d5166]">
                        Drag any teacher chip directly onto a preference row to swap or assign them.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortedPool.map((t) => {
                      const isAssigned = members.some(
                        (m) => m.name.trim().toLowerCase() === t.name.trim().toLowerCase()
                      );
                      return (
                        <button
                          key={t.id}
                          type="button"
                          draggable
                          onDragStart={(e) => handleDragStartPool(e, t)}
                          onDragEnd={handleDragEnd}
                          onClick={() => addFromPool(t)}
                          disabled={isAssigned}
                          className={cn(
                            'h-7 px-2.5 flex items-center gap-1.5 rounded-md border text-[11px] transition-all cursor-grab active:cursor-grabbing',
                            isAssigned
                              ? 'border-[#2dd4bf]/40 bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.1)] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] opacity-60 cursor-default'
                              : 'border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#475569] dark:text-[#94a3b8] hover:border-[var(--accent-color,#0d7a6b)] dark:hover:border-[#2dd4bf]'
                          )}
                        >
                          <GripVertical className="h-3 w-3 text-[#a0aec0] shrink-0" />
                          {isAssigned ? (
                            <Check className="h-3 w-3 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Official Unified Table (Draggable rows for teacher swapping) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[12px] font-semibold text-[#1c2430] dark:text-[#e6edf3]">
                        Official Course & Expert Preferences Table
                      </p>
                      <p className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
                        Drag table rows via <GripVertical className="inline h-3 w-3" /> handle to swap teacher preference order.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMembers((m) => [...m, emptyMember(m.length + 1)])}
                      className="text-[11px] font-medium text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add preference slot ({members.length + 1})
                    </button>
                  </div>

                  <div className="w-full overflow-x-auto rounded-[10px] border border-[#d0d7de] dark:border-[#2a3847] shadow-sm">
                    <table
                      className="border-collapse text-[11.5px] bg-white dark:bg-[#101820]"
                      style={{ minWidth: '1940px', width: '100%', tableLayout: 'fixed' }}
                    >
                      <colgroup>
                        <col style={{ width: '260px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '180px' }} />
                        <col style={{ width: '190px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '70px' }} />
                        <col style={{ width: '450px' }} />
                        <col style={{ width: '360px' }} />
                        <col style={{ width: '140px' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-[#f0f4f8] dark:bg-[#131e2b] border-b border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3]">
                          <th
                            colSpan={6}
                            className="px-3 py-2 text-center font-bold text-[12px] border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            Details of the course(s) for which panel is submitted
                          </th>
                          <th
                            rowSpan={2}
                            className="px-2 py-1 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            S.<br />No.
                          </th>
                          <th
                            rowSpan={2}
                            className="px-3 py-1 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            <div>Particulars of the Experts in order of Preference</div>
                            <div className="text-[10px] font-normal text-[#64748b] dark:text-[#889cb0] italic leading-tight">
                              (Name/Designation/Department) · Drag to Swap
                            </div>
                          </th>
                          <th rowSpan={2} className="px-3 py-1 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            <div>Contact Details</div>
                            <div className="text-[10px] font-normal text-[#64748b] dark:text-[#889cb0] italic leading-tight">
                              (Email ID/Mobile No.)
                            </div>
                          </th>
                          <th rowSpan={2} className="px-2 py-1 text-center font-bold">
                            Swap & Actions
                          </th>
                        </tr>
                        <tr className="bg-[#f8fafc] dark:bg-[#182332] border-b border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3]">
                          <th className="px-3 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Course Title
                          </th>
                          <th className="px-2 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Course Code
                          </th>
                          <th className="px-1 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Credits
                          </th>
                          <th className="px-2.5 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Nature of Course
                          </th>
                          <th className="px-2.5 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Programme(s)
                          </th>
                          <th className="px-2 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                            Whether Regular/Backlog
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member, index) => {
                          const totalRows = members.length;
                          const isDragging = draggedMemberIndex === index;
                          const isDragOver = dragOverMemberIndex === index;

                          return (
                            <tr
                              key={index}
                              draggable
                              onDragStart={(e) => handleDragStartMember(e, index)}
                              onDragOver={(e) => handleDragOverMember(e, index)}
                              onDragLeave={handleDragLeaveMember}
                              onDrop={(e) => handleDropOnMember(e, index)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                'border-b border-[#e2e8f0] dark:border-[#1e2a38] transition-all',
                                isDragging && 'opacity-40 bg-amber-50 dark:bg-amber-950/20',
                                isDragOver &&
                                  'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.15)] ring-2 ring-inset ring-[var(--accent-color,#0d7a6b)] dark:ring-[#2dd4bf]'
                              )}
                            >
                              {index === 0 && (
                                <>
                                  {/* Course Title */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-3 align-middle border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <input
                                      value={header.course_title}
                                      placeholder="Select or enter course title"
                                      onChange={(e) => setField('course_title', e.target.value)}
                                      className="w-full h-9 px-3 font-semibold rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12.5px] outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                    {remainingCourses.length > 0 && (
                                      <div className="mt-2 text-[10.5px]">
                                        <span className="text-[#64748b] dark:text-[#889cb0] block mb-1">
                                          Quick Catalog Pick ({remainingCourses.length}):
                                        </span>
                                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                          {remainingCourses.map((c) => (
                                            <button
                                              key={c.code}
                                              type="button"
                                              onClick={() => {
                                                setHeader((h) => ({
                                                  ...h,
                                                  course_title: c.title,
                                                  course_code: c.code,
                                                }));
                                              }}
                                              className="px-2 py-0.5 rounded text-[10px] font-mono border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] hover:border-[var(--accent-color,#0d7a6b)] text-left truncate max-w-[220px]"
                                            >
                                              {c.code} · {c.title}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Course Code */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-3 align-middle text-center border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <input
                                      value={header.course_code}
                                      placeholder="Code"
                                      onChange={(e) => setField('course_code', e.target.value)}
                                      className="w-full h-9 px-2 text-center font-mono font-bold rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12.5px] outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                  </td>

                                  {/* Credits */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-2.5 align-middle text-center border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <input
                                      value={header.credits}
                                      placeholder="Cr"
                                      onChange={(e) => setField('credits', e.target.value)}
                                      className="w-full h-9 px-1 text-center font-mono font-bold rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12.5px] outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                  </td>

                                  {/* Nature of Course */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-3 align-middle border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <select
                                      value={header.course_nature}
                                      onChange={(e) => setField('course_nature', e.target.value)}
                                      className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12px] font-medium outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    >
                                      {NATURE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Programme(s) */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-3 align-middle border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <input
                                      value={header.programme}
                                      placeholder="Programme"
                                      onChange={(e) => setField('programme', e.target.value)}
                                      className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12px] font-medium outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                  </td>

                                  {/* Whether Regular/Backlog or Both */}
                                  <td
                                    rowSpan={totalRows}
                                    className="p-3 align-middle text-center border-r border-[#d0d7de] dark:border-[#2a3847] bg-[#fbfcfd] dark:bg-[#0d141e]"
                                  >
                                    <select
                                      value={header.regular_backlog}
                                      onChange={(e) => setField('regular_backlog', e.target.value)}
                                      className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[12px] text-center font-medium outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    >
                                      {REGULAR_BACKLOG_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </>
                              )}

                              {/* S. No. + Drag Handle */}
                              <td className="p-2 text-center font-bold text-[12px] border-r border-[#d0d7de] dark:border-[#2a3847] text-[#64748b] dark:text-[#889cb0]">
                                <div className="flex items-center justify-center gap-1">
                                  <GripVertical
                                    className="h-4 w-4 cursor-grab text-[#a0aec0] hover:text-[#18202e] dark:hover:text-[#e2eaf4] shrink-0"
                                    title="Click & drag to swap teacher position"
                                  />
                                  <span>{index + 1}</span>
                                </div>
                              </td>

                              {/* Particulars of Expert (Name / Designation / Department) */}
                              <td className="p-2.5 border-r border-[#d0d7de] dark:border-[#2a3847]">
                                <div className="space-y-1.5">
                                  <input
                                    value={member.name}
                                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                                    placeholder={`Preference #${index + 1} Expert Name (e.g. Prof. A. K. Sharma)`}
                                    className="w-full h-8 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[12px] font-semibold placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf] outline-none"
                                  />
                                  <div className="grid grid-cols-[160px_1fr] gap-1.5">
                                    <input
                                      value={member.designation}
                                      onChange={(e) => updateMember(index, 'designation', e.target.value)}
                                      placeholder="Designation"
                                      className="h-7 px-2.5 rounded-md border border-[#e2e8f0] dark:border-[#1e2a38] bg-[#f8fafc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                    <input
                                      value={member.specialization}
                                      onChange={(e) => updateMember(index, 'specialization', e.target.value)}
                                      placeholder="Department / Specialization / Affiliation"
                                      className="h-7 px-2.5 rounded-md border border-[#e2e8f0] dark:border-[#1e2a38] bg-[#f8fafc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] outline-none focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf]"
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Contact Details (Email ID / Mobile No.) */}
                              <td className="p-2.5 border-r border-[#d0d7de] dark:border-[#2a3847]">
                                <input
                                  value={member.contact_details}
                                  onChange={(e) => updateMember(index, 'contact_details', e.target.value)}
                                  placeholder="Email ID / Mobile No. (e.g. name@univ.edu, +91 9876543210)"
                                  className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[12px] font-medium placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus:border-[var(--accent-color,#0d7a6b)] dark:focus:border-[#2dd4bf] outline-none"
                                />
                              </td>

                              {/* Actions & Swap Controls */}
                              <td className="p-1.5 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveMember(index, -1)}
                                    disabled={index === 0}
                                    title="Move up (Swap with previous)"
                                    className="p-1 rounded text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4] disabled:opacity-20"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveMember(index, 1)}
                                    disabled={index === members.length - 1}
                                    title="Move down (Swap with next)"
                                    className="p-1 rounded text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4] disabled:opacity-20"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveToPool(member)}
                                    disabled={!member.name.trim()}
                                    title="Save to teacher list"
                                    className="p-1 rounded text-[#64748b] dark:text-[#6b8299] hover:text-[var(--accent-color,#0d7a6b)] dark:hover:text-[#2dd4bf] disabled:opacity-20"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearOrRemoveMember(index)}
                                    title={members.length > 5 ? 'Remove slot' : 'Clear slot'}
                                    className="p-1 rounded text-[#9f1239] dark:text-[#fb7185] hover:bg-[#fef2f5] dark:hover:bg-[rgba(251,113,133,0.08)]"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Certificate & Signatures Block */}
                <div className="rounded-[10px] border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] p-4 text-[12px]">
                  <p className="font-bold text-center text-[#1c2430] dark:text-[#e6edf3] mb-1">
                    Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)
                  </p>
                  <p className="text-[11px] text-[#4b5563] dark:text-[#8fa1b5] text-center max-w-[850px] mx-auto leading-relaxed mb-4">
                    Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details,
                    Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners
                    as stated above shall readily accept any confidential assignment.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#e2e8f0] dark:border-[#1e2a38]">
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-[#1c2430] dark:text-[#e6edf3] text-[11px] flex items-center gap-1">
                        (Signature of Teacher In-charge): <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        required
                        value={header.teacher_incharge_name}
                        placeholder="Teacher In-charge Name (Compulsory)"
                        onChange={(e) => setField('teacher_incharge_name', e.target.value)}
                        className={`h-8 px-2.5 rounded border ${
                          !header.teacher_incharge_name.trim() ? 'border-amber-400 dark:border-amber-500/50' : 'border-[#d0d7de] dark:border-[#2a3847]'
                        } bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px]`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-[#1c2430] dark:text-[#e6edf3] text-[11px] flex items-center gap-1">
                        (Signature of Head/Co-ordinator): <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        required
                        value={header.head_name}
                        placeholder="Head / Coordinator Name (Compulsory)"
                        onChange={(e) => setField('head_name', e.target.value)}
                        className={`h-8 px-2.5 rounded border ${
                          !header.head_name.trim() ? 'border-amber-400 dark:border-amber-500/50' : 'border-[#d0d7de] dark:border-[#2a3847]'
                        } bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px]`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-[#1c2430] dark:text-[#e6edf3] text-[11px] flex items-center gap-1">
                        (Signature of the Dean of School): <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        required
                        value={header.dean_name}
                        placeholder="Dean of School Name (Compulsory)"
                        onChange={(e) => setField('dean_name', e.target.value)}
                        className={`h-8 px-2.5 rounded border ${
                          !header.dean_name.trim() ? 'border-amber-400 dark:border-amber-500/50' : 'border-[#d0d7de] dark:border-[#2a3847]'
                        } bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px]`}
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Notes for Exam Cell */}
                <div>
                  <label className="block text-[11px] font-bold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.08em] uppercase mb-1">
                    Notes / Remarks for the Examination Cell
                  </label>
                  <textarea
                    value={header.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Optional instructions, confidential remarks, or context for the exam cell…"
                    rows={2}
                    className="w-full p-2.5 rounded-[8px] border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0c1118] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] outline-none"
                  />
                </div>

                {/* 6. Form Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e2da] dark:border-[#1c2d3d]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || sending}
                      className="h-9 px-4 rounded-[8px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] font-medium hover:bg-[#f8fafc] disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Saving…' : editingId ? 'Update Draft' : 'Save Draft'}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="h-9 px-4 rounded-[8px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadPreviewPdf}
                      className="h-9 px-4 rounded-[8px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] text-[11.5px] font-medium hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)] inline-flex items-center gap-1.5"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Download PDF
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendCurrent}
                    disabled={saving || sending}
                    className="h-9 px-5 flex items-center gap-2 rounded-[8px] text-white text-[11.5px] font-semibold shadow-sm disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)',
                      boxShadow: '0 2px 8px rgba(13,122,107,0.25)',
                    }}
                  >
                    {sending ? 'Sending…' : 'Send to Exam Cell'}
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* Saved Panels Section */}
            <section ref={archiveRef} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                    Submitted & Saved Panels
                  </h2>
                  <p className="text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-0.5">
                    Showing {filteredPanels.length} of {panels.length} panel{panels.length !== 1 ? 's' : ''} in the current examination cycle.
                  </p>
                </div>
                {panels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ExportAllDropdown
                      panels={selectedSemesterFilter === 'all' ? panels : filteredPanels}
                      label={selectedSemesterFilter !== 'all' ? `Export Sem ${selectedSemesterFilter}` : undefined}
                    />
                    {semesterGroups.map((g) => (
                      <SemesterDownloadMenu key={g.key} group={g} />
                    ))}
                  </div>
                )}
              </div>

              {/* HOD Filter Bar */}
              {panels.length > 0 && renderFilterBar()}

              {isLoading ? (
                <div className="p-8 text-center text-[12px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820] rounded-[14px] border border-[#d0d7de] dark:border-[#1c2d3d]">
                  Loading panels…
                </div>
              ) : panels.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820] rounded-[14px] border border-[#d0d7de] dark:border-[#1c2d3d]">
                  No panels created yet. Fill out the official form above to create your first panel.
                </div>
              ) : filteredPanels.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820] rounded-[14px] border border-[#d0d7de] dark:border-[#1c2d3d] space-y-2">
                  <p>No panels match the selected semester, programme, or search criteria.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSemesterFilter('all');
                      setSelectedProgrammeFilter('all');
                      setSelectedStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs"
                  >
                    Reset All Filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPanels.map((panel) => (
                    <OfficialPanelCard
                      key={panel.id}
                      panel={panel}
                      isHod={true}
                      isExpanded={viewPanelId === panel.id}
                      onToggleExpand={() => setViewPanelId((curr) => (curr === panel.id ? null : panel.id))}
                      onEdit={() => loadForEdit(panel.id)}
                      onSend={() => sendToExamCell(panel)}
                      onDelete={() => deletePanel(panel.id)}
                      onDownloadPdf={() => exportPanelPdf(panel)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

function SemesterDownloadMenu({
  group,
}: {
  group: { key: string; label: string; panels: ExaminerPanel[] };
}) {
  const sample = group.panels[0];
  const sheetName = sample
    ? formatSemesterSheetName(sample.semester, sample.programme)
    : 'Semester - X';

  const cleanLabel = group.label.replace(/[^a-z0-9]+/gi, '-');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[11.5px] font-medium flex items-center gap-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#16202c] shadow-xs"
        >
          <FileDown className="w-3.5 h-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
          <span>Whole Semester: {group.label} ({group.panels.length})</span>
          <ChevronDown className="w-3 h-3 text-[#64748b] ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-[#101820] border border-[#d0d7de] dark:border-[#2a3847] shadow-xl rounded-xl p-1.5 z-50">
        <DropdownMenuLabel className="text-[11px] font-semibold text-[#64748b] dark:text-[#889cb0] px-2.5 py-1">
          {group.label} ({group.panels.length} panel{group.panels.length !== 1 ? 's' : ''})
        </DropdownMenuLabel>
        
        {/* Primary PDF: All Panels on 1 Single Page */}
        <DropdownMenuItem
          onClick={() => exportCombinedSemesterPdf(group.panels, `panels-${cleanLabel}-single-page.pdf`)}
          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#fff1f2] dark:hover:bg-[rgba(244,63,94,0.08)] focus:bg-[#fff1f2] dark:focus:bg-[rgba(244,63,94,0.08)]"
        >
          <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4] flex items-center gap-1.5">
              <span>Download PDF (All in 1 Page)</span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold tracking-wide">
                1 PAGE
              </span>
            </div>
            <div className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
              All {group.panels.length} course{group.panels.length !== 1 ? 's' : ''} on a single printed landscape page with 3 signatures
            </div>
          </div>
        </DropdownMenuItem>

        {/* Secondary PDF: 1 Page Per Panel */}
        {group.panels.length > 1 && (
          <DropdownMenuItem
            onClick={() => exportPanelsPdf(group.panels, `panels-${cleanLabel}-per-subject.pdf`)}
            className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-[#1c2d3d] focus:bg-[#f1f5f9] dark:focus:bg-[#1c2d3d]"
          >
            <div className="p-1.5 rounded-md bg-rose-50/60 dark:bg-rose-950/20 text-rose-500 mt-0.5 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
                Download PDF (1 Page per Subject)
              </div>
              <div className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
                {group.panels.length} pages · strictly 1 page each with signatures
              </div>
            </div>
          </DropdownMenuItem>
        )}

        {/* Excel Option */}
        <DropdownMenuItem
          onClick={() => exportPanelsExcel(group.panels, `panels-${cleanLabel}.xlsx`, 'by_semester')}
          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#f0fdf4] dark:hover:bg-[rgba(74,222,128,0.08)] focus:bg-[#f0fdf4] dark:focus:bg-[rgba(74,222,128,0.08)]"
        >
          <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4] flex items-center gap-1.5">
              <span>Download Excel (.xlsx)</span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold tracking-wide">
                Fit 1 Page
              </span>
            </div>
            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-mono">
              Sheet: {sheetName} (Borders & Print-Scaled)
            </div>
          </div>
        </DropdownMenuItem>

        {group.panels.length > 1 && (
          <DropdownMenuItem
            onClick={() => exportPanelsExcel(group.panels, `panels-${cleanLabel}-by-course.xlsx`, 'by_subject')}
            className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#f0fdf4] dark:hover:bg-[rgba(74,222,128,0.08)] focus:bg-[#f0fdf4] dark:focus:bg-[rgba(74,222,128,0.08)]"
          >
            <div className="p-1.5 rounded-md bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
                Excel (Separate Sheet per Subject)
              </div>
              <div className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
                {group.panels.length} sheets · each scaled to 1 printed page
              </div>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportAllDropdown({ panels, label }: { panels: ExaminerPanel[]; label?: string }) {
  if (panels.length === 0) return null;

  const buttonText = label ? `${label} (${panels.length} Course${panels.length !== 1 ? 's' : ''})` : `Export All (${panels.length} Courses)`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg border-[var(--accent-color,#0d7a6b)] dark:border-[#2dd4bf] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] bg-white dark:bg-[#101820] text-[11.5px] font-medium flex items-center gap-1.5 hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)] shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{buttonText}</span>
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 bg-white dark:bg-[#101820] border border-[#d0d7de] dark:border-[#2a3847] shadow-xl rounded-xl p-1.5 z-50">
        <DropdownMenuLabel className="text-[11px] font-semibold text-[#64748b] dark:text-[#889cb0] px-2.5 py-1">
          Master Export ({panels.length} course{panels.length !== 1 ? 's' : ''})
        </DropdownMenuLabel>

        {/* 1. Master PDF: 1 Page Per Semester */}
        <DropdownMenuItem
          onClick={() => exportAllCombinedSemestersPdf(panels, 'all-semesters-examiner-panels-master.pdf')}
          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#fff1f2] dark:hover:bg-[rgba(244,63,94,0.08)] focus:bg-[#fff1f2] dark:focus:bg-[rgba(244,63,94,0.08)]"
        >
          <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4] flex items-center gap-1.5">
              <span>Combined Master PDF (1 Page/Semester)</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold tracking-wide">
                RECOMMENDED
              </span>
            </div>
            <div className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
              Consolidates each semester onto a single landscape page with official signatures into 1 master PDF
            </div>
          </div>
        </DropdownMenuItem>

        {/* 2. Master PDF: 1 Page Per Subject */}
        <DropdownMenuItem
          onClick={() => exportPanelsPdf(panels, 'all-semesters-all-subjects.pdf')}
          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-[#1c2d3d] focus:bg-[#f1f5f9] dark:focus:bg-[#1c2d3d]"
        >
          <div className="p-1.5 rounded-md bg-rose-50/60 dark:bg-rose-950/20 text-rose-500 mt-0.5 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
              Combined Master PDF (1 Page/Subject)
            </div>
            <div className="text-[10.5px] text-[#64748b] dark:text-[#889cb0]">
              {panels.length} pages · single document with full signatures after every subject
            </div>
          </div>
        </DropdownMenuItem>

        {/* 3. Excel */}
        <DropdownMenuItem
          onClick={() => exportPanelsExcel(panels, 'all-semesters-examiner-panels.xlsx', 'by_semester')}
          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[#f0fdf4] dark:hover:bg-[rgba(74,222,128,0.08)] focus:bg-[#f0fdf4] dark:focus:bg-[rgba(74,222,128,0.08)]"
        >
          <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#18202e] dark:text-[#e2eaf4]">
              Export All to Excel (.xlsx)
            </div>
            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400">
              Each semester in its own sheet: Semester - X B.Tech/M.tech
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Visual Card Rendering Saved Panels in the Official Layout
function OfficialPanelCard({
  panel,
  isHod,
  isExpanded = true,
  onToggleExpand,
  onEdit,
  onSend,
  onDelete,
  onDownloadPdf,
  onDownloadExcel,
}: {
  panel: ExaminerPanel;
  isHod: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onDelete?: () => void;
  onDownloadPdf: () => void;
  onDownloadExcel?: () => void;
}) {
  const rowCount = Math.max(5, panel.members.length);
  const displayMembers = Array.from({ length: rowCount }, (_, i) => {
    return panel.members[i] || emptyMember(i + 1);
  });

  return (
    <div className="rounded-[12px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] shadow-sm overflow-hidden transition-all">
      {/* Panel Card Header Strip */}
      <div className="px-4 py-3 bg-[#f8fafc] dark:bg-[#0d1520] border-b border-[#e2e8f0] dark:border-[#1e2a38] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="text-[#64748b] dark:text-[#889cb0] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13px] text-[#1c2430] dark:text-[#e6edf3]">
                {panel.course_title || 'Untitled Course'}
              </span>
              {panel.course_code && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#e2e8f0] dark:bg-[#1e2a38] text-[#475569] dark:text-[#94a3b8]">
                  {panel.course_code}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748b] dark:text-[#889cb0]">
              {[
                panel.programme,
                panel.semester && `Sem ${panel.semester}`,
                panel.batch && `Batch ${panel.batch}`,
                panel.session_label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={panel.status === 'sent' ? 'default' : 'secondary'}
            className="text-[10px] font-mono uppercase tracking-wide"
          >
            {panel.status === 'sent' ? 'Sent to Exam Cell' : 'Draft'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadPdf}
            className="h-7 text-[11px] border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820]"
            title="Download PDF"
          >
            <FileDown className="w-3.5 h-3.5 mr-1 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadExcel || (() => exportPanelExcel(panel))}
            className="h-7 text-[11px] border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#166534] dark:text-[#4ade80] hover:bg-[#f0fdf4] dark:hover:bg-[rgba(74,222,128,0.08)]"
            title="Download Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
            Excel
          </Button>
          {isHod && onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="h-7 text-[11px] border-[#d0d7de] dark:border-[#2a3847]"
            >
              Edit
            </Button>
          )}
          {isHod && onSend && panel.status !== 'sent' && (
            <Button
              size="sm"
              onClick={onSend}
              className="h-7 text-[11px] text-white"
              style={{ background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)' }}
            >
              <Send className="w-3 h-3 mr-1" /> Send
            </Button>
          )}
          {isHod && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-7 text-[11px] text-[#9f1239] dark:text-[#fb7185] hover:bg-[#fef2f5] dark:hover:bg-[rgba(251,113,133,0.08)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Official Format Preview */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Metadata Grid */}
          <div className="border border-[#d0d7de] dark:border-[#2a3847] rounded-lg bg-[#fafbfc] dark:bg-[#0c131d] p-3.5 text-[11.5px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Name of the Department offering the courses:{' '}
                </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.department_label || '—'}</span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">School: </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.school || '—'}</span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">Session: </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.session_label || '—'}</span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">Programme: </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.programme || '—'}</span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">Semester: </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.semester || '—'}</span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3]">Batch: </span>
                <span className="text-[#475569] dark:text-[#94a3b8]">{panel.batch || '—'}</span>
              </div>
            </div>
          </div>

          {/* Unified Table */}
          <div className="overflow-x-auto rounded-lg border border-[#d0d7de] dark:border-[#2a3847]">
            <table
              className="border-collapse text-[11.5px]"
              style={{ minWidth: '1850px', width: '100%', tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '250px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '480px' }} />
                <col style={{ width: '365px' }} />
              </colgroup>
              <thead>
                <tr className="bg-[#f0f4f8] dark:bg-[#131e2b] border-b border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3]">
                  <th
                    colSpan={6}
                    className="px-3 py-2 text-center font-bold text-[12px] border-r border-[#d0d7de] dark:border-[#2a3847]"
                  >
                    Details of the course(s) for which panel is submitted
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 py-1 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]"
                  >
                    S.<br />No.
                  </th>
                  <th
                    rowSpan={2}
                    className="px-3 py-1 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]"
                  >
                    <div>Particulars of the Experts in order of Preference</div>
                    <div className="text-[10px] font-normal text-[#64748b] dark:text-[#889cb0] italic leading-tight">
                      (Name/Designation/Department)
                    </div>
                  </th>
                  <th rowSpan={2} className="w-[260px] px-3 py-1 text-center font-bold">
                    <div>Contact Details</div>
                    <div className="text-[10px] font-normal text-[#64748b] dark:text-[#889cb0] italic leading-tight">
                      (Email ID/Mobile No.)
                    </div>
                  </th>
                </tr>
                <tr className="bg-[#f8fafc] dark:bg-[#182332] border-b border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3]">
                  <th className="px-3 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Course Title
                  </th>
                  <th className="px-2 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Course Code
                  </th>
                  <th className="px-1 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Credits
                  </th>
                  <th className="px-2.5 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Nature of Course
                  </th>
                  <th className="px-2.5 py-2 text-left font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Programme(s)
                  </th>
                  <th className="px-2 py-2 text-center font-bold border-r border-[#d0d7de] dark:border-[#2a3847]">
                    Whether Regular/Backlog
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayMembers.map((member, index) => {
                  const particulars = [
                    member.name,
                    member.designation,
                    member.specialization || panel.department_label,
                  ]
                    .filter(Boolean)
                    .join(' / ');

                  return (
                    <tr
                      key={index}
                      className="border-b border-[#e2e8f0] dark:border-[#1e2a38] hover:bg-[#fafbfc] dark:hover:bg-[#111923]"
                    >
                      {index === 0 && (
                        <>
                          <td
                            rowSpan={rowCount}
                            className="p-2.5 align-middle border-r border-[#d0d7de] dark:border-[#2a3847] font-semibold text-[#1c2430] dark:text-[#e6edf3]"
                          >
                            {panel.course_title || '—'}
                          </td>
                          <td
                            rowSpan={rowCount}
                            className="p-2 align-middle text-center font-mono border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            {panel.course_code || '—'}
                          </td>
                          <td
                            rowSpan={rowCount}
                            className="p-2 align-middle text-center border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            {panel.credits || '—'}
                          </td>
                          <td
                            rowSpan={rowCount}
                            className="p-2 align-middle border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            {panel.course_nature || '—'}
                          </td>
                          <td
                            rowSpan={rowCount}
                            className="p-2 align-middle border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            {panel.programme || '—'}
                          </td>
                          <td
                            rowSpan={rowCount}
                            className="p-2 align-middle text-center border-r border-[#d0d7de] dark:border-[#2a3847]"
                          >
                            {panel.regular_backlog || '—'}
                          </td>
                        </>
                      )}
                      <td className="p-1.5 text-center font-mono text-[#64748b] dark:text-[#889cb0] border-r border-[#d0d7de] dark:border-[#2a3847]">
                        {index + 1}
                      </td>
                      <td className="p-2 border-r border-[#d0d7de] dark:border-[#2a3847]">
                        {particulars ? (
                          <span className="font-medium text-[#1c2430] dark:text-[#e6edf3]">{particulars}</span>
                        ) : (
                          <span className="text-[#94a3b8] dark:text-[#475569] italic">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        {member.contact_details ? (
                          <span className="text-[#334155] dark:text-[#cbd5e1]">{member.contact_details}</span>
                        ) : (
                          <span className="text-[#94a3b8] dark:text-[#475569] italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Certificate Block */}
          <div className="border border-[#d0d7de] dark:border-[#2a3847] rounded-md bg-[#fafbfc] dark:bg-[#0c131d] p-3 text-[11px]">
            <p className="font-bold text-center text-[#1c2430] dark:text-[#e6edf3] mb-1">
              Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)
            </p>
            <p className="text-[10.5px] text-[#4b5563] dark:text-[#8fa1b5] text-center max-w-[800px] mx-auto leading-relaxed mb-3">
              Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal
              Address and Specialization are correct/operational. Further, under normal settings, the Examiners as
              stated above shall readily accept any confidential assignment.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#e2e8f0] dark:border-[#1e2a38] text-[11px]">
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3] block sm:inline">
                  (Signature of Teacher In-charge):{' '}
                </span>
                <span className="text-[#334155] dark:text-[#cbd5e1] font-medium">
                  {panel.teacher_incharge_name || '________________'}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3] block sm:inline">
                  (Signature of Head/Co-ordinator):{' '}
                </span>
                <span className="text-[#334155] dark:text-[#cbd5e1] font-medium">
                  {panel.head_name || '________________'}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#1c2430] dark:text-[#e6edf3] block sm:inline">
                  (Signature of the Dean of School):{' '}
                </span>
                <span className="text-[#334155] dark:text-[#cbd5e1] font-medium">
                  {panel.dean_name || '________________'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
