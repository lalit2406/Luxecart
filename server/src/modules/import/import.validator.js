const SKU_REGEX = /^[A-Z0-9_-]{3,30}$/;
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const ALLOWED_GENDERS = ['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS', 'KIDS'];

export const REQUIRED_COLUMNS = ['Product Name', 'Brand', 'Category', 'SKU', 'Price'];

export const CANONICAL_COLUMNS = [
  'Product Name',
  'Brand',
  'Category',
  'Gender',
  'Short Description',
  'Description',
  'Tags',
  'SKU',
  'Barcode',
  'Color Name',
  'Color Hex',
  'Size',
  'Price',
  'MRP',
  'Stock',
  'Low Stock Threshold',
];

/**
 * Maps arbitrary header variations to canonical column names
 * @param {string} rawHeader
 * @returns {string}
 */
export const normalizeHeaderName = (rawHeader) => {
  if (!rawHeader || typeof rawHeader !== 'string') return '';
  const clean = rawHeader.trim().toLowerCase().replace(/[\s_-]+/g, '');

  const map = {
    productname: 'Product Name',
    name: 'Product Name',
    title: 'Product Name',
    product: 'Product Name',
    brand: 'Brand',
    category: 'Category',
    categorypath: 'Category',
    gender: 'Gender',
    department: 'Gender',
    shortdescription: 'Short Description',
    summary: 'Short Description',
    description: 'Description',
    details: 'Description',
    tags: 'Tags',
    sku: 'SKU',
    barcode: 'Barcode',
    upc: 'Barcode',
    colorname: 'Color Name',
    color: 'Color Name',
    colorhex: 'Color Hex',
    hex: 'Color Hex',
    size: 'Size',
    price: 'Price',
    sellingprice: 'Price',
    mrp: 'MRP',
    originalprice: 'MRP',
    stock: 'Stock',
    quantity: 'Stock',
    inventory: 'Stock',
    lowstockthreshold: 'Low Stock Threshold',
    threshold: 'Low Stock Threshold',
  };

  return map[clean] || rawHeader.trim();
};

/**
 * Validate that all required columns are present in spreadsheet headers
 * @param {string[]} headers
 * @returns {{ isValid: boolean, missing: string[], normalizedMap: Record<string, string> }}
 */
export const validateHeaders = (headers = []) => {
  const normalizedMap = {};
  const presentCanonical = new Set();

  headers.forEach((h) => {
    const canonical = normalizeHeaderName(h);
    if (canonical) {
      normalizedMap[h] = canonical;
      presentCanonical.add(canonical);
    }
  });

  const missing = REQUIRED_COLUMNS.filter((col) => !presentCanonical.has(col));

  return {
    isValid: missing.length === 0,
    missing,
    normalizedMap,
  };
};

/**
 * Validate a single parsed row
 * @param {object} row
 * @param {number} rowIndex (1-indexed based on spreadsheet row number)
 * @returns {{ isValid: boolean, errors: Array<{ row: number, productName: string, sku: string, code: string, message: string }>, sanitized: object }}
 */
