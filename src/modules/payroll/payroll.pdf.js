/**
 * Payslip PDF generation (pdfkit) — mirrors the minimal-letterhead
 * discipline already established for certificate.pdf.js: just the
 * company's known trade name, no invented CR number or signatory. See
 * docs/P2-M5-notes.md.
 */
import PDFDocument from 'pdfkit';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const money = (n) => `SAR ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildPayslipPdf({ run, line }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#111').text('Al Jazeera', left, 45);
    doc.moveTo(left, 68).lineTo(right, 68).strokeColor('#ddd').stroke();
    doc.fontSize(14).font('Helvetica-Bold').text('PAYSLIP', left, 90, { align: 'center', width: right - left });
    doc.font('Helvetica').fontSize(10).fillColor('#666').text(
      `${MONTH_NAMES[run.periodMonth - 1]} ${run.periodYear}`,
      left,
      118,
      { align: 'center', width: right - left }
    );

    doc.fontSize(9).font('Helvetica').fillColor('#666').text('EMPLOYEE', left, 150);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111').text(`${line.employeeName}  (${line.employeeCode})`, left, 163);
    if (line.approvedHours > 0) {
      const overtimeNote = line.overtimeHours > 0 ? ` (incl. ${line.overtimeHours} overtime)` : '';
      doc.fontSize(9).font('Helvetica').fillColor('#666').text(`Approved hours this period: ${line.approvedHours}${overtimeNote}`, left, 183);
    }

    let y = 210;
    const row = (label, value, { bold = false } = {}) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor('#111');
      doc.text(label, left, y, { width: 280 });
      doc.text(value, right - 160, y, { width: 160, align: 'right' });
      y += bold ? 22 : 18;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor('#eee').stroke();
    };

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#666').text('EARNINGS', left, y);
    y += 16;
    row('Basic salary', money(line.basicSalary));
    row('Housing allowance', money(line.housingAllowance));
    row('Transport allowance', money(line.transportAllowance));
    if (line.otherAllowances) row('Other allowances', money(line.otherAllowances));
    if (line.overtimePay) row(`Overtime (${line.overtimeHours}h @ 1.5×)`, money(line.overtimePay));
    row('Gross pay', money(line.grossPay), { bold: true });

    y += 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#666').text('DEDUCTIONS', left, y);
    y += 16;
    row('GOSI', money(line.gosiDeduction));
    for (const d of line.otherDeductions) row(d.label, money(d.amount));
    row('Total deductions', money(line.totalDeductions), { bold: true });

    y += 10;
    row('NET PAY', money(line.netPay), { bold: true });

    doc.end();
  });
}
