import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import ImportJob from './importJob.model.js';
import Product from '../products/product.model.js';
import Category from '../categories/category.model.js';
import {
  CANONICAL_COLUMNS,
  REQUIRED_COLUMNS,
  validateHeaders,
  validateRow,
  sanitizeForCsv,
} from './import.validator.js';
import { generateUniqueSlug } from '../../utils/slugify.js';

const MAX_ROWS = 5000;

class ImportService {
  /**
   * Helper to parse spreadsheet buffer into headers and row objects
   * @param {Buffer} buffer
   * @returns {{ headers: string[], rows: object[] }}
   */
  parseSpreadsheet(buffer) {
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (err) {
      const error = new Error('Failed to parse spreadsheet file. Please ensure it is a valid CSV or XLSX file.');
      error.statusCode = 400;
      error.code = 'INVALID_IMPORT_FILE';
      throw error;
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      const error = new Error('Spreadsheet contains no sheets.');
      error.statusCode = 400;
      error.code = 'EMPTY_IMPORT_FILE';
      throw error;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawMatrix || rawMatrix.length === 0) {
      const error = new Error('Spreadsheet is empty.');
      error.statusCode = 400;
      error.code = 'EMPTY_IMPORT_FILE';
      throw error;
    }

    const rawHeaders = rawMatrix[0].map((h) => String(h).trim()).filter(Boolean);
    if (rawHeaders.length === 0) {
      const error = new Error('Spreadsheet header row is missing or empty.');
      error.statusCode = 400;
      error.code = 'INVALID_IMPORT_HEADERS';
      throw error;
    }

    const { isValid, missing, normalizedMap } = validateHeaders(rawHeaders);
    if (!isValid) {
      const error = new Error(`Missing required columns: ${missing.join(', ')}`);
      error.statusCode = 400;
      error.code = 'INVALID_IMPORT_HEADERS';
      error.details = missing.map((m) => `Missing required column: ${m}`);
      throw error;
    }

    const dataRows = [];
    for (let r = 1; r < rawMatrix.length; r++) {
      const rowArr = rawMatrix[r];
      // Skip completely empty rows
      if (!rowArr || rowArr.every((cell) => cell === '' || cell === null || cell === undefined)) {
        continue;
      }

      const rowObj = {};
      rawHeaders.forEach((rawHeader, idx) => {
        const canonical = normalizedMap[rawHeader] || rawHeader;
        rowObj[canonical] = rowArr[idx] !== undefined ? rowArr[idx] : '';
      });

      dataRows.push({
        rawIndex: r + 1, // 1-based spreadsheet row index
        data: rowObj,
      });
    }

    return {
      headers: rawHeaders,
      rows: dataRows,
    };
  }

  /**
   * Helper to build in-memory category lookup map from MongoDB
   * Supports matching by ObjectId, Slug, Name, or "Parent > Child > Grandchild" path
   * @returns {Promise<Map<string, object>>}
   */
  async buildCategoryLookup() {
    const categories = await Category.find({ isActive: true }).lean();
    const map = new Map();

    categories.forEach((cat) => {
      // 1. By ID string
      map.set(cat._id.toString(), cat);

      // 2. By slug
      map.set(cat.slug.toLowerCase(), cat);

      // 3. By direct name
      map.set(cat.name.toLowerCase(), cat);

      // 4. By full hierarchy path e.g. "Men > Clothing > Shirts"
      if (cat.ancestors && cat.ancestors.length > 0) {
        const fullPath = [...cat.ancestors.map((a) => a.name), cat.name].join(' > ').toLowerCase();
        map.set(fullPath, cat);

        const slashPath = [...cat.ancestors.map((a) => a.name), cat.name].join(' / ').toLowerCase();
        map.set(slashPath, cat);
      }
    });

    return map;
  }

