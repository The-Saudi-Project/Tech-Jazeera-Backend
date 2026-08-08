/**
 * File-upload middleware (Multer).
 * Migrated to Cloudinary for persistent storage on Render.
 */
import multer from 'multer';
import { cloudinary, CloudinaryStorage } from '../config/cloudinary.js';
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

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'crm-documents',
    resource_type: 'auto', // Important: allows non-image files like PDF, DOCX
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
