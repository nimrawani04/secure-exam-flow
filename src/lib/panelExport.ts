import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ExaminerPanel, PanelMember } from '@/hooks/useExaminerPanels';

export const MEMBER_COLUMNS = [
  'Name',
  'Designation',
  'Specialization',
  'Postal Address',
  'Operational Contact Details',
  'Status',
];

export function downloadPanelTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    MEMBER_COLUMNS,
    ['Dr. A. Example', 'Professor', 'Computer Networks', 'Dept. of CSE, XYZ University', '9900112233 / a@example.com', 'Internal'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Panel');
  XLSX.writeFile(wb, 'panel-of-examiners-template.xlsx');
}

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().replace(/[^a-z]/g, '');
    if (keys.includes(norm)) return String(row[key] ?? '').trim();
  }
  return '';
};

export async function parsePanelWorkbook(file: File): Promise<PanelMember[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows
    .map((row, idx) => ({
      position: idx + 1,
      name: pick(row, ['name', 'examinername', 'fullname']),
      designation: pick(row, ['designation', 'post', 'rank']),
      specialization: pick(row, ['specialization', 'specializationon', 'specialisation', 'area']),
      postal_address: pick(row, ['postaladdress', 'address']),
      contact_details: pick(row, ['operationalcontactdetails', 'contactdetails', 'contact', 'phone', 'email']),
      status: pick(row, ['status', 'type']),
    }))
    .filter((m) => m.name);
}

export function exportPanelPdf(panel: ExaminerPanel) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  drawPanel(doc, panel);
  doc.save(`panel-of-examiners-${panel.course_code || 'course'}.pdf`);
}

export function exportPanelsPdf(panels: ExaminerPanel[], fileName: string) {
  if (panels.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  panels.forEach((p, i) => {
    if (i > 0) doc.addPage();
    drawPanel(doc, p);
  });
  doc.save(fileName);
}

function drawPanel(doc: jsPDF, panel: ExaminerPanel) {
  const width = doc.internal.pageSize.getWidth();

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('Panel of Examiners (Confidential)', width / 2, 48, { align: 'center' });

  doc.setFontSize(11);
  const left = 40;
  const right = width / 2 + 60;
  const line = (y: number, l: string, r: string) => {
    doc.text(l, left, y);
    doc.text(r, right, y);
  };
  line(80, `School : ${panel.school || '-'}`, `Department : ${panel.department_label || '-'}`);
  line(98, `Semester : ${panel.semester || '-'}`, `Session : ${panel.session_label || '-'}`);
  line(116, `Programme : ${panel.programme || '-'}`, `Course Code : ${panel.course_code || '-'}`);
  doc.text(doc.splitTextToSize(`Course Title : ${panel.course_title || '-'}`, width - 80), left, 134);

  autoTable(doc, {
    startY: 150,
    head: [['S. No.', ...MEMBER_COLUMNS]],
    body: panel.members.map((m, i) => [
      `${i + 1}.`,
      m.name || '',
      m.designation || '',
      m.specialization || '',
      m.postal_address || '',
      m.contact_details || '',
      m.status || '',
    ]),
    styles: { font: 'times', fontSize: 10, cellPadding: 6, lineWidth: 0.6, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    theme: 'grid',
    margin: { left: 40, right: 40 },
  });

  let endY = (doc as any).lastAutoTable?.finalY ?? 300;
  if (endY + 140 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    endY = 20;
  }
  doc.setFontSize(11);
  doc.setFont('times', 'bold');
  doc.text(
    'Certificate by the Head/Coordinator of the Department (Duly Endorsed by Dean Concerned)',
    width / 2,
    endY + 34,
    { align: 'center' }
  );
  doc.setFont('times', 'normal');
  const certificate =
    'Certified that the detailed particulars furnished in the Panel of Examiners like Contact Details, Postal Address and Specialization are correct/operational. Further, under normal settings, the Examiners as stated above shall readily accept any confidential assignment.';
  doc.text(doc.splitTextToSize(certificate, width - 120), width / 2, endY + 54, { align: 'center' });

  doc.text(`(Signature of Head/Co-ordinator)  ${panel.head_name || ''}`, left + 40, endY + 120);
  doc.text(`(Signature of the Dean of School)  ${panel.dean_name || ''}`, right, endY + 120);
}
