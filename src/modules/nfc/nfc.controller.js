/**
 * NFC admin controller — HTTP translation only. Two endpoints intentionally
 * break the JSON envelope: the QR image (PNG) and the CSV export (text/csv),
 * the documented binary-response exception.
 */
import QRCode from 'qrcode';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import * as nfcService from './nfc.service.js';
import * as analytics from './nfc.analytics.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

// Companies
export async function listCompanies(req, res) {
  res.json(new ApiResponse('NFC companies.', await nfcService.listCompanies(req.query)));
}
export async function getCompany(req, res) {
  res.json(new ApiResponse('NFC company.', await nfcService.getCompany(req.params.id)));
}
export async function createCompany(req, res) {
  res.status(201).json(new ApiResponse('Company created.', await nfcService.createCompany(req.body, actor(req))));
}
export async function updateCompany(req, res) {
  res.json(new ApiResponse('Company updated.', await nfcService.updateCompany(req.params.id, req.body, actor(req))));
}
export async function deleteCompany(req, res) {
  await nfcService.deleteCompany(req.params.id, actor(req));
  res.json(new ApiResponse('Company deleted.'));
}

// Employees
export async function createEmployee(req, res) {
  res.status(201).json(new ApiResponse('Person added.', await nfcService.createEmployee(req.body, actor(req))));
}
export async function updateEmployee(req, res) {
  res.json(new ApiResponse('Person updated.', await nfcService.updateEmployee(req.params.id, req.body, actor(req))));
}
export async function deleteEmployee(req, res) {
  await nfcService.deleteEmployee(req.params.id, actor(req));
  res.json(new ApiResponse('Person removed.'));
}

// Images (logo / photo). The image rides as multipart field `image`.
export async function uploadCompanyLogo(req, res) {
  if (!req.file) throw new ApiError(400, 'Choose an image to upload.');
  res.json(new ApiResponse('Logo updated.', await nfcService.setCompanyLogo(req.params.id, req.file.path, actor(req))));
}
export async function removeCompanyLogo(req, res) {
  res.json(new ApiResponse('Logo removed.', await nfcService.removeCompanyLogo(req.params.id, actor(req))));
}
export async function uploadEmployeePhoto(req, res) {
  if (!req.file) throw new ApiError(400, 'Choose an image to upload.');
  res.json(new ApiResponse('Photo updated.', await nfcService.setEmployeePhoto(req.params.id, req.file.path, actor(req))));
}
export async function removeEmployeePhoto(req, res) {
  res.json(new ApiResponse('Photo removed.', await nfcService.removeEmployeePhoto(req.params.id, actor(req))));
}

// Batches
export async function generateBatch(req, res) {
  res.status(201).json(new ApiResponse('Batch generated.', await nfcService.generateBatch(req.body, actor(req))));
}
export async function listBatches(req, res) {
  res.json(new ApiResponse('Batches.', await nfcService.listBatches()));
}

/** GET /api/nfc/batches/:id/cards.csv — writing all a batch's chips in one go. */
export async function batchCsv(req, res) {
  const { batch, cards } = await nfcService.getBatchCards(req.params.id);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Token', 'URL', 'Chip UID', 'Status', 'Assigned to'];
  const rows = cards.map((c) => [c.token, c.url, c.chipUid ?? '', c.status, c.employee?.name ?? ''].map(esc).join(','));
  const csv = [header.map(esc).join(','), ...rows].join('\r\n');
  const name = `nfc_batch_${(batch.label || batch._id).toString().replace(/[^\w-]/g, '_')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(csv);
}

// Cards
export async function listCards(req, res) {
  res.json(new ApiResponse('Cards.', await nfcService.listCards(req.query)));
}
export async function getCard(req, res) {
  res.json(new ApiResponse('Card.', await nfcService.getCard(req.params.id)));
}
export async function updateCard(req, res) {
  res.json(new ApiResponse('Card updated.', await nfcService.updateCard(req.params.id, req.body, actor(req))));
}
export async function deleteCard(req, res) {
  await nfcService.deleteCard(req.params.id, actor(req));
  res.json(new ApiResponse('Card deleted.'));
}
export async function assignCard(req, res) {
  res.json(new ApiResponse('Card assigned.', await nfcService.assignCard(req.params.id, req.body, actor(req))));
}
export async function assignCardToCompany(req, res) {
  res.json(new ApiResponse('Card assigned to company inventory.', await nfcService.assignCardToCompany(req.params.id, req.body, actor(req))));
}
export async function unassignCard(req, res) {
  res.json(new ApiResponse('Card unassigned.', await nfcService.unassignCard(req.params.id, actor(req))));
}
export async function markLost(req, res) {
  res.json(new ApiResponse('Card marked lost.', await nfcService.markLost(req.params.id, actor(req))));
}
export async function markReturned(req, res) {
  res.json(new ApiResponse('Card returned to inventory.', await nfcService.markReturned(req.params.id, actor(req))));
}
export async function disableCard(req, res) {
  res.json(new ApiResponse('Card disabled.', await nfcService.disableCard(req.params.id, actor(req))));
}
export async function rotateToken(req, res) {
  res.json(new ApiResponse('Token rotated. The old URL no longer works.', await nfcService.rotateToken(req.params.id, actor(req))));
}

// Analytics
export async function overviewAnalytics(req, res) {
  res.json(new ApiResponse('NFC analytics.', await analytics.getOverviewAnalytics(req.query)));
}
export async function cardAnalytics(req, res) {
  const data = await analytics.getCardAnalytics(req.params.id, req.query);
  if (!data) throw new ApiError(404, 'Card not found.');
  res.json(new ApiResponse('Card analytics.', data));
}
export async function companyAnalytics(req, res) {
  const data = await analytics.getCompanyAnalytics(req.params.id, req.query);
  if (!data) throw new ApiError(404, 'Company not found.');
  res.json(new ApiResponse('Company analytics.', data));
}

/** GET /api/nfc/cards/:id/qr.png — QR of the card's public URL. */
export async function cardQr(req, res) {
  const card = await nfcService.getCard(req.params.id);
  const png = await QRCode.toBuffer(card.url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="nfc_${card.token}.png"`);
  res.send(png);
}
