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
import { downloadPanelTemplate, parsePanelWorkbook, exportPanelPdf, exportPanelsPdf } from '@/lib/panelExport';
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
import { toast } from 'sonner';
import {
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  FileDown,
  UserPlus,
  GripVertical,
  ChevronDown,
  Check,
  Download,
} from 'lucide-react';

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
  head_name: '',
  dean_name: '',
  notes: '',
};

const FIELD_LABEL = 'mb-1.5 text-[#a0aec0] dark:text-[#3d5166] text-[9.5px] font-bold tracking-[0.09em] uppercase';
const FIELD_BOX =
  'w-full h-[38px] rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] text-[12px] outline-none';

/* ── Read-only academic field (School / Department) ── */
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={FIELD_LABEL}>{label}</p>
      <div
        className={`${FIELD_BOX} px-[11px] flex items-center bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4]`}
      >
        <span className="min-w-0 truncate">{value}</span>
      </div>
    </div>
  );
}

/* ── Select academic field (Session / Programme / Semester / Course) ── */
function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={FIELD_LABEL}>{label}</p>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_BOX} pl-[11px] pr-8 appearance-none bg-white dark:bg-[#101820] text-[#18202e] dark:text-[#e2eaf4] text-left cursor-pointer disabled:opacity-50 truncate`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[#a0aec0] dark:text-[#3d5166] pointer-events-none leading-none">
          <ChevronDown className="h-[11px] w-[11px]" />
        </span>
      </div>
    </div>
  );
}

/* ── Editable academic field (Head / Dean) ── */
function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="min-w-0">
      <p className={FIELD_LABEL}>{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${FIELD_BOX} px-[11px] bg-white dark:bg-[#101820] text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166]`}
      />
    </div>
  );
}

/* ── Small editable cell inside the examiners table ── */
function PanelInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full h-[34px] px-[9px] rounded-[7px] border border-[#e8e2da] dark:border-[#1c2d3d] outline-none bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] text-[11.5px] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus:border-[#0d7a6b] dark:focus:border-[#2dd4bf]"
    />
  );
}

