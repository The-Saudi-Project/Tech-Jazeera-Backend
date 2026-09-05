/**
 * Shared pdfkit letterhead — logo + legal identity + contact line, drawn at
 * a fixed reserved height so every document (invoice, quotation, EOSB
 * settlement, certificate, payslip) can just add LETTERHEAD_HEIGHT to its
 * own existing absolute Y coordinates rather than each recomputing where
 * its own content should start. Never blocks a document: every field is
 * optional (a company mid-filling-in its profile still gets a working PDF,
 * just a sparser header), and a corrupt/unreachable logo image is skipped,
 * not thrown.
 */

// Reserved regardless of how many lines are actually filled in — generous
// enough for logo + name + CR/VAT line + address/phone/email line, so every
// document's layout stays predictable whether the company profile is fully
// filled in or still blank.
export const LETTERHEAD_HEIGHT = 95;

export function drawLetterhead(doc, company = {}, logo = null) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = 40;

  let textX = left;
  if (logo?.buffer) {
    try {
      doc.image(logo.buffer, left, top, { fit: [72, 40] });
      textX = left + 84;
    } catch {
      // A corrupted/unreadable buffer should degrade to "no logo," never
      // block the document itself from generating.
    }
  }

  const textWidth = right - textX;
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111');
  doc.text(company.companyName || 'Company name not set', textX, top, { width: textWidth });

  doc.font('Helvetica').fontSize(8).fillColor('#666');
  const legalLine = [company.crNumber && `CR ${company.crNumber}`, company.vatNumber && `VAT ${company.vatNumber}`]
    .filter(Boolean)
    .join('   ·   ');
  if (legalLine) doc.text(legalLine, textX, doc.y + 2, { width: textWidth });

  const contactLine = [company.address, company.phone, company.email].filter(Boolean).join('   ·   ');
  if (contactLine) doc.text(contactLine, textX, doc.y + 2, { width: textWidth });

  const ruleY = top + LETTERHEAD_HEIGHT - 14;
  doc.moveTo(left, ruleY).lineTo(right, ruleY).strokeColor('#ddd').stroke();
}

/**
 * The authorized-signatory block certificates print at the bottom — a name
 * and title above a signature line, or nothing at all if neither is on
 * file (never an invented signatory).
 */
export function drawSignatoryBlock(doc, company = {}, x, y, width) {
  if (!company.signatoryName && !company.signatoryTitle) return;
  doc.moveTo(x, y).lineTo(x + width, y).strokeColor('#999').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(company.signatoryName || '', x, y + 6, { width });
  if (company.signatoryTitle) {
    doc.font('Helvetica').fontSize(8).fillColor('#666').text(company.signatoryTitle, x, doc.y + 1, { width });
  }
}