  /**
   * Stage 1: Parse, validate, and preview spreadsheet without creating products
   * @param {string} userId
   * @param {Buffer} fileBuffer
   * @param {string} fileName
   * @returns {Promise<object>}
   */
  async previewImport(userId, fileBuffer, fileName) {
    const isXlsx = fileName.toLowerCase().endsWith('.xlsx');
    const fileType = isXlsx ? 'XLSX' : 'CSV';

    const { rows } = this.parseSpreadsheet(fileBuffer);

    if (rows.length === 0) {
      const error = new Error('Spreadsheet contains no data rows to import.');
      error.statusCode = 400;
      error.code = 'NO_DATA_ROWS';
      throw error;
    }

    if (rows.length > MAX_ROWS) {
      const error = new Error(`Import exceeds maximum allowed limit of ${MAX_ROWS} rows (found ${rows.length} rows).`);
      error.statusCode = 400;
      error.code = 'IMPORT_ROW_LIMIT_EXCEEDED';
      throw error;
    }

    const categoryLookup = await this.buildCategoryLookup();

    const allErrors = [];
    const fileSkus = new Set();
    const duplicateSkusInFile = new Set();
    const validRowsBySku = new Map();

    // 1. First pass: Row validation & in-file duplicate SKU detection
    const parsedRows = [];
    rows.forEach(({ rawIndex, data }) => {
      const validation = validateRow(data, rawIndex);

      if (!validation.isValid) {
        allErrors.push(...validation.errors);
      } else {
        const sku = validation.sanitized.variant.sku;
        if (fileSkus.has(sku)) {
          duplicateSkusInFile.add(sku);
          allErrors.push({
            row: rawIndex,
            productName: validation.sanitized.name,
            sku,
            code: 'DUPLICATE_FILE_SKU',
            message: `Duplicate SKU '${sku}' found multiple times inside the uploaded spreadsheet`,
          });
        } else {
          fileSkus.add(sku);
        }

        parsedRows.push(validation.sanitized);
      }
    });

    // 2. Second pass: Batch check existing SKUs against MongoDB
    const skusToCheck = Array.from(fileSkus);
    const existingSkuProducts = await Product.find({ 'variants.sku': { $in: skusToCheck } })
      .select('variants.sku')
      .lean();

    const existingSkusInDb = new Set();
    existingSkuProducts.forEach((p) => {
      p.variants?.forEach((v) => {
        if (fileSkus.has(v.sku)) {
          existingSkusInDb.add(v.sku);
        }
      });
    });

    // 3. Third pass: Category resolution & Database SKU conflict check
    const productGroups = new Map();

    parsedRows.forEach((row) => {
      const sku = row.variant.sku;
      let hasError = false;

      if (duplicateSkusInFile.has(sku)) {
        hasError = true;
      }

      if (existingSkusInDb.has(sku)) {
        allErrors.push({
          row: row.row,
          productName: row.name,
          sku,
          code: 'SKU_ALREADY_EXISTS',
          message: `SKU '${sku}' already exists in database`,
        });
        hasError = true;
      }

      // Category Resolution
      const categoryRaw = row.categoryStr.toLowerCase();
      const categoryDoc = categoryLookup.get(categoryRaw);
      if (!categoryDoc) {
        allErrors.push({
          row: row.row,
          productName: row.name,
          sku,
          code: 'CATEGORY_NOT_FOUND',
          message: `Category '${row.categoryStr}' could not be resolved against existing active categories`,
        });
        hasError = true;
      }

      if (!hasError && categoryDoc) {
        // Group by product identity: name + brand + categoryId + gender
        const groupKey = `${row.name.toLowerCase()}::${row.brand.toLowerCase()}::${categoryDoc._id}::${row.gender}`;

        if (!productGroups.has(groupKey)) {
          productGroups.set(groupKey, {
            name: row.name,
            brand: row.brand,
            category: categoryDoc._id,
            categoryName: categoryDoc.name,
            gender: row.gender,
            shortDescription: row.shortDescription,
            description: row.description,
            tags: row.tags,
            variants: [],
          });
        }

        productGroups.get(groupKey).variants.push(row.variant);
      }
    });

    const validProducts = Array.from(productGroups.values());
    const validRowCount = validProducts.reduce((acc, p) => acc + p.variants.length, 0);
    const invalidRowCount = rows.length - validRowCount;

    // Create ImportJob record in status PREVIEWED
    const importJob = new ImportJob({
      userId,
      fileName,
      fileType,
      totalRows: rows.length,
      validRows: validRowCount,
      invalidRows: invalidRowCount,
      status: 'PREVIEWED',
      errors: allErrors,
      previewData: {
        products: validProducts,
      },
    });

    await importJob.save();

    return {
      importId: importJob._id.toString(),
      fileName,
      fileType,
      totalRows: rows.length,
      validRows: validRowCount,
      invalidRows: invalidRowCount,
      productsCount: validProducts.length,
      variantsCount: validRowCount,
      errors: allErrors,
      sampleProducts: validProducts.slice(0, 5),
    };
  }

