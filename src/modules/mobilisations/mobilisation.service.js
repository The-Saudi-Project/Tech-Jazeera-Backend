/**
 * Mobilisation service.
 *
 * M1: create/list/get/update a Draft record.
 * M2: joint-coordinator invite/confirm + submit (Draft/Rejected → PendingReview).
 * M3: Marketing Manager commercial-details (Section 2) + decide.
 * M4: admin-configurable viewer-role visibility circle, self-mobilise roles,
 *     commercial-field stripping for a plain Coordinator once Approved.
 * M5: multi-file documents.
 */
import Mobilisation from './mobilisation.model.js';
import Employee from '../employees/employee.model.js';
import Client from '../clients/client.model.js';
import Subcontractor from '../subcontractors/subcontractor.model.js';
import ApprovalRole from '../approvals/approvalRole.model.js';
import User from '../auth/user.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import { notifyUser } from '../notifications/notification.service.js';
import { resolveApprovalWorkflow, isMemberOfAnyRole } from '../approvals/approvals.service.js';
import {
  decideApprovalStep,
  resolveStepAuthority,
  membersOfRoles,
  annotateCanDecide,
} from '../approvals/approvalEngine.service.js';
import { getMobilisationSettings } from '../mobilisationSettings/mobilisationSettings.service.js';
import { signedDownloadUrl, destroyDocumentFile } from '../../middleware/upload.js';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const POPULATE = [
  { path: 'coordinators.user', select: 'name email role' },
  { path: 'steps.roles', select: 'name' },
  { path: 'approvalTrail.approvalRole', select: 'name' },
  { path: 'approvalTrail.approvedBy', select: 'name role' },
  { path: 'decidedBy', select: 'name' },
  { path: 'createdBy', select: 'name' },
  { path: 'documents.uploadedBy', select: 'name' },
];

const COMMERCIAL_FIELDS = [
  'clientRate',
  'clientCommission',
  'ftaAllowance',
  'subcontractorCommission',
  'profit',
  'clientQuotation',
  'clientQuotationDate',
  'clientPO',
  'clientPODate',
  'subQuotation',
  'subQuotationDate',
  'subPO',
];

/** Strip commercial fields for a plain Coordinator once the record is
 *  Approved — they see everything they typed themselves while Draft/
 *  PendingReview/Rejected, but the finalized commercial picture (rates,
 *  commission, profit, quotation/PO) is management-only from that point on.
 *  Admin and any MobilisationSettings.viewerRoles member always see everything. */
function stripCommercialFields(mobilisation) {
  const copy = { ...mobilisation };
  for (const field of COMMERCIAL_FIELDS) delete copy[field];
  return copy;
}

/** Snapshot fields captured from the referenced Employee at creation/edit —
 *  independently editable afterward, never live-joined on read (same
 *  durable-history convention as Deployment.clientName). */
function snapshotFromEmployee(employee) {
  return {
    workerName: employee.fullName,
    iqamaNumber: employee.iqama?.number ?? null,
    nationality: employee.nationality ?? null,
    trade: employee.designation ?? null,
    phone: employee.mobile ?? null,
  };
}

async function resolveSubcontractorSnapshot(hasSubcontractor, subcontractorId) {
  if (!hasSubcontractor) return { subcontractor: null, subcontractorName: null };
  if (!subcontractorId) throw new ApiError(400, 'Select a subcontractor.');
  const subcontractorDoc = await Subcontractor.findById(subcontractorId).lean();
  if (!subcontractorDoc) throw new ApiError(404, 'Subcontractor not found.');
  return { subcontractor: subcontractorId, subcontractorName: subcontractorDoc.name };
}

/** Every ApprovalRole id `userId` belongs to — computed once per request and
 *  reused for both the viewer-circle check and the "am I the current step's
 *  reviewer" check, rather than querying ApprovalRole membership per document. */
async function myRoleIds(userId) {
  const roles = await ApprovalRole.find({ members: userId }).select('_id').lean();
  return roles.map((r) => r._id);
}

/**
 * Minimal, purpose-scoped lookup for the "invite a joint coordinator"
 * picker. `/api/users` (the general staff directory) is Admin/Manager/HR
 * only, so a plain Coordinator — the one who actually needs this — can't
 * call it; this narrower endpoint returns just enough (name only, no
 * email) for any staff member to pick a fellow Coordinator by name.
 */
export async function listCoordinatorCandidates() {
  return User.find({ role: 'Coordinator' }).select('name').sort({ name: 1 }).lean();
}

