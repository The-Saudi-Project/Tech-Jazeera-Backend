/**
 * Staff-user controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as userService from './user.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/**
 * GET /api/users?role=Coordinator   (Admin, Manager)
 * 200 → data: User[] (never Worker accounts — see employees for those)
 */
export async function list(req, res) {
  const users = await userService.listStaffUsers(req.query);
  res.json(new ApiResponse('Staff users.', users));
}

/**
 * POST /api/users   (Admin)
 * 201 → data: { user, tempPassword } — tempPassword is shown ONCE, hand it over
 * 400 invalid manager · 409 email taken
 */
export async function create(req, res) {
  const data = await userService.createStaffUser(req.body, actor(req));
  res.status(201).json(new ApiResponse('Staff login created.', data));
}

/**
 * PATCH /api/users/:id   (Admin)
 * 200 → data: user · 400 self-deactivate / invalid manager · 404 unknown
 */
export async function update(req, res) {
  const user = await userService.updateStaffUser(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('User updated.', user));
}

/**
 * POST /api/users/:id/reset-password   (Admin)
 * 200 → data: { tempPassword } — shown ONCE, hand it over · 404 unknown
 */
export async function resetPassword(req, res) {
  const data = await userService.resetStaffPassword(req.params.id, actor(req));
  res.json(new ApiResponse('Password reset.', data));
}