  /**
   * Stage 2: Execute confirmed import and create DRAFT products
   * @param {string} userId
   * @param {string} importId
   * @returns {Promise<object>}
   */
  async executeImport(userId, importId) {
    if (!mongoose.Types.ObjectId.isValid(importId)) {
      const error = new Error('Invalid import ID');
      error.statusCode = 400;
      error.code = 'INVALID_IMPORT_ID';
      throw error;
    }

    const job = await ImportJob.findById(importId);
    if (!job) {
      const error = new Error('Import job not found');
      error.statusCode = 404;
      error.code = 'IMPORT_NOT_FOUND';
      throw error;
    }

    if (job.status !== 'PREVIEWED') {
      const error = new Error(`Import job has already been processed with status '${job.status}'`);
      error.statusCode = 400;
      error.code = 'IMPORT_ALREADY_EXECUTED';
      throw error;
    }

    const productsToCreate = job.previewData?.products || [];
    if (productsToCreate.length === 0) {
      job.status = 'FAILED';
      job.completedAt = new Date();
      await job.save();

      return {
        importId: job._id.toString(),
        status: 'FAILED',
        productsCreated: 0,
        variantsCreated: 0,
        message: 'No valid products to create in this import',
      };
    }

    job.status = 'PROCESSING';
    await job.save();

    let createdProductsCount = 0;
    let createdVariantsCount = 0;

    for (const pData of productsToCreate) {
      try {
        const categoryDoc = await Category.findById(pData.category);
        const categoryTree = categoryDoc
          ? [...(categoryDoc.ancestors || []).map((a) => a._id), categoryDoc._id]
          : [pData.category];

        const slug = await generateUniqueSlug(Product, pData.name);

        const product = new Product({
          name: pData.name,
          slug,
          brand: pData.brand,
          category: pData.category,
          categoryTree,
          gender: pData.gender,
          shortDescription: pData.shortDescription || '',
          description: pData.description,
          tags: pData.tags || [],
          status: 'DRAFT', // Strictly DRAFT status for all imported products
          images: [], // Images managed via Cloudinary Media Manager post-import
          variants: pData.variants,
        });

        await product.save();
        createdProductsCount++;
        createdVariantsCount += pData.variants.length;
      } catch (err) {
        console.error('[IMPORT SAVE ERROR]', err.message, err);
        job.errors.push({
          row: 0,
          productName: pData.name,
          sku: 'BATCH_SAVE_ERROR',
          code: 'PRODUCT_SAVE_FAILED',
          message: err.message,
        });
      }
    }

    const finalStatus =
      createdProductsCount === productsToCreate.length && job.invalidRows === 0
        ? 'COMPLETED'
        : createdProductsCount > 0
        ? 'PARTIAL'
        : 'FAILED';

    job.status = finalStatus;
    job.productsCreated = createdProductsCount;
    job.variantsCreated = createdVariantsCount;
    job.completedAt = new Date();
    await job.save();

    return {
      importId: job._id.toString(),
      status: finalStatus,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      productsCreated: createdProductsCount,
      variantsCreated: createdVariantsCount,
      errorsCount: job.errors.length,
      message: `Bulk import ${finalStatus.toLowerCase()}: Created ${createdProductsCount} draft products with ${createdVariantsCount} variants.`,
    };
  }

