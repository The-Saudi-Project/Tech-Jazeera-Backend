/**
 * Zod schemas for deployment endpoints.
 */
import { z } from 'zod';
import { DEPLOYMENT_SHIFTS, DEPLOYMENT_STATUSES } from './deployment.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalStr = (max) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

/** Fields common to assigning and transferring (everything except the worker). */
const placementFields = {
  client: id,
  site: z.string().trim().min(1, 'Site is required.').max(100),
  vehicle: optionalStr(60),
  driver: optionalStr(100),
  shift: z.enum(DEPLOYMENT_SHIFTS).default('Day'),
  startDate: z.coerce.date({ error: 'Start date is required.' }),
  notes: optionalStr(1000),
};

/** Assign: pick a worker + a placement. */
export const assignSchema = z.object({ worker: id, ...placementFields });

/** Transfer: the worker is taken from the existing deployment, so just a new placement. */
export const transferSchema = z.object({ ...placementFields });

export const listDeploymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  worker: id.optional(),
  client: id.optional(),
  status: z.preprocess(emptyToUndef, z.enum(DEPLOYMENT_STATUSES).optional()),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const deploymentIdParamSchema = z.object({ id });
