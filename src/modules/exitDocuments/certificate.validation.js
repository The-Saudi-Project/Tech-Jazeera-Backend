/**
 * Zod schemas for certificate requests.
 */
import { z } from 'zod';
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES } from './certificate.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const submitCertificateSchema = z.object({
  type: z.enum(CERTIFICATE_TYPES, { error: 'Choose a certificate type.' }),
  purpose: z.preprocess(emptyToUndef, z.string().trim().max(300).optional()),
});

export const decideCertificateSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const listCertificatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(CERTIFICATE_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, id.optional()),
});

export const listMyCertificatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(CERTIFICATE_STATUSES).optional()),
});

export const certificateIdParamSchema = z.object({ id });