  /**
   * List paginated past import jobs
   */
  async getImportJobs(page = 1, limit = 20) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [jobs, total] = await Promise.all([
      ImportJob.find()
        .select('fileName fileType totalRows validRows invalidRows productsCreated variantsCreated status createdAt completedAt')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ImportJob.countDocuments(),
    ]);

    return {
      jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Get single import job by ID with errors
   */
  async getImportJobById(id) {
    const job = await ImportJob.findById(id).populate('userId', 'name email').lean();
    if (!job) {
      const error = new Error('Import job not found');
      error.statusCode = 404;
      error.code = 'IMPORT_NOT_FOUND';
      throw error;
    }
    return job;
  }

  /**
   * Generate downloadable error CSV text for an import job
   * @param {string} id
   * @returns {Promise<string>}
   */
  async generateErrorCsv(id) {
    const job = await this.getImportJobById(id);
    const headers = ['Row', 'Product Name', 'SKU', 'Error Code', 'Error Message'];
    const lines = [headers.join(',')];

    (job.errors || []).forEach((err) => {
      const row = [
        sanitizeForCsv(err.row),
        `"${sanitizeForCsv(err.productName).replace(/"/g, '""')}"`,
        `"${sanitizeForCsv(err.sku).replace(/"/g, '""')}"`,
        `"${sanitizeForCsv(err.code).replace(/"/g, '""')}"`,
        `"${sanitizeForCsv(err.message).replace(/"/g, '""')}"`,
      ];
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }

  /**
   * Generate downloadable template in CSV or XLSX format
   * @param {'csv' | 'xlsx'} format
   * @returns {{ data: string | Buffer, contentType: string, filename: string }}
   */
  generateTemplate(format = 'csv') {
    const exampleRows = [
      {
        'Product Name': 'Egyptian Cotton Dress Shirt',
        Brand: 'LuxeCart Tailoring',
        Category: 'Men > Shirts',
        Gender: 'MEN',
        'Short Description': '200s 2-ply Egyptian cotton shirt.',
        Description: 'Single-needle tailoring with mother-of-pearl buttons and spread collar.',
        Tags: 'formal, luxury, cotton, classic',
        SKU: 'LUX-SH-WHT-38',
        Barcode: '8901234567890',
        'Color Name': 'Crisp White',
        'Color Hex': '#FFFFFF',
        Size: '38',
        Price: 5999,
        MRP: 9999,
        Stock: 25,
        'Low Stock Threshold': 5,
      },
      {
        'Product Name': 'Egyptian Cotton Dress Shirt',
        Brand: 'LuxeCart Tailoring',
        Category: 'Men > Shirts',
        Gender: 'MEN',
        'Short Description': '200s 2-ply Egyptian cotton shirt.',
        Description: 'Single-needle tailoring with mother-of-pearl buttons and spread collar.',
        Tags: 'formal, luxury, cotton, classic',
        SKU: 'LUX-SH-WHT-40',
        Barcode: '8901234567891',
        'Color Name': 'Crisp White',
        'Color Hex': '#FFFFFF',
        Size: '40',
        Price: 5999,
        MRP: 9999,
        Stock: 20,
        'Low Stock Threshold': 5,
      },
    ];

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exampleRows, { header: CANONICAL_COLUMNS });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return {
        data: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'luxecart_product_import_template.xlsx',
      };
    }

    // CSV format
    const worksheet = XLSX.utils.json_to_sheet(exampleRows, { header: CANONICAL_COLUMNS });
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    return {
      data: csvContent,
      contentType: 'text/csv',
      filename: 'luxecart_product_import_template.csv',
    };
  }
}

export default new ImportService();
