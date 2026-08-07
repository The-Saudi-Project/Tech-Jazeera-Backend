/**
 * File-upload middleware (Multer).
 *
 * Security posture:
 *  - TYPE: only an allowlist of MIME types is accepted; anything else is
 *    rejected before touching disk. We never trust the client's extension.
 *  - NAME: the stored filename is a random UUID + a safe extension derived
 *    from the (allowlisted) MIME type — so a malicious original name like
 *    `../../etc/passwd` or `x.php` can never influence the path or extension
 *    on disk. The original name is preserved only as metadata in the DB.
 *  - SIZE: capped, enforced by Multer, translated to a friendly 400.
 *
 * MulterError (size/field problems) is translated into our ApiError here so
 * the centralized error handler and the client see the standard envelope.
 */
import multer from 'multer';
import crypto from 'node:crypto';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/** MIME type → canonical extension. This map IS the allowlist. */
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    // Random name + extension derived from the trusted MIME map, NOT from the
    // user-supplied original name.
    cb(null, `${crypto.randomUUID()}${ALLOWED_TYPES[file.mimetype] ?? ''}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES[file.mimetype]) {
    return cb(new ApiError(400, 'Unsupported file type. Allowed: PDF, JPG, PNG, WEBP, Word, Excel.'));
  }
  cb(null, true);
}

const multerUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES } }).single('file');

/**
 * Wrap Multer so its own errors become ApiError. Field name must be `file`.
 */
export function uploadSingle(req, res, next) {
  multerUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'File is too large (maximum 10 MB).'));
      }
      return next(new ApiError(400, `Upload error: ${err.message}`));
    }
    return next(err); // ApiError from fileFilter, or anything unexpected
  });
}
