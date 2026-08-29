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
 * PATCH /api/users/:id   (Admin)
 * 200 → data: user · 400 self-deactivate · 404 unknown
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

/**
 * DELETE /api/users/:id   (Admin)
 * 200 → permanently removed · 400 self-delete / would orphan records · 404 unknown
 */
export async function remove(req, res) {
  await userService.deleteStaffUser(req.params.id, actor(req));
  res.json(new ApiResponse('User deleted.'));
}
