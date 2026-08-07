/**
 * NFC image handling: upload middleware for logos/photos, and a public route to
 * serve them. Images live under UPLOAD_DIR/nfc with random names and are served
 * publicly (they appear on public tap pages anyway); the random uuid names make
 * them non-enumerable.
 */
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

export const NFC_MEDIA_DIR = path.join(env.uploadDir, 'nfc');
fs.mkdirSync(NFC_MEDIA_DIR, { recursive: true });

const EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, NFC_MEDIA_DIR),
  // Random name + extension from the trusted MIME map (never the user's name).
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype] ?? ''}`),
});

function fileFilter(req, file, cb) {
  if (!EXT[file.mimetype]) return cb(new ApiError(400, 'Upload a PNG, JPG, or WEBP image.'));
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_BYTES } }).single('image');

/** Wrap multer so its errors become our standard ApiError. Field name: `image`. */
export function uploadNfcImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(400, 'Image is too large (maximum 2 MB).'));
      return next(new ApiError(400, `Upload error: ${err.message}`));
    }
    return next(err);
  });
}

/** Best-effort delete of a stored media file (on replace/remove). */
export function deleteNfcMedia(filename) {
  if (!filename) return;
  fs.unlink(path.join(NFC_MEDIA_DIR, path.basename(filename)), () => {});
}

/** GET /nfc-media/:filename — public, cached. Basename-guarded against traversal. */
export function serveNfcMedia(req, res) {
  const name = path.basename(req.params.filename);
  if (!/^[\w.-]+$/.test(name)) return res.status(404).end();
  return res.sendFile(
    path.join(NFC_MEDIA_DIR, name),
    {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        // These files are deliberately public — a person's photo is the tap
        // page's og:image, which other origins must be able to render.
        // helmet's app-wide default of `same-origin` would block that.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    (err) => {
      if (err && !res.headersSent) res.status(404).end();
    }
  );
}
