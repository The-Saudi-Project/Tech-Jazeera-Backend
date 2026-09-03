/**
 * Zod schemas for mobilisation endpoints — Section 1 create/update, joint-
 * coordinator invite, Section 2 commercial-details, decide, and document
 * category. Same conventions as employees/clients — empty strings from HTML
 * forms become undefined; numeric/boolean fields left unset here fall
 * through to the model's own Mongoose defaults (see employee.validation.js's
 * "No .default() here on purpose" note — the same reasoning applies to
 * `mobilisationFields.partial()` below).
 */
import { z } from 'zod';

const emptyToUndef = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalStr = (max) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const id = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);
const optionalNonNegNumber = z.preprocess(emptyToUndef, z.coerce.number().min(0).optional());
const optionalNumber = z.preprocess(emptyToUndef, z.coerce.number().optional());
const optionalDate = z.preprocess(emptyToUndef, z.coerce.date().optional());

const mobilisationFields = {
  worker: id('worker'),
  jobTitle: z.string().trim().min(1, 'Job title is required.').max(150),

  client: id('client'),
  clientRate: optionalNonNegNumber,
  clientCommission: optionalNonNegNumber,
  ftaAllowance: optionalNonNegNumber,
  clientTimesheetRequired: z.boolean().optional(),

  hasSubcontractor: z.boolean().optional(),
  subcontractor: z.preprocess(emptyToUndef, id('subcontractor').optional()),
  subcontractorCommission: optionalNonNegNumber,
  subcontractorTimesheetRequired: z.boolean().optional(),

  profit: optionalNumber,
  mobilisationDate: z.coerce.date({ error: 'Mobilisation date is required.' }),
  checkoutDate: optionalDate,

  overtimeRate: optionalNonNegNumber,
  overtimeHours: optionalNonNegNumber,
  otAmount: optionalNumber,
  otCommissionIn: optionalNumber,
  otCommissionOut: optionalNumber,

  remark: optionalStr(1000),
};

/** A subcontractor must be selected once "has a subcontractor" is toggled on. */
function withSubcontractorRefine(schema) {
  return schema.superRefine((data, ctx) => {
    if (data.hasSubcontractor && !data.subcontractor) {
      ctx.addIssue({ code: 'custom', path: ['subcontractor'], message: 'Select a subcontractor.' });
    }
  });
}

export const createMobilisationSchema = withSubcontractorRefine(z.object(mobilisationFields));

/** PATCH: any subset of the same fields — only while Draft (enforced in the
 *  service). `worker`/`client` stay required even on an edit; an in-progress
 *  Draft always names a real worker and client, there's no "half-set" state. */
export const updateMobilisationSchema = withSubcontractorRefine(z.object(mobilisationFields).partial());

export const listMobilisationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(['Draft', 'PendingReview', 'Approved', 'Rejected']).optional()),
  client: z.preprocess(emptyToUndef, id('client').optional()),
  worker: z.preprocess(emptyToUndef, id('worker').optional()),
  search: optionalStr(100),
  sortBy: z.enum(['mobilisationDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const mobilisationIdParamSchema = z.object({
  id: id('mobilisation'),
});

export const mobilisationCoordinatorParamSchema = z.object({
  id: id('mobilisation'),
  userId: id('user'),
});

export const addCoordinatorSchema = z.object({
  user: id('user'),
});

/** Section 2 — Marketing Manager only, during review (M3). Every field is
 *  optional individually: a reviewer may fill in the client side today and
 *  the subcontractor side once that quote actually arrives. */
export const commercialDetailsSchema = z.object({
  clientQuotation: optionalStr(100),
  clientQuotationDate: optionalDate,
  clientPO: optionalStr(100),
  clientPODate: optionalDate,
  subQuotation: optionalStr(100),
  subQuotationDate: optionalDate,
  subPO: optionalStr(100),
});

/** Rejecting requires a note so the coordinator knows what to fix before
 *  resubmitting; approving does not — same rule as decideClientSchema. */
export const decideMobilisationSchema = z
  .object({
    status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
    decisionNote: optionalStr(500),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'Rejected' && !data.decisionNote) {
      ctx.addIssue({ code: 'custom', path: ['decisionNote'], message: 'Explain what needs fixing before rejecting.' });
    }
  });

export const mobilisationDocumentCategorySchema = z.object({
  category: z.enum(['Contract', 'IDCopy', 'Other'], { error: 'Choose a document category.' }),
});

export const mobilisationDocumentParamSchema = z.object({
  id: id('mobilisation'),
  fileId: id('document'),
});
