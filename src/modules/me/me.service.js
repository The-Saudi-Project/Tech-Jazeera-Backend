/**
 * "Me" service — the self-service surface a Worker sees over other modules'
 * data (P2-M2). It adds no data of its own; it reads Employee/Document/Leave
 * scoped to req.user.employee, which is exactly the ownership guard the
 * P2-M1 notes deferred to this milestone.
 */
import Document from '../documents/document.model.js';
import * as documentService from '../documents/document.service.js';
import Employee from '../employees/employee.model.js';
import ApiError from '../../utils/ApiError.js';
import * as leaveService from '../leave/leave.service.js';
import * as attendanceService from '../attendance/attendance.service.js';

export async function getMyProfile(employeeId) {
  const employee = await Employee.findById(employeeId)
    .populate('currentClient', 'companyName')
    .populate('coordinator', 'name email')
    .lean();
  if (!employee) throw new ApiError(404, 'Employee record not found.');
  return employee;
}

export async function listMyDocuments(employeeId, { page = 1, limit = 20 } = {}) {
  return documentService.listDocuments({ page, limit, ownerType: 'Employee', owner: employeeId });
}

/** The ownership guard: a Worker may only ever resolve a file for THEIR OWN document. */
async function assertOwnsDocument(employeeId, documentId) {
  const doc = await Document.findById(documentId).select('ownerType owner').lean();
  if (!doc || doc.ownerType !== 'Employee' || doc.owner.toString() !== employeeId) {
    throw new ApiError(404, 'Document not found.');
  }
}

export async function getMyDocumentFile(employeeId, documentId, version) {
  await assertOwnsDocument(employeeId, documentId);
  return documentService.resolveFile(documentId, version);
}

export async function submitMyLeave(employeeId, body, actor) {
  return leaveService.submitLeaveRequest(employeeId, body, actor);
}

export async function listMyLeave(employeeId, query) {
  return leaveService.listOwnLeaveRequests(employeeId, query);
}

export async function cancelMyLeave(employeeId, leaveRequestId, actor) {
  return leaveService.cancelLeaveRequest(leaveRequestId, { ...actor, employee: employeeId });
}

export async function checkInMyAttendance(employeeId, body, actor) {
  return attendanceService.selfCheckIn({ employeeId, ...body }, actor);
}

export async function checkOutMyAttendance(employeeId, body, actor) {
  return attendanceService.selfCheckOut({ employeeId, ...body }, actor);
}

export async function tapMyAttendance(employeeId, body, actor) {
  return attendanceService.selfTap({ employeeId, ...body }, actor);
}

/** Own attendance history — defaults to the last 30 days when no range is given. */
export async function listMyAttendance(employeeId, { from, to } = {}) {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  return attendanceService.listAttendance({
    from: from ?? monthAgo.toISOString().slice(0, 10),
    to: to ?? today.toISOString().slice(0, 10),
    employee: employeeId,
  });
}
