/**
 * Document controller — HTTP translation.
 *
 * The file-streaming endpoint intentionally returns raw bytes (not the JSON
 * envelope). Uploads validate the multipart body AFTER Multer has written the
 * file, so validation/creation errors would orphan that file — the router
 * mounts a cleanup error handler (see document.routes.js) that unlinks
 * `req.file` on any failure.
 */
import fs from 'node:fs';
import ApiResponse from '../../utils/ApiResponse.js';
import * as documentService from './document.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** POST /api/documents (multipart: file + fields) — 201 → data: document */
export async function create(req, res) {
  const document = await documentService.createDocument({ ...req.body, file: req.file }, actor(req));
  res.status(201).json(new ApiResponse('Document uploaded.', document));
}

/** POST /api/documents/:id/versions (multipart: file) — 200 → data: document */
export async function addVersion(req, res) {
  const document = await documentService.addVersion(req.params.id, req.file, actor(req));
  res.json(new ApiResponse('New version uploaded.', document));
}

/** GET /api/documents — 200 → data: { items, total, page, pages } */
export async function list(req, res) {
  const data = await documentService.listDocuments(req.query);
  res.json(new ApiResponse('Documents.', data));
}

/** GET /api/documents/:id — 200 → data: document (with versions) */
export async function get(req, res) {
  const document = await documentService.getDocument(req.params.id);
  res.json(new ApiResponse('Document.', document));
}

/**
 * GET /api/documents/:id/file?version=N — streams the file bytes with the
 * correct Content-Type. The client decides inline preview vs download; the
 * originalName travels in Content-Disposition for downloads.
 */
export async function file(req, res) {
  const { absolutePath, mimeType, originalName } = await documentService.resolveFile(
    req.params.id,
    req.query.version
  );
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
  fs.createReadStream(absolutePath).pipe(res);
}

/** DELETE /api/documents/:id — 200 → data: null (file(s) removed from disk) */
export async function remove(req, res) {
  await documentService.deleteDocument(req.params.id, actor(req));
  res.json(new ApiResponse('Document deleted.'));
}
