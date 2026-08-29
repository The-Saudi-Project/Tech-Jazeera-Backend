/**
 * Certificate PDF generation (pdfkit).
 *
 * DELIBERATELY MINIMAL LETTERHEAD: only the company's known trade name is
 * printed ("Al Jazeera") — no CR number, address, or named signatory. This
 * app has no verified source for those (no Settings/company-profile record
 * exists yet — see docs/PHASE2-PLAN.md's standing rule against inventing
 * CR/VAT/IBAN-type company details). The blank signature line at the
 * bottom is normal for this kind of letter, not a placeholder — a human
 * signs or stamps it. See docs/P3-D-notes.md for the exact fields still
 * needed to complete a full company letterhead.
 */
import PDFDocument from 'pdfkit';

const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function header(doc, title) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#111').text('Al Jazeera', left, 45);
  doc.moveTo(left, 68).lineTo(right, 68).strokeColor('#ddd').stroke();
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111').text(title, left, 90, { align: 'center', width: right - left });
  doc.font('Helvetica').fontSize(10).fillColor('#666').text(`Date: ${shortDate(new Date())}`, left, 118);
  return 150;
}

function signatureBlock(doc, y) {
  const left = doc.page.margins.left;
  doc.moveTo(left, y + 50).lineTo(left + 220, y + 50).strokeColor('#999').stroke();
  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Authorized Signature', left, y + 55);
  doc.text('Human Resources', left, y + 68);
}

export function buildSalaryCertificatePdf({ employee, request }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = header(doc, 'SALARY CERTIFICATE');

    doc.font('Helvetica').fontSize(11).fillColor('#111').text('To Whom It May Concern,', left, y);
    y += 30;

    const iqama = employee.iqama?.number ? ` (Iqama No. ${employee.iqama.number})` : '';
    const body =
      `This is to certify that ${employee.fullName}${iqama} is employed with us as ${employee.designation}, ` +
      `since ${shortDate(employee.joiningDate)}. Their current monthly salary is SAR ${Number(employee.salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
    doc.text(body, left, y, { width: right - left, lineGap: 4 });
    y += doc.heightOfString(body, { width: right - left, lineGap: 4 }) + 20;

    if (request.purpose) {
      const purposeLine = `This certificate is issued at the employee's request for the purpose of ${request.purpose}.`;
      doc.text(purposeLine, left, y, { width: right - left, lineGap: 4 });
      y += doc.heightOfString(purposeLine, { width: right - left, lineGap: 4 }) + 20;
    }

    signatureBlock(doc, y);
    doc.end();
  });
}

export function buildServiceCertificatePdf({ employee, request, exitDate }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = header(doc, 'SERVICE CERTIFICATE');

    doc.font('Helvetica').fontSize(11).fillColor('#111').text('To Whom It May Concern,', left, y);
    y += 30;

    const period = exitDate
      ? `from ${shortDate(employee.joiningDate)} to ${shortDate(exitDate)}`
      : `since ${shortDate(employee.joiningDate)}, and continues to be employed with us`;
    const tense = exitDate ? 'was employed' : 'is employed';
    const body =
      `This is to certify that ${employee.fullName} ${tense} with us as ${employee.designation} ${period}. ` +
      `During this period, their conduct and performance were found to be satisfactory.`;
    doc.text(body, left, y, { width: right - left, lineGap: 4 });
    y += doc.heightOfString(body, { width: right - left, lineGap: 4 }) + 20;

    if (request.purpose) {
      const purposeLine = `This certificate is issued at the employee's request for the purpose of ${request.purpose}.`;
      doc.text(purposeLine, left, y, { width: right - left, lineGap: 4 });
      y += doc.heightOfString(purposeLine, { width: right - left, lineGap: 4 }) + 20;
    }

    signatureBlock(doc, y);
    doc.end();
  });
}
