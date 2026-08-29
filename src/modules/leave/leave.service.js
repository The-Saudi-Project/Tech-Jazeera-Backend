/**
 * Leave service — LeaveType configuration and the leave-request eligibility
 * engine.
 *
 * The eligibility engine is the heart of this module: entitlement is ALWAYS
 * computed here, server-side, from the employee's real joining date and their
 * actual leave history — never trusted from the client, exactly like
 * quotation totals. It is re-derived at submission time and frozen into
 * `eligibility` on the request (see leaveRequest.model.js) so a later policy
 * change can't retroactively rewrite why a past request was decided the way
 * it was.
 */
import Employee from '../employees/employee.model.js';
import LeaveType from './leaveType.model.js';
import LeaveRequest from './leaveRequest.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole calendar days between two dates, inclusive of both ends. */
function daysInclusive(start, end) {
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/** Full months of continuous service between `joiningDate` and `now`. Also
 *  used by the EOSB calculator (settlement.service.js) — one tenure formula,
 *  not two that could quietly drift apart. */
export function monthsOfService(joiningDate, now) {
  let months = (now.getFullYear() - joiningDate.getFullYear()) * 12 + (now.getMonth() - joiningDate.getMonth());
  if (now.getDate() < joiningDate.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Start of the employee's CURRENT leave-year (anniversary of joining), as of `now`. */
function currentLeaveYearStart(joiningDate, now) {
  const anniversary = new Date(joiningDate);
  anniversary.setFullYear(now.getFullYear());
  if (anniversary > now) anniversary.setFullYear(anniversary.getFullYear() - 1);
  return anniversary;
}

async function evaluateAnnual(employee, leaveType, requestedDays, now) {
  const serviceMonths = monthsOfService(employee.joiningDate, now);
  if (serviceMonths < leaveType.minServiceMonths) {
    return {
      eligible: false,
      autoApprovable: false,
      continuousServiceMonths: serviceMonths,
      entitlementDays: 0,
      usedDays: 0,
      remainingDays: 0,
      ruleApplied: `Requires ${leaveType.minServiceMonths} months of continuous service (has ${serviceMonths}).`,
    };
  }
  const entitlementDays =
    leaveType.tierYears && serviceMonths / 12 >= leaveType.tierYears
      ? leaveType.tierDaysPerYear
      : leaveType.daysPerYear;
  const yearStart = currentLeaveYearStart(employee.joiningDate, now);
  const [usedAgg] = await LeaveRequest.aggregate([
    {
      $match: {
        employee: employee._id,
        leaveType: leaveType._id,
        status: { $in: ['AutoApproved', 'Approved'] },
        startDate: { $gte: yearStart },
      },
    },
    { $group: { _id: null, total: { $sum: '$days' } } },
  ]);
  const usedDays = usedAgg?.total ?? 0;
  const remainingDays = Math.max(0, entitlementDays - usedDays);
  return {
    eligible: remainingDays >= requestedDays,
    autoApprovable: true,
    continuousServiceMonths: serviceMonths,
    entitlementDays,
    usedDays,
    remainingDays,
    ruleApplied: `Annual leave: ${entitlementDays} days/year, ${usedDays} used since ${yearStart.toDateString()}.`,
  };
}

async function evaluateContractCycle(employee, leaveType, requestedDays, now) {
  const serviceMonths = monthsOfService(employee.joiningDate, now);
  const cycleMonths = leaveType.cycleYears * 12;
  const cyclesCompleted = Math.floor(serviceMonths / cycleMonths);
  if (cyclesCompleted < 1) {
    return {
      eligible: false,
      autoApprovable: true,
      continuousServiceMonths: serviceMonths,
      entitlementDays: 0,
      usedDays: 0,
      remainingDays: 0,
      ruleApplied: `Requires a full ${leaveType.cycleYears}-year contract cycle (has ${(serviceMonths / 12).toFixed(1)} years).`,
    };
  }
  const cyclesUsed = await LeaveRequest.countDocuments({
    employee: employee._id,
    leaveType: leaveType._id,
    status: { $in: ['AutoApproved', 'Approved'] },
  });
  const cyclesAvailable = Math.max(0, cyclesCompleted - cyclesUsed);
  return {
    eligible: cyclesAvailable >= 1 && requestedDays <= leaveType.daysPerCycle,
    autoApprovable: true,
    continuousServiceMonths: serviceMonths,
    entitlementDays: leaveType.daysPerCycle,
    usedDays: cyclesUsed * leaveType.daysPerCycle,
    remainingDays: cyclesAvailable * leaveType.daysPerCycle,
    ruleApplied: `Contract-cycle leave: ${leaveType.daysPerCycle} days every ${leaveType.cycleYears} years — ${cyclesCompleted} cycle(s) completed, ${cyclesUsed} already taken.`,
  };
}

function evaluateManual(employee, leaveType, requestedDays, now) {
  const serviceMonths = monthsOfService(employee.joiningDate, now);
  const meetsMinService = serviceMonths >= leaveType.minServiceMonths;
  return {
    eligible: false,
    autoApprovable: false,
    continuousServiceMonths: serviceMonths,
    entitlementDays: 0,
    usedDays: 0,
    remainingDays: 0,
    ruleApplied: meetsMinService
      ? 'This leave type always requires manager review.'
      : `Requires ${leaveType.minServiceMonths} months of continuous service (has ${serviceMonths}).`,
  };
}

/** Compute eligibility for one employee/leaveType/requestedDays combination. */
export async function evaluateEligibility(employee, leaveType, requestedDays, now = new Date()) {
  // joiningDate is required for 'Client' employees but optional for 'Own'
  // ones (see employee.model.js) — every recurrence type below needs it, so
  // fail with a clear message rather than crash if it's genuinely missing.
  if (!employee.joiningDate) {
    throw new ApiError(
      400,
      'This employee has no joining date on file — add one before requesting leave.'
    );
  }
  if (leaveType.recurrence === 'Annual') return evaluateAnnual(employee, leaveType, requestedDays, now);
  if (leaveType.recurrence === 'ContractCycle') {
    return evaluateContractCycle(employee, leaveType, requestedDays, now);
  }
  return evaluateManual(employee, leaveType, requestedDays, now);
}

// ---------------------------------------------------------------------------
// LeaveType configuration (Admin/Manager — the "customizable" policy layer)
// ---------------------------------------------------------------------------

export async function listLeaveTypes({ activeOnly } = {}) {
  const filter = activeOnly === 'true' ? { isActive: true } : {};
  return LeaveType.find(filter).sort({ name: 1 }).lean();
}

export async function createLeaveType(data, actor) {
  const existing = await LeaveType.findOne({ name: data.name }).lean();
  if (existing) throw new ApiError(409, 'A leave type with this name already exists.');
  const type = await LeaveType.create(data);
  await logAudit({
    user: actor.userId,
    action: 'leaveType.create',
    targetType: 'LeaveType',
    targetId: type._id,
    meta: { name: type.name, recurrence: type.recurrence },
    ip: actor.ip,
  });
  return type.toObject();
}

export async function updateLeaveType(id, data, actor) {
  const type = await LeaveType.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  if (!type) throw new ApiError(404, 'Leave type not found.');
  await logAudit({
    user: actor.userId,
    action: 'leaveType.update',
    targetType: 'LeaveType',
    targetId: type._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return type;
}

// ---------------------------------------------------------------------------
// LeaveRequest — submit, list, decide, acknowledge, cancel
// ---------------------------------------------------------------------------

/** A Coordinator may only touch requests for employees assigned to them. */
async function assertEmployeeScope(actor, employeeId) {
  if (actor.role !== 'Coordinator') return; // everyone else's existing access is unchanged
  const employee = await Employee.findById(employeeId).select('coordinator').lean();
  if (!employee || employee.coordinator?.toString() !== actor.userId) {
    throw new ApiError(403, 'You do not have access to this employee.');
  }
}

export async function submitLeaveRequest(employeeId, { leaveType: leaveTypeId, startDate, endDate, reason }, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const leaveType = await LeaveType.findById(leaveTypeId).lean();
  if (!leaveType || !leaveType.isActive) throw new ApiError(400, 'This leave type is not available.');

  if (endDate < startDate) throw new ApiError(400, 'End date cannot be before the start date.');
  const days = daysInclusive(startDate, endDate);

  if (leaveType.maxDaysPerRequest && days > leaveType.maxDaysPerRequest) {
    throw new ApiError(
      400,
      `${leaveType.name} is capped at ${leaveType.maxDaysPerRequest} day${leaveType.maxDaysPerRequest > 1 ? 's' : ''} per request.`
    );
  }

  const overlap = await LeaveRequest.findOne({
    employee: employee._id,
    status: { $in: ['AutoApproved', 'Approved', 'PendingReview'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).lean();
  if (overlap) throw new ApiError(409, 'A leave request already exists that overlaps these dates.');

  const evaluation = await evaluateEligibility(employee, leaveType, days);
  const status = evaluation.eligible && evaluation.autoApprovable ? 'AutoApproved' : 'PendingReview';

  const request = await LeaveRequest.create({
    employee: employee._id,
    leaveType: leaveType._id,
    leaveTypeName: leaveType.name,
    startDate,
    endDate,
    days,
    reason,
    status,
    eligibility: {
      continuousServiceMonths: evaluation.continuousServiceMonths,
      entitlementDays: evaluation.entitlementDays,
      usedDays: evaluation.usedDays,
      remainingDays: evaluation.remainingDays,
      ruleApplied: evaluation.ruleApplied,
    },
  });

  await logAudit({
    user: actor.userId,
    action: status === 'AutoApproved' ? 'leave.request.auto_approved' : 'leave.request.submitted',
    targetType: 'LeaveRequest',
    targetId: request._id,
    meta: { employeeId: employee.employeeId, leaveType: leaveType.name, days, status },
    ip: actor.ip,
  });

  return request.toObject();
}

/** Staff review queue — scoped to a Coordinator's own team automatically. */
export async function listLeaveRequests({ page, limit, status, employee }, actor) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;

  if (actor.role === 'Coordinator') {
    const teamIds = await Employee.find({ coordinator: actor.userId }).distinct('_id');
    const teamIdStrings = teamIds.map((teamId) => teamId.toString());
    if (employee && !teamIdStrings.includes(employee)) {
      throw new ApiError(403, 'You do not have access to this employee.');
    }
    filter.employee = employee ?? { $in: teamIds };
  }

  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .populate('decidedBy', 'name')
      .lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listOwnLeaveRequests(employeeId, { page, limit, status }) {
  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Approve/reject a PendingReview request. Auto-approved ones are never decided — see acknowledge(). */
export async function decideLeaveRequest(id, { status, decisionNote }, actor) {
  const request = await LeaveRequest.findById(id);
  if (!request) throw new ApiError(404, 'Leave request not found.');
  if (request.status !== 'PendingReview') {
    throw new ApiError(400, 'Only requests pending review can be decided.');
  }
  await assertEmployeeScope(actor, request.employee);

  request.status = status;
  request.decidedBy = actor.userId;
  request.decidedAt = new Date();
  request.decisionNote = decisionNote;
  await request.save();

  await logAudit({
    user: actor.userId,
    action: `leave.request.${status.toLowerCase()}`,
    targetType: 'LeaveRequest',
    targetId: request._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  return request.toObject();
}

/** Mark an auto-approved request as seen — the "notice" a coordinator/manager clears. */
export async function acknowledgeLeaveRequest(id, actor) {
  const request = await LeaveRequest.findById(id);
  if (!request) throw new ApiError(404, 'Leave request not found.');
  if (request.status !== 'AutoApproved') {
    throw new ApiError(400, 'Only auto-approved requests can be acknowledged.');
  }
  await assertEmployeeScope(actor, request.employee);

  request.acknowledgedByManager = true;
  await request.save();

  await logAudit({
    user: actor.userId,
    action: 'leave.request.acknowledged',
    targetType: 'LeaveRequest',
    targetId: request._id,
    ip: actor.ip,
  });
  return request.toObject();
}

/** A worker cancels their own not-yet-started request. */
export async function cancelLeaveRequest(id, actor) {
  const request = await LeaveRequest.findById(id);
  if (!request) throw new ApiError(404, 'Leave request not found.');
  if (request.employee.toString() !== actor.employee) {
    throw new ApiError(403, 'You can only cancel your own leave requests.');
  }
  if (!['PendingReview', 'AutoApproved'].includes(request.status)) {
    throw new ApiError(400, 'This request can no longer be cancelled.');
  }
  if (new Date(request.startDate) <= new Date()) {
    throw new ApiError(400, 'This leave has already started and can no longer be cancelled.');
  }

  request.status = 'Cancelled';
  await request.save();

  await logAudit({
    user: actor.userId,
    action: 'leave.request.cancelled',
    targetType: 'LeaveRequest',
    targetId: request._id,
    ip: actor.ip,
  });
  return request.toObject();
}
