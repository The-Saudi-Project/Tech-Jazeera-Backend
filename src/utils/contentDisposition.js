/**
 * Content-Disposition for a user-supplied filename, shared by every route that
 * streams a stored file back to the browser (documents module, ESS module).
 *
 * Two forms on purpose: a quoted ASCII fallback with quotes/backslashes and
 * control characters stripped (they would break the header), plus RFC 5987
 * `filename*` so Arabic and accented names survive intact.
 */
export function contentDisposition(originalName) {
  // eslint-disable-next-line no-control-regex
  const ascii = originalName.replace(/[\u0000-\u001f"\\]/g, '').replace(/[^\x20-\x7e]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
}
