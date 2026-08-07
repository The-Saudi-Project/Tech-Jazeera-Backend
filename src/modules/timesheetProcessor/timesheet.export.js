/**
 * Timesheet export — turns a processed result (from timesheet.service) into a
 * professionally formatted .xlsx Buffer. Kept separate from the business logic
 * so the file-format concern never leaks into the processor.
 *
 * Styling mirrors the app's theme (indigo header band) and the existing
 * attendance export, so every spreadsheet the ERP produces looks consistent.
 */
import ExcelJS from 'exceljs';
import { minutesToHHMM } from './timesheet.time.js';

// Theme (ARGB). Indigo band + tinted zebra rows, matching the app palette.
const INK = 'FF14162B';
const INDIGO = 'FF4F46E5';
const HEADER_FILL = 'FF4F46E5';
const HEADER_TEXT = 'FFFFFFFF';
const ZEBRA_FILL = 'FFF3F4FB';
const BORDER = 'FFD8DCEC';

const thin = { style: 'thin', color: { argb: BORDER } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

const HEADERS = [
  'Date', 'Day', 'Login', 'Logout', 'Worked', 'Required', 'Deficiency', 'Overtime', 'Status',
];
const WIDTHS = [13, 7, 9, 9, 10, 10, 12, 10, 15];

/** Status → font color, so problem days read at a glance. */
const STATUS_COLOR = {
  Present: 'FF16A34A',
  Overtime: 'FFB45309',
  Deficient: 'FFDC2626',
  'Single Punch': INDIGO,
  'No Attendance': 'FF64748B',
  Holiday: 'FF0D9488', // teal
  'Holiday (Worked)': 'FFB45309', // amber, like overtime
};

/** @param {object} result  the object returned by timesheet.service.processTimesheet */
export async function buildTimesheetXlsx(result) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Al Jazeera ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Timesheet', {
    views: [{ state: 'frozen', ySplit: 6 }], // keep the header visible while scrolling
  });
  const lastCol = HEADERS.length; // 9

  // ---- Title band --------------------------------------------------------
  ws.mergeCells(1, 1, 1, lastCol);
  const title = ws.getCell('A1');
  title.value = 'Monthly Timesheet';
  title.font = { bold: true, size: 16, color: { argb: INK } };

  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell('A2').value = `${result.employee.fullName}  (${result.employee.employeeId})`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: INDIGO } };

  ws.mergeCells(3, 1, 3, lastCol);
  ws.getCell('A3').value = `${result.monthName} ${result.year}`;
  ws.getCell('A3').font = { size: 11, color: { argb: INK } };

  ws.mergeCells(4, 1, 4, lastCol);
  ws.getCell('A4').value =
    `Required hours/day: ${minutesToHHMM(result.requiredMinutes)}   ·   ` +
    `Generated: ${new Date(result.generatedAt).toLocaleString('en-GB')}`;
  ws.getCell('A4').font = { size: 10, color: { argb: 'FF64748B' } };

  ws.getRow(5).height = 4; // thin spacer

  // ---- Column headers ----------------------------------------------------
  const headerRow = ws.getRow(6);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allBorders;
  });
  headerRow.height = 20;

  // ---- Data rows ---------------------------------------------------------
  result.rows.forEach((r, idx) => {
    const row = ws.addRow([
      r.date,
      r.day,
      r.login ?? '',
      r.logout ?? '',
      minutesToHHMM(r.workedMinutes),
      minutesToHHMM(r.requiredMinutes),
      minutesToHHMM(r.deficiencyMinutes),
      minutesToHHMM(r.overtimeMinutes),
      r.status,
    ]);
    row.eachCell((cell, col) => {
      cell.border = allBorders;
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
      }
    });
    // Colour the status cell.
    const statusCell = row.getCell(lastCol);
    statusCell.font = { bold: true, color: { argb: STATUS_COLOR[r.status] ?? INK } };
  });

  // ---- Summary block -----------------------------------------------------
  ws.addRow([]);
  const s = result.summary;
  const summaryTitle = ws.addRow(['Monthly Summary']);
  summaryTitle.getCell(1).font = { bold: true, size: 12, color: { argb: INK } };

  const summaryLines = [
    ['Working Days', String(s.workingDays)],
    ['Holidays', String(s.holidayDays)],
    ['Present Days', String(s.presentDays)],
    ['Single Punch Days', String(s.singlePunchDays)],
    ['No Attendance Days', String(s.noAttendanceDays)],
    ['Total Worked Hours', minutesToHHMM(s.totalWorkedMinutes)],
    ['Total Required Hours', minutesToHHMM(s.totalRequiredMinutes)],
    ['Total Deficiency', minutesToHHMM(s.totalDeficiencyMinutes)],
    ['Total Overtime', minutesToHHMM(s.totalOvertimeMinutes)],
  ];
  for (const [label, value] of summaryLines) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    row.getCell(1).border = allBorders;
    row.getCell(2).border = allBorders;
    row.getCell(2).alignment = { horizontal: 'center' };
  }

  // ---- Column widths -----------------------------------------------------
  WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
