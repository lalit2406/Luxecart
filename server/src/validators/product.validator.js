import mongoose from 'mongoose';

const SKU_REGEX = /^[A-Z0-9_-]{3,30}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_SORTS = ['newest', 'price-low', 'price-high', 'rating', 'discount'];
const ALLOWED_GENDERS = ['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS'];

/**
 * Validate a single variant payload
 * @param {object} variant
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateVariantInput = (variant = {}) => {
  const errors = [];
  const { sku, barcode, attributes, price, mrp, inventory, weightInGrams, dimensionsInCm, images, isActive } = variant;

  // SKU validation
  let normalizedSku = '';
  if (!sku || typeof sku !== 'string') {
    errors.push('Variant SKU is required');
  } else {
    normalizedSku = sku.trim().toUpperCase();
    if (!SKU_REGEX.test(normalizedSku)) {
      errors.push(`Invalid SKU format for '${normalizedSku}'. Must be 3-30 uppercase alphanumeric characters or hyphens/underscores.`);
    }
  }

  // Price validation
  const numPrice = Number(price);
  const numMrp = Number(mrp);

  if (isNaN(numPrice) || numPrice <= 0) {
    errors.push(`Variant ${normalizedSku || ''}: Price must be a positive number greater than 0.`);
  }

  if (isNaN(numMrp) || numMrp <= 0) {
    errors.push(`Variant ${normalizedSku || ''}: MRP must be a positive number greater than 0.`);
  } else if (!isNaN(numPrice) && numPrice > numMrp) {
    errors.push(`Variant ${normalizedSku || ''}: Selling price (₹${numPrice}) cannot exceed MRP (₹${numMrp}).`);
  }

  // Stock validation
  const stock = inventory?.stock !== undefined ? Number(inventory.stock) : 0;
  if (isNaN(stock) || stock < 0) {
    errors.push(`Variant ${normalizedSku || ''}: Stock cannot be negative.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      sku: normalizedSku,
      barcode: barcode ? String(barcode).trim() : null,
      attributes: attributes && typeof attributes === 'object' ? attributes : {},
      price: numPrice,
      mrp: numMrp,
      inventory: {
        stock: Math.floor(stock),
        reserved: inventory?.reserved ? Number(inventory.reserved) : 0,
        lowStockThreshold: inventory?.lowStockThreshold ? Number(inventory.lowStockThreshold) : 5,
      },
      weightInGrams: weightInGrams ? Number(weightInGrams) : 250,
      dimensionsInCm: dimensionsInCm || { length: 0, width: 0, height: 0 },
      images: Array.isArray(images) ? images : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    },
  };
};

/**
 * Validate product creation or update payload
 * @param {object} data
 * @param {boolean} [isPublishing=false]
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateProductInput = (data = {}, isPublishing = false, isUpdate = false) => {
  const errors = [];
  const {
    name,
    slug,
    brand,
    description,
    shortDescription,
    category,
    gender,
    images,
    specifications,
    variants,
    status,
    isFeatured,
    isNewArrival,
    isBestseller,
    tags,
    seo,
    model3d,
  } = data;

  // Basic required fields
  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Product name must be at least 2 characters long');
    } else if (name.trim().length > 150) {
      errors.push('Product name cannot exceed 150 characters');
    }
  }

  if (!isUpdate || brand !== undefined) {
    if (!brand || typeof brand !== 'string' || brand.trim().length < 1) {
      errors.push('Brand name is required');
    }
  }

  if (!isUpdate || description !== undefined) {
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      errors.push('Product description must be at least 10 characters long');
    }
  }

  if (!isUpdate || category !== undefined) {
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      errors.push('Valid category ID is required');
    }
  }

  if (slug !== undefined && slug !== null && slug !== '') {
    if (typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim().toLowerCase())) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }
  }

  if (gender !== undefined && !ALLOWED_GENDERS.includes(gender)) {
    errors.push(`Gender must be one of: ${ALLOWED_GENDERS.join(', ')}`);
  }

  // Variant validations
  let sanitizedVariants = undefined;
  if (variants !== undefined) {
    sanitizedVariants = [];
    if (Array.isArray(variants)) {
      const skuSet = new Set();
      variants.forEach((v, idx) => {
        const vResult = validateVariantInput(v);
        if (!vResult.isValid) {
          errors.push(`Variant #${idx + 1}: ${vResult.errors.join(', ')}`);
        } else {
          if (skuSet.has(vResult.sanitized.sku)) {
            errors.push(`Duplicate SKU '${vResult.sanitized.sku}' found inside product.`);
          }
          skuSet.add(vResult.sanitized.sku);
          sanitizedVariants.push(vResult.sanitized);
        }
      });
    } else {
      errors.push('Variants must be provided as an array');
    }
  }

  // Image validations
  let sanitizedImages = undefined;
  let primaryCount = 0;

  if (images !== undefined) {
    sanitizedImages = [];
    if (Array.isArray(images)) {
      images.forEach((img, idx) => {
        if (!img.url || typeof img.url !== 'string') {
          errors.push(`Image #${idx + 1} is missing a valid URL`);
        } else {
          const isPrimary = Boolean(img.isPrimary);
          if (isPrimary) primaryCount++;
          sanitizedImages.push({
            url: img.url.trim(),
            alt: img.alt ? String(img.alt).trim() : '',
            isPrimary,
            displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : idx,
            color: img.color ? String(img.color).trim() : '',
          });
        }
      });

      // If first image exists and none was explicitly primary, default first to primary
      if (sanitizedImages.length > 0 && primaryCount === 0) {
        sanitizedImages[0].isPrimary = true;
        primaryCount = 1;
      }
    } else {
      errors.push('Images must be provided as an array');
    }
  }

  // Strict validation if status is ACTIVE or transitioning to ACTIVE
  const targetStatus = status !== undefined ? status : (!isUpdate ? (isPublishing ? 'ACTIVE' : 'DRAFT') : undefined);
  if (targetStatus === 'ACTIVE') {
    if (sanitizedVariants !== undefined) {
      if (sanitizedVariants.length === 0) {
        errors.push('Active product must contain at least one valid variant.');
      } else {
        const hasActiveVariant = sanitizedVariants.some((v) => v.isActive);
        if (!hasActiveVariant) {
          errors.push('Active product must have at least one active variant.');
        }
      }
    }

    if (sanitizedImages !== undefined) {
      if (sanitizedImages.length === 0) {
        errors.push('Active product must have at least one image.');
      } else if (primaryCount !== 1) {
        errors.push('Active product must have exactly one primary image.');
      }
    }
  }

  // Specifications
  let sanitizedSpecs = undefined;
  if (specifications !== undefined) {
    sanitizedSpecs = Array.isArray(specifications) ? specifications : [];
  }

  // Tags
  let sanitizedTags = undefined;
  if (tags !== undefined) {
    sanitizedTags = Array.isArray(tags) ? tags.map((t) => String(t).trim().toLowerCase()) : [];
  }

  // 3D Model Metadata Validation (Optional Phase 15)
  let sanitizedModel3d = undefined;
  if (model3d !== undefined) {
    if (model3d && typeof model3d === 'object') {
      const rawUrl = model3d.url ? String(model3d.url).trim() : null;
      const rawFormat = model3d.format ? String(model3d.format).trim().toUpperCase() : null;
      const rawPoster = model3d.posterUrl ? String(model3d.posterUrl).trim() : null;
      const enabled = Boolean(model3d.enabled);

      if (rawUrl && !/^(https:\/\/|\/|\.\/)[^\s]+$/i.test(rawUrl)) {
        errors.push('3D model URL must use secure HTTPS protocol or valid relative path.');
      }

      if (rawPoster && !/^(https:\/\/|\/|\.\/)[^\s]+$/i.test(rawPoster)) {
        errors.push('3D poster URL must use secure HTTPS protocol or valid relative path.');
      }

      if (rawFormat && !['GLB', 'GLTF'].includes(rawFormat)) {
        errors.push("3D model format must be either 'GLB' or 'GLTF'.");
      }

      sanitizedModel3d = {
        enabled,
        url: rawUrl || null,
        format: rawFormat || null,
        posterUrl: rawPoster || null,
      };
    } else {
      sanitizedModel3d = {
        enabled: false,
        url: null,
        format: null,
        posterUrl: null,
      };
    }
  }

  const sanitized = {};
  if (name !== undefined) sanitized.name = name.trim();
  else if (!isUpdate) sanitized.name = '';

  if (slug !== undefined && slug !== null && slug !== '') sanitized.slug = slug.trim().toLowerCase();

  if (brand !== undefined) sanitized.brand = brand.trim();
  else if (!isUpdate) sanitized.brand = '';

  if (description !== undefined) sanitized.description = description.trim();
  else if (!isUpdate) sanitized.description = '';

  if (shortDescription !== undefined) sanitized.shortDescription = String(shortDescription).trim();
  else if (!isUpdate) sanitized.shortDescription = '';

  if (category !== undefined) sanitized.category = new mongoose.Types.ObjectId(category);

  if (gender !== undefined) sanitized.gender = gender;
  else if (!isUpdate) sanitized.gender = 'UNISEX';

  if (sanitizedImages !== undefined) sanitized.images = sanitizedImages;
  else if (!isUpdate) sanitized.images = [];

  if (sanitizedSpecs !== undefined) sanitized.specifications = sanitizedSpecs;
  else if (!isUpdate) sanitized.specifications = [];

  if (sanitizedVariants !== undefined) sanitized.variants = sanitizedVariants;
  else if (!isUpdate) sanitized.variants = [];

  if (targetStatus !== undefined) sanitized.status = targetStatus;

  if (isFeatured !== undefined) sanitized.isFeatured = Boolean(isFeatured);
  else if (!isUpdate) sanitized.isFeatured = false;

  if (isNewArrival !== undefined) sanitized.isNewArrival = Boolean(isNewArrival);
  else if (!isUpdate) sanitized.isNewArrival = false;

  if (isBestseller !== undefined) sanitized.isBestseller = Boolean(isBestseller);
  else if (!isUpdate) sanitized.isBestseller = false;

  if (sanitizedTags !== undefined) sanitized.tags = sanitizedTags;
  else if (!isUpdate) sanitized.tags = [];

  if (seo !== undefined && typeof seo === 'object') sanitized.seo = seo;
  if (sanitizedModel3d !== undefined) sanitized.model3d = sanitizedModel3d;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate catalog query parameters (filtering, search, sorting, pagination)
 * @param {object} query
 * @returns {{ filter: object, sort: object, pagination: { page: number, limit: number, skip: number } }}
 */
