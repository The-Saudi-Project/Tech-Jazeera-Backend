/**
 * "Me" controller — HTTP translation only. Every handler resolves data
 * against req.user.employee, never a client-supplied id — that IS the
 * self-service guarantee, not an extra check layered on top of it.
 */
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ApiError from '../../utils/ApiError.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { contentDisposition } from '../../utils/contentDisposition.js';
import * as meService from './me.service.js';

const actor = (req) => ({ userId: req.user.id, employee: req.user.employee, ip: req.ip });

/** requireRoles('Worker') on the router guarantees a role, not the link — a
 *  Worker whose Employee was since deleted would otherwise 500 downstream. */
function myEmployeeId(req) {
  if (!req.user.employee) {
    throw new ApiError(404, 'No employee record is linked to this account.');
  }
  return req.user.employee;
}

/** GET /api/me — 200 → data: employee (own record) */
export async function getProfile(req, res) {
  const employee = await meService.getMyProfile(myEmployeeId(req));
  res.json(new ApiResponse('Your profile.', employee));
}

/** GET /api/me/documents — 200 → data: { items, total, page, pages } */
export async function listDocuments(req, res) {
  const data = await meService.listMyDocuments(myEmployeeId(req), req.query);
  res.json(new ApiResponse('Your documents.', data));
}

/** GET /api/me/documents/:id/file?version=N — streams own file bytes only. */
export async function documentFile(req, res) {
  const fileData = await meService.getMyDocumentFile(myEmployeeId(req), req.params.id, req.query.version);

  res.setHeader('Content-Type', fileData.mimeType);
  res.setHeader('Content-Disposition', contentDisposition(fileData.originalName));

  if (fileData.source === 'disk') {
    await pipeline(fs.createReadStream(fileData.absolutePath), res);
    return;
  }
  const upstream = await fetch(fileData.url);
  if (!upstream.ok || !upstream.body) {
    throw new ApiError(410, 'The stored file is no longer available.');
  }
  await pipeline(Readable.fromWeb(upstream.body), res);
}

/** POST /api/me/leave — 201 → data: leave request (AutoApproved or PendingReview) */
export async function submitLeave(req, res) {
  const request = await meService.submitMyLeave(myEmployeeId(req), req.body, actor(req));
  const message =
    request.status === 'AutoApproved' ? 'Leave request approved.' : 'Leave request submitted for review.';
  res.status(201).json(new ApiResponse(message, request));
}

/** GET /api/me/leave — 200 → data: { items, total, page, pages } */
export async function listLeave(req, res) {
  const data = await meService.listMyLeave(myEmployeeId(req), req.query);
  res.json(new ApiResponse('Your leave requests.', data));
}

/** PATCH /api/me/leave/:id/cancel — 200 → data: leave request */
export async function cancelLeave(req, res) {
  const request = await meService.cancelMyLeave(myEmployeeId(req), req.params.id, actor(req));
  res.json(new ApiResponse('Leave request cancelled.', request));
}

/** POST /api/me/attendance — 201 → data: attendance record. 403 if outside the geofence/office network. */
export async function markAttendance(req, res) {
  const record = await meService.markMyAttendance(myEmployeeId(req), req.body, actor(req));
  res.status(201).json(new ApiResponse('Attendance marked.', record));
}

/** GET /api/me/attendance — 200 → data: record[] (last 30 days by default) */
export async function listAttendance(req, res) {
  const data = await meService.listMyAttendance(myEmployeeId(req), req.query);
  res.json(new ApiResponse('Your attendance.', data));
}
