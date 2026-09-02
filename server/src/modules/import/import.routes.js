import { Router } from 'express';
import multer from 'multer';
import {
  previewImport,
  executeImport,
  getImportJobs,
  getImportJobById,
  downloadErrorCsv,
  downloadTemplate,
} from './import.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Multer config for CSV / XLSX files (Max 10MB)
const spreadsheetStorage = multer.memoryStorage();
const spreadsheetFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  const isValidExt = name.endsWith('.csv') || name.endsWith('.xlsx');
  if (isValidExt) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only .csv and .xlsx spreadsheet files are allowed.');
    error.statusCode = 400;
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const uploadSpreadsheet = multer({
  storage: spreadsheetStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: spreadsheetFilter,
});

// All bulk import routes require authenticated ADMIN
router.use(authenticate, requireRole('ADMIN'));

router.get('/template', downloadTemplate);
router.post('/preview', uploadSpreadsheet.single('file'), previewImport);
router.post('/execute', executeImport);
router.get('/', getImportJobs);
router.get('/:id', getImportJobById);
router.get('/:id/errors', downloadErrorCsv);

export default router;