export default function ExaminerPanels() {
  const { profile, user } = useAuth();
  const { panels, isLoading, savePanel, sendToExamCell, deletePanel } = useExaminerPanels();
  const isHod = profile?.role === 'hod';

  const [header, setHeader] = useState<PanelHeaderInput>(emptyHeader);
  const [members, setMembers] = useState<PanelMember[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [pool, setPool] = useState<PoolTeacher[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const reorderMembers = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setMembers((rows) => {
      if (from >= rows.length || to >= rows.length) return rows;
      const next = [...rows];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

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

      setPool([...dbPool, ...defaultsToAdd]);
    } catch (e) {
      console.warn('Using default teacher list:', e);
      setPool(
        DEFAULT_TEACHER_POOL.map((dt, idx) => ({
          id: `default-${idx}`,
          name: dt.name,
          designation: dt.designation,
          specialization: dt.specialization,
          postal_address: dt.postal_address,
          contact_details: dt.contact_details,
          status: dt.status || null,
        }))
      );
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

  const semesterGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; panels: ExaminerPanel[] }>();
    panels.forEach((p) => {
      if (!p.semester) return;
      const key = `${p.session_label}|${p.programme}|${p.semester}`;
      const label = [p.programme, `Sem ${p.semester}`, p.session_label].filter(Boolean).join(' · ');
      if (!map.has(key)) map.set(key, { key, label, panels: [] });
      map.get(key)!.panels.push(p);
    });
    return [...map.values()];
  }, [panels]);

  const addFromPool = (t: PoolTeacher) => {
    if (members.some((m) => m.name.trim().toLowerCase() === t.name.trim().toLowerCase())) return;
    const row: PanelMember = {
      position: members.length + 1,
      name: t.name,
      designation: t.designation || '',
      specialization: t.specialization || '',
      postal_address: t.postal_address || '',
      contact_details: t.contact_details || '',
      status: t.status || '',
    };
    setMembers((rows) => {
      const blank = rows.findIndex((r) => !r.name.trim());
      const next = blank >= 0 ? rows.map((r, i) => (i === blank ? row : r)) : [...rows, row];
      return next.map((r, i) => ({ ...r, position: i + 1 }));
    });
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

  const resetForm = () => {
    setHeader((h) => ({ ...emptyHeader, session_label: h.session_label, programme: h.programme, semester: h.semester, head_name: h.head_name, dean_name: h.dean_name }));
    setMembers([]);
    setEditingId(undefined);
  };

  const handleUpload = async (file: File) => {
    try {
      const parsed = await parsePanelWorkbook(file);
      if (parsed.length === 0) {
        toast.error('No examiner rows found in that file');
        return;
      }
      setMembers(parsed);
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
        const clean = members.filter((m) => m.name.trim()).map((m, i) => ({ ...m, position: i + 1 }));
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
          status: 'draft',
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
      head_name: panel.head_name || '',
      dean_name: panel.dean_name || '',
      notes: panel.notes || '',
    });
    setMembers(panel.members.length ? panel.members : [1, 2, 3, 4].map(emptyMember));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadSemester = () => {
    const group = semesterGroups[0];
    if (!group) {
      toast.info('No panels yet to export');
      return;
    }
    exportPanelsPdf(group.panels, `panels-${group.label.replace(/[^a-z0-9]+/gi, '-')}.pdf`);
  };

  const externalCount = useMemo(
    () => members.filter((m) => (m.status || '').trim().toLowerCase() === 'external').length,
    [members]
  );

  const recentPanels = useMemo(() => panels.slice(0, 2), [panels]);

  if (!isHod) {
    return (
      <DashboardLayout>
        <div className="-m-4 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)]">
          <main className="px-4 sm:px-10 pt-[34px] pb-16">
            <div className="w-full max-w-[1280px] mx-auto">
              <p className="mb-[7px] text-[#a0aec0] dark:text-[#3d5166] text-[10.5px] font-semibold tracking-[0.09em] uppercase">
                Confidential · Examination cycle 2025
              </p>
              <h1 className="m-0 font-serif italic font-light text-[32px] sm:text-[43px] leading-[1.1] tracking-[-0.025em]">
                Panel of <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Examiners</em>
              </h1>
              <p className="mt-[10px] text-[12.5px] text-[#64748b] dark:text-[#6b8299]">
                Confidential examiner panels sent by heads of departments.
              </p>
              <div className="mt-6 space-y-3">
                {isLoading ? (
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">Loading…</p>
                ) : panels.length === 0 ? (
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No panels yet.</p>
                ) : (
                  panels.map((panel) => (
                    <div
                      key={panel.id}
                      className="p-4 rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                    >
                      <p className="font-semibold text-[13px]">
                        {panel.course_title || 'Untitled course'}{' '}
                        {panel.course_code && (
                          <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
                            ({panel.course_code})
                          </span>
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] text-[12px]"
                        onClick={() => exportPanelPdf(panel)}
                      >
                        <FileDown className="w-4 h-4 mr-2" /> Download PDF
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="-m-4 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)] overflow-x-hidden">
        <main className="w-full px-4 sm:px-10 pt-[34px] pb-16">
          <div className="w-full max-w-[1280px] mx-auto">
            {/* Hero */}
            <div className="mb-[26px] flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <p className="mb-[7px] text-[#a0aec0] dark:text-[#3d5166] text-[10.5px] font-semibold tracking-[0.09em] uppercase">
                  Confidential · Examination cycle 2025
                </p>
                <h1 className="m-0 font-serif italic font-light text-[32px] sm:text-[43px] leading-[1.1] tracking-[-0.025em]">
                  Panel of <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Examiners</em>
                </h1>
                <p className="mt-[10px] text-[12.5px] text-[#64748b] dark:text-[#6b8299]">
                  Create the confidential panel and send it securely to the Exam Cell.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={downloadPanelTemplate}
                  className="h-9 px-[13px] flex items-center gap-[7px] rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium hover:opacity-90"
                >
                  <Download className="h-3 w-3" /> Excel template
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-9 px-[13px] flex items-center gap-[7px] rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium hover:opacity-90"
                >
                  <Upload className="h-3 w-3" /> Bulk upload
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

            {/* New panel card */}
            <section className="w-full rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden">
              <div className="px-[18px] py-4 flex items-center justify-between gap-4 border-b border-[#e8e2da] dark:border-[#1c2d3d]">
                <div>
                  <p className="text-[13px] font-semibold">{editingId ? 'Edit panel' : 'New panel'}</p>
                  <p className="mt-[3px] text-[10.5px] text-[#a0aec0] dark:text-[#3d5166]">
                    Complete the academic details, then compose the examiner list.
                  </p>
                </div>
                <div className="flex gap-[7px] shrink-0">
                  <span className="px-2 py-[3px] rounded-full bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf] font-mono text-[9.5px]">
                    {members.length} members
                  </span>
                  <span className="px-2 py-[3px] rounded-full bg-[#f5f3ff] dark:bg-[rgba(167,139,250,0.08)] text-[#5b21b6] dark:text-[#a78bfa] font-mono text-[9.5px]">
                    {externalCount} external
                  </span>
                </div>
              </div>

              <div className="p-[18px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[13px]">
                  <ReadonlyField label="School" value={header.school || IT_SCHOOL} />
                  <ReadonlyField label="Department" value={header.department_label || IT_DEPARTMENT} />
                  <FieldSelect
                    label="Session"
                    value={header.session_label}
                    placeholder="Choose session"
                    onChange={(v) =>
                      setHeader((h) => ({ ...h, session_label: v, programme: '', semester: '', course_code: '', course_title: '' }))
                    }
                    options={SESSION_OPTIONS.map((s) => ({ value: s, label: s }))}
                  />
                  <FieldSelect
                    label="Programme"
                    value={header.programme}
                    placeholder="Choose programme"
                    disabled={!header.session_label}
                    onChange={(v) => setHeader((h) => ({ ...h, programme: v, semester: '', course_code: '', course_title: '' }))}
                    options={IT_PROGRAMMES.map((p) => ({ value: p.name, label: p.name }))}
                  />
                  {programme?.manual ? (
                    <>
                      <FieldInput label="Semester" value={header.semester} placeholder="Semester" onChange={(v) => setField('semester', v)} />
                      <FieldInput label="Course" value={header.course_title} placeholder="Course title" onChange={(v) => setField('course_title', v)} />
                    </>
                  ) : (
                    <>
                      <FieldSelect
                        label="Semester"
                        value={header.semester}
                        placeholder="Choose semester"
                        disabled={!programme}
                        onChange={(v) => setHeader((h) => ({ ...h, semester: v, course_code: '', course_title: '' }))}
                        options={semesterInfo.map((s) => ({
                          value: s.label,
                          label: `${s.label}${s.complete ? ' (done)' : !s.unlocked ? ' (locked)' : ''}`,
                          disabled: !s.unlocked,
                        }))}
                      />
                      <FieldSelect
                        label="Course"
                        value={courseKey(header.course_code, header.course_title)}
                        placeholder={header.semester && remainingCourses.length === 0 ? 'All courses done' : 'Choose course'}
                        disabled={!header.semester}
                        onChange={(v) => {
                          const found = remainingCourses.find((x) => courseKey(x.code, x.title) === v);
                          setHeader((h) => ({ ...h, course_code: found?.code || '', course_title: found?.title || '' }));
                        }}
                        options={remainingCourses.map((x) => ({
                          value: courseKey(x.code, x.title),
                          label: `${x.code ? `${x.code} · ` : ''}${x.title}`,
                        }))}
                      />
                    </>
                  )}
                  <FieldInput label="Head / Co-ordinator" value={header.head_name} placeholder="Head / Co-ordinator" onChange={(v) => setField('head_name', v)} />
                  <FieldInput label="Dean of School" value={header.dean_name} placeholder="Dean of School" onChange={(v) => setField('dean_name', v)} />
                </div>

                <div className="h-px my-5 bg-[#e8e2da] dark:bg-[#1c2d3d]" />

                {/* Teacher pills */}
                <div className="mb-[18px]">
                  <div className="mb-[9px]">
                    <p className="text-[12px] font-semibold">Add from your teacher list</p>
                    <p className="mt-0.5 text-[10.5px] text-[#a0aec0] dark:text-[#3d5166]">
                      Select a teacher to append them to the panel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-[7px]">
                    {pool.length === 0 && (
                      <p className="text-[11.5px] text-[#a0aec0] dark:text-[#3d5166]">No saved teachers yet.</p>
                    )}
                    {pool.map((teacher) => {
                      const added = members.some(
                        (member) => member.name.trim().toLowerCase() === teacher.name.trim().toLowerCase()
                      );
                      return (
                        <button
                          key={teacher.id}
                          onClick={() => addFromPool(teacher)}
                          disabled={added}
                          className={`h-[31px] px-[10px] flex items-center gap-1.5 rounded-[8px] border text-[10.8px] ${
                            added
                              ? 'border-[rgba(13,122,107,0.25)] dark:border-[rgba(45,212,191,0.25)] bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)] text-[#0d7a6b] dark:text-[#2dd4bf] opacity-70 cursor-default'
                              : 'border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] hover:border-[#0d7a6b] dark:hover:border-[#2dd4bf] cursor-pointer'
                          }`}
                        >
                          {added ? <Check className="h-[10px] w-[10px]" /> : <Plus className="h-[10px] w-[10px]" />}
                          {teacher.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Examiners table */}
                <div className="mb-[9px] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold">Examiners</p>
                    <p className="mt-0.5 text-[10.5px] text-[#a0aec0] dark:text-[#3d5166]">
                      Every field is editable. Drag the grip or use the arrows to reorder.
                    </p>
                  </div>
                  <button
                    onClick={() => setMembers((m) => [...m, emptyMember(m.length + 1)])}
                    className="h-8 px-[11px] flex items-center gap-1.5 shrink-0 rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#0d7a6b] dark:text-[#2dd4bf] text-[11px] font-medium hover:opacity-90"
                  >
                    <Plus className="h-[11px] w-[11px]" /> Add row
                  </button>
                </div>

                <div className="w-full overflow-x-auto rounded-[11px] border border-[#e8e2da] dark:border-[#1c2d3d]">
                  <table className="w-full min-w-[1120px] border-collapse table-fixed">
                    <thead className="bg-[#f7f4ef] dark:bg-[#0a1019]">
                      <tr>
                        {(
                          [
                            ['Order', 76, 'center'],
                            ['#', 38, 'center'],
                            ['Name', 170, 'left'],
                            ['Designation', 145, 'left'],
                            ['Specialization', 145, 'left'],
                            ['Postal address', 210, 'left'],
                            ['Contact details', 205, 'left'],
                            ['Status', 105, 'left'],
                            ['', 70, 'right'],
                          ] as [string, number, 'center' | 'left' | 'right'][]
                        ).map(([label, width, align], i) => (
                          <th
                            key={i}
                            style={{ width }}
                            className={`px-[7px] py-[9px] text-[9px] font-bold tracking-[0.08em] uppercase text-[#a0aec0] dark:text-[#3d5166] ${
                              align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, index) => (
                        <tr
                          key={member.id ? `${member.id}-${index}` : `row-${index}`}
                          draggable
                          onDragStart={(e) => {
                            setDragIdx(index);
                            e.dataTransfer.effectAllowed = 'move';
                            try {
                              e.dataTransfer.setData('text/plain', String(index));
                            } catch {
                              /* noop */
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverIdx !== index) setDragOverIdx(index);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData('text/plain');
                            const from = dragIdx ?? (raw ? Number(raw) : NaN);
                            if (!Number.isNaN(from)) reorderMembers(from, index);
                            setDragIdx(null);
                            setDragOverIdx(null);
                          }}
                          onDragEnd={() => {
                            setDragIdx(null);
                            setDragOverIdx(null);
                          }}
                          className={`border-t border-[#f0ece6] dark:border-[#172130] transition-colors ${
                            dragIdx === index ? 'opacity-50' : ''
                          } ${
                            dragOverIdx === index && dragIdx !== index
                              ? 'bg-[#eaf6f4] dark:bg-[rgba(45,212,191,0.08)]'
                              : 'bg-white dark:bg-[#101820]'
                          }`}
                        >
                          <td className="px-[5px] py-1.5">
                            <div className="flex items-center justify-center gap-[1px]">
                              <span className="text-[#a0aec0] dark:text-[#3d5166] leading-none cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-3 w-3" strokeWidth={2.4} />
                              </span>
                              <button
                                onClick={() => moveMember(index, -1)}
                                disabled={index === 0}
                                title="Move up"
                                className="w-[22px] h-[26px] rotate-180 text-[#a0aec0] dark:text-[#3d5166] disabled:opacity-30 enabled:hover:text-[#18202e] dark:enabled:hover:text-[#e2eaf4] leading-none"
                              >
                                <ChevronDown className="h-[10px] w-[10px] mx-auto" />
                              </button>
                              <button
                                onClick={() => moveMember(index, 1)}
                                disabled={index === members.length - 1}
                                title="Move down"
                                className="w-[22px] h-[26px] text-[#a0aec0] dark:text-[#3d5166] disabled:opacity-30 enabled:hover:text-[#18202e] dark:enabled:hover:text-[#e2eaf4] leading-none"
                              >
                                <ChevronDown className="h-[10px] w-[10px] mx-auto" />
                              </button>
                            </div>
                          </td>
                          <td className="font-mono text-[10px] text-[#a0aec0] dark:text-[#3d5166] text-center">
                            {index + 1}
                          </td>
                          {(
                            [
                              ['name', 'Full name'],
                              ['designation', 'Designation'],
                              ['specialization', 'Specialization'],
                              ['postal_address', 'Full postal address'],
                              ['contact_details', 'Email and phone'],
                              ['status', 'Status'],
                            ] as [keyof PanelMember, string][]
                          ).map(([key, placeholder]) => (
                            <td key={key} className="px-1 py-1.5">
                              <PanelInput
                                label={`${index + 1} ${key}`}
                                value={String(member[key] ?? '')}
                                placeholder={placeholder}
                                onChange={(value) => updateMember(index, key, value)}
                              />
                            </td>
                          ))}
                          <td className="px-[5px] py-1.5 text-right">
                            <div className="inline-flex items-center">
                              <button
                                onClick={() => saveToPool(member)}
                                title="Save teacher to list"
                                className="w-[30px] h-[30px] inline-flex items-center justify-center rounded-[7px] text-[#64748b] dark:text-[#6b8299] hover:text-[#0d7a6b] dark:hover:text-[#2dd4bf] hover:bg-[#eaf6f4] dark:hover:bg-[rgba(45,212,191,0.08)]"
                              >
                                <UserPlus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() =>
                                  setMembers((current) =>
                                    current.filter((_, i) => i !== index).map((r, i) => ({ ...r, position: i + 1 }))
                                  )
                                }
                                title="Remove examiner"
                                className="w-[30px] h-[30px] inline-flex items-center justify-center rounded-[7px] text-[#9f1239] dark:text-[#fb7185] hover:bg-[#fef2f5] dark:hover:bg-[rgba(251,113,133,0.08)]"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {members.length === 0 && (
                    <p className="px-5 py-[52px] text-center text-[12.5px] text-[#a0aec0] dark:text-[#3d5166] bg-white dark:bg-[#101820]">
                      Choose teachers from the list above to begin.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-[18px]">
                  <p className="mb-1.5 text-[#a0aec0] dark:text-[#3d5166] text-[9.5px] font-bold tracking-[0.09em] uppercase">
                    Notes for the examination cell
                  </p>
                  <textarea
                    value={header.notes}
                    onChange={(event) => setField('notes', event.target.value)}
                    placeholder="Optional instructions or context…"
                    rows={3}
                    className="w-full p-[10px_11px] resize-y rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] outline-none bg-[#f7f4ef] dark:bg-[#0c1118] text-[11.5px] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus:border-[#0d7a6b] dark:focus:border-[#2dd4bf]"
                  />
                </div>

                <div className="mt-[14px] flex flex-wrap gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || sending}
                    className="h-[35px] px-[14px] rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium disabled:opacity-60 hover:opacity-90 inline-flex items-center gap-[7px]"
                  >
                    <Save className="h-3 w-3" /> {saving ? 'Saving…' : editingId ? 'Update draft' : 'Save draft'}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      className="h-[35px] px-[14px] rounded-[8px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[#64748b] dark:text-[#6b8299] text-[11.5px] font-medium"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSendCurrent}
                    disabled={saving || sending}
                    className="h-[35px] px-[15px] flex items-center gap-[7px] rounded-[8px] text-white text-[11.5px] font-semibold disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)',
                      boxShadow: '0 2px 8px rgba(13,122,107,0.25)',
                    }}
                  >
                    {sending ? 'Sending…' : 'Send to Exam Cell'} <Send className="h-[11px] w-[11px]" />
                  </button>
                </div>
              </div>
            </section>

            {/* Your panels */}
            <section className="mt-7">
              <div className="mb-[11px] flex items-end justify-between">
                <div>
                  <p className="text-[13px] font-semibold">Your panels</p>
                  <p className="mt-[3px] text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
                    {panels.length} panel{panels.length !== 1 ? 's' : ''} · current examination cycle
                  </p>
                </div>
                <button
                  onClick={handleDownloadSemester}
                  className="text-[#0d7a6b] dark:text-[#2dd4bf] text-[11.5px] hover:opacity-80"
                >
                  Download semester PDF
                </button>
              </div>
              {isLoading ? (
                <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">Loading…</p>
              ) : recentPanels.length === 0 ? (
                <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166]">No panels yet.</p>
              ) : (
                <div className="grid gap-[10px] sm:grid-cols-2">
                  {recentPanels.map((panel) => (
                    <div
                      key={panel.id}
                      className="min-w-0 px-4 py-[15px] rounded-[12px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium">
                            {panel.course_title || 'Untitled course'}
                          </p>
                          <p className="mt-[5px] font-mono text-[10px] text-[#a0aec0] dark:text-[#3d5166]">
                            {panel.course_code || '—'} ·{' '}
                            {[panel.programme, panel.semester && `Semester ${panel.semester}`]
                              .filter(Boolean)
                              .join(' · ')}{' '}
                            · {panel.members.length} examiners
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-[3px] rounded-full text-[9.5px] font-bold tracking-[0.05em] uppercase ${
                            panel.status === 'sent'
                              ? 'bg-[#ecfdf5] dark:bg-[rgba(52,211,153,0.08)] text-[#065f46] dark:text-[#34d399]'
                              : 'bg-[#fef8ee] dark:bg-[rgba(251,191,36,0.08)] text-[#92400e] dark:text-[#fbbf24]'
                          }`}
                        >
                          {panel.status === 'sent' ? 'Sent' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Archive — manage saved panels */}
            <div ref={archiveRef} className="mt-7 space-y-3 scroll-mt-24">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-semibold">All panels</h2>
                  <p className="text-[12px] text-[#a0aec0] dark:text-[#3d5166] mt-0.5">
                    Download, edit or forward saved panels
                  </p>
                </div>
                <span className="font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#ede9e2] dark:bg-[#131c27] text-[#64748b] dark:text-[#6b8299]">
                  {panels.length}
                </span>
              </div>
              {semesterGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {semesterGroups.map((g) => (
                    <Button
                      key={g.key}
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px]"
                      onClick={() => exportPanelsPdf(g.panels, `panels-${g.label.replace(/[^a-z0-9]+/gi, '-')}.pdf`)}
                    >
                      <FileDown className="w-4 h-4 mr-2" /> Whole semester PDF: {g.label} ({g.panels.length})
                    </Button>
                  ))}
                </div>
              )}
              {!isLoading &&
                panels.map((panel) => (
                  <div
                    key={panel.id}
                    className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px]">
                            {panel.course_title || 'Untitled course'}{' '}
                            {panel.course_code && (
                              <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">
                                ({panel.course_code})
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                            {[panel.programme, panel.semester && `Semester ${panel.semester}`, panel.session_label]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                          <p className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166] mt-1">
                            {panel.members.length} examiner{panel.members.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <Badge variant={panel.status === 'sent' ? 'default' : 'secondary'} className="font-mono text-[10px]">
                          {panel.status === 'sent' ? 'Sent to exam cell' : 'Draft'}
                        </Badge>
                      </div>
                      {panel.notes && <p className="text-[13px]">{panel.notes}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] text-[12px]"
                          onClick={() => exportPanelPdf(panel)}
                        >
                          <FileDown className="w-4 h-4 mr-2" /> Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] text-[12px]"
                          onClick={() => loadForEdit(panel.id)}
                        >
                          Edit
                        </Button>
                        {panel.status !== 'sent' && (
                          <Button
                            size="sm"
                            className="rounded-lg text-white text-[12px]"
                            style={{ background: 'linear-gradient(135deg, #0fa88f, #0d7a6b)' }}
                            onClick={() => sendToExamCell(panel)}
                          >
                            <Send className="w-4 h-4 mr-2" /> Send to exam cell
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePanel(panel.id)}
                          className="text-[#9f1239] dark:text-[#fb7185] text-[12px]"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
