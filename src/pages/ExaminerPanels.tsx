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
import { IT_DEPARTMENT, IT_PROGRAMMES, IT_SCHOOL, SESSION_OPTIONS, courseKey } from '@/lib/itCatalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileSpreadsheet, Plus, Save, Send, Trash2, Upload, FileDown, UserPlus } from 'lucide-react';

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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

export default function ExaminerPanels() {
  const { profile, user } = useAuth();
  const { panels, isLoading, savePanel, sendToExamCell, deletePanel } = useExaminerPanels();
  const isHod = profile?.role === 'hod';

  const [header, setHeader] = useState<PanelHeaderInput>(emptyHeader);
  const [members, setMembers] = useState<PanelMember[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [pool, setPool] = useState<PoolTeacher[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPool = async () => {
    const { data } = await supabase.from('panel_examiner_pool').select('*').order('created_at');
    setPool((data as PoolTeacher[]) || []);
  };
  useEffect(() => {
    if (isHod) loadPool();
  }, [isHod]);

  const programme = IT_PROGRAMMES.find((p) => p.name === header.programme);

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
    let prevComplete = true;
    return programme.semesters.map((s) => {
      const complete = s.courses.every((x) => doneKeys.has(`${s.label}|${courseKey(x.code, x.title)}`));
      const unlocked = prevComplete;
      prevComplete = prevComplete && complete;
      return { label: s.label, complete, unlocked };
    });
  }, [programme, doneKeys]);

  const remainingCourses = useMemo(() => {
    const sem = programme?.semesters.find((s) => s.label === header.semester);
    if (!sem) return [];
    return sem.courses.filter((x) => !doneKeys.has(`${sem.label}|${courseKey(x.code, x.title)}`));
  }, [programme, header.semester, doneKeys]);

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
    const row: PanelMember = {
      position: 0,
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

  const setMember = (idx: number, key: keyof PanelMember, value: string) =>
    setMembers((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

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
    setSaving(true);
    const id = await savePanel(header, members, editingId);
    setSaving(false);
    if (id) resetForm();
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

  return (
    <DashboardLayout>
      <div className="space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-bold">Panel of Examiners</h1>
          <p className="text-sm text-muted-foreground">
            {isHod
              ? 'Fill the confidential panel, upload it from Excel, send it to the examination cell or download it as PDF.'
              : 'Confidential examiner panels sent by heads of departments.'}
          </p>
        </div>

        {isHod && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">
                {editingId ? 'Edit panel' : 'New panel'}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={downloadPanelTemplate}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel template
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Bulk upload
                </Button>
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
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 min-w-0">
                  <Label>School</Label>
                  <Input value={IT_SCHOOL} readOnly />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label>Department</Label>
                  <Input value={IT_DEPARTMENT} readOnly />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="session">Session</Label>
                  <select id="session" className={selectCls} value={header.session_label}
                    onChange={(e) => setHeader((h) => ({ ...h, session_label: e.target.value, programme: '', semester: '', course_code: '', course_title: '' }))}>
                    <option value="">Choose session</option>
                    {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="programme">Programme</Label>
                  <select id="programme" className={selectCls} value={header.programme} disabled={!header.session_label}
                    onChange={(e) => setHeader((h) => ({ ...h, programme: e.target.value, semester: '', course_code: '', course_title: '' }))}>
                    <option value="">Choose programme</option>
                    {IT_PROGRAMMES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                {programme?.manual ? (
                  <>
                    {([['semester', 'Semester'], ['course_code', 'Course code'], ['course_title', 'Course title']] as [keyof PanelHeaderInput, string][]).map(([key, label]) => (
                      <div key={key} className="space-y-1.5 min-w-0">
                        <Label htmlFor={key}>{label}</Label>
                        <Input id={key} value={header[key]} onChange={(e) => setField(key, e.target.value)} placeholder={label} />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="semester">Semester</Label>
                      <select id="semester" className={selectCls} value={header.semester} disabled={!programme}
                        onChange={(e) => setHeader((h) => ({ ...h, semester: e.target.value, course_code: '', course_title: '' }))}>
                        <option value="">Choose semester</option>
                        {semesterInfo.map((s) => (
                          <option key={s.label} value={s.label} disabled={!s.unlocked}>
                            Semester {s.label}{s.complete ? ' (done)' : !s.unlocked ? ' (locked)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
                      <Label htmlFor="course">Course</Label>
                      <select id="course" className={selectCls} value={courseKey(header.course_code, header.course_title)} disabled={!header.semester}
                        onChange={(e) => {
                          const found = remainingCourses.find((x) => courseKey(x.code, x.title) === e.target.value);
                          setHeader((h) => ({ ...h, course_code: found?.code || '', course_title: found?.title || '' }));
                        }}>
                        <option value={courseKey('', '')}>
                          {header.semester && remainingCourses.length === 0 ? 'All courses done' : 'Choose course'}
                        </option>
                        {remainingCourses.map((x) => (
                          <option key={courseKey(x.code, x.title)} value={courseKey(x.code, x.title)}>
                            {x.code ? `${x.code} — ` : ''}{x.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {([['head_name', 'Head / Co-ordinator'], ['dean_name', 'Dean of School']] as [keyof PanelHeaderInput, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5 min-w-0">
                    <Label htmlFor={key}>{label}</Label>
                    <Input id={key} value={header[key]} onChange={(e) => setField(key, e.target.value)} placeholder={label} />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Add from your teacher list (added in the order you tap)</Label>
                <div className="flex flex-wrap gap-2">
                  {pool.length === 0 && <p className="text-sm text-muted-foreground">No saved teachers yet.</p>}
                  {pool.map((t) => {
                    const added = members.some((m) => m.name.trim().toLowerCase() === t.name.trim().toLowerCase());
                    return (
                      <Button key={t.id} size="sm" variant={added ? 'secondary' : 'outline'} disabled={added} onClick={() => addFromPool(t)}>
                        <Plus className="w-3 h-3 mr-1" /> {t.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Examiners</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMembers((m) => [...m, emptyMember(m.length + 1)])}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add row
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left w-10">#</th>
                        <th className="p-2 text-left min-w-[150px]">Name</th>
                        <th className="p-2 text-left min-w-[130px]">Designation</th>
                        <th className="p-2 text-left min-w-[140px]">Specialization</th>
                        <th className="p-2 text-left min-w-[180px]">Postal address</th>
                        <th className="p-2 text-left min-w-[160px]">Contact details</th>
                        <th className="p-2 text-left min-w-[110px]">Status</th>
                        <th className="p-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 text-muted-foreground">{idx + 1}</td>
                          {(
                            [
                              'name',
                              'designation',
                              'specialization',
                              'postal_address',
                              'contact_details',
                              'status',
                            ] as (keyof PanelMember)[]
                          ).map((key) => (
                            <td key={key} className="p-1">
                              <Input
                                value={String(m[key] ?? '')}
                                onChange={(e) => setMember(idx, key, e.target.value)}
                                className="h-9"
                              />
                            </td>
                          ))}
                          <td className="p-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => saveToPool(m)}
                              aria-label="Save teacher to list"
                              title="Save to teacher list"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMembers((rows) => rows.filter((_, i) => i !== idx))}
                              aria-label="Remove examiner"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes for the examination cell (optional)</Label>
                <Textarea
                  id="notes"
                  value={header.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" /> {editingId ? 'Update panel' : 'Save panel'}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {isHod ? 'Your panels' : 'Received panels'}
          </h2>
          {semesterGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {semesterGroups.map((g) => (
                <Button key={g.key} variant="outline" size="sm"
                  onClick={() => exportPanelsPdf(g.panels, `panels-${g.label.replace(/[^a-z0-9]+/gi, '-')}.pdf`)}>
                  <FileDown className="w-4 h-4 mr-2" /> Whole semester PDF: {g.label} ({g.panels.length})
                </Button>
              ))}
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : panels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No panels yet.</p>
          ) : (
            panels.map((panel) => (
              <Card key={panel.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {panel.course_title || 'Untitled course'}{' '}
                        {panel.course_code && (
                          <span className="text-muted-foreground">({panel.course_code})</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {[panel.programme, panel.semester && `Semester ${panel.semester}`, panel.session_label]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {panel.members.length} examiner{panel.members.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Badge variant={panel.status === 'sent' ? 'default' : 'secondary'}>
                      {panel.status === 'sent' ? 'Sent to exam cell' : 'Draft'}
                    </Badge>
                  </div>

                  {panel.notes && <p className="text-sm">{panel.notes}</p>}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportPanelPdf(panel)}>
                      <FileDown className="w-4 h-4 mr-2" /> Download PDF
                    </Button>
                    {isHod && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => loadForEdit(panel.id)}>
                          Edit
                        </Button>
                        {panel.status !== 'sent' && (
                          <Button size="sm" onClick={() => sendToExamCell(panel)}>
                            <Send className="w-4 h-4 mr-2" /> Send to exam cell
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePanel(panel.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </>
                    )}
                  </div>

                  {panel.members.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Designation</th>
                            <th className="p-2 text-left">Specialization</th>
                            <th className="p-2 text-left">Contact</th>
                            <th className="p-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panel.members.map((m) => (
                            <tr key={m.id || m.position} className="border-t">
                              <td className="p-2">{m.name}</td>
                              <td className="p-2">{m.designation}</td>
                              <td className="p-2">{m.specialization}</td>
                              <td className="p-2">{m.contact_details}</td>
                              <td className="p-2">{m.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
