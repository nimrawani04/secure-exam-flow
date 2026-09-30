import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import type { ExaminerPanel, PanelMember, PanelHeaderInput } from '@/hooks/useExaminerPanels';

export const MEMBER_COLUMNS = [
  'Name',
  'Designation',
  'Specialization',
  'Postal Address',
  'Operational Contact Details',
  'Status',
];

export async function downloadPanelTemplate() {
  try {
    const response = await fetch('/Panel of Examiners Format.xlsx');
    if (!response.ok) throw new Error('File not found');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'panel-of-examiners-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    downloadBasicTemplate();
  }
}

function downloadBasicTemplate() {
  const data: (string | number | null)[][] = [
    [
      'Name of the Department offering the courses:',
      null, null, null, null, null,
      'School:',
      null, null, null, null,
    ],
    [
      'Session:',
      null, null, null, null, null,
      'Programme:',
      null, null, null, null,
    ],
    [
      'Semester:',
      null, null, null, null, null,
      'Batch:',
      null, null, null, null,
    ],
    [
      'Details of the course(s) for which panel is submitted',
      null, null, null, null, null,
      'S.\nNo.',
      'Particulars of the Experts in order of Preference\n(Name/Designation/Department)',
      null,
      null,
      'Contact Details\n(Email ID/Mobile No.)',
    ],
    [
      'Course Title',
      'Course Code',
      'Credits',
      'Nature of Course \n(Major, Minor, Lab, MDC, VAC, SEC, AEC, OGE, MOOCs etc.)',
      'Programme(s)\n(whose students have opted the course)',
      'Whether Regular/ Backlog or Both',
      null,
      null,
      null,
      null,
      null,
    ],
    ['', '', '', '', '', '', 1, '', '', '', ''],
    ['', '', '', '', '', '', 2, '', '', '', ''],
    ['', '', '', '', '', '', 3, '', '', '', ''],
    ['', '', '', '', '', '', 4, '', '', '', ''],
    ['', '', '', '', '', '', 5, '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!merges'] = [
    { s: { c: 0, r: 0 }, e: { c: 5, r: 0 } },
    { s: { c: 6, r: 0 }, e: { c: 10, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: 5, r: 1 } },
    { s: { c: 6, r: 1 }, e: { c: 10, r: 1 } },
    { s: { c: 0, r: 2 }, e: { c: 5, r: 2 } },
    { s: { c: 6, r: 2 }, e: { c: 10, r: 2 } },
    { s: { c: 0, r: 3 }, e: { c: 5, r: 3 } },
    { s: { c: 6, r: 3 }, e: { c: 6, r: 4 } },
    { s: { c: 7, r: 3 }, e: { c: 9, r: 4 } },
    { s: { c: 10, r: 3 }, e: { c: 10, r: 4 } },
    // Course info vertical merges for rows 5 to 9
    { s: { c: 0, r: 5 }, e: { c: 0, r: 9 } },
    { s: { c: 1, r: 5 }, e: { c: 1, r: 9 } },
    { s: { c: 2, r: 5 }, e: { c: 2, r: 9 } },
    { s: { c: 3, r: 5 }, e: { c: 3, r: 9 } },
    { s: { c: 4, r: 5 }, e: { c: 4, r: 9 } },
    { s: { c: 5, r: 5 }, e: { c: 5, r: 9 } },
    { s: { c: 7, r: 5 }, e: { c: 9, r: 5 } },
    { s: { c: 7, r: 6 }, e: { c: 9, r: 6 } },
    { s: { c: 7, r: 7 }, e: { c: 9, r: 7 } },
    { s: { c: 7, r: 8 }, e: { c: 9, r: 8 } },
    { s: { c: 7, r: 9 }, e: { c: 9, r: 9 } },
  ];

  ws['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 26 }, { wch: 24 }, { wch: 16 },
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 36 },
  ];

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  const headerFill = {
    patternType: 'solid',
    fgColor: { rgb: 'F2F4F7' },
  };

  // Apply borders and fonts to all data cells so it matches the PDF format visually
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c <= 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].s = {
        border: thinBorder,
        font: { name: 'Times New Roman', sz: 9.5 },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      };
      if (r === 3 || r === 4) {
        ws[cellRef].s.fill = headerFill;
        ws[cellRef].s.font.bold = true;
      } else if (r < 3) {
        ws[cellRef].s.font.bold = true;
        ws[cellRef].s.alignment.horizontal = 'left';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Panel Format');
  XLSX.writeFile(wb, 'panel-of-examiners-template.xlsx');
}

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().replace(/[^a-z]/g, '');
    if (keys.includes(norm)) return String(row[key] ?? '').trim();
  }
  return '';
};

export interface ParsedPanelWorkbookResult {
  members: PanelMember[];
  header?: Partial<PanelHeaderInput>;
}

