/**
 * Zod schemas for notifications + push subscriptions.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.preprocess((v) => v === 'true', z.boolean().default(false)),
});

export const notificationIdParamSchema = z.object({ id });

/** The exact shape PushManager.subscribe() returns in the browser. */
export const subscribePushSchema = z.object({
  endpoint: z.url({ error: 'A valid push endpoint is required.' }),
  keys: z.object({
    p256dh: z.string().min(1, 'Missing p256dh key.'),
    auth: z.string().min(1, 'Missing auth key.'),
  }),
  userAgent: z.preprocess(emptyToUndef, z.string().trim().max(300).optional()),
});

export const unsubscribePushSchema = z.object({
  endpoint: z.url({ error: 'A valid push endpoint is required.' }),
});
