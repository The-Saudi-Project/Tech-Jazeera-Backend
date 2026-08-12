/**
 * Zod schemas for the NFC platform. Transforms double as sanitization: empty
 * optionals become undefined; the brand colour must be a 6-digit hex.
 */
import { z } from 'zod';
import { NFC_CARD_STATUSES } from './nfcCard.model.js';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalStr = (max) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);
const optionalObjectId = z.preprocess(emptyToUndef, z.string().regex(/^[a-f0-9]{24}$/i).optional());

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' ? emptyToUndef(v.trim().toLowerCase()) : v),
  z.email('Enter a valid email address.').optional()
);
const optionalHex = z.preprocess(
  emptyToUndef,
  z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4F46E5.').optional()
);

export const idParamSchema = z.object({ id: objectId('record') });

export const createCompanySchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required.').max(120),
  companyNameAr: optionalStr(120),
  contactPerson: optionalStr(100),
  phone: optionalStr(30),
  email: optionalEmail,
  website: optionalStr(200),
  address: optionalStr(300),
  mapLink: optionalStr(500),
  city: optionalStr(80),
  brandColour: optionalHex,
  notes: optionalStr(2000),
});
export const updateCompanySchema = createCompanySchema.partial();

export const createEmployeeSchema = z.object({
  company: objectId('company'),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  jobTitle: optionalStr(100),
  phone: optionalStr(30),
  whatsapp: optionalStr(30),
  email: optionalEmail,
  linkedin: optionalStr(200),
  bio: optionalStr(600),
  idNumber: optionalStr(40),
  notes: optionalStr(2000),
});
export const updateEmployeeSchema = createEmployeeSchema.omit({ company: true }).partial();

export const generateBatchSchema = z.object({
  count: z.coerce.number().int().min(1, 'Generate at least 1 card.').max(100, 'Up to 100 at a time.'),
  label: optionalStr(80),
  note: optionalStr(300),
  company: optionalObjectId,
});

export const updateCardSchema = z.object({ chipUid: optionalStr(60) });
export const assignCardSchema = z.object({ employee: objectId('employee') });
export const assignCardToCompanySchema = z.object({ company: objectId('company') });

export const listCardsSchema = z.object({
  search: optionalStr(60),
  status: z.preprocess(emptyToUndef, z.enum(NFC_CARD_STATUSES).optional()),
  company: optionalObjectId,
  batch: optionalObjectId,
});

export const listCompaniesSchema = z.object({ search: optionalStr(100) });

/**
 * Analytics window. Capped at a year so nobody can ask the database to bucket
 * an unbounded range, and defaulted so the endpoints work with no query at all.
 */
export const analyticsQuerySchema = z.object({
  days: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1, 'Use at least 1 day.').max(365, 'Up to 365 days.').default(30)
  ),
});
