import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
      null, null, null, null, null, null, null, null,
      'Semester:',
      null,
    ],
    [
      'School:',
      null, null, null, null, null, null, null, null,
      'Batch:',
      null,
    ],
    [
      'Session:',
      null, null, null, null, null, null, null, null,
      null, null,
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
    { s: { c: 0, r: 0 }, e: { c: 8, r: 0 } },
    { s: { c: 9, r: 0 }, e: { c: 10, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: 8, r: 1 } },
    { s: { c: 9, r: 1 }, e: { c: 10, r: 1 } },
    { s: { c: 0, r: 2 }, e: { c: 8, r: 2 } },
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
    { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 32 }, { wch: 24 }, { wch: 20 },
    { wch: 6 }, { wch: 36 }, { wch: 4 }, { wch: 4 }, { wch: 30 },
  ];

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
        } else if (/^semester/i.test(val)) {
          header.semester = val.split(':')[1]?.trim() || nextVal;
        } else if (/^batch/i.test(val)) {
          header.batch = val.split(':')[1]?.trim() || nextVal;
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

  // Group panels by session and semester
  const groups = new Map<string, ExaminerPanel[]>();
  panels.forEach((p) => {
    const key = `${p.session_label || 'current'} · Sem ${p.semester || '-'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  let groupIndex = 0;
  groups.forEach((groupPanels) => {
    if (groupIndex > 0) doc.addPage();
    drawSemesterPanelDocument(doc, groupPanels);
    groupIndex++;
  });

  doc.save(fileName);
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

function drawHeaderMetadata(doc: jsPDF, p: ExaminerPanel, startY: number) {
  const leftMargin = 28;
  const width = doc.internal.pageSize.getWidth();
  const tableWidth = width - leftMargin * 2;

  autoTable(doc, {
    startY,
    body: [
      [
        {
          content: `Name of the Department offering the courses:  ${p.department_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Semester:  ${p.semester || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `School:  ${p.school || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: `Batch:  ${p.batch || '-'}`,
          styles: { fontStyle: 'bold' },
        },
      ],
      [
        {
          content: `Session:  ${p.session_label || '-'}`,
          styles: { fontStyle: 'bold' },
        },
        {
          content: p.programme ? `Programme:  ${p.programme}` : '',
          styles: { fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9.5,
      cellPadding: 4,
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 545 },
      1: { cellWidth: 240 },
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
      styles: { halign: 'center', fontStyle: 'bold', fontSize: 9.5, cellPadding: 4 },
    },
    {
      content: 'S.\nNo.',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    },
    {
      content: 'Particulars of the Experts in order of Preference\n(Name/Designation/Department)',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5, cellPadding: 3 },
    },
    {
      content: 'Contact Details\n(Email ID/Mobile No.)',
      rowSpan: 2,
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5, cellPadding: 3 },
    },
  ],
  [
    { content: 'Course Title', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } },
    { content: 'Course Code', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } },
    { content: 'Credits', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } },
    { content: 'Nature of Course\n(Major, Minor, Lab, MDC, VAC, SEC, AEC, OGE, MOOCs etc.)', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7 } },
    { content: 'Programme(s)\n(whose students have opted the course)', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5 } },
    { content: 'Whether Regular/\nBacklog or Both', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5 } },
  ],
];

const COLUMN_STYLES = {
  0: { cellWidth: 105, halign: 'left' as const },
  1: { cellWidth: 60, halign: 'center' as const },
  2: { cellWidth: 38, halign: 'center' as const },
  3: { cellWidth: 105, halign: 'left' as const },
  4: { cellWidth: 85, halign: 'left' as const },
  5: { cellWidth: 68, halign: 'center' as const },
  6: { cellWidth: 28, halign: 'center' as const },
  7: { cellWidth: 168, halign: 'left' as const },
  8: { cellWidth: 128, halign: 'left' as const },
};

function buildCourseBodyRows(panel: ExaminerPanel): any[][] {
  const rowCount = Math.max(5, panel.members.length);
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
        { content: panel.course_nature || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: 7.5 } },
        { content: panel.programme || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'left', fontSize: 7.5 } },
        { content: panel.regular_backlog || '-', rowSpan: rowCount, styles: { valign: 'middle', halign: 'center', fontSize: 7.5 } },
        { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
        { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: 8 } },
        { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: 8 } },
      ]);
    } else {
      rows.push([
        { content: String(r + 1), styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
        { content: particulars, styles: { halign: 'left', valign: 'middle', fontSize: 8 } },
        { content: contact, styles: { halign: 'left', valign: 'middle', fontSize: 8 } },
      ]);
    }
  }
  return rows;
}

function drawCertificate(doc: jsPDF, headName?: string | null, deanName?: string | null) {
  const width = doc.internal.pageSize.getWidth();
  const leftMargin = 28;

  let certY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 460;
  if (certY + 95 > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    certY = 35;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)',
    width / 2,
    certY,
    { align: 'center' }
  );

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  const certText =
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.';
  doc.text(doc.splitTextToSize(certText, width - 80), width / 2, certY + 14, { align: 'center', maxWidth: width - 80 });

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `(Signature of Head/Co-ordinator)${headName ? '   ' + headName : ''}`,
    leftMargin + 30,
    certY + 52
  );
  doc.text(
    `(Signature of the Dean of School)${deanName ? '   ' + deanName : ''}`,
    width / 2 + 60,
    certY + 52
  );
}

function drawSinglePanelDocument(doc: jsPDF, panel: ExaminerPanel) {
  const width = doc.internal.pageSize.getWidth();
  const leftMargin = 28;
  const tableWidth = width - leftMargin * 2;

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('PANEL OF EXAMINERS (CONFIDENTIAL)', width / 2, 32, { align: 'center' });

  // Metadata block
  drawHeaderMetadata(doc, panel, 44);

  // Main unified table
  const tableStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 110;
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
      lineWidth: 0.6,
    },
    styles: {
      font: 'times',
      lineColor: [150, 150, 150],
      lineWidth: 0.5,
      cellPadding: 4,
      textColor: [0, 0, 0],
    },
    columnStyles: COLUMN_STYLES,
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });

  // Certificate block
  drawCertificate(doc, panel.head_name, panel.dean_name);
}

function drawSemesterPanelDocument(doc: jsPDF, panels: ExaminerPanel[]) {
  const first = panels[0];
  const width = doc.internal.pageSize.getWidth();
  const leftMargin = 28;
  const tableWidth = width - leftMargin * 2;

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('PANEL OF EXAMINERS (CONFIDENTIAL)', width / 2, 32, { align: 'center' });

  // Metadata block
  drawHeaderMetadata(doc, first, 44);

  // Combine all courses into the same table
  const tableStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 110;
  const body: any[][] = [];
  panels.forEach((p) => {
    body.push(...buildCourseBodyRows(p));
  });

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
      lineWidth: 0.6,
    },
    styles: {
      font: 'times',
      lineColor: [150, 150, 150],
      lineWidth: 0.5,
      cellPadding: 4,
      textColor: [0, 0, 0],
    },
    columnStyles: COLUMN_STYLES,
    margin: { left: leftMargin, right: leftMargin },
    tableWidth,
  });

  // Certificate block
  drawCertificate(doc, first.head_name, first.dean_name);
}
