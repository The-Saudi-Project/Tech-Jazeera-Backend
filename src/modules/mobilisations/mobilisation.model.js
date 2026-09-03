/**
 * Mobilisation — the commercial+staffing record of placing a worker with a
 * client (optionally routed through a subcontractor), including billing
 * rates/commissions and the profit on the deal. Distinct from Deployment
 * (worker↔client↔site only, no commercial data) — see
 * docs/MOBILISATION-notes.md.
 *
 * Section 1 is filled by whoever creates it (a Coordinator, or — from M4 —
 * a BDM/Marketing Manager self-mobilising); Section 2 (client/sub quotation
 * & PO) is filled only by the Marketing Manager during review, via the
 * commercial-details endpoint (M3).
 *
 * `worker`/`client`/`subcontractor` are references (independent lifecycles);
 * their name/identity fields are SNAPSHOTS captured at creation, same
 * durable-history convention as Deployment.clientName — a later Iqama
 * renewal or client rename must not silently rewrite an already-submitted
 * mobilisation.
 *
 * `profit` is a plain editable Number, never a formula-only computed field —
 * the exact commission arithmetic hasn't been verified against a real
 * example yet (same posture as Payroll's manually-entered GOSI).
 *
 * `workflow`/`workflowName`/`steps`/`currentStep`/`approvalTrail` are the
 * Configurable Approval Hierarchy fields, identical shape to
 * reimbursement.model.js — the Marketing Manager decision (M2/M3) reuses
 * approvals/approvalEngine.service.js's decideApprovalStep unchanged.
 */
import mongoose from 'mongoose';

export const MOBILISATION_STATUSES = ['Draft', 'PendingReview', 'Approved', 'Rejected'];
export const MOBILISATION_DOCUMENT_CATEGORIES = ['Contract', 'IDCopy', 'Other'];

/** One uploaded file (M5). _id kept (default) — deleted individually by id,
 *  unlike Document.versions' append-only history. */
const mobilisationDocumentSchema = new mongoose.Schema({
  fileName: { type: String, required: true }, // Cloudinary public_id
  resourceType: { type: String, required: true }, // 'raw', from the upload middleware
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  category: { type: String, enum: MOBILISATION_DOCUMENT_CATEGORIES, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
});

/** One coordinator on the record. The creator is the primary, auto-confirmed;
 *  anyone else added (M2) must explicitly confirm before the record can be
 *  submitted — see mobilisation.service.js's submitMobilisation. */
const coordinatorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPrimary: { type: Boolean, default: false },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false }
);

const mobilisationSchema = new mongoose.Schema(
  {
    // --- Section 1: worker & job ---
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    workerName: { type: String, required: true }, // snapshot of Employee.fullName
    iqamaNumber: { type: String, trim: true }, // snapshot of Employee.iqama.number
    nationality: { type: String, trim: true }, // snapshot of Employee.nationality
    trade: { type: String, trim: true }, // snapshot of Employee.designation
    phone: { type: String, trim: true }, // snapshot of Employee.mobile
    jobTitle: { type: String, required: true, trim: true, maxlength: 150 },

    // --- Section 1: client & billing ---
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true }, // snapshot of Client.companyName
    clientRate: { type: Number, default: 0, min: 0 },
    clientCommission: { type: Number, default: 0, min: 0 },
    ftaAllowance: { type: Number, default: 0, min: 0 },
    clientTimesheetRequired: { type: Boolean, default: false },

    // --- Section 1: subcontractor (optional) ---
    hasSubcontractor: { type: Boolean, default: false },
    subcontractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcontractor', default: null },
    subcontractorName: { type: String, default: null }, // snapshot of Subcontractor.name
    subcontractorCommission: { type: Number, default: 0, min: 0 },
    subcontractorTimesheetRequired: { type: Boolean, default: false },

    // --- Section 1: economics & dates ---
    profit: { type: Number, default: 0 },
    mobilisationDate: { type: Date, required: true },
    checkoutDate: { type: Date, default: null },

    // --- Section 1: overtime ---
    overtimeRate: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    otAmount: { type: Number, default: 0 },
    otCommissionIn: { type: Number, default: 0 }, // cash commission received
    otCommissionOut: { type: Number, default: 0 }, // cash commission paid out

    // --- Section 1: coordinators / documents / remark ---
    coordinators: {
      type: [coordinatorSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A mobilisation needs at least one coordinator.',
      },
    },
    documents: { type: [mobilisationDocumentSchema], default: [] },
    remark: { type: String, trim: true, maxlength: 1000 },

    // --- Section 2: Marketing Manager review only (M3) ---
    clientQuotation: { type: String, trim: true, default: null },
    clientQuotationDate: { type: Date, default: null },
    clientPO: { type: String, trim: true, default: null },
    clientPODate: { type: Date, default: null },
    subQuotation: { type: String, trim: true, default: null },
    subQuotationDate: { type: Date, default: null },
    subPO: { type: String, trim: true, default: null },

    // --- Workflow (Configurable Approval Hierarchy, M2/M3) ---
    status: { type: String, enum: MOBILISATION_STATUSES, default: 'Draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflow', default: null },
    workflowName: { type: String, default: null },
    steps: {
      type: [
        {
          label: String,
          roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRole' }],
          _id: false,
        },
      ],
      default: undefined,
    },
    currentStep: { type: Number, default: 0 },
    approvalTrail: {
      type: [
        {
          step: Number,
          approvalRole: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRole', default: null },
          viaAdminOverride: Boolean,
          approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          decision: { type: String, enum: ['Approved', 'Rejected'] },
          note: String,
          decidedAt: Date,
          _id: false,
        },
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

mobilisationSchema.index({ worker: 1, createdAt: -1 });
mobilisationSchema.index({ client: 1 });
mobilisationSchema.index({ status: 1, createdAt: -1 });
mobilisationSchema.index({ 'coordinators.user': 1 });

export default mongoose.model('Mobilisation', mobilisationSchema);
