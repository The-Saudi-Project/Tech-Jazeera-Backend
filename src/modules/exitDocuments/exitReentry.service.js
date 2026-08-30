/**
 * Exit Re-Entry visa request service — submit/decide/mark-issued, same
 * single-level shape as Leave and the financial requests.
 */
import Employee from '../employees/employee.model.js';
import LeaveRequest from '../leave/leaveRequest.model.js';
import ExitReentryRequest from './exitReentry.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import { notifyEmployeeUser } from '../notifications/notification.service.js';

async function assertOwnsLeaveRequest(employeeId, leaveRequestId) {
  if (!leaveRequestId) return;
  const leave = await LeaveRequest.findById(leaveRequestId).select('employee').lean();
  if (!leave || leave.employee.toString() !== employeeId) {
    throw new ApiError(400, 'That leave request does not belong to this employee.');
  }
}

export async function submitExitReentry(employeeId, data, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');
  await assertOwnsLeaveRequest(employeeId, data.linkedLeaveRequest);

  const request = await ExitReentryRequest.create({ employee: employeeId, ...data });
  await logAudit({
    user: actor.userId,
    action: 'exitReentry.submit',
    targetType: 'ExitReentryRequest',
    targetId: request._id,
    meta: { employeeId: employee.employeeId, visaType: data.visaType },
    ip: actor.ip,
  });
  return request.toObject();
}

export async function listOwnExitReentry(employeeId, { page, limit, status }) {
  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ExitReentryRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ExitReentryRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function cancelExitReentry(employeeId, id, actor) {
  const request = await ExitReentryRequest.findById(id);
  if (!request) throw new ApiError(404, 'Exit re-entry request not found.');
  if (request.employee.toString() !== employeeId) {
    throw new ApiError(403, 'You can only cancel your own requests.');
  }
  if (request.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be cancelled.');

  request.status = 'Cancelled';
  await request.save();
  await logAudit({
    user: actor.userId,
    action: 'exitReentry.cancel',
    targetType: 'ExitReentryRequest',
    targetId: request._id,
    ip: actor.ip,
  });
  return request.toObject();
}

export async function listExitReentry({ page, limit, status, employee }) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [items, total] = await Promise.all([
    ExitReentryRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .lean(),
    ExitReentryRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideExitReentry(id, { status, decisionNote }, actor) {
  const request = await ExitReentryRequest.findById(id);
  if (!request) throw new ApiError(404, 'Exit re-entry request not found.');
  if (request.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be decided.');

  request.status = status;
  request.decidedBy = actor.userId;
  request.decidedAt = new Date();
  request.decisionNote = decisionNote;
  await request.save();
  await logAudit({
    user: actor.userId,
    action: `exitReentry.${status.toLowerCase()}`,
    targetType: 'ExitReentryRequest',
    targetId: request._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  await notifyEmployeeUser(request.employee, {
    type: 'RequestStatus',
    title: `Exit re-entry visa request ${status.toLowerCase()}`,
    body: decisionNote || undefined,
    url: '/me/exit-documents',
  });
  return request.toObject();
}

/** HR records that the visa was actually processed with Jawazat/Muqeem. */
export async function markExitReentryIssued(id, { visaReferenceNumber }, actor) {
  const request = await ExitReentryRequest.findById(id);
  if (!request) throw new ApiError(404, 'Exit re-entry request not found.');
  if (request.status !== 'Approved') throw new ApiError(400, 'Only an approved request can be marked issued.');

  request.status = 'Issued';
  request.issuedAt = new Date();
  request.issuedBy = actor.userId;
  request.visaReferenceNumber = visaReferenceNumber;
  await request.save();
  await logAudit({
    user: actor.userId,
    action: 'exitReentry.issued',
    targetType: 'ExitReentryRequest',
    targetId: request._id,
    meta: { visaReferenceNumber },
    ip: actor.ip,
  });
  return request.toObject();
}
