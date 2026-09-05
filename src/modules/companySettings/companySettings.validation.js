/**
 * Zod schemas for company settings. Every field is optional (a company can
 * fill these in gradually, field by field) and nullable via "" → null, same
 * "clear it" convention as coordinator/manager/weeklyOffDay elsewhere.
 */
import { z } from 'zod';

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optionalStr = (max) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const updateCompanySettingsSchema = z.object({
  companyName: optionalStr(150),
  companyNameAr: optionalStr(150),
  crNumber: optionalStr(50),
  vatNumber: optionalStr(50),
  address: optionalStr(300),
  phone: optionalStr(30),
  email: z.preprocess(
    emptyToNull,
    z.email('Enter a valid email address.').nullable().optional()
  ),
  website: optionalStr(150),
  bankName: optionalStr(100),
  bankIban: optionalStr(50),
  signatoryName: optionalStr(100),
  signatoryTitle: optionalStr(100),
});

const roleId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid role id.');

export const updateManageRolesSchema = z.object({
  manageRoles: z.array(roleId).max(50),
});
