/**
 * NFC image handling: upload middleware for logos/photos.
 * Migrated to Cloudinary for persistent storage on Render.
 */
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { cloudinary, CloudinaryStorage } from '../../config/cloudinary.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

export const NFC_MEDIA_DIR = path.join(env.uploadDir, 'nfc');
fs.mkdirSync(NFC_MEDIA_DIR, { recursive: true });

const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nfc-media',
    allowed_formats: ['jpg', 'png', 'webp'],
  },
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
export async function deleteNfcMedia(filename) {
  if (!filename) return;
  
  if (filename.includes('res.cloudinary.com')) {
    try {
      // Extract public_id from URL: .../upload/v1234/nfc-media/xyz.jpg -> nfc-media/xyz
      const urlParts = filename.split('/');
      const folderAndFile = urlParts.slice(-2).join('/');
      const publicId = folderAndFile.split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error(`Failed to delete image from Cloudinary: ${filename}`, err);
    }
  } else {
    // Fallback for old local files (if any remain)
    fs.unlink(path.join(NFC_MEDIA_DIR, path.basename(filename)), () => {});
  }
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
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    (err) => {
      if (err && !res.headersSent) res.status(404).end();
    }
  );
}
