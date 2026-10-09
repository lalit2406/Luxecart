import multer from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are allowed.`);
    error.statusCode = 400;
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 30,
  },
  fileFilter,
});

/**
 * Express middleware wrapper to handle multer errors gracefully
 */
export const handleMediaUpload = (fieldName = 'images', maxCount = 30) => {
  const multerMiddleware = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds maximum allowed limit of 5 MB per image',
            error: { code: 'FILE_TOO_LARGE' },
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Too many files uploaded. Maximum is ${maxCount} images per request`,
            error: { code: 'TOO_MANY_FILES' },
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          error: { code: err.code },
        });
      } else if (err) {
        return res.status(err.statusCode || 400).json({
          success: false,
          message: err.message,
          error: { code: err.code || 'UPLOAD_ERROR' },
        });
      }
      next();
    });
  };
};
