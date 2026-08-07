/**
 * AuditLog — immutable record of who did what, when, from where.
 *
 * Required by the spec for auth events and CRUD actions; also feeds the M10
 * dashboard "recent activity" panel. Append-only by convention: nothing in
 * the application ever updates or deletes an audit row.
 */
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    // Null for events with no authenticated user (e.g. failed logins).
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Dot-namespaced verb, e.g. 'auth.login.success', 'employee.create'.
    // A plain string (not an enum) so new modules add actions without
    // touching this file.
    action: { type: String, required: true },
    // What the action touched, e.g. targetType 'Employee', targetId <id>.
    targetType: { type: String, default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Small free-form context (e.g. attempted email on a failed login).
    // NEVER put passwords, tokens, or full documents in here.
    meta: { type: Object, default: {} },
    ip: { type: String, default: null },
  },
  // createdAt is the event time; updatedAt is meaningless for append-only data.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The dashboard and the audit screen both read "newest first".
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