export async function createMobilisation(data, actor) {
  const allowed =
    actor.role === 'Admin' ||
    actor.role === 'Coordinator' ||
    (await isMemberOfAnyRole(actor.userId, (await getMobilisationSettings()).selfMobiliseRoles));
  if (!allowed) {
    throw new ApiError(403, 'You do not have permission to create a mobilisation.');
  }

  const employee = await Employee.findById(data.worker).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');
  const clientDoc = await Client.findById(data.client).lean();
  if (!clientDoc) throw new ApiError(404, 'Client not found.');
  const subcontractorSnapshot = await resolveSubcontractorSnapshot(data.hasSubcontractor, data.subcontractor);

  const mobilisation = await Mobilisation.create({
    ...data,
    ...snapshotFromEmployee(employee),
    clientName: clientDoc.companyName,
    ...subcontractorSnapshot,
    coordinators: [{ user: actor.userId, isPrimary: true, confirmed: true, confirmedAt: new Date() }],
    createdBy: actor.userId,
  });

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.create',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { workerName: mobilisation.workerName, clientName: mobilisation.clientName },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

/**
 * Visibility (M4): Admin sees everything. Everyone else sees a mobilisation
 * if ANY of —
 *  - they're a coordinator on it (any status),
 *  - they're a MobilisationSettings.viewerRoles member and it's past Draft
 *    (BDM's immediate "read on version" once submitted; the full MM/BDM/FM/
 *    COO/GM circle after approval — one mechanism for both),
 *  - they hold a role in the CURRENT step's pool while it's PendingReview
 *    (so the Marketing Manager can find their review queue even before an
 *    Admin has also added them to viewerRoles).
 * Commercial fields are stripped for a plain-coordinator viewer once Approved.
 */
export async function listMobilisations(query, actor) {
  const { page, limit, status, client, worker, search, sortBy, sortOrder } = query;
  const conditions = [];
  if (status) conditions.push({ status });
  if (client) conditions.push({ client });
  if (worker) conditions.push({ worker });
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    conditions.push({ $or: [{ workerName: rx }, { clientName: rx }, { jobTitle: rx }] });
  }

  let isViewer = false;
  if (actor.role !== 'Admin') {
    const roleIds = await myRoleIds(actor.userId);
    const settings = await getMobilisationSettings();
    isViewer = roleIds.some((r) => settings.viewerRoles.some((v) => v.toString() === r.toString()));

    const visibility = [{ 'coordinators.user': actor.userId }];
    if (isViewer) visibility.push({ status: { $ne: 'Draft' } });
    if (roleIds.length) visibility.push({ status: 'PendingReview', 'steps.roles': { $in: roleIds } });
    conditions.push({ $or: visibility });
  }
  const filter = conditions.length > 0 ? { $and: conditions } : {};
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 };

  const [rawItems, total] = await Promise.all([
    Mobilisation.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate(POPULATE).lean(),
    Mobilisation.countDocuments(filter),
  ]);

  const strippedItems =
    actor.role === 'Admin' || isViewer
      ? rawItems
      : rawItems.map((m) => (m.status === 'Approved' ? stripCommercialFields(m) : m));
  const items = await annotateCanDecide(strippedItems, actor, {
    pendingStatus: 'PendingReview',
    legacyAllowedRoles: ['Admin'],
  });

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getMobilisation(id, actor) {
  const mobilisation = await Mobilisation.findById(id).populate(POPULATE).lean();
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');

  let visible = mobilisation;
  if (actor.role !== 'Admin') {
    const isCoordinator = mobilisation.coordinators.some((c) => c.user._id.toString() === actor.userId);
    const settings = await getMobilisationSettings();
    const isViewer = settings.viewerRoles.length
      ? await isMemberOfAnyRole(actor.userId, settings.viewerRoles)
      : false;
    const isViewerAllowed = isViewer && mobilisation.status !== 'Draft';

    let isStepReviewer = false;
    if (mobilisation.status === 'PendingReview') {
      const stepRoleIds = (mobilisation.steps?.[mobilisation.currentStep]?.roles ?? []).map((r) => r._id ?? r);
      isStepReviewer = await isMemberOfAnyRole(actor.userId, stepRoleIds);
    }

    if (!isCoordinator && !isViewerAllowed && !isStepReviewer) {
      throw new ApiError(403, 'You do not have access to this mobilisation.');
    }
    if (!isViewer && !isStepReviewer && mobilisation.status === 'Approved') {
      visible = stripCommercialFields(mobilisation);
    }
  }

  const [annotated] = await annotateCanDecide([visible], actor, {
    pendingStatus: 'PendingReview',
    legacyAllowedRoles: ['Admin'],
  });
  return annotated;
}

