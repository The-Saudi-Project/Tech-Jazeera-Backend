/**
 * Timesheet export — turns a processed result (from timesheet.service) into a
 * professionally formatted .xlsx Buffer. Kept separate from the business logic
 * so the file-format concern never leaks into the processor, and separate
 * from I/O — an optional company logo is handed in as already-fetched bytes
 * (see timesheet.controller.js), this module never fetches anything itself.
 *
 * The exact layout (row heights, fonts, colors, column widths, the blank
 * REMARKS/APPROVED columns) mirrors a real reference export the company
 * already uses for printed/filed timesheets — matched deliberately, not
 * just "close enough."
 */
import ExcelJS from 'exceljs';
import { minutesToHHMM } from './timesheet.time.js';

// Theme (ARGB) — matches the app's own ink/muted/border tokens.
const INK = 'FF14162B';
const MUTED = 'FF64748B';
const ZEBRA_FILL = 'FFF3F4FB';
const BORDER = 'FFD8DCEC';
const DARK_BORDER = 'FF000000';

const thin = { style: 'thin', color: { argb: BORDER } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
const thinDark = { style: 'thin', color: { argb: DARK_BORDER } };
const darkBorders = { top: thinDark, left: thinDark, bottom: thinDark, right: thinDark };

const HEADERS = [
  'Date', 'Day', 'Login', 'Logout', 'Worked', 'Required', 'Deficiency', 'Overtime', 'Status',
];
// REMARKS/APPROVED are blank, hand-filled columns on the printed sheet —
// never populated by this export, only their header cell is styled.
const MANUAL_HEADERS = ['REMARKS', 'APPROVED'];
const WIDTHS = [20, 10, 9, 9, 10, 10, 12, 10, 15, 11, 12];

/** Status → font color, so problem days read at a glance. */
const STATUS_COLOR = {
  Present: 'FF16A34A',
  Overtime: 'FFB45309',
  Deficient: 'FFDC2626',
  'Single Punch': 'FF4F46E5',
  'No Attendance': MUTED,
  Holiday: 'FF0D9488', // teal
  'Holiday (Worked)': 'FFB45309', // amber, like overtime
};

/**
 * @param {object} result  the object returned by timesheet.service.processTimesheet
 * @param {{buffer: Buffer, extension: 'png'|'jpeg'|'gif'} | null} [logo]
 *   already-fetched company logo bytes, or null/undefined for no logo — the
 *   normal case until an Admin uploads one (see companySettings module).
 */
export async function buildTimesheetXlsx(result, logo = null) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Al Jazeera ERP';
  wb.created = new Date();
  const lastCol = HEADERS.length + MANUAL_HEADERS.length; // 11

  // Freeze pane sits right below the column-header row, wherever that ends
  // up (row 6 normally, row 7 with a logo) — computed after we know.
  const headerRowNumber = logo ? 7 : 6;
  const ws = wb.addWorksheet('Timesheet', {
    views: [{ state: 'frozen', ySplit: headerRowNumber }],
  });

  let r = 1;

  // ---- Logo band (optional) ----------------------------------------------
  if (logo) {
    const imageId = wb.addImage({ buffer: logo.buffer, extension: logo.extension });
    ws.mergeCells(r, 1, r, lastCol);
    ws.getRow(r).height = 116.25;
    // 0-indexed cell anchors — fills the merged band exactly, stretching
    // the image to fit (same as a picture pasted and stretched in Excel).
    ws.addImage(imageId, { tl: { col: 0, row: r - 1 }, br: { col: lastCol, row: r }, editAs: 'oneCell' });
    r += 1;
  }

  // ---- Title band ----------------------------------------------------------
  ws.mergeCells(r, 1, r, lastCol);
  ws.getCell(r, 1).value = 'Monthly Timesheet';
  ws.getCell(r, 1).font = { bold: true, size: 16, color: { argb: INK } };
  r += 1;

  ws.mergeCells(r, 1, r, lastCol);
  ws.getCell(r, 1).value = result.employee.fullName;
  ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: INK } };
  r += 1;

  ws.mergeCells(r, 1, r, lastCol);
  ws.getCell(r, 1).value = `${result.monthName} ${result.year}`;
  ws.getCell(r, 1).font = { size: 11, color: { argb: INK } };
  r += 1;

  ws.mergeCells(r, 1, r, lastCol);
  ws.getCell(r, 1).value =
    `Required hours/day: ${minutesToHHMM(result.requiredMinutes)}   ·   ` +
    `Generated: ${new Date(result.generatedAt).toLocaleString('en-GB')}`;
  ws.getCell(r, 1).font = { size: 10, color: { argb: MUTED } };
  r += 1;

  // ---- Column headers ------------------------------------------------------
  const headerRow = ws.getRow(r);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: INK } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allBorders;
  });
  // REMARKS/APPROVED — a distinct, hand-fill-in look (Arial, a solid dark
  // border) on the header only; data rows leave these two columns untouched.
  MANUAL_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(HEADERS.length + i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, name: 'Arial' };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = darkBorders;
  });
  headerRow.height = 20.1;
  r += 1;

  // ---- Data rows -------------------------------------------------------
  result.rows.forEach((row, idx) => {
    const excelRow = ws.getRow(r);
    const values = [
      row.date,
      row.day,
      row.login ?? '',
      row.logout ?? '',
      minutesToHHMM(row.workedMinutes),
      minutesToHHMM(row.requiredMinutes),
      minutesToHHMM(row.deficiencyMinutes),
      minutesToHHMM(row.overtimeMinutes),
      row.status,
    ];
    values.forEach((v, i) => {
      excelRow.getCell(i + 1).value = v;
    });
    excelRow.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col > HEADERS.length) return; // REMARKS/APPROVED stay blank & unstyled
      cell.border = allBorders;
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
      }
    });
    // Colour the status cell.
    const statusCell = excelRow.getCell(HEADERS.length);
    statusCell.font = { bold: true, color: { argb: STATUS_COLOR[row.status] ?? INK } };
    r += 1;
  });

  // ---- Summary block -----------------------------------------------------
  r += 1; // blank spacer row
  const s = result.summary;
  ws.getCell(r, 1).value = 'Monthly Summary';
  ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: INK } };
  r += 1;

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
    const row = ws.getRow(r);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    row.getCell(1).border = allBorders;
    row.getCell(2).border = allBorders;
    row.getCell(2).alignment = { horizontal: 'center' };
    r += 1;
  }

  // ---- Column widths -----------------------------------------------------
  WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
