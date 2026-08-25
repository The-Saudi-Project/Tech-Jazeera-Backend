import { z } from 'zod';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** thresholdDays (P2-M2): override the 30-day expiry-alert window. */
export const dashboardQuerySchema = z.object({
  thresholdDays: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(365).optional()),
});
