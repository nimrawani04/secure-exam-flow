import { useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  useExaminerPanels,
  emptyMember,
  type PanelMember,
  type PanelHeaderInput,
} from '@/hooks/useExaminerPanels';
import { downloadPanelTemplate, parsePanelWorkbook, exportPanelPdf } from '@/lib/panelExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Plus, Save, Send, Trash2, Upload, FileDown } from 'lucide-react';

const emptyHeader: PanelHeaderInput = {
  school: '',
  department_label: '',
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
  const { profile } = useAuth();
  const { panels, isLoading, savePanel, sendToExamCell, deletePanel } = useExaminerPanels();
  const isHod = profile?.role === 'hod';

  const [header, setHeader] = useState<PanelHeaderInput>(emptyHeader);
  const [members, setMembers] = useState<PanelMember[]>([1, 2, 3, 4].map(emptyMember));
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setField = (key: keyof PanelHeaderInput, value: string) =>
    setHeader((h) => ({ ...h, [key]: value }));

  const setMember = (idx: number, key: keyof PanelMember, value: string) =>
    setMembers((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  const resetForm = () => {
    setHeader(emptyHeader);
    setMembers([1, 2, 3, 4].map(emptyMember));
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
                {([
                  ['school', 'School'],
                  ['department_label', 'Department'],
                  ['programme', 'Programme'],
                  ['semester', 'Semester'],
                  ['session_label', 'Session'],
                  ['course_title', 'Course title'],
                  ['course_code', 'Course code'],
                  ['head_name', 'Head / Co-ordinator'],
                  ['dean_name', 'Dean of School'],
                ] as [keyof PanelHeaderInput, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5 min-w-0">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={header[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={label}
                    />
                  </div>
                ))}
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
                          <td className="p-1">
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
