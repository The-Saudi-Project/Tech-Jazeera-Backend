import { z } from 'zod';

export const updateMobilisationSettingsSchema = z.object({
  officeSecretaryStaleDays: z.coerce.number().int().min(1).max(3650).optional(),
});
