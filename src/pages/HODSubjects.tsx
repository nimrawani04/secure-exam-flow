import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  Edit3,
  Copy,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Layers,
  GraduationCap,
  ChevronRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  IT_DEPARTMENT,
  IT_SCHOOL,
  SESSION_OPTIONS,
  IT_PROGRAMMES,
} from '@/lib/itCatalog';
import {
  CourseCatalogItem,
  SubjectCatalogEntry,
  COURSE_NATURE_OPTIONS,
  SEMESTER_OPTIONS,
  fetchSubjectCatalogs,
  saveSubjectCatalog,
  deleteSubjectCatalog,
  getDefaultSyllabusCourses,
  downloadSubjectTemplate,
  exportCatalogToExcel,
  parseSubjectFile,
  parsePastedText,
  getAllAvailableProgrammes,
  catalogKey,
} from '@/lib/subjectCatalogStorage';
import { Link } from 'react-router-dom';

export default function HODSubjects() {
  const { profile, user } = useAuth();
  const isHod = profile?.role === 'hod';

  // --- Form Header State ---
  const [departmentLabel, setDepartmentLabel] = useState(IT_DEPARTMENT);
  const [school, setSchool] = useState(IT_SCHOOL);
  const [sessionLabel, setSessionLabel] = useState('January 2026');
  const [programme, setProgramme] = useState('B.Tech CSE');
  const [customProgramme, setCustomProgramme] = useState('');
  const [isAddingNewProgramme, setIsAddingNewProgramme] = useState(false);
  const [semester, setSemester] = useState('I');
  const [batch, setBatch] = useState('2023');

  // --- Course Rows in Editor ---
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Catalogs Database List ---
  const [savedCatalogs, setSavedCatalogs] = useState<SubjectCatalogEntry[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  // --- Search & Filter Catalogs List ---
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [filterProgramme, setFilterProgramme] = useState<string>('all');

  // --- Modals State ---
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkActiveTab, setBulkActiveTab] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedUploadCourses, setParsedUploadCourses] = useState<CourseCatalogItem[]>([]);
  const [uploadMergeMode, setUploadMergeMode] = useState<'replace' | 'append'>('replace');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal
  const [catalogToDelete, setCatalogToDelete] = useState<SubjectCatalogEntry | null>(null);

  // Available programmes
  const availableProgrammes = useMemo(() => {
    return getAllAvailableProgrammes();
  }, [savedCatalogs]);

  // Load catalogs on mount
  const loadCatalogs = async () => {
    setIsLoadingCatalogs(true);
    try {
      const data = await fetchSubjectCatalogs();
      setSavedCatalogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingCatalogs(false);
    }
  };

  useEffect(() => {
    loadCatalogs();

    const handleUpdate = () => {
      fetchSubjectCatalogs().then(setSavedCatalogs);
    };
    window.addEventListener('cuk_subject_catalog_updated', handleUpdate);
    return () => window.removeEventListener('cuk_subject_catalog_updated', handleUpdate);
  }, []);

  // Compute active key for current selection
  const currentKey = useMemo(() => {
    const prog = isAddingNewProgramme ? customProgramme : programme;
    return catalogKey({
      session_label: sessionLabel,
      programme: prog,
      semester,
      batch,
    });
  }, [sessionLabel, programme, customProgramme, isAddingNewProgramme, semester, batch]);

  // Check if an existing catalog matches current selection
  const existingCatalogForSelection = useMemo(() => {
    return savedCatalogs.find((c) => catalogKey(c) === currentKey);
  }, [savedCatalogs, currentKey]);

  // When selection changes, if courses list is empty and existing catalog exists, auto-load or offer
  useEffect(() => {
    if (existingCatalogForSelection) {
      // If we are not actively editing a different catalog
      if (!editingCatalogId || editingCatalogId !== existingCatalogForSelection.id) {
        setEditingCatalogId(existingCatalogForSelection.id);
        setCourses(existingCatalogForSelection.courses.map((c) => ({ ...c })));
      }
    } else {
      // If no existing catalog, prefill with default syllabus if current list was from another selection
      if (editingCatalogId) {
        setEditingCatalogId(null);
      }
    }
  }, [currentKey]);

  // Initialize with syllabus defaults if completely empty
  useEffect(() => {
    if (courses.length === 0 && !existingCatalogForSelection) {
      const defaults = getDefaultSyllabusCourses(programme, semester);
      if (defaults.length > 0) {
        setCourses(defaults);
      }
    }
  }, [programme, semester]);

  // Handle adding empty course row
  const handleAddCourseRow = () => {
    const newCourse: CourseCatalogItem = {
      id: `course-${Date.now()}-${courses.length}`,
      code: '',
      title: '',
      credits: '4',
      nature: 'Major',
    };
    setCourses([...courses, newCourse]);
  };

  // Handle changing a row field
  const handleCourseChange = (index: number, field: keyof CourseCatalogItem, value: string) => {
    const updated = [...courses];
    updated[index] = {
      ...updated[index],
      [field]: field === 'code' ? value.toUpperCase() : value,
    };
    setCourses(updated);
  };

  // Handle deleting a course row
  const handleDeleteRow = (index: number) => {
    setCourses(courses.filter((_, i) => i !== index));
  };

  // Move row up or down
  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= courses.length) return;
    const updated = [...courses];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCourses(updated);
  };

  // Prefill syllabus defaults
  const handlePrefillDefaults = () => {
    const activeProg = isAddingNewProgramme ? customProgramme : programme;
    const defaults = getDefaultSyllabusCourses(activeProg, semester);
    if (defaults.length === 0) {
      toast.info(`No pre-configured syllabus defaults found for ${activeProg} Semester ${semester}.`);
      return;
    }
    setCourses(defaults);
    toast.success(`Loaded ${defaults.length} default syllabus courses for Semester ${semester}.`);
  };

  // Clear all courses in editor
  const handleClearAll = () => {
    if (courses.length === 0) return;
    setCourses([]);
    toast.info('Cleared all course rows from current editor.');
  };

  // Save the catalog
  const handleSaveCatalog = async () => {
    const activeProg = isAddingNewProgramme ? customProgramme.trim() : programme.trim();

    if (!departmentLabel.trim()) {
      toast.error('Please enter department name');
      return;
    }
    if (!school.trim()) {
      toast.error('Please enter school name');
      return;
    }
    if (!sessionLabel.trim()) {
      toast.error('Please select or enter academic session');
      return;
    }
    if (!activeProg) {
      toast.error('Please select or specify programme');
      return;
    }
    if (!semester.trim()) {
      toast.error('Please select semester');
      return;
    }
    if (!batch.trim()) {
      toast.error('Please specify batch year (e.g. 2023)');
      return;
    }

    const validCourses = courses.filter((c) => c.code.trim() || c.title.trim());
    if (validCourses.length === 0) {
      toast.error('Please add at least one course with code or title');
      return;
    }

    setSaving(true);
    try {
      const { saved, isOverwrite } = await saveSubjectCatalog({
        id: editingCatalogId || undefined,
        department_label: departmentLabel,
        school: school,
        session_label: sessionLabel,
        programme: activeProg,
        semester: semester,
        batch: batch,
        courses: validCourses,
        userId: user?.id,
      });

      setEditingCatalogId(saved.id);
      await loadCatalogs();

      if (isOverwrite) {
        toast.success(
          `Overwrote courses for ${activeProg} · Sem ${semester} (${batch}): ${validCourses.length} courses updated!`
        );
      } else {
        toast.success(
          `Successfully saved ${validCourses.length} courses for ${activeProg} · Sem ${semester}!`
        );
      }

      if (isAddingNewProgramme) {
        setProgramme(activeProg);
        setIsAddingNewProgramme(false);
        setCustomProgramme('');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to save subject catalog');
    } finally {
      setSaving(false);
    }
  };

  // Edit an existing catalog item from table
  const handleEditFromTable = (cat: SubjectCatalogEntry) => {
    setDepartmentLabel(cat.department_label || IT_DEPARTMENT);
    setSchool(cat.school || IT_SCHOOL);
    setSessionLabel(cat.session_label);
    setProgramme(cat.programme);
    setIsAddingNewProgramme(false);
    setCustomProgramme('');
    setSemester(cat.semester);
    setBatch(cat.batch);
    setCourses(cat.courses.map((c) => ({ ...c })));
    setEditingCatalogId(cat.id);

    window.scrollTo({ top: 180, behavior: 'smooth' });
    toast.info(`Loaded ${cat.programme} · Sem ${cat.semester} (${cat.courses.length} courses) into editor.`);
  };

  // Delete confirmed
  const handleConfirmDelete = async () => {
    if (!catalogToDelete) return;
    try {
      await deleteSubjectCatalog(catalogToDelete.id);
      if (editingCatalogId === catalogToDelete.id) {
        setEditingCatalogId(null);
        setCourses([]);
      }
      await loadCatalogs();
      toast.success(
        `Deleted catalog for ${catalogToDelete.programme} Sem ${catalogToDelete.semester}.`
      );
      setCatalogToDelete(null);
    } catch (e) {
      toast.error('Failed to delete catalog');
    }
  };

  // File upload change
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFileName(file.name);
      const parsed = await parseSubjectFile(file);
      if (parsed.length === 0) {
        toast.error('No courses could be parsed from this file.');
        return;
      }
      setParsedUploadCourses(parsed);
      toast.success(`Parsed ${parsed.length} courses from "${file.name}"!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to parse file. Ensure it is a valid .xlsx or .csv.');
    }
  };

  // Paste parse
  const handlePasteParse = () => {
    if (!pastedText.trim()) {
      toast.error('Please paste text first.');
      return;
    }
    const parsed = parsePastedText(pastedText);
    if (parsed.length === 0) {
      toast.error('Could not parse any courses from the pasted text.');
      return;
    }
    setParsedUploadCourses(parsed);
    toast.success(`Parsed ${parsed.length} courses from pasted text!`);
  };

  // Apply parsed upload courses to main editor
  const handleApplyUpload = () => {
    if (parsedUploadCourses.length === 0) {
      toast.error('No courses to apply.');
      return;
    }

    if (uploadMergeMode === 'replace') {
      setCourses(parsedUploadCourses);
      toast.success(`Replaced editor with ${parsedUploadCourses.length} courses.`);
    } else {
      setCourses([...courses, ...parsedUploadCourses]);
      toast.success(`Appended ${parsedUploadCourses.length} courses to current list.`);
    }

    setBulkUploadOpen(false);
    setParsedUploadCourses([]);
    setPastedText('');
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered list of saved catalogs
  const filteredSavedCatalogs = useMemo(() => {
    return savedCatalogs.filter((cat) => {
      if (filterProgramme !== 'all' && cat.programme !== filterProgramme) {
        return false;
      }
      if (searchCatalogQuery.trim()) {
        const q = searchCatalogQuery.toLowerCase().trim();
        const matchProg = cat.programme.toLowerCase().includes(q);
        const matchSem = cat.semester.toLowerCase().includes(q);
        const matchSession = cat.session_label.toLowerCase().includes(q);
        const matchBatch = cat.batch.toLowerCase().includes(q);
        const matchCourse = cat.courses.some(
          (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
        );
        return matchProg || matchSem || matchSession || matchBatch || matchCourse;
      }
      return true;
    });
  }, [savedCatalogs, filterProgramme, searchCatalogQuery]);

  // Total credits calculation
  const totalCredits = useMemo(() => {
    return courses.reduce((sum, c) => {
      const val = parseFloat(c.credits || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [courses]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e2e8f0] dark:border-[#1e2a38]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[var(--accent-soft,rgba(13,122,107,0.1))] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]">
                <BookOpen className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c2430] dark:text-[#e6edf3]">
                Subject Catalog Management
              </h1>
            </div>
            <p className="text-[13px] text-[#64748b] dark:text-[#889cb0] max-w-3xl">
              Add and update curriculum subjects by Department, School, Session, Programme, Semester, and Batch.
              Saving new courses for a semester will overwrite the previous course list to keep catalogs up to date.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/hod/panels">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-[12px] rounded-lg border-[#d0d7de] dark:border-[#2a3847] hover:bg-[#f0f4f8] dark:hover:bg-[#15202e]"
              >
                <span>Examiner Panels</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#64748b]" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadSubjectTemplate(programme, semester);
                toast.success('Downloaded Excel template!');
              }}
              className="h-9 gap-1.5 text-[12px] rounded-lg border-[#d0d7de] dark:border-[#2a3847] hover:bg-[#f0f4f8] dark:hover:bg-[#15202e]"
            >
              <Download className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span>Template</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkUploadOpen(true)}
              className="h-9 gap-1.5 text-[12px] font-medium text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Upload</span>
            </Button>
          </div>
        </div>

        {/* 1. Academic Particulars Configuration Block (Same style as Examiner Panels!) */}
        <div className="rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#e2e8f0] dark:border-[#1e2a38] pb-3">
            <div>
              <h3 className="text-[13.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] flex items-center gap-2">
                <span>Academic Particulars & Offering Department</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10.5px] font-normal border-[var(--accent-color,#0d7a6b)]/40 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]"
                >
                  Panel Standard
                </Badge>
              </h3>
              <p className="text-[11.5px] text-[#64748b] dark:text-[#889cb0]">
                Matches the official panel specification. Subjects configured here will immediately be available in Examiner Panels.
              </p>
            </div>

            {editingCatalogId && (
              <Badge
                variant="secondary"
                className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1.5"
              >
                <Edit3 className="h-3 w-3" />
                <span>Editing Saved Catalog</span>
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Department */}
            <div>
              <Label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Name of the Department:
              </Label>
              <Input
                value={departmentLabel}
                onChange={(e) => setDepartmentLabel(e.target.value)}
                placeholder="Department offering the courses"
                className="h-9 text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
              />
            </div>

            {/* 2. School */}
            <div>
              <Label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                School:
              </Label>
              <Input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="School name"
                className="h-9 text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
              />
            </div>

            {/* 3. Session */}
            <div>
              <Label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Session:
              </Label>
              <div className="flex gap-2">
                <select
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                >
                  {SESSION_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {!SESSION_OPTIONS.includes(sessionLabel) && (
                    <option value={sessionLabel}>{sessionLabel}</option>
                  )}
                </select>
              </div>
            </div>

            {/* 4. Programme */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Programme:
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewProgramme(!isAddingNewProgramme)}
                  className="text-[11px] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:underline"
                >
                  {isAddingNewProgramme ? 'Choose Existing' : '+ New Programme'}
                </button>
              </div>

              {isAddingNewProgramme ? (
                <Input
                  value={customProgramme}
                  onChange={(e) => setCustomProgramme(e.target.value)}
                  placeholder="e.g. M.Sc IT, B.Tech AI"
                  className="h-9 text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                  autoFocus
                />
              ) : (
                <select
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] focus:ring-1 focus:ring-[var(--accent-color,#0d7a6b)] outline-none"
                >
                  {availableProgrammes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 5. Semester */}
            <div>
              <Label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Semester:
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                {SEMESTER_OPTIONS.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSemester(sem)}
                    className={cn(
                      'h-9 rounded-lg border text-[12px] font-semibold transition-all',
                      semester === sem
                        ? 'border-[#0d7a6b] bg-[#0d7a6b] text-white shadow-xs'
                        : 'border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#475569] dark:text-[#94a3b8] hover:border-[#0d7a6b]'
                    )}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Batch */}
            <div>
              <Label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Batch:
              </Label>
              <Input
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. 2023, 2024"
                className="h-9 text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
              />
            </div>
          </div>
        </div>

        {/* Live Overwrite & Syllabus Status Banner */}
        {existingCatalogForSelection ? (
          <div className="rounded-[12px] border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12.5px] font-semibold">
                  Existing Catalog Found for {programme} · Semester {semester} (Batch {batch})
                </p>
                <p className="text-[11.5px] text-amber-800/80 dark:text-amber-300/80">
                  Currently configured with {existingCatalogForSelection.courses.length} courses (updated{' '}
                  {new Date(existingCatalogForSelection.updated_at).toLocaleDateString()}). Saving changes will{' '}
                  <strong className="underline">overwrite</strong> this previous course list.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCourses(existingCatalogForSelection.courses.map((c) => ({ ...c })));
                  toast.info('Reloaded saved courses.');
                }}
                className="h-8 text-[11.5px] border-amber-400 bg-white dark:bg-[#101820]"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reload Saved
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[12px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-[#64748b] dark:text-[#889cb0]">
              <Info className="h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf] shrink-0" />
              <span>
                Configuring courses for <strong>{programme}</strong> · Semester <strong>{semester}</strong> (Batch{' '}
                <strong>{batch}</strong>).
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrefillDefaults}
              className="h-7 text-[11px] gap-1 text-[#0d7a6b] dark:text-[#2dd4bf] border-[#0d7a6b]/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Prefill Syllabus Defaults</span>
            </Button>
          </div>
        )}

        {/* 2. Course Table Editor */}
        <div className="rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#e2e8f0] dark:border-[#1e2a38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafbfc] dark:bg-[#0e1622]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Courses for Semester {semester}
                </h3>
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                >
                  {courses.length} course{courses.length === 1 ? '' : 's'} · {totalCredits} credits
                </Badge>
              </div>
              <p className="text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                Add, edit, or remove courses and course codes. Course codes keep changing and can be updated freely.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={courses.length === 0}
                className="h-8 text-[11.5px] text-rose-600 dark:text-rose-400 border-[#d0d7de] dark:border-[#2a3847] hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleAddCourseRow}
                className="h-8 text-[11.5px] font-medium text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Course Row
              </Button>
            </div>
          </div>

          {/* Courses Table */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[#d0d7de] dark:border-[#2a3847] bg-[#f0f4f8] dark:bg-[#131e2b] text-[#1c2430] dark:text-[#e6edf3] font-bold">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-48">Course Code</th>
                  <th className="py-2.5 px-3 min-w-[280px]">Course Title</th>
                  <th className="py-2.5 px-3 w-28 text-center">Credits</th>
                  <th className="py-2.5 px-3 w-40">Nature of Course</th>
                  <th className="py-2.5 px-3 w-28 text-center">Order & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e2a38]">
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#64748b] dark:text-[#889cb0]">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-[13px] font-medium">No courses added for this semester yet</p>
                      <p className="text-[11.5px] mt-1 max-w-md mx-auto">
                        Click &quot;Add Course Row&quot; above to enter courses manually, &quot;Bulk Upload&quot; to import from
                        Excel/CSV, or &quot;Prefill Syllabus Defaults&quot;.
                      </p>
                      <div className="mt-3 flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handlePrefillDefaults}
                          className="h-8 text-[11.5px] gap-1 text-[#0d7a6b] dark:text-[#2dd4bf]"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Prefill Defaults
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddCourseRow}
                          className="h-8 text-[11.5px] gap-1 bg-[#0d7a6b] text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Row
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  courses.map((course, index) => (
                    <tr
                      key={course.id || index}
                      className="hover:bg-[#fafbfc] dark:hover:bg-[#121c27] transition-colors group"
                    >
                      {/* S.No */}
                      <td className="py-2 px-3 text-center font-mono text-[#64748b] dark:text-[#889cb0] text-[11px]">
                        {index + 1}
                      </td>

                      {/* Course Code */}
                      <td className="py-2 px-3">
                        <Input
                          value={course.code}
                          onChange={(e) => handleCourseChange(index, 'code', e.target.value)}
                          placeholder="e.g. BTCS 501"
                          className="h-8 font-mono font-bold text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                        />
                      </td>

                      {/* Course Title */}
                      <td className="py-2 px-3">
                        <Input
                          value={course.title}
                          onChange={(e) => handleCourseChange(index, 'title', e.target.value)}
                          placeholder="e.g. Operating Systems"
                          className="h-8 text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                        />
                      </td>

                      {/* Credits */}
                      <td className="py-2 px-3 text-center">
                        <Input
                          value={course.credits || '4'}
                          onChange={(e) => handleCourseChange(index, 'credits', e.target.value)}
                          placeholder="Credits"
                          className="h-8 text-center font-mono text-[12px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                        />
                      </td>

                      {/* Nature */}
                      <td className="py-2 px-3">
                        <select
                          value={course.nature || 'Major'}
                          onChange={(e) => handleCourseChange(index, 'nature', e.target.value)}
                          className="w-full h-8 px-2 rounded-md border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] outline-none focus:ring-1 focus:ring-[#0d7a6b]"
                        >
                          {COURSE_NATURE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 'up')}
                            disabled={index === 0}
                            title="Move Up"
                            className="p-1 rounded text-[#64748b] hover:text-[#1c2430] dark:hover:text-[#e6edf3] disabled:opacity-30"
                          >
                            <MoveUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 'down')}
                            disabled={index === courses.length - 1}
                            title="Move Down"
                            className="p-1 rounded text-[#64748b] hover:text-[#1c2430] dark:hover:text-[#e6edf3] disabled:opacity-30"
                          >
                            <MoveDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(index)}
                            title="Delete course"
                            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Save & Overwrite Bar */}
          <div className="p-4 border-t border-[#e2e8f0] dark:border-[#1e2a38] bg-[#fafbfc] dark:bg-[#0e1622] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[12px] text-[#64748b] dark:text-[#889cb0] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              <span>
                Target: <strong>{isAddingNewProgramme ? customProgramme || 'New Programme' : programme}</strong> · Sem{' '}
                <strong>{semester}</strong> ({batch})
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadSubjectTemplate(programme, semester);
                }}
                className="h-9 text-[12px] border-[#d0d7de] dark:border-[#2a3847]"
              >
                <Download className="h-3.5 w-3.5 mr-1 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                Export Template
              </Button>
              <Button
                onClick={handleSaveCatalog}
                disabled={saving || courses.length === 0}
                className="h-9 px-5 text-[12px] font-semibold text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-sm gap-2"
              >
                <Save className="h-4 w-4" />
                <span>
                  {existingCatalogForSelection
                    ? 'Save & Overwrite Semester Courses'
                    : 'Save Semester Subject Catalog'}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* 3. Configured Catalogs Overview & History */}
        <div className="rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0] dark:border-[#1e2a38]">
            <div>
              <h3 className="text-[14px] font-bold text-[#1c2430] dark:text-[#e6edf3] flex items-center gap-2">
                <span>Configured Subject Catalogs</span>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10.5px] bg-[#f0f4f8] dark:bg-[#15202e]"
                >
                  {savedCatalogs.length} saved
                </Badge>
              </h3>
              <p className="text-[11.5px] text-[#64748b] dark:text-[#889cb0]">
                All semester courses configured for HOD panels. Click &quot;Edit&quot; to modify or overwrite any catalog.
              </p>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" />
                <Input
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Search programme, course..."
                  className="h-8 pl-8 text-[11.5px] bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847]"
                />
              </div>

              <select
                value={filterProgramme}
                onChange={(e) => setFilterProgramme(e.target.value)}
                className="h-8 px-2 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px]"
              >
                <option value="all">All Programmes</option>
                {availableProgrammes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredSavedCatalogs.length === 0 ? (
            <div className="py-10 text-center text-[#64748b] dark:text-[#889cb0]">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">No saved subject catalogs match your criteria</p>
              <p className="text-[11.5px] text-[#a0aec0] dark:text-[#64748b] mt-1">
                Configure courses above and click &quot;Save Semester Subject Catalog&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSavedCatalogs.map((cat) => {
                const isCurrentlyActive = editingCatalogId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'rounded-[12px] border p-4 transition-all flex flex-col justify-between bg-white dark:bg-[#101820]',
                      isCurrentlyActive
                        ? 'border-[#0d7a6b] dark:border-[#2dd4bf] ring-1 ring-[#0d7a6b] shadow-sm'
                        : 'border-[#d0d7de] dark:border-[#2a3847] hover:border-[#0d7a6b]/50'
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[13px] text-[#1c2430] dark:text-[#e6edf3]">
                              {cat.programme}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-[10.5px] border-[#0d7a6b]/30 text-[#0d7a6b] dark:text-[#2dd4bf] bg-[var(--accent-soft,rgba(13,122,107,0.06))]"
                            >
                              Sem {cat.semester}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                            {cat.session_label} {cat.batch ? `· Batch ${cat.batch}` : ''}
                          </p>
                        </div>

                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] bg-[#f0f4f8] dark:bg-[#15202e] shrink-0"
                        >
                          {cat.courses.length} courses
                        </Badge>
                      </div>

                      {/* Preview course tags */}
                      <div className="flex flex-wrap gap-1 my-2.5 max-h-16 overflow-hidden">
                        {cat.courses.slice(0, 5).map((c, i) => (
                          <span
                            key={i}
                            title={`${c.code}: ${c.title}`}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] text-[#475569] dark:text-[#94a3b8] truncate max-w-[150px]"
                          >
                            {c.code || c.title}
                          </span>
                        ))}
                        {cat.courses.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] text-[#64748b] bg-[#f0f4f8] dark:bg-[#15202e]">
                            +{cat.courses.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e2a38] flex items-center justify-between text-[11px] text-[#64748b] dark:text-[#889cb0]">
                      <span className="text-[10.5px]">
                        Updated {new Date(cat.updated_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportCatalogToExcel(cat)}
                          title="Export to Excel"
                          className="h-7 w-7 p-0 text-[#0d7a6b] hover:bg-[#0d7a6b]/10"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCatalogToDelete(cat)}
                          title="Delete Catalog"
                          className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditFromTable(cat)}
                          className={cn(
                            'h-7 px-2.5 text-[11px] gap-1 rounded-md border',
                            isCurrentlyActive
                              ? 'bg-[#0d7a6b] text-white border-[#0d7a6b]'
                              : 'border-[#d0d7de] dark:border-[#2a3847] hover:border-[#0d7a6b]'
                          )}
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>{isCurrentlyActive ? 'Loaded' : 'Edit'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- Bulk Upload Dialog --- */}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847] rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[16px] text-[#1c2430] dark:text-[#e6edf3]">
              <Upload className="h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span>Bulk Upload Courses for Semester {semester}</span>
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#64748b] dark:text-[#889cb0]">
              Upload an Excel (.xlsx / .xls / .csv) sheet or paste tabular text directly from Google Sheets or Excel.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs: File Upload vs Quick Paste */}
          <div className="flex border-b border-[#e2e8f0] dark:border-[#1e2a38] mt-2">
            <button
              type="button"
              onClick={() => setBulkActiveTab('file')}
              className={cn(
                'py-2 px-4 text-[12.5px] font-semibold border-b-2 transition-all',
                bulkActiveTab === 'file'
                  ? 'border-[#0d7a6b] text-[#0d7a6b] dark:text-[#2dd4bf]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c2430]'
              )}
            >
              Upload Excel / CSV File
            </button>
            <button
              type="button"
              onClick={() => setBulkActiveTab('paste')}
              className={cn(
                'py-2 px-4 text-[12.5px] font-semibold border-b-2 transition-all',
                bulkActiveTab === 'paste'
                  ? 'border-[#0d7a6b] text-[#0d7a6b] dark:text-[#2dd4bf]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c2430]'
              )}
            >
              Quick Paste Tabular Text
            </button>
          </div>

          <div className="py-3 space-y-4">
            {bulkActiveTab === 'file' ? (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[12px] border-2 border-dashed border-[#d0d7de] dark:border-[#2a3847] hover:border-[#0d7a6b] dark:hover:border-[#2dd4bf] p-6 text-center cursor-pointer transition-colors bg-[#fafbfc] dark:bg-[#0e1622]"
                >
                  <FileSpreadsheet className="h-9 w-9 text-[#0d7a6b] dark:text-[#2dd4bf] mx-auto mb-2 opacity-80" />
                  <p className="text-[13px] font-semibold text-[#1c2430] dark:text-[#e6edf3]">
                    {uploadedFileName || 'Click to select or drag & drop file'}
                  </p>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-1">
                    Supports .xlsx, .xls, .csv. Columns: Course Code, Course Title, Credits, Course Nature.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="flex items-center justify-between text-[11.5px] text-[#64748b] dark:text-[#889cb0]">
                  <span>Need the standard template?</span>
                  <button
                    type="button"
                    onClick={() => downloadSubjectTemplate(programme, semester)}
                    className="text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:underline font-medium flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Download Sample Excel Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[12px] font-semibold">Paste tab-separated or comma-separated rows:</Label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`BTCS 501\tOperating Systems\t4\tMajor\nBTCS 507\tComputer Graphics\t4\tMajor\nBTCS 511 L\tComputer Graphics Lab\t2\tLab`}
                  rows={6}
                  className="w-full p-3 font-mono text-[11.5px] rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] text-[#1c2430] dark:text-[#e6edf3] outline-none focus:ring-1 focus:ring-[#0d7a6b]"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePasteParse}
                    className="h-8 text-[11.5px] border-[#d0d7de] dark:border-[#2a3847]"
                  >
                    Parse Pasted Text
                  </Button>
                </div>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedUploadCourses.length > 0 && (
              <div className="rounded-[10px] border border-[#d0d7de] dark:border-[#2a3847] p-3 bg-[#fafbfc] dark:bg-[#0e1622] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                    Parsed Preview ({parsedUploadCourses.length} courses detected):
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                    Ready to Import
                  </Badge>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-[#e2e8f0] dark:divide-[#1e2a38] text-[11.5px]">
                  {parsedUploadCourses.map((c, i) => (
                    <div key={i} className="py-1 flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#0d7a6b] dark:text-[#2dd4bf] w-28 truncate">
                        {c.code || '(no code)'}
                      </span>
                      <span className="flex-1 truncate text-[#1c2430] dark:text-[#e6edf3]">
                        {c.title || '(no title)'}
                      </span>
                      <span className="text-[#64748b] text-[10.5px] w-20 text-right">
                        {c.credits} cr · {c.nature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Merge mode selector */}
                <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#1e2a38] flex items-center justify-between text-[11.5px]">
                  <span className="font-medium">Apply options:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="mergeMode"
                        checked={uploadMergeMode === 'replace'}
                        onChange={() => setUploadMergeMode('replace')}
                        className="text-[#0d7a6b]"
                      />
                      <span>Replace current rows</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="mergeMode"
                        checked={uploadMergeMode === 'append'}
                        onChange={() => setUploadMergeMode('append')}
                        className="text-[#0d7a6b]"
                      />
                      <span>Append to current rows</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkUploadOpen(false);
                setParsedUploadCourses([]);
              }}
              className="h-8 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyUpload}
              disabled={parsedUploadCourses.length === 0}
              className="h-8 text-[12px] bg-[#0d7a6b] hover:bg-[#0fa88f] text-white"
            >
              Apply {parsedUploadCourses.length} Courses to Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Delete Confirmation Dialog --- */}
      <Dialog open={!!catalogToDelete} onOpenChange={(open) => !open && setCatalogToDelete(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847] rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] text-rose-600 dark:text-rose-400">
              <Trash2 className="h-4 w-4" />
              <span>Delete Subject Catalog?</span>
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[#64748b] dark:text-[#889cb0]">
              Are you sure you want to delete the course catalog for{' '}
              <strong>
                {catalogToDelete?.programme} · Semester {catalogToDelete?.semester} (Batch {catalogToDelete?.batch})
              </strong>
              ? This contains {catalogToDelete?.courses.length} courses and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogToDelete(null)}
              className="h-8 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDelete}
              className="h-8 text-[12px] bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
