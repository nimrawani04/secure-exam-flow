import { supabase } from '@/integrations/supabase/client';
import { IT_DEPARTMENT, IT_SCHOOL, IT_PROGRAMMES, type CatalogCourse } from './itCatalog';
import XLSX from 'xlsx-js-style';

export interface CourseCatalogItem {
  id: string;
  code: string;
  title: string;
  credits?: string;
  nature?: string;
}

export interface SubjectCatalogEntry {
  id: string;
  department_label: string;
  school: string;
  session_label: string;
  programme: string;
  semester: string;
  batch: string;
  courses: CourseCatalogItem[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

const LOCAL_STORAGE_KEY = 'cuk_department_subject_catalogs_v1';

export const COURSE_NATURE_OPTIONS = [
  'Major',
  'Minor',
  'Lab',
  'Core',
  'Elective',
  'SEC',
  'VAC',
  'AEC',
  'MDC',
  'OGE',
  'MOOCs',
];

export const SEMESTER_OPTIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// Read local cache safely
export function getLocalCatalogs(): SubjectCatalogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list: SubjectCatalogEntry[] = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((item) => !item.programme?.toLowerCase().includes('mechanical'))
      : [];
  } catch (err) {
    console.error('Error reading local subject catalogs:', err);
    return [];
  }
}

// Write local cache safely
export function saveLocalCatalogs(catalogs: SubjectCatalogEntry[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(catalogs));
    window.dispatchEvent(new CustomEvent('cuk_subject_catalog_updated'));
  } catch (err) {
    console.error('Error saving local subject catalogs:', err);
  }
}

/**
 * Fetch all subject catalogs.
 * Tries Supabase first; on error or empty, merges with localStorage.
 */
