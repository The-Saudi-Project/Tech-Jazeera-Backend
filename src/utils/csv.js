/**
 * CSV writing helpers.
 *
 * CSV has no type system: every cell is text, and the spreadsheet that opens
 * the file decides what that text means. Excel, LibreOffice and Google Sheets
 * all treat a cell starting with `=`, `+`, `-`, `@` (or a leading tab/CR) as a
 * FORMULA. So an employee named
 *
 *     =cmd|'/c calc'!A1
 *
 * stops being a name the moment an accountant opens the export — it becomes
 * something the spreadsheet tries to execute, with a prompt most people click
 * through. That is CSV formula injection, and quoting does NOT prevent it:
 * quotes only protect the delimiter, and the formula is parsed after unquoting.
 *
 * The fix is to make the leading character harmless. Prefixing with a single
 * quote is the convention every major spreadsheet understands as "this cell is
 * literally text"; it is consumed on display, so the reader still sees the
 * original value.
 *
 * NOTE: this applies to CSV only. The .xlsx exports (attendance, timesheet)
 * write through ExcelJS, which stores these values as typed string cells and
 * never emits a formula element — verified, not assumed. Adding the prefix
 * there would put a visible apostrophe in front of real data for no gain.
 */

/** Characters that make a spreadsheet treat the rest of the cell as a formula. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Neutralize a value that is about to become a CSV cell.
 * Returns a string that renders identically but can never be executed.
 */
export function csvCell(value) {
  const text = String(value ?? '');
  const safe = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  // Standard CSV quoting: wrap in quotes, double any embedded quote.
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Join one row of already-raw values into a CSV line. */
export function csvRow(values) {
  return values.map(csvCell).join(',');
}

/**
 * Build a full CSV document (CRLF line endings, as the format expects).
 * `header` is an array of column names; `rows` an array of value arrays.
 */
export function buildCsv(header, rows) {
  return [csvRow(header), ...rows.map(csvRow)].join('\r\n');
}
