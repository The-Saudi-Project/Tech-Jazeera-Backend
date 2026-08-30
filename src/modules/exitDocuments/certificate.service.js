/**
 * Certificate request service — submit/decide/mark-issued, plus resolving
 * the data a PDF needs (never trusting the client for any of it — the same
 * discipline as quotation totals and the EOSB calculator).
 */
import Employee from '../employees/employee.model.js';
import Settlement from '../eosb/settlement.model.js';
import CertificateRequest from './certificate.model.js';
import { CERTIFICATE_TYPES_WITH_PDF } from './certificate.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import { notifyEmployeeUser } from '../notifications/notification.service.js';

export async function submitCertificate(employeeId, data, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const request = await CertificateRequest.create({ employee: employeeId, ...data });
  await logAudit({
    user: actor.userId,
    action: 'certificate.submit',
    targetType: 'CertificateRequest',
    targetId: request._id,
    meta: { employeeId: employee.employeeId, type: data.type },
    ip: actor.ip,
  });
  return request.toObject();
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

export async function listCertificates({ page, limit, status, employee }) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [items, total] = await Promise.all([
    CertificateRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .lean(),
    CertificateRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideCertificate(id, { status, decisionNote }, actor) {
  const request = await CertificateRequest.findById(id);
  if (!request) throw new ApiError(404, 'Certificate request not found.');
  if (request.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be decided.');

  request.status = status;
  request.decidedBy = actor.userId;
  request.decidedAt = new Date();
  request.decisionNote = decisionNote;
  await request.save();
  await logAudit({
    user: actor.userId,
    action: `certificate.${status.toLowerCase()}`,
    targetType: 'CertificateRequest',
    targetId: request._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  await notifyEmployeeUser(request.employee, {
    type: 'RequestStatus',
    title: `${request.type} certificate request ${status.toLowerCase()}`,
    body: decisionNote || undefined,
    url: '/me/exit-documents',
  });
  return request.toObject();
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
