/**
 * RamadanPeriod controller — HTTP translation only, mirrors holiday.controller.js.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as ramadanPeriodService from './ramadanPeriod.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

export async function list(req, res) {
  const periods = await ramadanPeriodService.listRamadanPeriods(req.query);
  res.json(new ApiResponse('Ramadan periods.', periods));
}

export async function create(req, res) {
  const period = await ramadanPeriodService.createRamadanPeriod(req.body, actor(req));
  res.status(201).json(new ApiResponse('Ramadan period added.', period));
}

export async function update(req, res) {
  const period = await ramadanPeriodService.updateRamadanPeriod(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Ramadan period updated.', period));
}

export async function remove(req, res) {
  await ramadanPeriodService.deleteRamadanPeriod(req.params.id, actor(req));
  res.json(new ApiResponse('Ramadan period removed.'));
}