export const validateCatalogQuery = (query = {}) => {
  const filter = { status: 'ACTIVE' };

  // Category filter
  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) {
    filter.categoryTree = new mongoose.Types.ObjectId(query.category);
  }

  // Brand filter
  if (query.brand && (typeof query.brand === 'string' || Array.isArray(query.brand))) {
    const brands = (Array.isArray(query.brand) ? query.brand : query.brand.split(','))
      .map((b) => (typeof b === 'string' ? b.trim() : ''))
      .filter(Boolean);
    if (brands.length > 0) {
      filter.brand = { $in: brands.map((b) => new RegExp(`^${b}$`, 'i')) };
    }
  }

  // Gender filter
  if (query.gender && ALLOWED_GENDERS.includes(query.gender.toUpperCase())) {
    filter.gender = query.gender.toUpperCase();
  }

  // Merchandising flags
  if (query.isFeatured === 'true') filter.isFeatured = true;
  if (query.isNewArrival === 'true') filter.isNewArrival = true;
  if (query.isBestseller === 'true') filter.isBestseller = true;

  // Search keyword query
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    filter.$text = { $search: query.search.trim() };
  }

  // Exact variant combinations ($elemMatch)
  const variantConditions = { isActive: true };
  let hasVariantFilter = false;

  if (query.size) {
    const sizes = (Array.isArray(query.size) ? query.size : query.size.split(',')).map((s) => s.trim());
    variantConditions['attributes.size'] = { $in: sizes };
    hasVariantFilter = true;
  }

  if (query.color) {
    const colors = (Array.isArray(query.color) ? query.color : query.color.split(',')).map((c) => c.trim());
    variantConditions['attributes.color.name'] = { $in: colors.map((c) => new RegExp(`^${c}$`, 'i')) };
    hasVariantFilter = true;
  }

  if (query.inStock === 'true') {
    variantConditions['inventory.stock'] = { $gt: 0 };
    hasVariantFilter = true;
  } else if (query.inStock === 'false') {
    variantConditions['inventory.stock'] = 0;
    hasVariantFilter = true;
  }

  // Specific price range filtering (checked on variant level when variant filter exists or priceSummary)
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  if (minPrice !== null || maxPrice !== null) {
    if (hasVariantFilter) {
      variantConditions.price = {};
      if (minPrice !== null && !isNaN(minPrice)) variantConditions.price.$gte = minPrice;
      if (maxPrice !== null && !isNaN(maxPrice)) variantConditions.price.$lte = maxPrice;
    } else {
      filter['priceSummary.minPrice'] = {};
      if (minPrice !== null && !isNaN(minPrice)) filter['priceSummary.minPrice'].$gte = minPrice;
      if (maxPrice !== null && !isNaN(maxPrice)) filter['priceSummary.minPrice'].$lte = maxPrice;
    }
  }

  if (hasVariantFilter) {
    filter.variants = { $elemMatch: variantConditions };
  }

  // Discount percentage filter
  if (query.minDiscount && !isNaN(Number(query.minDiscount))) {
    filter['priceSummary.maxDiscountPercent'] = { $gte: Number(query.minDiscount) };
  }

  // Sorting
  let sort = { createdAt: -1 };
  if (query.sort && ALLOWED_SORTS.includes(query.sort)) {
    switch (query.sort) {
      case 'price-low':
        sort = { 'priceSummary.minPrice': 1 };
        break;
      case 'price-high':
        sort = { 'priceSummary.maxPrice': -1 };
        break;
      case 'rating':
        sort = { 'ratings.average': -1, 'ratings.count': -1 };
        break;
      case 'discount':
        sort = { 'priceSummary.maxDiscountPercent': -1 };
        break;
      case 'newest':
      default:
        sort = { createdAt: -1 };
        break;
    }
  } else if (filter.$text) {
    sort = { score: { $meta: 'textScore' } };
  }

  // Pagination
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || '12', 10)));
  const skip = (page - 1) * limit;

  return {
    filter,
    sort,
    pagination: { page, limit, skip },
  };
};