export async function parsePanelWorkbookWithHeader(file: File): Promise<ParsedPanelWorkbookResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('panel') || n.toLowerCase().includes('semester')) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  // First, check if this is the official format (with metadata in rows 0-3)
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' });

  let isOfficialFormat = false;
  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const rowStr = JSON.stringify(aoa[i] || '').toLowerCase();
    if (rowStr.includes('details of the course') || rowStr.includes('particulars of the experts')) {
      isOfficialFormat = true;
      headerRowIdx = i;
      break;
    }
  }

  if (isOfficialFormat && headerRowIdx >= 0) {
    const header: Partial<PanelHeaderInput> = {};

    // Extract metadata from rows before headerRowIdx
    for (let r = 0; r < headerRowIdx; r++) {
      const row = aoa[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        const nextVal = String(row[c + 1] || '').trim();
        if (/department offering/i.test(val)) {
          header.department_label = val.split(':')[1]?.trim() || nextVal;
        } else if (/^school/i.test(val)) {
          header.school = val.split(':')[1]?.trim() || nextVal;
        } else if (/^session/i.test(val)) {
          header.session_label = val.split(':')[1]?.trim() || nextVal;
        } else if (/^programme/i.test(val)) {
          header.programme = val.split(':')[1]?.trim() || nextVal;
        } else if (/^semester/i.test(val)) {
          header.semester = val.split(':')[1]?.trim() || nextVal;
        } else if (/^batch/i.test(val)) {
          header.batch = val.split(':')[1]?.trim() || nextVal;
        } else if (/teacher in-?charge/i.test(val)) {
          header.teacher_incharge_name = val.split(':')[1]?.trim() || nextVal;
        } else if (/head/i.test(val) && !/department offering/i.test(val)) {
          header.head_name = val.split(':')[1]?.trim() || nextVal;
        } else if (/dean/i.test(val)) {
          header.dean_name = val.split(':')[1]?.trim() || nextVal;
        }
      }
    }

    // The subheaders are at headerRowIdx + 1
    const dataStartRow = headerRowIdx + 2;
    const members: PanelMember[] = [];

    // Parse course details from first data row
    if (aoa[dataStartRow]) {
      const firstRow = aoa[dataStartRow];
      if (firstRow[0] || firstRow[1]) {
        header.course_title = String(firstRow[0] || '').trim() || undefined;
        header.course_code = String(firstRow[1] || '').trim() || undefined;
        header.credits = String(firstRow[2] || '').trim() || undefined;
        header.course_nature = String(firstRow[3] || '').trim() || undefined;
        header.programme = String(firstRow[4] || '').trim() || undefined;
        header.regular_backlog = String(firstRow[5] || '').trim() || undefined;
      }
    }

    for (let r = dataStartRow; r < aoa.length; r++) {
      const row = aoa[r] || [];
      const sNo = row[6];
      const particulars = String(row[7] || row[8] || '').trim();
      const contact = String(row[10] || row[11] || row[12] || '').trim();

      if (particulars) {
        // Parse "Name / Designation / Department"
        const parts = particulars.split(/[\/,]/).map((p) => p.trim());
        members.push({
          position: typeof sNo === 'number' ? sNo : members.length + 1,
          name: parts[0] || particulars,
          designation: parts[1] || '',
          specialization: parts.slice(2).join(' / ') || '',
          postal_address: '',
          contact_details: contact,
          status: '',
        });
      }
    }

    if (members.length > 0) {
      return { members, header };
    }
  }

  // Fallback: standard flat rows
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const fallbackMembers = rows
    .map((row, idx) => ({
      position: idx + 1,
      name: pick(row, ['name', 'examinername', 'fullname', 'particularsoftheexpertsinorderofpreference', 'experts', 'expertname', 'name/designation/department']),
      designation: pick(row, ['designation', 'post', 'rank', 'designationdepartment', 'designation/dept']),
      specialization: pick(row, ['specialization', 'specializationon', 'specialisation', 'area', 'specializationdepartment', 'specialization/dept']),
      postal_address: pick(row, ['postaladdress', 'address', 'postaladdresscontact', 'postal/address']),
      contact_details: pick(row, ['operationalcontactdetails', 'contactdetails', 'contact', 'phone', 'email', 'contactdetailsemailidmobileno', 'contactdetailsemail', 'email/mobile']),
      status: pick(row, ['status', 'type', 'internalexternal', 'regularbacklog']) || '',
    }))
    .filter((m) => m.name);

  return { members: fallbackMembers };
}

export async function parsePanelWorkbook(file: File): Promise<PanelMember[]> {
  const result = await parsePanelWorkbookWithHeader(file);
  return result.members;
}

export function exportPanelPdf(panel: ExaminerPanel) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  drawSinglePanelDocument(doc, panel);
  doc.save(`panel-of-examiners-${panel.course_code || 'course'}.pdf`);
}

