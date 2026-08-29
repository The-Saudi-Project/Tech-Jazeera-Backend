/**
 * Salary advance service — submit/decide/repay. Money is always rounded and
 * server-computed, same discipline as quotation totals.
 */
import Employee from '../employees/employee.model.js';
import SalaryAdvance from './advance.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Adds the derived repayment figures every caller needs — never stored,
 *  always computed fresh from the repayments ledger so it can't drift. */
function withBalance(advance) {
  const amountRepaid = money(advance.repayments.reduce((sum, r) => sum + r.amount, 0));
  return { ...advance, amountRepaid, outstandingBalance: money(advance.amount - amountRepaid) };
}

export async function submitAdvance(employeeId, data, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const active = await SalaryAdvance.findOne({
    employee: employeeId,
    status: { $in: ['Pending', 'Approved'] },
  }).lean();
  if (active) {
    throw new ApiError(409, 'You already have an advance request in progress — it must be decided and repaid before requesting another.');
  }

  const advance = await SalaryAdvance.create({ employee: employeeId, ...data });
  await logAudit({
    user: actor.userId,
    action: 'advance.submit',
    targetType: 'SalaryAdvance',
    targetId: advance._id,
    meta: { employeeId: employee.employeeId, amount: data.amount },
    ip: actor.ip,
  });
  return withBalance(advance.toObject());
}

export async function listOwnAdvances(employeeId, { page, limit, status }) {
  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    SalaryAdvance.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SalaryAdvance.countDocuments(filter),
  ]);
  return { items: items.map(withBalance), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function cancelAdvance(employeeId, id, actor) {
  const advance = await SalaryAdvance.findById(id);
  if (!advance) throw new ApiError(404, 'Advance request not found.');
  if (advance.employee.toString() !== employeeId) {
    throw new ApiError(403, 'You can only cancel your own advance requests.');
  }
  if (advance.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be cancelled.');

  advance.status = 'Cancelled';
  await advance.save();
  await logAudit({
    user: actor.userId,
    action: 'advance.cancel',
    targetType: 'SalaryAdvance',
    targetId: advance._id,
    ip: actor.ip,
  });
  return withBalance(advance.toObject());
}

export async function listAdvances({ page, limit, status, employee }) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [items, total] = await Promise.all([
    SalaryAdvance.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .lean(),
    SalaryAdvance.countDocuments(filter),
  ]);
  return { items: items.map(withBalance), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideAdvance(id, { status, decisionNote }, actor) {
  const advance = await SalaryAdvance.findById(id);
  if (!advance) throw new ApiError(404, 'Advance request not found.');
  if (advance.status !== 'Pending') throw new ApiError(400, 'Only a pending request can be decided.');

  advance.status = status;
  advance.decidedBy = actor.userId;
  advance.decidedAt = new Date();
  advance.decisionNote = decisionNote;
  await advance.save();

  await logAudit({
    user: actor.userId,
    action: `advance.${status.toLowerCase()}`,
    targetType: 'SalaryAdvance',
    targetId: advance._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  return withBalance(advance.toObject());
}

export async function addRepayment(id, data, actor) {
  const advance = await SalaryAdvance.findById(id);
  if (!advance) throw new ApiError(404, 'Advance request not found.');
  if (advance.status !== 'Approved') {
    throw new ApiError(400, 'Repayments can only be recorded against an approved advance.');
  }

  const alreadyRepaid = money(advance.repayments.reduce((sum, r) => sum + r.amount, 0));
  const outstanding = money(advance.amount - alreadyRepaid);
  if (data.amount > outstanding) {
    throw new ApiError(400, `That exceeds the outstanding balance (SAR ${outstanding}).`);
  }

  advance.repayments.push({ ...data, recordedBy: actor.userId });
  const newOutstanding = money(outstanding - data.amount);
  if (newOutstanding === 0) advance.status = 'Closed';
  await advance.save();

  await logAudit({
    user: actor.userId,
    action: 'advance.repayment.add',
    targetType: 'SalaryAdvance',
    targetId: advance._id,
    meta: { amount: data.amount, newOutstanding },
    ip: actor.ip,
  });
  return withBalance(advance.toObject());
}
