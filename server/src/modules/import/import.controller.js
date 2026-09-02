import importService from './import.service.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Admin: Upload spreadsheet file and get preflight preview
 */
export const previewImport = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('No spreadsheet file uploaded. Please provide a CSV or XLSX file.');
      error.statusCode = 400;
      error.code = 'NO_FILE_UPLOADED';
      throw error;
    }

    const result = await importService.previewImport(
      req.user.id,
      req.file.buffer,
      req.file.originalname
    );

    return sendSuccess(res, 200, 'Import preview generated successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Execute confirmed import
 */
export const executeImport = async (req, res, next) => {
  try {
    const { importId } = req.body;
    if (!importId) {
      const error = new Error('importId is required to execute import');
      error.statusCode = 400;
      error.code = 'MISSING_IMPORT_ID';
      throw error;
    }

    const result = await importService.executeImport(req.user.id, importId);
    return sendSuccess(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get paginated list of past import jobs
 */
export const getImportJobs = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await importService.getImportJobs(page, limit);
    return sendSuccess(res, 200, 'Import jobs fetched successfully', result.jobs, {
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get single import job details and errors
 */
export const getImportJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await importService.getImportJobById(id);
    return sendSuccess(res, 200, 'Import job fetched successfully', { job });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Download error report as CSV
 */
export const downloadErrorCsv = async (req, res, next) => {
  try {
    const { id } = req.params;
    const csvContent = await importService.generateErrorCsv(id);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import_errors_${id}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Download sample import template (CSV or XLSX)
 */
export const downloadTemplate = async (req, res, next) => {
  try {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const { data, contentType, filename } = importService.generateTemplate(format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(data);
  } catch (error) {
    next(error);
  }
};