const DIRECT_FIELDS = [
  'jobTitle',
  'clientRate',
  'clientCommission',
  'ftaAllowance',
  'clientTimesheetRequired',
  'subcontractorCommission',
  'subcontractorTimesheetRequired',
  'profit',
  'mobilisationDate',
  'checkoutDate',
  'overtimeRate',
  'overtimeHours',
  'otAmount',
  'otCommissionIn',
  'otCommissionOut',
  'remark',
];

function assertPrimaryOrAdmin(mobilisation, actor) {
  const isPrimary = mobilisation.coordinators.some(
    (c) => c.isPrimary && c.user.toString() === actor.userId
  );
  if (actor.role !== 'Admin' && !isPrimary) {
    throw new ApiError(403, 'Only the primary coordinator can do this.');
  }
}

/** Edit Section 1 — Draft/Rejected only, primary coordinator or Admin. Each
 *  reference (worker/client/subcontractor) is re-resolved and its snapshot
 *  refreshed only if the caller actually sent it. */
export async function updateMobilisation(id, data, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (!['Draft', 'Rejected'].includes(mobilisation.status)) {
    throw new ApiError(400, 'Only a Draft or Rejected mobilisation can be edited.');
  }
  assertPrimaryOrAdmin(mobilisation, actor);

  if ('worker' in data) {
    const employee = await Employee.findById(data.worker).lean();
    if (!employee) throw new ApiError(404, 'Employee not found.');
    Object.assign(mobilisation, snapshotFromEmployee(employee));
    mobilisation.worker = data.worker;
  }
  if ('client' in data) {
    const clientDoc = await Client.findById(data.client).lean();
    if (!clientDoc) throw new ApiError(404, 'Client not found.');
    mobilisation.client = data.client;
    mobilisation.clientName = clientDoc.companyName;
  }
  if ('hasSubcontractor' in data || 'subcontractor' in data) {
    const hasSubcontractor = data.hasSubcontractor ?? mobilisation.hasSubcontractor;
    const subcontractorId = 'subcontractor' in data ? data.subcontractor : mobilisation.subcontractor?.toString();
    const snapshot = await resolveSubcontractorSnapshot(hasSubcontractor, subcontractorId);
    mobilisation.hasSubcontractor = hasSubcontractor;
    mobilisation.subcontractor = snapshot.subcontractor;
    mobilisation.subcontractorName = snapshot.subcontractorName;
  }
  for (const field of DIRECT_FIELDS) {
    if (field in data) mobilisation[field] = data[field];
  }

  await mobilisation.save();
  await logAudit({
    user: actor.userId,
    action: 'mobilisation.update',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

// ---------------------------------------------------------------------------
// M2 — joint coordinators + submit
// ---------------------------------------------------------------------------

/** Invite a joint coordinator — Draft/Rejected only, primary/Admin only. The
 *  invitee must be a real 'Coordinator' login (the requirement's own framing:
 *  "add a combined coordinator... another coordinator"), not already on the
 *  record. They start unconfirmed and must explicitly confirm before submit
 *  is allowed. */
export async function addCoordinator(id, userId, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (!['Draft', 'Rejected'].includes(mobilisation.status)) {
    throw new ApiError(400, 'Coordinators can only be changed on a Draft or Rejected mobilisation.');
  }
  assertPrimaryOrAdmin(mobilisation, actor);

  if (mobilisation.coordinators.some((c) => c.user.toString() === userId)) {
    throw new ApiError(400, 'This user is already a coordinator on this mobilisation.');
  }
  const user = await User.findById(userId).select('role name').lean();
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'Coordinator') {
    throw new ApiError(400, 'Only a Coordinator login can be added as a joint coordinator.');
  }

  mobilisation.coordinators.push({ user: userId, isPrimary: false, confirmed: false, confirmedAt: null });
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.coordinator.add',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { addedUser: userId },
    ip: actor.ip,
  });
  await notifyUser(userId, {
    type: 'RequestStatus',
    title: `You've been added as a coordinator on a mobilisation for ${mobilisation.workerName}`,
    body: 'Confirm your involvement before it can be submitted for review.',
    url: `/mobilisations/${mobilisation._id}`,
  });
  return mobilisation.toObject();
}

/** Remove a joint coordinator — only while they haven't confirmed yet (a
 *  confirmed co-coordinator has already vouched for the record; correcting
 *  a mistake there is an Admin edit, not a routine removal), never the
 *  primary, Draft/Rejected only, primary/Admin only. */