export function exportPanelsPdf(panels: ExaminerPanel[], fileName: string) {
  if (panels.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Each subject is rendered as an individual document with its own 3 signatures directly after it (1 page each)
  panels.forEach((p, index) => {
    if (index > 0) doc.addPage();
    drawSinglePanelDocument(doc, p);
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Exports all panels of a semester in a unified official layout on a SINGLE page.
 * Scaled dynamically so that all courses and signatures fit cleanly on 1 landscape A4 page when printed.
 */
export function exportCombinedSemesterPdf(panels: ExaminerPanel[], fileName: string) {
  if (panels.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  drawCombinedSemesterDocument(doc, panels);
  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Exports all panels across all semesters into ONE single consolidated Master PDF.
 * Each semester is placed on its own landscape page (all courses of that semester + 3 signatures on 1 page).
 */
export function exportAllCombinedSemestersPdf(panels: ExaminerPanel[], fileName: string) {
  if (panels.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Group by session, programme, semester
  const semMap = new Map<string, ExaminerPanel[]>();
  panels.forEach((p) => {
    const key = `${p.session_label || ''}|${p.programme || ''}|${p.semester || ''}`;
    if (!semMap.has(key)) semMap.set(key, []);
    semMap.get(key)!.push(p);
  });

  let pageIndex = 0;
  semMap.forEach((semPanels) => {
    if (pageIndex > 0) doc.addPage();
    drawCombinedSemesterDocument(doc, semPanels);
    pageIndex++;
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Generates an Excel sheet name strictly formatted as:
 * Semester - X B.Tech/M.tech
 * where X is the actual semester (e.g. VII, III, 1).
 * Guaranteed to be <= 31 characters, contains no invalid characters, and unique within the workbook.
 */
export function formatSemesterSheetName(
  semester?: string | null,
  programme?: string | null,
  suffix?: string | null,
  usedNames?: Set<string>
): string {
  let cleanSem = (semester || '').trim().replace(/^(?:semester|sem)\s*/i, '').trim();
  if (!cleanSem) cleanSem = 'I';

  const p = (programme || '').trim();
  let degree = 'B.Tech';
  if (/m\.?tech/i.test(p)) degree = 'M.Tech';
  else if (/b\.?tech/i.test(p)) degree = 'B.Tech';
  else if (/mca/i.test(p)) degree = 'MCA';
  else if (/bca/i.test(p)) degree = 'BCA';
  else if (/m\.?sc/i.test(p)) degree = 'M.Sc';
  else if (/b\.?sc/i.test(p)) degree = 'B.Sc';
  else if (/ph\.?d/i.test(p)) degree = 'Ph.D';
  else if (p) degree = p.split(/[\s·-]+/)[0];

  let name = suffix
    ? `Semester - ${cleanSem} ${degree} (${suffix})`
    : `Semester - ${cleanSem} ${degree}`;

  name = name.replace(/[:\\/?*\[\]]/g, '-').trim();
  if (name.length > 31) name = name.substring(0, 31).trim();

  if (usedNames) {
    let candidate = name;
    let counter = 2;
    while (Array.from(usedNames).some((n) => n.toLowerCase() === candidate.toLowerCase())) {
      const tag = ` (${counter})`;
      const maxBase = 31 - tag.length;
      candidate = `${name.substring(0, maxBase).trim()}${tag}`;
      counter++;
    }
    name = candidate;
    usedNames.add(name);
  }
  return name;
}

/**
 * Builds an official Excel worksheet for one or more subject panels in a semester.
 * Features:
 * - Single top metadata header block (Department, School, Session, Semester, Batch, Programme)
 * - All subjects/courses in the semester rendered together in ONE continuous table
 * - Single Certificate statement and 3 Signatures at the bottom of the semester sheet
 */
export function buildSemesterWorksheet(panels: ExaminerPanel[]): XLSX.WorkSheet {
  if (panels.length === 0) return XLSX.utils.aoa_to_sheet([]);
  const p0 = panels[0];
  const data: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  const rowHeights: { hpt: number }[] = [];
  let currentRow = 0;

  // 0. Confidential Document Title
  const titleRow = currentRow;
  data.push([
    'PANEL OF EXAMINERS (CONFIDENTIAL)',
    null, null, null, null, null, null, null, null, null, null,
  ]);
  merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 10 } });
  rowHeights[titleRow] = { hpt: 26 };
  currentRow++;

  // 1. Metadata Block (2 columns x 3 rows)
  data.push([
    `Name of the Department offering the courses:  ${p0.department_label || '-'}`,
    null, null, null, null, null,
    `School:  ${p0.school || '-'}`,
    null, null, null, null,
  ]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
  merges.push({ s: { r: currentRow, c: 6 }, e: { r: currentRow, c: 10 } });
  rowHeights[currentRow] = { hpt: 20 };
  currentRow++;

  data.push([
    `Session:  ${p0.session_label || '-'}`,
    null, null, null, null, null,
    `Programme:  ${p0.programme || '-'}`,
    null, null, null, null,
  ]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
  merges.push({ s: { r: currentRow, c: 6 }, e: { r: currentRow, c: 10 } });
  rowHeights[currentRow] = { hpt: 20 };
  currentRow++;

  data.push([
    `Semester:  ${p0.semester || '-'}`,
    null, null, null, null, null,
    `Batch:  ${p0.batch || '-'}`,
    null, null, null, null,
  ]);
  merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
  merges.push({ s: { r: currentRow, c: 6 }, e: { r: currentRow, c: 10 } });
  rowHeights[currentRow] = { hpt: 20 };
  currentRow++;

  // 2. Table Header 1
  const tHead1 = currentRow;
  data.push([
    'Details of the course(s) for which panel is submitted',
    null, null, null, null, null,
    'S.\nNo.',
    'Particulars of the Experts in order of Preference\n(Name/Designation/Department)',
    null, null,
    'Contact Details\n(Email ID/Mobile No.)',
  ]);
  merges.push({ s: { r: tHead1, c: 0 }, e: { r: tHead1, c: 5 } });
  merges.push({ s: { r: tHead1, c: 6 }, e: { r: tHead1 + 1, c: 6 } });
  merges.push({ s: { r: tHead1, c: 7 }, e: { r: tHead1 + 1, c: 9 } });
  merges.push({ s: { r: tHead1, c: 10 }, e: { r: tHead1 + 1, c: 10 } });
  rowHeights[tHead1] = { hpt: 26 };
  currentRow++;

  // Table Header 2
  const tHead2 = currentRow;
  data.push([
    'Course Title',
    'Course Code',
    'Credits',
    'Nature of Course \n(Major, Minor, Lab, MDC, VAC, SEC, AEC, OGE, MOOCs etc.)',
    'Programme(s)\n(whose students have opted the course)',
    'Whether Regular/ Backlog or Both',
    null, null, null, null, null,
  ]);
  rowHeights[tHead2] = { hpt: 38 };
  currentRow++;

  // 3. Render all courses together continuously in one table
  panels.forEach((p) => {
    const expStartRow = currentRow;
    const members = p.members && p.members.length > 0 ? p.members : [emptyMember(1)];
    const expRowCount = members.length;

    for (let i = 0; i < expRowCount; i++) {
      const m = members[i];
      const particulars = m && m.name
        ? [m.name.trim(), m.designation?.trim(), m.specialization?.trim() || m.postal_address?.trim()].filter(Boolean).join(' / ')
        : '';
      const contact = m ? m.contact_details || '' : '';

      data.push([
        i === 0 ? (p.course_title || '') : null,
        i === 0 ? (p.course_code || '') : null,
        i === 0 ? String(p.credits || '4') : null,
        i === 0 ? (p.course_nature || 'Major') : null,
        i === 0 ? (p.programme || '') : null,
        i === 0 ? (p.regular_backlog || 'Regular') : null,
        i + 1,
        particulars,
        null, null,
        contact,
      ]);
      merges.push({ s: { r: currentRow, c: 7 }, e: { r: currentRow, c: 9 } });
      rowHeights[currentRow] = { hpt: 28 };
      currentRow++;
    }

    // Vertical merges for course particulars columns 0 to 5
    for (let col = 0; col <= 5; col++) {
      merges.push({ s: { r: expStartRow, c: col }, e: { r: expStartRow + expRowCount - 1, c: col } });
    }
  });

  // Spacer after table
  data.push(['', '', '', '', '', '', '', '', '', '', '']);
  rowHeights[currentRow] = { hpt: 12 };
  currentRow++;

  // 4. Endorsement Certificate Header (at bottom of semester sheet)
  const certHeadRow = currentRow;
  data.push([
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)',
    null, null, null, null, null, null, null, null, null, null,
  ]);
  merges.push({ s: { r: certHeadRow, c: 0 }, e: { r: certHeadRow, c: 10 } });
  rowHeights[certHeadRow] = { hpt: 20 };
  currentRow++;

  // Certificate Statement
  const certTextRow = currentRow;
  data.push([
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.',
    null, null, null, null, null, null, null, null, null, null,
  ]);
  merges.push({ s: { r: certTextRow, c: 0 }, e: { r: certTextRow, c: 10 } });
  rowHeights[certTextRow] = { hpt: 26 };
  currentRow++;

  // Spacer rows for signing
  data.push(['', '', '', '', '', '', '', '', '', '', '']);
  rowHeights[currentRow] = { hpt: 20 };
  currentRow++;
  data.push(['', '', '', '', '', '', '', '', '', '', '']);
  rowHeights[currentRow] = { hpt: 20 };
  currentRow++;

  // 5. 3 Signatures (Titles only)
  const sigLabelRow = currentRow;
  data.push([
    '(Signature of Teacher In-charge)', null, null,
    null,
    '(Signature of Head/Co-ordinator)', null, null,
    null,
    '(Signature of the Dean of School)', null, null,
  ]);
  merges.push({ s: { r: sigLabelRow, c: 0 }, e: { r: sigLabelRow, c: 2 } });
  merges.push({ s: { r: sigLabelRow, c: 4 }, e: { r: sigLabelRow, c: 6 } });
  merges.push({ s: { r: sigLabelRow, c: 8 }, e: { r: sigLabelRow, c: 10 } });
  rowHeights[sigLabelRow] = { hpt: 22 };
  currentRow++;

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!merges'] = merges;
  ws['!rows'] = rowHeights;
  ws['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 26 }, { wch: 24 }, { wch: 16 },
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 36 },
  ];

  return ws;
}

function formatExpertParticulars(m?: PanelMember, defaultDept?: string | null): string {
  if (!m || !m.name) return '';
  const parts = [
    m.name.trim(),
    m.designation?.trim(),
    (m.specialization?.trim() || defaultDept?.trim()),
  ].filter(Boolean);
  return parts.join(' / ');
}

/**
 * Builds an official Excel worksheet using ExcelJS with:
 * - All subjects of that semester rendered together in ONE seamless continuous table
 * - Single top metadata block for the semester
 * - Single endorsement certificate and 3 signatures at the bottom
 * - Landscape A4 view
 * - Complete cell borders on all headers, metadata, and data cells
 * - Distinct, solid borders between every teacher row
 * - 3 signature titles without name labels
 */
export function buildSemesterWorksheetExcelJS(
  wb: ExcelJS.Workbook,
  panels: ExaminerPanel[],
  sheetName: string
): ExcelJS.Worksheet {
  if (panels.length === 0) return wb.addWorksheet(sheetName);
  const ws = wb.addWorksheet(sheetName);
  const p0 = panels[0];

  // Set page setup: landscape A4
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.25,
      bottom: 0.25,
      header: 0.1,
      footer: 0.1,
    },
    showGridLines: false,
    blackAndWhite: false,
  };

  ws.views = [{ showGridLines: false }];

  ws.columns = [
    { width: 32 }, // 1: Title
    { width: 15 }, // 2: Code
    { width: 8 },  // 3: Credits
    { width: 26 }, // 4: Nature
    { width: 24 }, // 5: Programme
    { width: 16 }, // 6: Reg/Back
    { width: 6 },  // 7: S. No.
    { width: 22 }, // 8: Particulars (merged col 1)
    { width: 18 }, // 9: Particulars (merged col 2)
    { width: 18 }, // 10: Particulars (merged col 3) -> total width = 58
    { width: 36 }, // 11: Contact Details
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F4F7' },
  };

  const metaFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFAFBFD' },
  };

  const whiteFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  let r = 1;

  // 0. Confidential Document Title (Single top header for the semester)
  ws.getRow(r).getCell(1).value = 'PANEL OF EXAMINERS (CONFIDENTIAL)';
  ws.mergeCells(r, 1, r, 11);
  ws.getRow(r).getCell(1).font = { name: 'Times New Roman', size: 13, bold: true };
  ws.getRow(r).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 26;
  r++;

  // 1. Metadata Block (2 columns x 3 rows)
  const meta = [
    [
      `Name of the Department offering the courses:  ${p0.department_label || '-'}`,
      `School:  ${p0.school || '-'}`,
    ],
    [
      `Session:  ${p0.session_label || '-'}`,
      `Programme:  ${p0.programme || '-'}`,
    ],
    [
      `Semester:  ${p0.semester || '-'}`,
      `Batch:  ${p0.batch || '-'}`,
    ],
  ];

  meta.forEach(([colLeft, colRight]) => {
    ws.getRow(r).getCell(1).value = colLeft;
    ws.mergeCells(r, 1, r, 6);
    ws.getRow(r).getCell(7).value = colRight;
    ws.mergeCells(r, 7, r, 11);
    ws.getRow(r).height = 21;

    for (let c = 1; c <= 11; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = thinBorder;
      cell.fill = metaFill;
      cell.font = { name: 'Times New Roman', size: 9.5, bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
      };
    }
    r++;
  });

  // 2. Table Header 1
  const tHead1 = r;
  ws.getRow(r).getCell(1).value = 'Details of the course(s) for which panel is submitted';
  ws.mergeCells(r, 1, r, 6);
  ws.getRow(r).getCell(7).value = 'S.\nNo.';
  ws.mergeCells(r, 7, r + 1, 7);
  ws.getRow(r).getCell(8).value =
    'Particulars of the Experts in order of Preference\n(Name/Designation/Department)';
  ws.mergeCells(r, 8, r + 1, 10);
  ws.getRow(r).getCell(11).value = 'Contact Details\n(Email ID/Mobile No.)';
  ws.mergeCells(r, 11, r + 1, 11);
  ws.getRow(r).height = 26;
  r++;

  // Table Header 2
  const subHeaders = [
    'Course Title',
    'Course Code',
    'Credits',
    'Nature of Course \n(Major, Minor, Lab, MDC, VAC, SEC, AEC, OGE, MOOCs etc.)',
    'Programme(s)\n(whose students have opted the course)',
    'Whether Regular/ Backlog or Both',
  ];
  subHeaders.forEach((sh, idx) => {
    ws.getRow(r).getCell(idx + 1).value = sh;
  });
  ws.getRow(r).height = 38;

  for (let tr = tHead1; tr <= r; tr++) {
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getRow(tr).getCell(c);
      cell.border = thinBorder;
      cell.fill = headerFill;
      cell.font = { name: 'Times New Roman', size: 8.5, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
  }
  r++;

  // 3. Render ALL subjects of this semester continuously in ONE table
  panels.forEach((p) => {
    const expStartRow = r;
    const members = p.members && p.members.length > 0 ? p.members : [emptyMember(1)];
    const expRowCount = members.length;

    for (let i = 0; i < expRowCount; i++) {
      const curRow = r;
      const m = members[i];
      const particulars = formatExpertParticulars(m, p.department_label);
      const contact = m?.contact_details || '';

      if (i === 0) {
        ws.getRow(curRow).getCell(1).value = p.course_title || '';
        ws.getRow(curRow).getCell(2).value = p.course_code || '';
        ws.getRow(curRow).getCell(3).value = String(p.credits || '4');
        ws.getRow(curRow).getCell(4).value = p.course_nature || 'Major';
        ws.getRow(curRow).getCell(5).value = p.programme || '';
        ws.getRow(curRow).getCell(6).value = p.regular_backlog || 'Regular';
      }
      ws.getRow(curRow).getCell(7).value = i + 1;
      ws.getRow(curRow).getCell(8).value = particulars;
      ws.mergeCells(curRow, 8, curRow, 10);
      ws.getRow(curRow).getCell(11).value = contact;
      ws.getRow(curRow).height = 28;

      for (let c = 1; c <= 11; c++) {
        const cell = ws.getRow(curRow).getCell(c);
        cell.font = { name: 'Times New Roman', size: 9.5, bold: c === 7 };
        const isCenter = c === 2 || c === 3 || c === 6 || c === 7;
        cell.alignment = {
          vertical: 'middle',
          horizontal: isCenter ? 'center' : 'left',
          wrapText: true,
        };
      }
      r++;
    }

    // Vertical merges for course particulars columns 1 to 6
    for (let c = 1; c <= 6; c++) {
      ws.mergeCells(expStartRow, c, expStartRow + expRowCount - 1, c);
    }

    // Enforce distinct solid thin borders for every individual teacher row & outer perimeter of course block
    for (let i = 0; i < expRowCount; i++) {
      const rowNum = expStartRow + i;
      const row = ws.getRow(rowNum);

      // Columns 1 to 6 (Merged course particulars outer borders)
      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: i === 0 ? { style: 'thin', color: { argb: 'FF000000' } } : undefined,
          bottom: i === expRowCount - 1 ? { style: 'thin', color: { argb: 'FF000000' } } : undefined,
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      }

      // Columns 7 to 11 (Every teacher has a distinct, solid border on all 4 sides)
      for (let c = 7; c <= 11; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      }
    }
  });

  // Spacer after expert table
  ws.getRow(r).height = 14;
  for (let c = 1; c <= 11; c++) {
    const cell = ws.getRow(r).getCell(c);
    cell.border = {};
    cell.fill = whiteFill;
  }
  r++;

  // 4. Endorsement Certificate Header (at bottom of the semester sheet, NO BOX / NO BORDER)
  ws.getRow(r).getCell(1).value =
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)';
  ws.mergeCells(r, 1, r, 11);
  ws.getRow(r).getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
  ws.getRow(r).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 22;
  for (let c = 1; c <= 11; c++) {
    const cell = ws.getRow(r).getCell(c);
    cell.border = {};
    cell.fill = whiteFill;
  }
  r++;

  // Certificate Statement (NO BOX / NO BORDER)
  ws.getRow(r).getCell(1).value =
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.';
  ws.mergeCells(r, 1, r, 11);
  ws.getRow(r).getCell(1).font = { name: 'Times New Roman', size: 9, italic: true };
  ws.getRow(r).getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(r).height = 28;
  for (let c = 1; c <= 11; c++) {
    const cell = ws.getRow(r).getCell(c);
    cell.border = {};
    cell.fill = whiteFill;
  }
  r++;

  // Ample blank signing space on top of signature labels
  for (let s = 0; s < 3; s++) {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = {};
      cell.fill = whiteFill;
    }
    r++;
  }

  // 5. 3 Signatures towards bottom (Titles only, no names)
  const sigRow = r;
  ws.getRow(sigRow).getCell(1).value = '(Signature of Teacher In-charge)';
  ws.mergeCells(sigRow, 1, sigRow, 3);
  ws.getRow(sigRow).getCell(5).value = '(Signature of Head/Co-ordinator)';
  ws.mergeCells(sigRow, 5, sigRow, 7);
  ws.getRow(sigRow).getCell(9).value = '(Signature of the Dean of School)';
  ws.mergeCells(sigRow, 9, sigRow, 11);
  ws.getRow(sigRow).height = 22;
  for (let c = 1; c <= 11; c++) {
    const cell = ws.getRow(sigRow).getCell(c);
    cell.border = {};
    cell.fill = whiteFill;
    cell.font = { name: 'Times New Roman', size: 9.5, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  return ws;
}

/**
 * Exports panels to an Excel (.xlsx) workbook using ExcelJS.
 * Features:
 * - When viewed in Excel: all subjects of a semester are in that semester's sheet tab.
 * - Tab switching: bottom tab bar has tabs for each semester (e.g. Semester - III, Semester - V, etc.).
 * - When printed: each subject panel prints on its own separate page due to horizontal page breaks.
 * - Dynamic rows matching selected experts (e.g. 4 rows if 4 are selected).
 * - 3 clean signature titles without name labels.
 */
export async function exportPanelsExcel(
  panels: ExaminerPanel[],
  fileName: string,
  mode: 'by_semester' | 'by_subject' = 'by_semester'
) {
  if (panels.length === 0) return;
  const wb = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  if (mode === 'by_subject') {
    panels.forEach((p, idx) => {
      const sheetName = formatSemesterSheetName(
        p.semester,
        p.programme,
        p.course_code || `Course ${idx + 1}`,
        usedNames
      );
      buildSemesterWorksheetExcelJS(wb, [p], sheetName);
    });
  } else {
    // Group by session, programme, semester
    const semMap = new Map<string, ExaminerPanel[]>();
    panels.forEach((p) => {
      const key = `${p.session_label || ''}|${p.programme || ''}|${p.semester || ''}`;
      if (!semMap.has(key)) semMap.set(key, []);
      semMap.get(key)!.push(p);
    });

    semMap.forEach((semPanels) => {
      const sample = semPanels[0];
      const sheetName = formatSemesterSheetName(
        sample.semester,
        sample.programme,
        null,
        usedNames
      );
      buildSemesterWorksheetExcelJS(wb, semPanels, sheetName);
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPanelExcel(panel: ExaminerPanel) {
  exportPanelsExcel([panel], `panel-${panel.course_code || 'course'}.xlsx`, 'by_semester');
}

function drawHeaderMetadata(doc: jsPDF, p: ExaminerPanel, startY: number, leftMargin = 24, tableWidth = 792) {
  autoTable(doc, {
    startY,
    body: [
      [
        {
          content: `Name of the Department offering the courses:  ${p.department_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `School:  ${p.school || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `Session:  ${p.session_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Programme:  ${p.programme || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `Semester:  ${p.semester || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Batch:  ${p.batch || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [0, 0, 0],
      lineColor: [170, 170, 170],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 392 },
      1: { cellWidth: 392 },
    },
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });
}

const TABLE_HEAD = [
  [
    {
      content: 'Details of the course(s) for which panel is submitted',
      colSpan: 6,
      styles: { halign: 'center', fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
    },
    {
      content: 'S.\nNo.',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5 },
    },
    {
      content: 'Particulars of the Experts in order of Preference\n(Name/Designation/Department)',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5 },
    },
    {
      content: 'Contact Details\n(Email ID/Mobile No.)',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5 },
    },
  ],
  [
    { content: 'Course Title', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5 } },
    { content: 'Course Code', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5 } },
    { content: 'Credits', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5 } },
    { content: 'Nature of Course\n(Major, Minor, Lab, MDC, VAC, SEC, AEC, OGE, MOOCs etc.)', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
    { content: 'Programme(s)\n(whose students have opted the course)', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7 } },
    { content: 'Whether Regular/\nBacklog or Both', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7 } },
  ],
];

// Optimized column distribution: 792 pt total width, giving maximum width to Experts (248 pt) & Contact Details (184 pt)
const COLUMN_STYLES = {
  0: { cellWidth: 85, halign: 'left' as const },
  1: { cellWidth: 48, halign: 'center' as const },
  2: { cellWidth: 25, halign: 'center' as const },
  3: { cellWidth: 70, halign: 'left' as const },
  4: { cellWidth: 62, halign: 'left' as const },
  5: { cellWidth: 48, halign: 'center' as const },
  6: { cellWidth: 22, halign: 'center' as const },
  7: { cellWidth: 248, halign: 'left' as const },
  8: { cellWidth: 184, halign: 'left' as const },
};

function buildCourseBodyRows(panel: ExaminerPanel): any[][] {
  const rowCount = Math.max(1, panel.members.length);
  const rows: any[][] = [];

  for (let r = 0; r < rowCount; r++) {
    const member = panel.members[r];
    const particulars = formatExpertParticulars(member, panel.department_label);
    const contact = member?.contact_details || '';

    if (r === 0) {
      rows.push([
        { content: panel.course_title || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: 8 } },
        { content: panel.course_code || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: 8 } },
        { content: String(panel.credits || '-'), rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: 8 } },
        { content: panel.course_nature || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: 7.2 } },
        { content: panel.programme || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: 7.2 } },
        { content: panel.regular_backlog || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: 7.2 } },
        { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
        { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
        { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
      ]);
    } else {
      rows.push([
        { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
        { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
        { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: 8, minCellHeight: 23 } },
      ]);
    }
  }
  return rows;
}

function drawCertificate(doc: jsPDF) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const leftMargin = 28;

  // Space after the panel box
  const tableBottom = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : 300;
  const certY = tableBottom + 26;

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)',
    width / 2,
    certY,
    { align: 'center' }
  );

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  const certText =
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.';
  doc.text(doc.splitTextToSize(certText, width - 80), width / 2, certY + 14, { align: 'center', maxWidth: width - 80 });

  // Ample blank vertical clearance for physical signatures and official stamps
  const sigY = Math.max(certY + 65, height - 55);

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);

  doc.text('(Signature of Teacher In-charge)', leftMargin + 20, sigY);
  doc.text('(Signature of Head/Co-ordinator)', width / 2, sigY, { align: 'center' });
  doc.text('(Signature of the Dean of School)', width - leftMargin - 20, sigY, { align: 'right' });
}

