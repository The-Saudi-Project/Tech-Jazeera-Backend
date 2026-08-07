/**
 * Deployment — a record of a worker being placed at a client site.
 *
 * This is the entity that finally populates Employee.currentClient /
 * currentSite (built in M4, referenced by M5). Its lifecycle:
 *   assign  → a new Active deployment; employee's current* fields are set
 *   transfer→ the Active deployment is Ended and a fresh Active one created
 *   end     → the Active deployment is Ended; employee's current* fields cleared
 * Ended deployments are never mutated or deleted — they are the history.
 *
 * Schema choices, justified:
 *  - `worker` and `client` are REFERENCES (both are independent entities with
 *    their own lifecycles). This is references-over-embedding again.
 *  - `clientName` and `site` are STRING SNAPSHOTS captured at assignment time.
 *    History must stay readable even if the client is later renamed or a site
 *    is removed from the client, and even if the client is eventually deleted
 *    (allowed once no workers are assigned). The `client` ref is kept too, for
 *    linking while the client still exists.
 */
import mongoose from 'mongoose';

export const DEPLOYMENT_SHIFTS = ['Day', 'Night', 'Rotating'];
export const DEPLOYMENT_STATUSES = ['Active', 'Ended'];
/** Why an Active deployment was ended — drives the history label. */
export const DEPLOYMENT_END_REASONS = ['Transferred', 'Unassigned'];

const deploymentSchema = new mongoose.Schema(
  {
    // NOTE: no field-level `index: true` on worker/client/status — indexes are
    // declared explicitly below. Declaring both causes a duplicate-index clash
    // that silently prevents the partial-unique guard from being created.
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true }, // snapshot for durable history
    site: { type: String, required: true, trim: true }, // snapshot (a client site name)
    vehicle: { type: String, trim: true },
    driver: { type: String, trim: true },
    shift: { type: String, enum: DEPLOYMENT_SHIFTS, default: 'Day' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: DEPLOYMENT_STATUSES, default: 'Active' },
    endReason: { type: String, enum: DEPLOYMENT_END_REASONS, default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

/**
 * THE double-assignment guard, enforced at the database level: a worker may
 * have at most ONE deployment whose status is 'Active'. The partial filter
 * exempts Ended deployments, so a worker accumulates unlimited history but is
 * never actively deployed in two places at once. Named explicitly so it can't
 * be confused with the compound history index below (which shares the leading
 * `worker` key). The service also checks this for a friendly message; this
 * index is the hard backstop against races.
 */
deploymentSchema.index(
  { worker: 1 },
  { unique: true, partialFilterExpression: { status: 'Active' }, name: 'uniq_active_worker' }
);
// A worker's history, newest-first (distinct key pattern from the guard above).
deploymentSchema.index({ worker: 1, startDate: -1 });
// A client's placements, optionally filtered by status.
deploymentSchema.index({ client: 1, status: 1 });
// The global register, newest-first.
deploymentSchema.index({ startDate: -1 });

export default mongoose.model('Deployment', deploymentSchema);
