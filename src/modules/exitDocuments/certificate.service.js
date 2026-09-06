/**
 * Certificate request service — submit/decide/mark-issued, plus resolving
 * the data a PDF needs (never trusting the client for any of it — the same
 * discipline as quotation totals and the EOSB calculator). Submit/decide run
 * through the same Configurable Approval Hierarchy engine as Leave/
 * ExitReentry — see approvals/approvalEngine.service.js.
 */
import Employee from '../employees/employee.model.js';
import Settlement from '../eosb/settlement.model.js';
import CertificateRequest from './certificate.model.js';
import { CERTIFICATE_TYPES_WITH_PDF } from './certificate.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import { resolveApprovalWorkflow } from '../approvals/approvals.service.js';
import { decideApprovalStep, annotateCanDecide, notifySubmission } from '../approvals/approvalEngine.service.js';

/** The ORIGINAL decide-route role gate — preserved exactly as the
 *  authorization used whenever no ApprovalWorkflow governs a request. */
const LEGACY_DECIDE_ROLES = ['Admin', 'Manager', 'HR'];

/** Shared by submitCertificate (notifySubmission) and decideCertificate
 *  (buildStepNotification) so the text can never drift between steps. */
function buildCertificateStepNotification(doc, stepIndex) {
  return {
    type: 'RequestStatus',
    title: `A ${doc.type} request needs your approval`,
    body: doc.steps?.[stepIndex]?.label ? `Step: ${doc.steps[stepIndex].label}` : undefined,
    url: '/exit-documents',
  };
}

export async function submitCertificate(employeeId, data, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const workflow = await resolveApprovalWorkflow(employee, 'Certificate');
  const workflowFields = workflow
    ? { workflow: workflow._id, workflowName: workflow.name, steps: workflow.steps, currentStep: 0 }
    : {};

  const request = await CertificateRequest.create({ employee: employeeId, ...data, ...workflowFields });
  await logAudit({
    user: actor.userId,
    action: 'certificate.submit',
    targetType: 'CertificateRequest',
    targetId: request._id,
    meta: { employeeId: employee.employeeId, type: data.type },
    ip: actor.ip,
  });
  const plain = request.toObject();
  await notifySubmission(plain, buildCertificateStepNotification, LEGACY_DECIDE_ROLES);
  return plain;
}

export async function listOwnCertificates(employeeId, { page, limit, status }) {
  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    CertificateRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CertificateRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function cancelCertificate(employeeId, id, actor) {
  const request = await CertificateRequest.findById(id);
  if (!request) throw new ApiError(404, 'Certificate request not found.');
  if (request.employee.toString() !== employeeId) {
    throw new ApiError(403, 'You can only cancel your own requests.');
  }
  if (request.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be cancelled.');

  await request.deleteOne();
  await logAudit({
    user: actor.userId,
    action: 'certificate.cancel',
    targetType: 'CertificateRequest',
    targetId: request._id,
    ip: actor.ip,
  });
}

export async function listCertificates({ page, limit, status, employee }, actor) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [rawItems, total] = await Promise.all([
    CertificateRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .populate('decidedBy', 'name')
      .populate('steps.roles', 'name')
      .populate('approvalTrail.approvalRole', 'name')
      .populate('approvalTrail.approvedBy', 'name role')
      .lean(),
    CertificateRequest.countDocuments(filter),
  ]);
  const items = await annotateCanDecide(rawItems, actor, {
    pendingStatus: 'Pending',
    legacyAllowedRoles: LEGACY_DECIDE_ROLES,
  });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideCertificate(id, { status, decisionNote }, actor) {
  return decideApprovalStep({
    Model: CertificateRequest,
    id,
    decision: status,
    note: decisionNote,
    actor,
    pendingStatus: 'Pending',
    legacyAllowedRoles: LEGACY_DECIDE_ROLES,
    notFoundMessage: 'Certificate request not found.',
    auditAction: 'certificate',
    buildFinalNotification: (doc) => ({
      type: 'RequestStatus',
      title: `${doc.type} certificate request ${doc.status.toLowerCase()}`,
      body: doc.decisionNote || undefined,
      url: (role) => (role === 'Worker' || role === 'Staff' ? '/me/exit-documents' : '/exit-documents'),
    }),
    buildStepNotification: buildCertificateStepNotification,
  });
}

/** Marks issued — for a letter, "handed over"; for the attestation type, "stamped and returned". */
export async function markCertificateIssued(id, actor) {
  const request = await CertificateRequest.findById(id);
  if (!request) throw new ApiError(404, 'Certificate request not found.');
  if (request.status !== 'Approved') throw new ApiError(400, 'Only an approved request can be marked issued.');

  request.status = 'Issued';
  request.issuedAt = new Date();
  request.issuedBy = actor.userId;
  await request.save();
  await logAudit({
    user: actor.userId,
    action: 'certificate.issued',
    targetType: 'CertificateRequest',
    targetId: request._id,
    ip: actor.ip,
  });
  return request.toObject();
}

/**
 * Resolve everything a certificate PDF needs, or throw. Only Approved/Issued
 * letter-type requests may be rendered — never Pending (nothing to hand out
 * before HR actually approves it) and never the attestation type (there is
 * no document for this app to generate — see certificate.model.js).
 */
export async function resolveCertificateForPdf(id, requesterEmployeeId = null) {
  const request = await CertificateRequest.findById(id).lean();
  if (!request) throw new ApiError(404, 'Certificate request not found.');
  if (requesterEmployeeId && request.employee.toString() !== requesterEmployeeId) {
    throw new ApiError(404, 'Certificate request not found.');
  }
  if (!CERTIFICATE_TYPES_WITH_PDF.includes(request.type)) {
    throw new ApiError(400, 'This request type does not generate a document — its status is tracked instead.');
  }
  if (!['Approved', 'Issued'].includes(request.status)) {
    throw new ApiError(400, 'This request has not been approved yet.');
  }

  const employee = await Employee.findById(request.employee).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  let exitDate = null;
  if (employee.status === 'Exited') {
    const settlement = await Settlement.findOne({ employee: employee._id }).sort({ exitDate: -1 }).lean();
    exitDate = settlement?.exitDate ?? null;
  }

  return { request, employee, exitDate };
}
