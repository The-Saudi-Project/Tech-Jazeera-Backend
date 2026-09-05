import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');

export const createJobTitleSchema = z.object({
  name: z.string().trim().min(2, 'Job title is required.').max(80),
});

export const updateJobTitleSchema = z.object({
  name: z.string().trim().min(2, 'Job title is required.').max(80).optional(),
  isActive: z.boolean().optional(),
});

export const listJobTitlesSchema = z.object({
  activeOnly: z.enum(['true', 'false']).optional(),
});

export const jobTitleIdParamSchema = z.object({ id });