export async function fetchSubjectCatalogs(): Promise<SubjectCatalogEntry[]> {
  const localList = getLocalCatalogs();

  try {
    const { data, error } = await supabase
      .from('department_subject_catalogs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error || !data) {
      return localList;
    }

    const dbCatalogs: SubjectCatalogEntry[] = (data as any[]).map((row) => ({
      id: row.id,
      department_label: row.department_label || IT_DEPARTMENT,
      school: row.school || IT_SCHOOL,
      session_label: row.session_label || '',
      programme: row.programme || '',
      semester: row.semester || '',
      batch: row.batch || '',
      courses: Array.isArray(row.courses) ? row.courses : [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Merge: DB items take precedence, but keep any local not yet on remote
    const dbMap = new Map(dbCatalogs.map((item) => [catalogKey(item), item]));
    for (const loc of localList) {
      const k = catalogKey(loc);
      if (!dbMap.has(k)) {
        dbMap.set(k, loc);
      }
    }

    const merged = Array.from(dbMap.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    saveLocalCatalogs(merged);
    return merged;
  } catch (err) {
    console.warn('Could not reach remote catalogs, returning local:', err);
    return localList;
  }
}

export function catalogKey(entry: {
  session_label: string;
  programme: string;
  semester: string;
  batch: string;
}) {
  return `${(entry.session_label || '').trim().toLowerCase()}::${(
    entry.programme || ''
  )
    .trim()
    .toLowerCase()}::${(entry.semester || '').trim().toLowerCase()}::${(
    entry.batch || ''
  )
    .trim()
    .toLowerCase()}`;
}

/**
 * Save or overwrite courses for a specific semester configuration.
 * "then they can add the courses for that sem and those should over write prev one"
 */
export async function saveSubjectCatalog(entry: {
  id?: string;
  department_label: string;
  school: string;
  session_label: string;
  programme: string;
  semester: string;
  batch: string;
  courses: CourseCatalogItem[];
  userId?: string;
}): Promise<{ saved: SubjectCatalogEntry; isOverwrite: boolean }> {
  const localList = getLocalCatalogs();
  const targetKey = catalogKey(entry);

  const existingIndex = localList.findIndex((item) => catalogKey(item) === targetKey);
  const isOverwrite = existingIndex >= 0;

  const now = new Date().toISOString();
  const finalId =
    entry.id || (isOverwrite ? localList[existingIndex].id : crypto.randomUUID());

  const fullEntry: SubjectCatalogEntry = {
    id: finalId,
    department_label: entry.department_label.trim() || IT_DEPARTMENT,
    school: entry.school.trim() || IT_SCHOOL,
    session_label: entry.session_label.trim(),
    programme: entry.programme.trim(),
    semester: entry.semester.trim(),
    batch: entry.batch.trim(),
    courses: entry.courses.map((c, i) => ({
      id: c.id || `c-${Date.now()}-${i}`,
      code: (c.code || '').trim(),
      title: (c.title || '').trim(),
      credits: (c.credits || '4').trim(),
      nature: (c.nature || 'Major').trim(),
    })),
    created_by: entry.userId,
    created_at: isOverwrite ? localList[existingIndex].created_at : now,
    updated_at: now,
  };

  // Update local
  if (isOverwrite) {
    localList[existingIndex] = fullEntry;
  } else {
    localList.unshift(fullEntry);
  }
  saveLocalCatalogs(localList);

  // Attempt to write to Supabase table
  try {
    const payload = {
      id: fullEntry.id,
      department_label: fullEntry.department_label,
      school: fullEntry.school,
      session_label: fullEntry.session_label,
      programme: fullEntry.programme,
      semester: fullEntry.semester,
      batch: fullEntry.batch,
      courses: fullEntry.courses,
      created_by: entry.userId || null,
      updated_at: now,
    };

    await supabase.from('department_subject_catalogs').upsert(payload, {
      onConflict: 'id',
    });
  } catch (err) {
    console.warn('Remote sync error for department_subject_catalogs:', err);
  }

  return { saved: fullEntry, isOverwrite };
}

/**
 * Delete a saved catalog entry by id.
 */
export async function deleteSubjectCatalog(id: string): Promise<boolean> {
  const localList = getLocalCatalogs();
  const updated = localList.filter((item) => item.id !== id);
  saveLocalCatalogs(updated);

  try {
    await supabase.from('department_subject_catalogs').delete().eq('id', id);
  } catch (err) {
    console.warn('Could not delete from remote table:', err);
  }

  return true;
}

/**
 * Get dynamic courses for a given programme and semester.
 * Checks custom catalogs first (exact session/batch or general session match),
 * then falls back to static IT_PROGRAMMES catalog.
 */
export function getCoursesForSemester(
  programmeName: string,
  semesterLabel: string,
  sessionLabel?: string,
  batch?: string
): { code: string; title: string; credits?: string; nature?: string }[] {
  const localList = getLocalCatalogs();

  if (localList.length > 0) {
    const cleanProg = (programmeName || '').trim().toLowerCase();
    const cleanSem = (semesterLabel || '').trim().toLowerCase();
    const cleanSession = (sessionLabel || '').trim().toLowerCase();
    const cleanBatch = (batch || '').trim().toLowerCase();

    // 1. Exact match with session and batch
    if (cleanSession && cleanBatch) {
      const match = localList.find(
        (c) =>
          c.programme.trim().toLowerCase() === cleanProg &&
          c.semester.trim().toLowerCase() === cleanSem &&
          c.session_label.trim().toLowerCase() === cleanSession &&
          c.batch.trim().toLowerCase() === cleanBatch
      );
      if (match && match.courses.length > 0) {
        return match.courses;
      }
    }

    // 2. Match with session
    if (cleanSession) {
      const match = localList.find(
        (c) =>
          c.programme.trim().toLowerCase() === cleanProg &&
          c.semester.trim().toLowerCase() === cleanSem &&
          c.session_label.trim().toLowerCase() === cleanSession
      );
      if (match && match.courses.length > 0) {
        return match.courses;
      }
    }

    // 3. Match with programme & semester only
    const match = localList.find(
      (c) =>
        c.programme.trim().toLowerCase() === cleanProg &&
        c.semester.trim().toLowerCase() === cleanSem
    );
    if (match && match.courses.length > 0) {
      return match.courses;
    }
  }

  // Fallback to static IT_PROGRAMMES
  const prog = IT_PROGRAMMES.find(
    (p) => p.name.trim().toLowerCase() === (programmeName || '').trim().toLowerCase()
  );
  if (!prog) return [];

  const sem = prog.semesters.find(
    (s) => s.label.trim().toUpperCase() === (semesterLabel || '').trim().toUpperCase()
  );
  if (!sem) return [];

  return sem.courses.map((c) => ({
    code: c.code,
    title: c.title,
    credits: '4',
    nature: 'Major',
  }));
}

export const ALLOWED_PROGRAMMES = [
  'B.Tech CSE',
  'M.Tech CSE',
  'M.Tech AI & ML',
  'PhD',
] as const;

/**
 * Get all available programme names: strictly B.Tech CSE, M.Tech CSE, M.Tech AI & ML, PhD
 */
export function getAllAvailableProgrammes(): string[] {
  return [...ALLOWED_PROGRAMMES];
}

/**
 * Get default syllabus courses for a programme & semester (if found in IT_PROGRAMMES).
 */
export function getDefaultSyllabusCourses(
  programmeName: string,
  semesterLabel: string
): CourseCatalogItem[] {
  const prog = IT_PROGRAMMES.find(
    (p) => p.name.trim().toLowerCase() === (programmeName || '').trim().toLowerCase()
  );
  if (!prog) return [];

  const sem = prog.semesters.find(
    (s) => s.label.trim().toUpperCase() === (semesterLabel || '').trim().toUpperCase()
  );
  if (!sem) return [];

  return sem.courses.map((c, i) => ({
    id: `default-${i}-${Date.now()}`,
    code: c.code,
    title: c.title,
    credits: '4',
    nature: 'Major',
  }));
}

/**
 * Download a blank/sample Excel template for subject bulk upload.
 */
export function downloadSubjectTemplate(
  programme: string = 'B.Tech CSE',
  semester: string = 'I'
) {
  const wsData = [
    ['Course Code', 'Course Title', 'Credits', 'Course Nature'],
    ['25MT2U101', 'Discrete Mathematics (MDC)', '4', 'Major'],
    ['BT 102', 'Engineering Physics', '4', 'Major'],
    ['CHM20-MIN-101', 'General Chemistry', '4', 'Minor'],
    ['BT 104', 'Engineering Drawing (SEC)', '2', 'SEC'],
    ['BT 107 L', 'Engineering Physics Lab', '2', 'Lab'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Style headers
  ws['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 10 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Course_Template');

  const filename = `Course_Template_${programme.replace(/\s+/g, '_')}_Sem_${semester}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export an existing subject catalog to Excel.
 */
export function exportCatalogToExcel(entry: SubjectCatalogEntry) {
  const wsData = [
    ['Subject Catalog Specification'],
    ['Department:', entry.department_label, '', 'School:', entry.school],
    ['Programme:', entry.programme, '', 'Semester:', entry.semester],
    ['Session:', entry.session_label, '', 'Batch:', entry.batch],
    ['Total Courses:', entry.courses.length, '', 'Updated:', entry.updated_at],
    [],
    ['S.No.', 'Course Code', 'Course Title', 'Credits', 'Course Nature'],
    ...entry.courses.map((c, idx) => [
      idx + 1,
      c.code,
      c.title,
      c.credits || '4',
      c.nature || 'Major',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 48 }, { wch: 10 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  const sheetName = `${entry.programme.slice(0, 15)}_Sem_${entry.semester}`.replace(/[\\/?*[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename = `Courses_${entry.programme.replace(/\s+/g, '_')}_Sem_${entry.semester}_Batch_${entry.batch || 'General'}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Parse rows from uploaded Excel/CSV file buffer.
 */
export async function parseSubjectFile(file: File): Promise<CourseCatalogItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded file appears to be empty.');
  }

  return parseRowArray(rawRows);
}

/**
 * Parse raw text pasted from clipboard (CSV or Tab-delimited).
 */
export function parsePastedText(text: string): CourseCatalogItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = lines.map((line) => {
    if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
    if (line.includes(',')) {
      // Basic CSV split
      return line.split(',').map((s) => s.trim());
    }
    return [line.trim()];
  });
  return parseRowArray(rows);
}

function parseRowArray(rows: any[][]): CourseCatalogItem[] {
  let headerIndex = -1;
  let codeCol = 0;
  let titleCol = 1;
  let creditsCol = 2;
  let natureCol = 3;

  // Search for header row
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((cell) => String(cell || '').trim().toLowerCase());
    const hasCode = row.some((c) => c.includes('code'));
    const hasTitle = row.some((c) => c.includes('title') || c.includes('name') || c.includes('course') || c.includes('subject'));

    if (hasCode || hasTitle) {
      headerIndex = i;
      row.forEach((cell, idx) => {
        if (cell.includes('code')) codeCol = idx;
        else if (cell.includes('title') || cell.includes('name') || cell.includes('course') || cell.includes('subject'))
          titleCol = idx;
        else if (cell.includes('credit')) creditsCol = idx;
        else if (cell.includes('nature') || cell.includes('type')) natureCol = idx;
      });
      break;
    }
  }

  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  const parsedCourses: CourseCatalogItem[] = [];

  dataRows.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const code = String(row[codeCol] || '').trim();
    const title = String(row[titleCol] || '').trim();
    const credits = String(row[creditsCol] || '').trim() || '4';
    const nature = String(row[natureCol] || '').trim() || 'Major';

    // Must have at least a title or a code
    if (code || title) {
      parsedCourses.push({
        id: `parsed-${idx}-${Date.now()}`,
        code: code,
        title: title || code,
        credits: credits,
        nature: nature,
      });
    }
  });

  return parsedCourses;
}