export async function removeCoordinator(id, userId, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (!['Draft', 'Rejected'].includes(mobilisation.status)) {
    throw new ApiError(400, 'Coordinators can only be changed on a Draft or Rejected mobilisation.');
  }
  assertPrimaryOrAdmin(mobilisation, actor);

  const entry = mobilisation.coordinators.find((c) => c.user.toString() === userId);
  if (!entry) throw new ApiError(404, 'This user is not a coordinator on this mobilisation.');
  if (entry.isPrimary) throw new ApiError(400, 'The primary coordinator cannot be removed.');
  if (entry.confirmed) throw new ApiError(400, 'A confirmed coordinator cannot be removed.');

  mobilisation.coordinators = mobilisation.coordinators.filter((c) => c.user.toString() !== userId);
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.coordinator.remove',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { removedUser: userId },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

/** A joint coordinator confirming their own involvement — only that user,
 *  for themselves, Draft/Rejected only (confirmation is meaningless once
 *  already submitted). */
export async function confirmCoordinator(id, userId, actor) {
  if (actor.userId !== userId) {
    throw new ApiError(403, 'You can only confirm your own coordinator invitation.');
  }
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (!['Draft', 'Rejected'].includes(mobilisation.status)) {
    throw new ApiError(400, 'This mobilisation is no longer awaiting confirmation.');
  }
  const entry = mobilisation.coordinators.find((c) => c.user.toString() === userId);
  if (!entry) throw new ApiError(404, 'You are not a coordinator on this mobilisation.');

  entry.confirmed = true;
  entry.confirmedAt = new Date();
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.coordinator.confirm',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

/** Draft/Rejected → PendingReview. 400 unless every coordinator has
 *  confirmed. Resolves the company-wide 'Mobilisation' ApprovalWorkflow
 *  fresh each time (no per-employee override concept here — the `worker`
 *  on a mobilisation is the subject of the placement, not the requester, so
 *  using their Employee.approvalWorkflow would be semantically wrong;
 *  resolveApprovalWorkflow is reused unchanged, just always falling through
 *  to the company-wide default). A prior rejection's approvalTrail is kept
 *  as history; only the terminal decision fields reset. */
export async function submitMobilisation(id, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (!['Draft', 'Rejected'].includes(mobilisation.status)) {
    throw new ApiError(400, 'Only a Draft or Rejected mobilisation can be submitted.');
  }
  assertPrimaryOrAdmin(mobilisation, actor);

  const unconfirmed = mobilisation.coordinators.filter((c) => !c.confirmed);
  if (unconfirmed.length > 0) {
    throw new ApiError(400, 'Every coordinator on this mobilisation must confirm before it can be submitted.');
  }

  const workflow = await resolveApprovalWorkflow({ approvalWorkflow: null }, 'Mobilisation');
  mobilisation.status = 'PendingReview';
  mobilisation.decidedBy = null;
  mobilisation.decidedAt = null;
  mobilisation.decisionNote = null;
  if (workflow) {
    mobilisation.workflow = workflow._id;
    mobilisation.workflowName = workflow.name;
    mobilisation.steps = workflow.steps;
  } else {
    mobilisation.workflow = null;
    mobilisation.workflowName = null;
    mobilisation.steps = undefined;
  }
  mobilisation.currentStep = 0;
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.submit',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    ip: actor.ip,
  });
  if (workflow) {
    const memberIds = await membersOfRoles(workflow.steps[0]?.roles);
    await Promise.all(
      memberIds.map((userId) =>
        notifyUser(userId, {
          type: 'RequestStatus',
          title: `A mobilisation for ${mobilisation.workerName} needs your review`,
          url: `/mobilisations/${mobilisation._id}`,
        })
      )
    );
  }
  return mobilisation.toObject();
}

// ---------------------------------------------------------------------------
// M3 — Marketing Manager review: commercial-details + decide
// ---------------------------------------------------------------------------

const COMMERCIAL_DETAIL_FIELDS = [
  'clientQuotation',
  'clientQuotationDate',
  'clientPO',
  'clientPODate',
  'subQuotation',
  'subQuotationDate',
  'subPO',
];

/** Section 2 — filled by whoever is authorized for the CURRENT step (the
 *  Marketing Manager, or Admin), PendingReview only. Does not touch status —
 *  deciding is a separate call, since the shared decide engine only ever
 *  mutates status/decidedBy/approvalTrail (see approvalEngine.service.js). */
