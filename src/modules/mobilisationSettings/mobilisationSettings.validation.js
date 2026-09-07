import { z } from 'zod';

const roleId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid role id.');

export const updateMobilisationSettingsSchema = z.object({
  viewerRoles: z.array(roleId).max(50).optional(),
  selfMobiliseRoles: z.array(roleId).max(50).optional(),
  officeSecretaryStaleDays: z.coerce.number().int().min(1).max(3650).optional(),
});
