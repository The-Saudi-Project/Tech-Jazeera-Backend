/**
 * Zod schema for audit queries. `z.coerce` because query-string values are
 * always strings ("2" → 2); caps stop ?limit=100000 from dumping the table.
 */
import { z } from 'zod';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const listAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Substring search on the dot-namespaced action (e.g. "nfc" matches every
  // nfc.* action, "auth.login.failed" matches exactly that one).
  action: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
  from: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  // The client only ever sends a bare "YYYY-MM-DD" (a <input type="date">),
  // which Date-parses to 00:00:00.000 UTC that day — as an inclusive "to"
  // bound that would exclude the entire day the user actually selected. Push
  // it to the last millisecond of that day so "to 25 Aug" really means
  // through 25 Aug, not "before 25 Aug even started".
  to: z.preprocess(
    emptyToUndef,
    z.coerce
      .date()
      .transform((d) => new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1))
      .optional()
  ),
});