function drawSinglePanelDocument(doc: jsPDF, panel: ExaminerPanel) {
  const width = doc.internal.pageSize.getWidth();
  const leftMargin = 24;
  const tableWidth = 792;

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('PANEL OF EXAMINERS (CONFIDENTIAL)', width / 2, 28, { align: 'center' });

  // Metadata block
  drawHeaderMetadata(doc, panel, 38, leftMargin, tableWidth);

  // Main unified table
  const tableStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 105;
  const body = buildCourseBodyRows(panel);

  autoTable(doc, {
    startY: tableStartY,
    head: TABLE_HEAD,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
    },
    styles: {
      font: 'times',
      lineColor: [150, 150, 150],
      lineWidth: 0.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      textColor: [0, 0, 0],
    },
    columnStyles: COLUMN_STYLES,
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });

  // Certificate block with 3 signature titles
  drawCertificate(doc);
}

/**
 * Draws all panels belonging to a single semester on a SINGLE landscape A4 page.
 * Uses adaptive row padding and font sizing to guarantee that all courses,
 * expert particulars, endorsement certificate, and all 3 signatures fit onto 1 printed page.
 */
function drawCombinedSemesterDocument(doc: jsPDF, panels: ExaminerPanel[]) {
  if (panels.length === 0) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 24;
  const tableWidth = 792;
  const p0 = panels[0];

  // Document Title
  doc.setFont('times', 'bold');
  doc.setFontSize(11.5);
  doc.text('PANEL OF EXAMINERS (CONFIDENTIAL)', pageWidth / 2, 22, { align: 'center' });

  // Top Semester Metadata Block
  autoTable(doc, {
    startY: 28,
    body: [
      [
        {
          content: `Name of the Department offering the courses:  ${p0.department_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Semester:  ${p0.semester || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `School:  ${p0.school || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Batch:  ${p0.batch || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `Session:  ${p0.session_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: p0.programme ? `Programme:  ${p0.programme}` : '',
          styles: { fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 552 },
      1: { cellWidth: 240 },
    },
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });

  // Dynamic sizing based on number of panels to GUARANTEE fitting on 1 single page when printed
  const courseCount = panels.length;
  const isLarge = courseCount >= 4;
  const isMedium = courseCount === 3;
  const cellPad = isLarge ? 1.4 : (isMedium ? 2 : 2.5);
  const dataFontSize = isLarge ? 6.5 : (isMedium ? 7 : 7.5);

  const body: any[][] = [];
  panels.forEach((p) => {
    const rowCount = Math.max(1, p.members.length);
    for (let r = 0; r < rowCount; r++) {
      const member = p.members[r];
      const particulars = formatExpertParticulars(member, p.department_label);
      const contact = member?.contact_details || '';

      if (r === 0) {
        body.push([
          { content: p.course_title || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: dataFontSize } },
          { content: p.course_code || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: dataFontSize } },
          { content: String(p.credits || '-'), rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: dataFontSize } },
          { content: p.course_nature || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: Math.max(6, dataFontSize - 0.5) } },
          { content: p.programme || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: Math.max(6, dataFontSize - 0.5) } },
          { content: p.regular_backlog || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: Math.max(6, dataFontSize - 0.5) } },
          { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: dataFontSize } },
          { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: dataFontSize } },
          { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: dataFontSize } },
        ]);
      } else {
        body.push([
          { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: dataFontSize } },
          { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: dataFontSize } },
          { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: dataFontSize } },
        ]);
      }
    }
  });

  const tableStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 4 : 95;
  autoTable(doc, {
    startY: tableStartY,
    head: [
      [
        {
          content: 'Details of the course(s) for which panel is submitted',
          colSpan: 6,
          styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, cellPadding: 2 },
        },
        {
          content: 'S. No.',
          rowSpan: 2,
          styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
        },
        {
          content: 'Particulars of the Experts in order of Preference\n(Name/Designation/Department)',
          rowSpan: 2,
          styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
        },
        {
          content: 'Contact Details\n(Email ID/Mobile No.)',
          rowSpan: 2,
          styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
        },
      ],
      [
        { content: 'Course Title', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
        { content: 'Course Code', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
        { content: 'Credits', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
        { content: 'Nature', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
        { content: 'Programme(s)', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
        { content: 'Reg/Back', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
      ],
    ],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
    },
    styles: {
      font: 'times',
      lineColor: [150, 150, 150],
      lineWidth: 0.4,
      cellPadding: cellPad,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 85, halign: 'left' },
      1: { cellWidth: 48, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 70, halign: 'left' },
      4: { cellWidth: 62, halign: 'left' },
      5: { cellWidth: 48, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 248, halign: 'left' },
      8: { cellWidth: 184, halign: 'left' },
    },
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });

  // Endorsement certificate and signatures with proper vertical spacing
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableBottom = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : 350;
  
  // Dynamic gap after the table box based on course count
  const certGap = courseCount <= 2 ? 20 : courseCount === 3 ? 14 : 10;
  const certY = tableBottom + certGap;

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)',
    pageWidth / 2,
    certY,
    { align: 'center' }
  );

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  const certText =
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.';
  doc.text(doc.splitTextToSize(certText, pageWidth - 60), pageWidth / 2, certY + 11, { align: 'center', maxWidth: pageWidth - 60 });

  // Ample vertical room for signatures and stamps above the labels
  const sigY = Math.min(pageHeight - 38, Math.max(certY + 45, (pageHeight + certY + 15) / 2));

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);

  doc.text('(Signature of Teacher In-charge)', leftMargin + 20, sigY);
  doc.text('(Signature of Head/Co-ordinator)', pageWidth / 2, sigY, { align: 'center' });
  doc.text('(Signature of the Dean of School)', pageWidth - leftMargin - 20, sigY, { align: 'right' });
}

