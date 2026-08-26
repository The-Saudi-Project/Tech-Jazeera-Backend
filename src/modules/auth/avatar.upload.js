/**
 * Profile-picture upload — any logged-in user, any role. Deliberately NOT the
 * documents pipeline (middleware/upload.js): a profile photo isn't a
 * passport or a contract, so it doesn't need the authenticated/signed-URL
 * treatment — it's stored as a plain public Cloudinary image and rendered
 * directly, same as the NFC logo/photo pattern (see nfc.upload.js).
 */
import multer from 'multer';
import { cloudinary, CloudinaryStorage } from '../../config/cloudinary.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — a face crop, not a document

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'user-avatars',
    allowed_formats: ALLOWED_FORMATS,
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }],
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new ApiError(400, 'Upload a PNG, JPG, or WEBP image.'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_BYTES } }).single('avatar');

/** Wrap multer so its errors become our standard ApiError. Field name: `avatar`. */
export function uploadAvatarImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(400, 'Image is too large (maximum 2 MB).'));
      return next(new ApiError(400, `Upload error: ${err.message}`));
    }
    return next(err);
  });
}

/** Best-effort delete of a stored avatar (on replace/remove) — never blocks the request on failure. */
export async function deleteAvatarMedia(url) {
  if (!url) return;
  try {
    const parts = url.split('/');
    const folderAndFile = parts.slice(-2).join('/'); // "user-avatars/xyz.jpg"
    const publicId = folderAndFile.split('.')[0]; // "user-avatars/xyz"
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error(`[auth] Failed to delete avatar from Cloudinary: ${url} — ${err.message}`);
  }
}
