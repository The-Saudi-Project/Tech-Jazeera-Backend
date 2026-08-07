/**
 * Zod schema for audit queries. `z.coerce` because query-string values are
 * always strings ("2" → 2); caps stop ?limit=100000 from dumping the table.
 */
import { z } from 'zod';

export const listAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
