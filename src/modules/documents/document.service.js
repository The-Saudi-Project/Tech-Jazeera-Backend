/**
 * Document service — upload, versioning, listing/search, file resolution,
 * and deletion (which also removes files from disk).
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import Document from './document.model.js';
import Employee from '../employees/employee.model.js';
import Client from '../clients/client.model.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

/** Documents expiring within this many days (or already expired) are "expiring". */
export const EXPIRY_WARNING_DAYS = 30;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Refuse to attach a document to an owner that doesn't exist. */
async function assertOwnerExists(ownerType, owner) {
  const Model = ownerType === 'Employee' ? Employee : Client;
  const exists = await Model.exists({ _id: owner });
  if (!exists) throw new ApiError(404, `${ownerType} not found.`);
}

/** Absolute path of a stored file. */
function diskPath(fileName) {
  return path.join(env.uploadDir, fileName);
}

/** Build one embedded version object from a Multer file. */
function versionFromFile(file, version, userId) {
  return {
    version,
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
}

/** Create a new document (version 1) from an uploaded file. */
export async function createDocument({ title, category, ownerType, owner, expiryDate, file }, actor) {
  if (!file) throw new ApiError(400, 'A file is required.');
  await assertOwnerExists(ownerType, owner);

  const document = await Document.create({
    title,
    category,
    ownerType,
    owner,
    expiryDate: expiryDate ?? null,
    versions: [versionFromFile(file, 1, actor.userId)],
  });

  await logAudit({
    user: actor.userId,
    action: 'document.create',
    targetType: 'Document',
    targetId: document._id,
    meta: { title, category, ownerType },
    ip: actor.ip,
  });
  return document.toObject();
}

/** Append a new version (the uploaded file) to an existing document. */
export async function addVersion(id, file, actor) {
  if (!file) throw new ApiError(400, 'A file is required.');
  const document = await Document.findById(id);
  if (!document) throw new ApiError(404, 'Document not found.');

  const nextVersion = document.versions[document.versions.length - 1].version + 1;
  document.versions.push(versionFromFile(file, nextVersion, actor.userId));
  await document.save();

  await logAudit({
    user: actor.userId,
    action: 'document.version',
    targetType: 'Document',
    targetId: document._id,
    meta: { title: document.title, version: nextVersion },
    ip: actor.ip,
  });
  return document.toObject();
}

/**
 * List/search documents. Filters: ownerType, owner, category, search (title),
 * expiring (within EXPIRY_WARNING_DAYS or past).
 */
export async function listDocuments({ page, limit, ownerType, owner, category, search, expiring }) {
  const conditions = [];
  if (ownerType) conditions.push({ ownerType });
  if (owner) conditions.push({ owner });
  if (category) conditions.push({ category });
  if (search) conditions.push({ title: { $regex: escapeRegex(search), $options: 'i' } });
  if (expiring === 'true') {
    const threshold = new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    conditions.push({ expiryDate: { $ne: null, $lte: threshold } });
  }
  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [items, total] = await Promise.all([
    Document.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'fullName employeeId companyName')
      .lean(),
    Document.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getDocument(id) {
  const document = await Document.findById(id)
    .populate('owner', 'fullName employeeId companyName')
    .populate('versions.uploadedBy', 'name')
    .lean();
  if (!document) throw new ApiError(404, 'Document not found.');
  return document;
}

/**
 * Resolve a physical file to stream. Defaults to the current version.
 * Returns { absolutePath, mimeType, originalName } or throws 404.
 */
export async function resolveFile(id, versionNumber) {
  const document = await Document.findById(id).lean();
  if (!document) throw new ApiError(404, 'Document not found.');

  const version = versionNumber
    ? document.versions.find((v) => v.version === versionNumber)
    : document.versions[document.versions.length - 1];
  if (!version) throw new ApiError(404, 'That version does not exist.');

  const absolutePath = diskPath(version.fileName);
  // Confirm the file is actually on disk before claiming success.
  try {
    await fs.access(absolutePath);
  } catch {
    throw new ApiError(410, 'The stored file is missing on the server.');
  }
  return { absolutePath, mimeType: version.mimeType, originalName: version.originalName };
}

/** Delete a document and remove ALL its version files from disk. */
export async function deleteDocument(id, actor) {
  const document = await Document.findById(id);
  if (!document) throw new ApiError(404, 'Document not found.');

  // Best-effort file cleanup — a missing file must not block the DB delete.
  await Promise.all(
    document.versions.map((v) => fs.unlink(diskPath(v.fileName)).catch(() => {}))
  );
  await document.deleteOne();

  await logAudit({
    user: actor.userId,
    action: 'document.delete',
    targetType: 'Document',
    targetId: document._id,
    meta: { title: document.title, versions: document.versions.length },
    ip: actor.ip,
  });
}
