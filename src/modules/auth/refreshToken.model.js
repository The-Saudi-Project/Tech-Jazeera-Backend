/**
 * RefreshToken — one document per live login session (per device).
 *
 * Why a separate collection instead of a field on User:
 *   - multi-device: office PC and phone each get their own document
 *   - rotation is atomic: delete the old doc, insert the new one
 *   - revocation is trivial: delete all docs for a user
 *   - expiry is automatic: the TTL index below makes MongoDB delete expired
 *     sessions itself — no cleanup cron needed
 *
 * SECURITY: we store a SHA-256 HASH of the token, never the token itself.
 * A leaked database dump therefore cannot be replayed as live sessions.
 * (SHA-256, not bcrypt, because the token is already 512 bits of randomness —
 * there is nothing to brute-force — and we need deterministic lookups.)
 */
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    // Set when this token is rotated. A rotated token may be presented again
    // within a short grace window (concurrent browser tabs racing to refresh
    // share one cookie); reuse AFTER the window is treated as theft.
    rotatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index: MongoDB automatically deletes each document once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
