/**
 * Zod schemas for document endpoints. Note the create/version bodies arrive as
 * multipart form fields (all strings) alongside the file, so dates are coerced.
 */
import { z } from 'zod';
import { DOCUMENT_OWNER_TYPES, DOCUMENT_CATEGORIES } from './document.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const createDocumentSchema = z.object({
  title: z.string().trim().min(2, 'Title is required.').max(150),
  category: z.enum(DOCUMENT_CATEGORIES),
  ownerType: z.enum(DOCUMENT_OWNER_TYPES),
  owner: id,
  expiryDate: z.preprocess(emptyToUndef, z.coerce.date().optional()),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  ownerType: z.preprocess(emptyToUndef, z.enum(DOCUMENT_OWNER_TYPES).optional()),
  owner: id.optional(),
  category: z.preprocess(emptyToUndef, z.enum(DOCUMENT_CATEGORIES).optional()),
  search: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
  expiring: z.preprocess(emptyToUndef, z.enum(['true', 'false']).optional()),
});

export const documentIdParamSchema = z.object({ id });

/** File streaming: which version to serve (defaults to current if omitted). */
export const fileQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});
