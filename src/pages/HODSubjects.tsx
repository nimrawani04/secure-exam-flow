import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  MoveUp,
  MoveDown,
  Layers,
  ChevronRight,
  Info,
  Check,
  X,
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

  // Auto-detect Department from profile
  useEffect(() => {
    if (!profile?.department_id) return;
    const fetchDept = async () => {
      try {
        const { data } = await supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id!)
          .single();
        if (data?.name) {
          setDepartmentLabel(data.name);
          if (data.name.toLowerCase().includes('mechanical')) {
            setSchool('School of Engineering & Technology');
            setProgramme((prev) => (prev === 'B.Tech CSE' ? 'B.Tech Mechanical' : prev));
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch department name:', err);
      }
    };
    fetchDept();
  }, [profile?.department_id]);

  // Available programmes
  const availableProgrammes = useMemo(() => {
    const list = getAllAvailableProgrammes();
    if (departmentLabel.toLowerCase().includes('mechanical') && !list.includes('B.Tech Mechanical')) {
      return ['B.Tech Mechanical', 'M.Tech Mechanical', ...list];
    }
    return list;
  }, [savedCatalogs, departmentLabel]);

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

  // When selection changes, if courses list is empty and existing catalog exists, auto-load
  useEffect(() => {
    if (existingCatalogForSelection) {
      if (!editingCatalogId || editingCatalogId !== existingCatalogForSelection.id) {
        setEditingCatalogId(existingCatalogForSelection.id);
        setCourses(existingCatalogForSelection.courses.map((c) => ({ ...c })));
      }
    } else {
      if (editingCatalogId) {
        setEditingCatalogId(null);
      }
    }
  }, [currentKey]);

  // Initialize with syllabus defaults if empty and matching default exists
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
      toast.info(`No default syllabus courses found for ${activeProg} Semester ${semester}. You can add courses manually or upload an Excel sheet.`);
      return;
    }
    setCourses(defaults);
    toast.success(`Loaded ${defaults.length} syllabus courses for Semester ${semester}.`);
  };

  // Clear all courses in editor
  const handleClearAll = () => {
    if (courses.length === 0) return;
    setCourses([]);
    toast.info('Cleared course rows.');
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
      toast.error('Please select academic session');
      return;
    }
    if (!activeProg) {
      toast.error('Please select or enter programme');
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
      toast.error('Please add at least one course with a code or title');
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
          `Overwrote ${validCourses.length} courses for ${activeProg} · Sem ${semester} (Batch ${batch})!`
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

    window.scrollTo({ top: 120, behavior: 'smooth' });
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
      <div className="space-y-6 max-w-7xl mx-auto pb-20">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[#e2e8f0] dark:border-[#1e2a38]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 sm:p-2 rounded-lg bg-[var(--accent-soft,rgba(13,122,107,0.1))] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] shrink-0">
                <BookOpen className="h-4 sm:h-5 w-4 sm:w-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1c2430] dark:text-[#e6edf3]">
                  Subject Catalog Management
                </h1>
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] text-[#64748b] dark:text-[#889cb0] max-w-3xl leading-relaxed">
              Add and update curriculum subjects by Department, School, Session, Programme, Semester, and Batch.
              Saving new courses for a semester will overwrite the previous course list to keep catalogs up to date.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link to="/hod/panels" className="flex-1 sm:flex-initial">
              <button
                type="button"
                className="w-full sm:w-auto h-9 px-3.5 flex items-center justify-center gap-1.5 text-[11.5px] sm:text-[12px] font-semibold rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] hover:bg-[#f0f4f8] dark:hover:bg-[#15202e] shadow-xs transition-colors"
              >
                <span>Examiner Panels</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              </button>
            </Link>
            <button
              type="button"
              onClick={() => {
                downloadSubjectTemplate(programme, semester);
                toast.success('Downloaded Excel template!');
              }}
              className="flex-1 sm:flex-initial h-9 px-3.5 flex items-center justify-center gap-1.5 text-[11.5px] sm:text-[12px] font-semibold rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] hover:bg-[#f0f4f8] dark:hover:bg-[#15202e] shadow-xs transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span>Template</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkUploadOpen(true)}
              className="w-full sm:w-auto h-9 px-4 flex items-center justify-center gap-1.5 text-[11.5px] sm:text-[12px] font-semibold text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Upload</span>
            </button>
          </div>
        </div>

        {/* 1. Academic Particulars Configuration Block (Matching Examiner Panels layout) */}
        <div className="rounded-[12px] sm:rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 sm:mb-4 border-b border-[#e2e8f0] dark:border-[#1e2a38] pb-3">
            <div>
              <h3 className="text-[13px] sm:text-[13.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] flex items-center gap-2">
                <span>Academic Particulars & Offering Department</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--accent-soft,rgba(13,122,107,0.1))] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]">
                  Panel Aligned
                </span>
              </h3>
              <p className="text-[11px] sm:text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                Matches official university particulars. Configured courses populate automatically when selecting this programme & semester in Examiner Panels.
              </p>
            </div>

            {editingCatalogId && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1.5 self-start sm:self-auto">
                <Edit3 className="h-3 w-3" />
                <span>Editing Saved Catalog</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* 1. Department */}
            <div>
              <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Name of the Department:
              </label>
              <input
                value={departmentLabel}
                onChange={(e) => setDepartmentLabel(e.target.value)}
                placeholder="Department offering the courses"
                className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
              />
            </div>

            {/* 2. School */}
            <div>
              <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                School:
              </label>
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="School name"
                className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
              />
            </div>

            {/* 3. Session */}
            <div>
              <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Session:
              </label>
              <select
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
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

            {/* 4. Programme */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Programme:
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewProgramme(!isAddingNewProgramme)}
                  className="text-[11px] text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:underline font-medium"
                >
                  {isAddingNewProgramme ? 'Choose Existing' : '+ Custom Programme'}
                </button>
              </div>

              {isAddingNewProgramme ? (
                <input
                  value={customProgramme}
                  onChange={(e) => setCustomProgramme(e.target.value)}
                  placeholder="e.g. B.Tech Mechanical, M.Sc IT"
                  className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
                  autoFocus
                />
              ) : (
                <select
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Semester:
                </label>
                <span className="text-[10.5px] text-[#64748b]">Selected: {semester}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 w-full">
                {SEMESTER_OPTIONS.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSemester(sem)}
                    className={cn(
                      'h-9 rounded-lg border text-[11px] sm:text-[11.5px] font-semibold transition-all font-sans flex items-center justify-center',
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
              <label className="block text-[11.5px] font-bold text-[#1c2430] dark:text-[#e6edf3] mb-1.5">
                Batch:
              </label>
              <input
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. 2023, 2024"
                className="w-full h-9 px-3 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] font-sans focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Live Overwrite & Syllabus Status Banner */}
        {existingCatalogForSelection ? (
          <div className="rounded-[12px] border border-amber-400/40 bg-amber-500/10 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12.5px] font-bold leading-snug">
                  Active Catalog Configured for {programme} · Semester {semester} (Batch {batch})
                </p>
                <p className="text-[11.5px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                  Currently holds <strong>{existingCatalogForSelection.courses.length} courses</strong> (updated{' '}
                  {new Date(existingCatalogForSelection.updated_at).toLocaleDateString()}). Saving new changes will{' '}
                  <strong className="underline">overwrite</strong> this existing semester course list.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCourses(existingCatalogForSelection.courses.map((c) => ({ ...c })));
                  toast.info('Reloaded saved courses.');
                }}
                className="w-full sm:w-auto h-8 px-3 text-[11.5px] font-semibold border border-amber-400/60 rounded-lg bg-white dark:bg-[#101820] text-amber-900 dark:text-amber-200 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reload Saved</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[12px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-[#475569] dark:text-[#94a3b8]">
              <Info className="h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf] shrink-0" />
              <span>
                Configuring courses for <strong className="text-[#1c2430] dark:text-[#e6edf3]">{programme}</strong> · Semester{' '}
                <strong className="text-[#1c2430] dark:text-[#e6edf3]">{semester}</strong> (Batch{' '}
                <strong className="text-[#1c2430] dark:text-[#e6edf3]">{batch}</strong>).
              </span>
            </div>

            <button
              type="button"
              onClick={handlePrefillDefaults}
              className="w-full sm:w-auto h-7 px-3 text-[11px] font-semibold gap-1.5 text-[#0d7a6b] dark:text-[#2dd4bf] border border-[#0d7a6b]/30 rounded-md hover:bg-[#0d7a6b]/10 transition-colors inline-flex items-center justify-center"
            >
              <Sparkles className="h-3 w-3" />
              <span>Prefill Syllabus Defaults</span>
            </button>
          </div>
        )}

        {/* 2. Course Table Editor Card */}
        <div className="rounded-[12px] sm:rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#e2e8f0] dark:border-[#1e2a38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafbfc] dark:bg-[#0e1622]">
            <div>
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <h3 className="text-[13.5px] sm:text-[14px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                  Courses for Semester {semester}
                </h3>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#94a3b8] border border-[#d0d7de] dark:border-[#2a3847]">
                  {courses.length} course{courses.length === 1 ? '' : 's'} · {totalCredits} credits
                </span>
              </div>
              <p className="text-[11px] sm:text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                Add, edit, or remove courses and course codes. Course codes keep changing and can be updated freely.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={courses.length === 0}
                className="flex-1 sm:flex-initial h-8 px-3 text-[11.5px] font-medium text-rose-600 dark:text-rose-400 border border-[#d0d7de] dark:border-[#2a3847] rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear All</span>
              </button>
              <button
                type="button"
                onClick={handleAddCourseRow}
                className="flex-1 sm:flex-initial h-8 px-3.5 text-[11.5px] font-semibold text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-xs inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Course Row</span>
              </button>
            </div>
          </div>

          {/* Courses Table (table-fixed with min-w-[700px] inside overflow-x-auto for zero layout breaking on mobile) */}
          {courses.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[#64748b] dark:text-[#889cb0]">
              <div className="w-12 h-12 rounded-full bg-[#0d7a6b]/10 dark:bg-[#0d7a6b]/20 flex items-center justify-center mx-auto mb-3 text-[#0d7a6b] dark:text-[#2dd4bf]">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="text-[14px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                No courses configured for Semester {semester} yet
              </p>
              <p className="text-[12px] text-[#64748b] dark:text-[#889cb0] mt-1 max-w-md mx-auto">
                Add courses manually using the button below, prefill from standard syllabus, or bulk upload from Excel/CSV.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePrefillDefaults}
                  className="w-full sm:w-auto h-8 px-3 text-[12px] font-semibold text-[#0d7a6b] dark:text-[#2dd4bf] border border-[#0d7a6b]/40 rounded-lg hover:bg-[#0d7a6b]/10 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Prefill Syllabus Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCourseRow}
                  className="w-full sm:w-auto h-8 px-3.5 text-[12px] font-semibold text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-xs inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Course</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkUploadOpen(true)}
                  className="w-full sm:w-auto h-8 px-3 text-[12px] font-semibold text-[#1c2430] dark:text-[#e6edf3] border border-[#d0d7de] dark:border-[#2a3847] rounded-lg hover:bg-[#f0f4f8] transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Bulk Upload Excel</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="sm:hidden px-4 py-1.5 text-[10.5px] font-medium text-[#64748b] dark:text-[#889cb0] bg-slate-50 dark:bg-slate-900 border-b border-[#e2e8f0] dark:border-[#1e2a38]">
                ← Swipe table sideways to edit all course fields →
              </div>
              <table className="w-full min-w-[700px] text-left border-collapse table-fixed text-[12px]">
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '85px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '95px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#d0d7de] dark:border-[#2a3847] bg-[#f0f4f8] dark:bg-[#131e2b] text-[#1c2430] dark:text-[#e6edf3] font-bold text-[12px]">
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3">Course Code</th>
                    <th className="py-2.5 px-3">Course Title</th>
                    <th className="py-2.5 px-3 text-center">Credits</th>
                    <th className="py-2.5 px-3">Nature of Course</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e2a38]">
                  {courses.map((course, index) => (
                    <tr
                      key={course.id || index}
                      className="hover:bg-[#fafbfc] dark:hover:bg-[#121c27] transition-colors group"
                    >
                      {/* S.No */}
                      <td className="py-2 px-3 text-center font-semibold text-[#64748b] dark:text-[#889cb0] text-[11.5px]">
                        {index + 1}
                      </td>

                      {/* Course Code */}
                      <td className="py-2 px-3">
                        <input
                          value={course.code}
                          onChange={(e) => handleCourseChange(index, 'code', e.target.value)}
                          placeholder="e.g. ME 101"
                          className="w-full h-8 px-2.5 font-mono uppercase font-bold text-[#0d7a6b] dark:text-[#2dd4bf] text-[12px] rounded-md border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
                        />
                      </td>

                      {/* Course Title */}
                      <td className="py-2 px-3">
                        <input
                          value={course.title}
                          onChange={(e) => handleCourseChange(index, 'title', e.target.value)}
                          placeholder="e.g. Thermodynamics / Design of Machines"
                          className="w-full h-8 px-2.5 font-sans font-medium text-[#1c2430] dark:text-[#e6edf3] text-[12.5px] rounded-md border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] focus:border-[#0d7a6b] focus:ring-1 focus:ring-[#0d7a6b] outline-none transition-all"
                        />
                      </td>

                      {/* Credits */}
                      <td className="py-2 px-3 text-center">
                        <input
                          value={course.credits || '4'}
                          onChange={(e) => handleCourseChange(index, 'credits', e.target.value)}
                          placeholder="4"
                          className="w-full h-8 px-1 text-center font-bold text-[#1c2430] dark:text-[#e6edf3] text-[12px] rounded-md border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] focus:border-[#0d7a6b] outline-none transition-all"
                        />
                      </td>

                      {/* Nature */}
                      <td className="py-2 px-3">
                        <select
                          value={course.nature || 'Major'}
                          onChange={(e) => handleCourseChange(index, 'nature', e.target.value)}
                          className="w-full h-8 px-2 rounded-md border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[12px] font-sans outline-none focus:border-[#0d7a6b] transition-all"
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
                            className="p-1 rounded text-[#64748b] hover:text-[#1c2430] dark:hover:text-[#e6edf3] disabled:opacity-20 transition-colors"
                          >
                            <MoveUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRow(index, 'down')}
                            disabled={index === courses.length - 1}
                            title="Move Down"
                            className="p-1 rounded text-[#64748b] hover:text-[#1c2430] dark:hover:text-[#e6edf3] disabled:opacity-20 transition-colors"
                          >
                            <MoveDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(index)}
                            title="Delete course"
                            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Save & Overwrite Footer */}
          <div className="p-3.5 sm:p-4 border-t border-[#e2e8f0] dark:border-[#1e2a38] bg-[#fafbfc] dark:bg-[#0e1622] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[12px] text-[#64748b] dark:text-[#889cb0] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10b981] shrink-0" />
              <span className="truncate">
                Target: <strong className="text-[#1c2430] dark:text-[#e6edf3]">{isAddingNewProgramme ? customProgramme || 'New Programme' : programme}</strong> · Sem{' '}
                <strong className="text-[#1c2430] dark:text-[#e6edf3]">{semester}</strong> (Batch {batch})
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  downloadSubjectTemplate(programme, semester);
                }}
                className="w-full sm:w-auto h-9 px-3 text-[12px] font-semibold border border-[#d0d7de] dark:border-[#2a3847] rounded-lg bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] hover:bg-[#f0f4f8] transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                <span>Export Template</span>
              </button>
              <button
                type="button"
                onClick={handleSaveCatalog}
                disabled={saving || courses.length === 0}
                className="w-full sm:w-auto h-9 px-4 sm:px-5 text-[12px] font-bold text-white rounded-lg bg-[#0d7a6b] hover:bg-[#0fa88f] transition-colors shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>
                  {existingCatalogForSelection
                    ? 'Save & Overwrite Semester Courses'
                    : 'Save Semester Subject Catalog'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Configured Catalogs Overview & History */}
        <div className="rounded-[12px] sm:rounded-[14px] border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0] dark:border-[#1e2a38]">
            <div>
              <h3 className="text-[14px] font-bold text-[#1c2430] dark:text-[#e6edf3] flex items-center gap-2">
                <span>Configured Subject Catalogs</span>
                <span className="font-semibold text-[11px] px-2 py-0.5 rounded-full bg-[#f0f4f8] dark:bg-[#15202e] text-[#475569] dark:text-[#94a3b8] border border-[#d0d7de] dark:border-[#2a3847]">
                  {savedCatalogs.length} saved
                </span>
              </h3>
              <p className="text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                All semester courses configured for HOD panels. Click &quot;Edit&quot; to modify or overwrite any catalog.
              </p>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" />
                <input
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Search programme, course..."
                  className="w-full h-8 pl-8 pr-3 text-[11.5px] font-sans rounded-lg bg-white dark:bg-[#101820] border border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3] outline-none focus:border-[#0d7a6b]"
                />
              </div>

              <select
                value={filterProgramme}
                onChange={(e) => setFilterProgramme(e.target.value)}
                className="w-full sm:w-auto h-8 px-2 rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] text-[11.5px] font-sans outline-none focus:border-[#0d7a6b]"
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
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#0d7a6b]/30 text-[#0d7a6b] dark:text-[#2dd4bf] bg-[var(--accent-soft,rgba(13,122,107,0.06))]">
                              Sem {cat.semester}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748b] dark:text-[#889cb0] mt-0.5">
                            {cat.session_label} {cat.batch ? `· Batch ${cat.batch}` : ''}
                          </p>
                        </div>

                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f4f8] dark:bg-[#15202e] text-[#475569] dark:text-[#94a3b8] border border-[#d0d7de] dark:border-[#2a3847] shrink-0">
                          {cat.courses.length} courses
                        </span>
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
                        <button
                          type="button"
                          onClick={() => exportCatalogToExcel(cat)}
                          title="Export to Excel"
                          className="h-7 w-7 flex items-center justify-center rounded text-[#0d7a6b] hover:bg-[#0d7a6b]/10 transition-colors"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogToDelete(cat)}
                          title="Delete Catalog"
                          className="h-7 w-7 flex items-center justify-center rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditFromTable(cat)}
                          className={cn(
                            'h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-md border transition-colors inline-flex items-center',
                            isCurrentlyActive
                              ? 'bg-[#0d7a6b] text-white border-[#0d7a6b]'
                              : 'border-[#d0d7de] dark:border-[#2a3847] text-[#1c2430] dark:text-[#e6edf3] hover:border-[#0d7a6b]'
                          )}
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>{isCurrentlyActive ? 'Loaded' : 'Edit'}</span>
                        </button>
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
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847] rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] sm:text-[16px] text-[#1c2430] dark:text-[#e6edf3]">
              <Upload className="h-4 w-4 text-[#0d7a6b] dark:text-[#2dd4bf] shrink-0" />
              <span>Bulk Upload Courses for Semester {semester}</span>
            </DialogTitle>
            <DialogDescription className="text-[11.5px] sm:text-[12px] text-[#64748b] dark:text-[#889cb0]">
              Upload an Excel (.xlsx / .xls / .csv) sheet or paste tabular text directly from Google Sheets or Excel.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs: File Upload vs Quick Paste */}
          <div className="grid grid-cols-2 border-b border-[#e2e8f0] dark:border-[#1e2a38] mt-2">
            <button
              type="button"
              onClick={() => setBulkActiveTab('file')}
              className={cn(
                'py-2 px-2 sm:px-4 text-[11.5px] sm:text-[12.5px] font-semibold text-center border-b-2 transition-all truncate',
                bulkActiveTab === 'file'
                  ? 'border-[#0d7a6b] text-[#0d7a6b] dark:text-[#2dd4bf]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c2430]'
              )}
            >
              Upload Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => setBulkActiveTab('paste')}
              className={cn(
                'py-2 px-2 sm:px-4 text-[11.5px] sm:text-[12.5px] font-semibold text-center border-b-2 transition-all truncate',
                bulkActiveTab === 'paste'
                  ? 'border-[#0d7a6b] text-[#0d7a6b] dark:text-[#2dd4bf]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c2430]'
              )}
            >
              Quick Paste Text
            </button>
          </div>

          <div className="py-3 space-y-4">
            {bulkActiveTab === 'file' ? (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[12px] border-2 border-dashed border-[#d0d7de] dark:border-[#2a3847] hover:border-[#0d7a6b] dark:hover:border-[#2dd4bf] p-4 sm:p-6 text-center cursor-pointer transition-colors bg-[#fafbfc] dark:bg-[#0e1622]"
                >
                  <FileSpreadsheet className="h-8 sm:h-9 w-8 sm:w-9 text-[#0d7a6b] dark:text-[#2dd4bf] mx-auto mb-2 opacity-80" />
                  <p className="text-[12.5px] sm:text-[13px] font-semibold text-[#1c2430] dark:text-[#e6edf3] break-words">
                    {uploadedFileName || 'Click to select or drag & drop file'}
                  </p>
                  <p className="text-[11px] sm:text-[11.5px] text-[#64748b] dark:text-[#889cb0] mt-1">
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

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-[11.5px] text-[#64748b] dark:text-[#889cb0]">
                  <span>Need the standard template?</span>
                  <button
                    type="button"
                    onClick={() => downloadSubjectTemplate(programme, semester)}
                    className="text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto"
                  >
                    <Download className="h-3 w-3" />
                    Download Sample Excel Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-[#1c2430] dark:text-[#e6edf3]">Paste tab-separated or comma-separated rows:</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`ME 101\tThermodynamics\t4\tMajor\nME 102\tFluid Mechanics\t4\tMajor\nME 103 L\tThermal Engineering Lab\t2\tLab`}
                  rows={5}
                  className="w-full p-2.5 sm:p-3 font-mono text-[11px] sm:text-[11.5px] rounded-lg border border-[#d0d7de] dark:border-[#2a3847] bg-[#fafbfc] dark:bg-[#0e1622] text-[#1c2430] dark:text-[#e6edf3] outline-none focus:border-[#0d7a6b]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handlePasteParse}
                    className="h-8 px-3 text-[11.5px] font-semibold border border-[#d0d7de] dark:border-[#2a3847] rounded-lg bg-white dark:bg-[#101820] text-[#1c2430] dark:text-[#e6edf3] hover:bg-[#f0f4f8]"
                  >
                    Parse Pasted Text
                  </button>
                </div>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedUploadCourses.length > 0 && (
              <div className="rounded-[10px] border border-[#d0d7de] dark:border-[#2a3847] p-3 bg-[#fafbfc] dark:bg-[#0e1622] space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[12px] font-bold text-[#1c2430] dark:text-[#e6edf3]">
                    Parsed Preview ({parsedUploadCourses.length} courses detected):
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300">
                    Ready to Import
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-[#e2e8f0] dark:divide-[#1e2a38] text-[11.5px]">
                  {parsedUploadCourses.map((c, i) => (
                    <div key={i} className="py-1 flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#0d7a6b] dark:text-[#2dd4bf] w-24 sm:w-28 truncate shrink-0">
                        {c.code || '(no code)'}
                      </span>
                      <span className="flex-1 truncate text-[#1c2430] dark:text-[#e6edf3]">
                        {c.title || '(no title)'}
                      </span>
                      <span className="text-[#64748b] text-[10.5px] shrink-0 text-right">
                        {c.credits} cr · {c.nature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Merge mode selector */}
                <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#1e2a38] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-medium text-[#1c2430] dark:text-[#e6edf3]">Apply options:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#1c2430] dark:text-[#e6edf3]">
                      <input
                        type="radio"
                        name="mergeMode"
                        checked={uploadMergeMode === 'replace'}
                        onChange={() => setUploadMergeMode('replace')}
                        className="text-[#0d7a6b]"
                      />
                      <span>Replace current rows</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#1c2430] dark:text-[#e6edf3]">
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

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkUploadOpen(false);
                setParsedUploadCourses([]);
              }}
              className="w-full sm:w-auto h-8 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyUpload}
              disabled={parsedUploadCourses.length === 0}
              className="w-full sm:w-auto h-8 text-[12px] bg-[#0d7a6b] hover:bg-[#0fa88f] text-white"
            >
              Apply {parsedUploadCourses.length} Courses to Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Delete Confirmation Dialog --- */}
      <Dialog open={!!catalogToDelete} onOpenChange={(open) => !open && setCatalogToDelete(null)}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md p-4 sm:p-6 bg-white dark:bg-[#101820] border-[#d0d7de] dark:border-[#2a3847] rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] text-rose-600 dark:text-rose-400">
              <Trash2 className="h-4 w-4 shrink-0" />
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

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogToDelete(null)}
              className="w-full sm:w-auto h-8 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDelete}
              className="w-full sm:w-auto h-8 text-[12px] bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