export async function saveCommercialDetails(id, data, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  if (mobilisation.status !== 'PendingReview') {
    throw new ApiError(400, 'Commercial details can only be added while a mobilisation is pending review.');
  }
  const stepRoleIds = mobilisation.steps?.[mobilisation.currentStep]?.roles ?? [];
  const { authorized } = await resolveStepAuthority(actor, stepRoleIds);
  if (!authorized) {
    throw new ApiError(403, 'You are not an approver for the current step of this mobilisation.');
  }

  for (const field of COMMERCIAL_DETAIL_FIELDS) {
    if (field in data) mobilisation[field] = data[field];
  }
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.commercialDetails.save',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

/**
 * Reuses the shared workflow-decision engine, overriding only how the final
 * decision is delivered: decideApprovalStep's default (`notifyEmployeeUser
 * (doc.employee, ...)`) assumes the request's "subject" is an Employee with
 * a login — Mobilisation's coordinators are Users directly, with no
 * `employee` field on the model at all, so the default would silently
 * resolve nobody (or worse, a query with an undefined filter value).
 * `legacyAllowedRoles: ['Admin']` is a safety net so an Admin can still
 * decide before the org has configured a real 'Mobilisation'
 * ApprovalWorkflow/Marketing-Manager role — mirrors every other request
 * type's legacy fallback.
 */
export async function decideMobilisation(id, { status, decisionNote }, actor) {
  return decideApprovalStep({
    Model: Mobilisation,
    id,
    decision: status,
    note: decisionNote,
    actor,
    pendingStatus: 'PendingReview',
    legacyAllowedRoles: ['Admin'],
    notFoundMessage: 'Mobilisation not found.',
    auditAction: 'mobilisation',
    buildFinalNotification: (doc) => ({
      type: 'RequestStatus',
      title: `Mobilisation for ${doc.workerName} ${doc.status.toLowerCase()}`,
      body: doc.decisionNote || undefined,
      url: `/mobilisations/${doc._id}`,
    }),
    notifyFinal: async (doc, notification) => {
      const memberIds = doc.coordinators.map((c) => (c.user._id ?? c.user).toString());
      await Promise.all(memberIds.map((userId) => notifyUser(userId, notification)));
    },
  });
}

// ---------------------------------------------------------------------------
// M5 — documents
// ---------------------------------------------------------------------------

/** Upload is blocked once Approved — the record is finalized; a document
 *  needed after that point is an Admin edit, not a routine attachment. */
function assertDocumentsEditable(mobilisation) {
  if (mobilisation.status === 'Approved') {
    throw new ApiError(400, 'Documents cannot be changed on an Approved mobilisation.');
  }
}

function assertCanTouchDocuments(mobilisation, actor) {
  if (actor.role === 'Admin') return;
  const isCoordinator = mobilisation.coordinators.some((c) => c.user.toString() === actor.userId);
  if (!isCoordinator) throw new ApiError(403, 'You do not have access to this mobilisation.');
}

export async function addDocuments(id, files, category, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  assertCanTouchDocuments(mobilisation, actor);
  assertDocumentsEditable(mobilisation);
  if (!files?.length) throw new ApiError(400, 'Attach at least one file.');

  for (const file of files) {
    mobilisation.documents.push({
      fileName: file.filename,
      resourceType: 'raw',
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category,
      uploadedBy: actor.userId,
      uploadedAt: new Date(),
    });
  }
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.documents.add',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { count: files.length, category },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

export async function removeDocument(id, fileId, actor) {
  const mobilisation = await Mobilisation.findById(id);
  if (!mobilisation) throw new ApiError(404, 'Mobilisation not found.');
  assertCanTouchDocuments(mobilisation, actor);
  assertDocumentsEditable(mobilisation);

  const doc = mobilisation.documents.id(fileId);
  if (!doc) throw new ApiError(404, 'Document not found.');

  await destroyDocumentFile(doc.fileName, doc.resourceType).catch(() => {});
  mobilisation.documents = mobilisation.documents.filter((d) => d._id.toString() !== fileId);
  await mobilisation.save();

  await logAudit({
    user: actor.userId,
    action: 'mobilisation.documents.remove',
    targetType: 'Mobilisation',
    targetId: mobilisation._id,
    meta: { fileId },
    ip: actor.ip,
  });
  return mobilisation.toObject();
}

/** A document's file for whoever can already view the record (get()'s own
 *  access rules — the caller has already been through getMobilisation). */
export async function getDocumentFile(id, fileId, actor) {
  const mobilisation = await getMobilisation(id, actor);
  const doc = (mobilisation.documents ?? []).find((d) => d._id.toString() === fileId);
  if (!doc) throw new ApiError(404, 'Document not found.');
  return {
    url: signedDownloadUrl(doc.fileName, doc.resourceType),
    mimeType: doc.mimeType,
    originalName: doc.originalName,
  };
}