export const validateRow = (row, rowIndex) => {
  const errors = [];
  const name = String(row['Product Name'] || '').trim();
  const brand = String(row['Brand'] || '').trim();
  const categoryStr = String(row['Category'] || '').trim();
  const genderRaw = String(row['Gender'] || 'UNISEX').trim().toUpperCase();
  const gender = ALLOWED_GENDERS.includes(genderRaw) ? genderRaw : 'UNISEX';

  const shortDesc = String(row['Short Description'] || '').trim();
  const desc = String(row['Description'] || shortDesc || `${name} by ${brand}`).trim();
  const rawTags = String(row['Tags'] || '');
  const tags = rawTags
    ? rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const rawSku = String(row['SKU'] || '').trim();
  const sku = rawSku.toUpperCase();
  const barcode = row['Barcode'] !== undefined && row['Barcode'] !== null && row['Barcode'] !== '' ? String(row['Barcode']).trim() : null;

  const colorName = String(row['Color Name'] || 'Default').trim();
  let colorHex = String(row['Color Hex'] || '#000000').trim();
  if (colorHex && !colorHex.startsWith('#')) {
    colorHex = `#${colorHex}`;
  }

  const size = String(row['Size'] || 'Free Size').trim();

  const numPrice = Number(row['Price']);
  const numMrp = row['MRP'] !== undefined && row['MRP'] !== null && row['MRP'] !== '' ? Number(row['MRP']) : numPrice;
  const numStock = row['Stock'] !== undefined && row['Stock'] !== null && row['Stock'] !== '' ? Number(row['Stock']) : 0;
  const numLowStock =
    row['Low Stock Threshold'] !== undefined && row['Low Stock Threshold'] !== null && row['Low Stock Threshold'] !== ''
      ? Number(row['Low Stock Threshold'])
      : 5;

  // 1. Product Name Validation
  if (!name || name.length < 2) {
    errors.push({
      row: rowIndex,
      productName: name || 'Unknown',
      sku: sku || 'N/A',
      code: 'INVALID_PRODUCT_NAME',
      message: 'Product name must be at least 2 characters long',
    });
  } else if (name.length > 150) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_PRODUCT_NAME',
      message: 'Product name cannot exceed 150 characters',
    });
  }

  // 2. Brand Validation
  if (!brand) {
    errors.push({
      row: rowIndex,
      productName: name || 'Unknown',
      sku: sku || 'N/A',
      code: 'MISSING_BRAND',
      message: 'Brand is required',
    });
  }

  // 3. Category Path Validation
  if (!categoryStr) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'MISSING_CATEGORY',
      message: 'Category path or name is required',
    });
  }

  // 4. SKU Validation
  if (!sku) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: 'MISSING',
      code: 'MISSING_SKU',
      message: 'Variant SKU is required',
    });
  } else if (!SKU_REGEX.test(sku)) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku,
      code: 'INVALID_SKU_FORMAT',
      message: `Invalid SKU format '${sku}'. Must be 3-30 uppercase alphanumeric characters or hyphens/underscores.`,
    });
  }

  // 5. Price & MRP Validation
  if (isNaN(numPrice) || numPrice <= 0) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_PRICE',
      message: 'Selling price must be a valid positive number greater than 0',
    });
  }

  if (isNaN(numMrp) || numMrp <= 0) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_MRP',
      message: 'MRP must be a valid positive number greater than 0',
    });
  } else if (!isNaN(numPrice) && numPrice > numMrp) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'PRICE_EXCEEDS_MRP',
      message: `Selling price (₹${numPrice}) cannot exceed MRP (₹${numMrp})`,
    });
  }

  // 6. Stock Validation
  if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_STOCK',
      message: 'Stock must be a non-negative integer (0 or greater)',
    });
  }

  if (isNaN(numLowStock) || numLowStock < 0) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_THRESHOLD',
      message: 'Low stock threshold must be a non-negative number',
    });
  }

  // 7. Color Hex Validation
  if (colorHex && !HEX_COLOR_REGEX.test(colorHex)) {
    errors.push({
      row: rowIndex,
      productName: name,
      sku: sku || 'N/A',
      code: 'INVALID_COLOR_HEX',
      message: `Invalid color hex code '${colorHex}'. Example: #000000 or #FFF`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      row: rowIndex,
      name,
      brand,
      categoryStr,
      gender,
      shortDescription: shortDesc,
      description: desc,
      tags,
      variant: {
        sku,
        barcode,
        attributes: {
          color: { name: colorName, hex: colorHex || '#000000' },
          size,
        },
        price: numPrice,
        mrp: numMrp,
        inventory: {
          stock: Math.floor(numStock),
          reserved: 0,
          lowStockThreshold: Math.floor(numLowStock),
        },
        isActive: true,
      },
    },
  };
};

/**
 * Sanitize cell values for CSV export to prevent formula injection (=, +, -, @)
 * @param {any} value
 * @returns {string}
 */
export const sanitizeForCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};
