/**
 * JobTitle controller — HTTP translation only. The write circle is dynamic
 * (Admin/Manager/any ApprovalRole member) — can't be a static
 * requireRoles(...) — so every write action checks it here itself.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import * as jobTitleService from './jobTitle.service.js';

const actor = (req) => ({ userId: req.user.id, role: req.user.role, ip: req.ip });

async function assertCanManage(req) {
  const allowed = await jobTitleService.canManageJobTitles(actor(req));
  if (!allowed) throw new ApiError(403, 'You do not have permission to manage job titles.');
}

export async function list(req, res) {
  const jobTitles = await jobTitleService.listJobTitles(req.query);
  res.json(new ApiResponse('Job titles.', jobTitles));
}

export async function create(req, res) {
  await assertCanManage(req);
  const jobTitle = await jobTitleService.createJobTitle(req.body, actor(req));
  res.status(201).json(new ApiResponse('Job title created.', jobTitle));
}

export async function update(req, res) {
  await assertCanManage(req);
  const jobTitle = await jobTitleService.updateJobTitle(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Job title updated.', jobTitle));
}

export async function remove(req, res) {
  await assertCanManage(req);
  await jobTitleService.deleteJobTitle(req.params.id, actor(req));
  res.json(new ApiResponse('Job title deleted.'));
}
