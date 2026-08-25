/**
 * Attendance controller — HTTP translation only.
 *
 * Note: the export endpoint intentionally breaks the JSON `{success,...}`
 * envelope — it streams a binary file with download headers. That is the one
 * legitimate non-JSON response in the API.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as attendanceService from './attendance.service.js';
import { buildXlsx, buildPdf } from './attendance.export.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** POST /api/attendance/bulk — 200 → data: { date, marked } */
export async function markBulk(req, res) {
  const data = await attendanceService.markBulk(req.body, actor(req));
  res.json(new ApiResponse('Attendance saved.', data));
}

/** GET /api/attendance — 200 → data: records[] (for the grid) */
export async function list(req, res) {
  const data = await attendanceService.listAttendance(req.query);
  res.json(new ApiResponse('Attendance records.', data));
}

/** GET /api/attendance/summary — 200 → data: { from, to, statuses, rows } */
export async function summary(req, res) {
  const data = await attendanceService.getSummary(req.query);
  res.json(new ApiResponse('Attendance summary.', data));
}

/** GET /api/attendance/export?format=xlsx|pdf — downloads a file. */
export async function exportSummary(req, res) {
  const { format, from, to } = req.query;
  const summaryData = await attendanceService.getSummary({ from, to });

  const isExcel = format === 'xlsx';
  const buffer = isExcel ? await buildXlsx(summaryData) : await buildPdf(summaryData);
  const filename = `attendance_${from}_to_${to}.${isExcel ? 'xlsx' : 'pdf'}`;

  res.setHeader(
    'Content-Type',
    isExcel
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

/** GET /api/attendance/office-location   (Admin) — 200 → data: location | null */
export async function getOfficeLocation(req, res) {
  const data = await attendanceService.getOfficeLocation();
  res.json(new ApiResponse('Office location.', data));
}

/** PATCH /api/attendance/office-location   (Admin) — 200 → data: location */
export async function updateOfficeLocation(req, res) {
  const data = await attendanceService.setOfficeLocation(req.body, actor(req));
  res.json(new ApiResponse('Office location saved.', data));
}

/** GET /api/attendance/tap-points   (Admin) — 200 → data: tapPoint[] */
export async function listTapPoints(req, res) {
  const data = await attendanceService.listTapPoints();
  res.json(new ApiResponse('Tap points.', data));
}

/** POST /api/attendance/tap-points   (Admin) — 201 → data: tapPoint (includes token/URL) */
export async function createTapPoint(req, res) {
  const data = await attendanceService.createTapPoint(req.body, actor(req));
  res.status(201).json(new ApiResponse('Tap point created.', data));
}

/** PATCH /api/attendance/tap-points/:id   (Admin) — 200 → data: tapPoint */
export async function updateTapPoint(req, res) {
  const data = await attendanceService.updateTapPoint(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Tap point saved.', data));
}

/** POST /api/attendance/tap-points/:id/rotate   (Admin) — 200 → data: tapPoint (new token) */
export async function rotateTapPointToken(req, res) {
  const data = await attendanceService.rotateTapPointToken(req.params.id, actor(req));
  res.json(new ApiResponse('Tap point token rotated — rewrite the physical tag.', data));
}

/** DELETE /api/attendance/tap-points/:id   (Admin) — 200 */
export async function deleteTapPoint(req, res) {
  await attendanceService.deleteTapPoint(req.params.id, actor(req));
  res.json(new ApiResponse('Tap point deleted.', null));
}
