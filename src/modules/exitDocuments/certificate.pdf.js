/**
 * Certificate PDF generation (pdfkit).
 *
 * Uses the real company letterhead + authorized signatory once Company
 * Settings has been filled in (see companySettings/letterhead.pdf.js) —
 * this is the exact gap flagged when this file was first written ("no
 * Settings/company-profile record exists yet, so no CR number/signatory is
 * invented"; see docs/P3-D-notes.md). Falls back to the original minimal
 * header (just a generic "Company name not set" title) and a blank,
 * unlabeled signature line when no company profile exists yet, so a
 * certificate generated before anyone fills in the settings page still
 * works exactly as it always did.
 */
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawSignatoryBlock, LETTERHEAD_HEIGHT } from '../companySettings/letterhead.pdf.js';

const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function header(doc, title, company, logo) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = company ? LETTERHEAD_HEIGHT : 0;
  if (company) drawLetterhead(doc, company, logo);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111').text(title, left, top + 25, { align: 'center', width: right - left });
  doc.font('Helvetica').fontSize(10).fillColor('#666').text(`Date: ${shortDate(new Date())}`, left, top + 53);
  return top + 85;
}

function signatureBlock(doc, y, company) {
  const left = doc.page.margins.left;
  if (company?.signatoryName || company?.signatoryTitle) {
    drawSignatoryBlock(doc, company, left, y + 50, 220);
    return;
  }
  // No signatory on file yet — a blank, unlabeled line for a human to sign
  // or stamp, same as before this feature existed.
  doc.moveTo(left, y + 50).lineTo(left + 220, y + 50).strokeColor('#999').stroke();
  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Authorized Signature', left, y + 55);
}

export function buildSalaryCertificatePdf({ employee, request }, company = null, logo = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = header(doc, 'SALARY CERTIFICATE', company, logo);

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

    signatureBlock(doc, y, company);
    doc.end();
  });
}

export function buildServiceCertificatePdf({ employee, request, exitDate }, company = null, logo = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = header(doc, 'SERVICE CERTIFICATE', company, logo);

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

    signatureBlock(doc, y, company);
    doc.end();
  });
}
