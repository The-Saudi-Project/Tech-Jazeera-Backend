/**
 * Employee controller — HTTP translation only. All inputs arrive already
 * validated/sanitized by the Zod middleware; all business rules live in the
 * service.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as employeeService from './employee.service.js';

/** Who performed the action, for the audit trail. */
const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/**
 * GET /api/employees?page&limit&search&status&alerts&sortBy&sortOrder
 * 200 → data: { items, total, page, pages }
 */
export async function list(req, res) {
  const data = await employeeService.listEmployees(req.query);
  res.json(new ApiResponse('Employees.', data));
}

/**
 * GET /api/employees/:id
 * 200 → data: employee · 400 bad id · 404 unknown
 */
export async function get(req, res) {
  const employee = await employeeService.getEmployee(req.params.id);
  res.json(new ApiResponse('Employee.', employee));
}

/**
 * POST /api/employees   (Admin, Manager, HR)
 * 201 → data: employee · 400 validation · 409 duplicate employeeId
 */
export async function create(req, res) {
  const employee = await employeeService.createEmployee(req.body, actor(req));
  res.status(201).json(new ApiResponse('Employee created.', employee));
}

/**
 * PATCH /api/employees/:id   (Admin, Manager, HR)
 * 200 → data: employee · 400 / 404 / 409 as above
 */
export async function update(req, res) {
  const employee = await employeeService.updateEmployee(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Employee updated.', employee));
}

/**
 * DELETE /api/employees/:id   (Admin, HR)
 * 200 → data: null · 404 unknown
 */
export async function remove(req, res) {
  await employeeService.deleteEmployee(req.params.id, actor(req));
  res.json(new ApiResponse('Employee deleted.'));
}

/**
 * POST /api/employees/:id/user   (Admin, HR)
 * Provisions a Worker login for this employee.
 * 201 → data: { user, tempPassword } — tempPassword is shown ONCE, hand it over
 * 400 no email on file · 404 unknown employee · 409 already has a login / email taken
 */
export async function createLogin(req, res) {
  const data = await employeeService.createEmployeeLogin(req.params.id, req.body, actor(req));
  res.status(201).json(new ApiResponse('Worker login created.', data));
}
