/**
 * vCard 3.0 builder. Kept minimal and iOS-safe: CRLF line endings, VERSION:3.0,
 * proper value escaping. Only whitelisted, already-public fields go in.
 */

/** Escape a vCard text value (backslash, newline, comma, semicolon). */
function esc(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildVCard({ employee, company }) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${esc(employee.name)};;;;`);
  lines.push(`FN:${esc(employee.name)}`);
  if (company?.companyName) lines.push(`ORG:${esc(company.companyName)}`);
  if (employee.jobTitle) lines.push(`TITLE:${esc(employee.jobTitle)}`);
  if (employee.phone) lines.push(`TEL;TYPE=CELL,VOICE:${esc(employee.phone)}`);
  if (employee.whatsapp) lines.push(`TEL;TYPE=CELL:${esc(employee.whatsapp)}`);
  if (employee.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(employee.email)}`);
  if (company?.website) lines.push(`URL:${esc(company.website)}`);
  if (employee.linkedin) lines.push(`URL:${esc(employee.linkedin)}`);
  if (company?.address) lines.push(`ADR;TYPE=WORK:;;${esc(company.address)};;;;`);
  if (employee.bio) lines.push(`NOTE:${esc(employee.bio)}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}
