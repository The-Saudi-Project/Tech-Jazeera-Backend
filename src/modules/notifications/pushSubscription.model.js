/**
 * PushSubscription — one browser/device's Web Push endpoint for a user
 * (P3-F). The shape (endpoint + keys.p256dh + keys.auth) is exactly what
 * `PushManager.subscribe()` returns in the browser and what `web-push`
 * expects to send to — stored verbatim, never reshaped.
 *
 * One user can have several (phone + laptop, or two browsers) — `endpoint`
 * is the natural unique key (each browser/device mints its own), not a
 * compound (user, device) key we'd have to invent.
 */
import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Informational only (shown as "Chrome on Windows" etc. if a "manage
    // devices" list is ever built) — never parsed or relied on for logic.
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
