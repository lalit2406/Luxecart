/**
 * LUXECART SAFE CATALOG-ONLY MIGRATION UTILITY (test -> luxecart_staging)
 *
 * Migrates strictly the curated LuxeCart catalog (6 root categories, 15+ active
 * child categories, and the 12 curated private-label products) from `test` into
 * `luxecart_staging`.
 *
 * STRICT SAFETY INVARIANTS:
 * 1. Source database MUST be `test` (read-only queries only; never writes to source).
 * 2. Destination database MUST be `luxecart_staging`.
 * 3. Requires explicit `--confirm-source=test` and `--confirm-target=luxecart_staging`.
 * 4. Defaults to DRY-RUN mode; requires `--apply` for any destination database write.
 * 5. Uses separate `SOURCE_MONGODB_URI` and `TARGET_MONGODB_URI` env vars.
 * 6. Never prints credentials or full MongoDB URIs in logs or errors.
 * 7. Never runs deleteMany, dropCollection, dropDatabase, or destructive resets.
 * 8. Never accesses users, orders, addresses, carts, sessions, coupons, reviews,
 *    support tickets, or any non-catalog collection.
 * 9. Never modifies `seedRealCatalog.js` or invokes Cloudinary deletion APIs.
 *
 * CLOUDINARY SHARED-ASSET NOTICE & FUTURE ISOLATION RECOMMENDATION:
 * - Migrated baseline product images reference existing Cloudinary `publicId`s
 *   under `luxecart/products/...`. This script never deletes, renames, or
 *   overwrites Cloudinary assets.
 * - WARNING: Removing a migrated baseline image through the Staging Admin UI
 *   invokes `deleteFromCloudinary(publicId)`, which would destroy the shared
 *   Cloudinary asset used by `test` and hardcoded storefront tiles.
 * - RECOMMENDED FUTURE ISOLATION: Clone the baseline assets into
 *   `luxecart/staging/products/<slug>/...` using the Cloudinary Admin/Upload API
 *   and update `images[].url` and `images[].publicId` in `luxecart_staging`.
 *
 * Usage:
 *   Dry-run (default):
 *     node scripts/migrate_catalog_to_staging.js --confirm-source=test --confirm-target=luxecart_staging
 *
 *   Apply writes:
 *     node scripts/migrate_catalog_to_staging.js --confirm-source=test --confirm-target=luxecart_staging --apply
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../src/modules/categories/category.model.js';
import Product from '../src/modules/products/product.model.js';
import { sanitizeUri } from './backup_database.js';
import { parseMongoUri } from './restore_database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const REQUIRED_SOURCE_DB = 'test';
export const REQUIRED_TARGET_DB = 'luxecart_staging';

export const ALLOWED_CATALOG_COLLECTIONS = Object.freeze(['categories', 'products']);

export const REQUIRED_ROOT_CATEGORY_SLUGS = Object.freeze([
  'men',
  'women',
  'footwear',
  'beauty',
  'accessories',
  'lifestyle',
]);

export const REQUIRED_CHILD_CATEGORY_SLUGS = Object.freeze([
  'mens-apparel',
  'mens-t-shirts',
  'mens-shirts',
  'mens-jeans',
  'womens-apparel',
  'womens-dresses',
  'womens-tops',
  'womens-kurta-sets',
  'womens-trousers',
  'sneakers',
  'loafers',
  'skincare',
  'face-serum',
  'bags',
  'shoulder-bags',
]);

export const CURATED_PRODUCT_SLUGS = Object.freeze([
  'aurelio-essential-oversized-t-shirt',
  'northline-oxford-casual-shirt',
  'veyron-relaxed-linen-shirt',
  'urban-form-straight-fit-denim',
  'elane-satin-midi-dress',
  'mirae-ribbed-knit-top',
  'nivara-printed-kurta-set',
  'velora-wide-leg-trousers',
  'vanta-retro-runner-sneakers',
  'stride-minimal-leather-loafers',
  'nivelle-vitamin-c-brightening-serum',
  'aurelia-structured-shoulder-bag',
]);

/**
 * Redacts MongoDB credentials and secret URI substrings from any error or log text.
 * @param {string} message
 * @param {string[]} [sensitiveUris=[]]
 * @returns {string}
 */
export const sanitizeLogMessage = (message, sensitiveUris = []) => {
  if (!message || typeof message !== 'string') return '';
  let clean = sanitizeUri(message);
  for (const rawUri of sensitiveUris) {
    if (rawUri && typeof rawUri === 'string' && rawUri.trim()) {
      const trimmed = rawUri.trim();
      if (clean.includes(trimmed)) {
        clean = clean.split(trimmed).join(sanitizeUri(trimmed));
      }
      // Also redact extracted user/pass tokens if echoed separately by driver errors
      const authMatch = trimmed.match(/^mongodb(?:\+srv)?:\/\/([^/?#@]+)@/i);
      if (authMatch && authMatch[1]) {
        const authPart = authMatch[1];
        if (clean.includes(authPart)) {
          clean = clean.split(authPart).join('[REDACTED_CREDENTIALS]');
        }
        const colonIdx = authPart.indexOf(':');
        if (colonIdx > -1) {
          const rawPass = authPart.slice(colonIdx + 1);
          let decodedPass = rawPass;
          try {
            decodedPass = decodeURIComponent(rawPass);
          } catch (_) {}
          for (const secretToken of [rawPass, decodedPass]) {
            if (secretToken && secretToken.length >= 3 && clean.includes(secretToken)) {
              clean = clean.split(secretToken).join('[REDACTED]');
            }
          }
        }
      }
    }
  }
  return clean;
};

/**
 * Creates a sanitized Error with code while preserving safe diagnostics.
 * @param {string} code
 * @param {string} message
 * @param {string[]} [sensitiveUris=[]]
 * @returns {Error}
 */
function createMigrationError(code, message, sensitiveUris = []) {
  const err = new Error(sanitizeLogMessage(message, sensitiveUris));
  err.code = code;
  return err;
}

/**
 * Validates CLI flags, confirmation tokens, and source/target MongoDB URIs
 * BEFORE attempting any network or database connection (fail-closed).
 *
 * @param {object} options
 * @returns {object} Validated migration configuration
 */
export const validateMigrationInputs = (options = {}) => {
  const {
    sourceUri = process.env.SOURCE_MONGODB_URI,
    targetUri = process.env.TARGET_MONGODB_URI,
    confirmSource = null,
    confirmTarget = null,
    apply = false,
  } = options;

  const sensitiveUris = [sourceUri, targetUri].filter(Boolean);

  // 1. Explicit CLI confirmation gates
  if (!confirmSource || typeof confirmSource !== 'string' || !confirmSource.trim()) {
    throw createMigrationError(
      'SOURCE_CONFIRMATION_REQUIRED',
      `Migration aborted: Missing required confirmation flag '--confirm-source=${REQUIRED_SOURCE_DB}'.`,
      sensitiveUris
    );
  }
  if (confirmSource.trim() !== REQUIRED_SOURCE_DB) {
    throw createMigrationError(
      'SOURCE_CONFIRMATION_MISMATCH',
      `Migration aborted: '--confirm-source' must be '${REQUIRED_SOURCE_DB}', received '${confirmSource.trim()}'.`,
      sensitiveUris
    );
  }

  if (!confirmTarget || typeof confirmTarget !== 'string' || !confirmTarget.trim()) {
    throw createMigrationError(
      'TARGET_CONFIRMATION_REQUIRED',
      `Migration aborted: Missing required confirmation flag '--confirm-target=${REQUIRED_TARGET_DB}'.`,
      sensitiveUris
    );
  }
  if (confirmTarget.trim() !== REQUIRED_TARGET_DB) {
    throw createMigrationError(
      'TARGET_CONFIRMATION_MISMATCH',
      `Migration aborted: '--confirm-target' must be '${REQUIRED_TARGET_DB}', received '${confirmTarget.trim()}'.`,
      sensitiveUris
    );
  }

  // 2. Separate SOURCE_MONGODB_URI and TARGET_MONGODB_URI presence
  if (!sourceUri || typeof sourceUri !== 'string' || !sourceUri.trim()) {
    throw createMigrationError(
      'MISSING_SOURCE_URI',
      'Migration aborted: SOURCE_MONGODB_URI environment variable is required and cannot be empty.',
      sensitiveUris
    );
  }
  if (!targetUri || typeof targetUri !== 'string' || !targetUri.trim()) {
    throw createMigrationError(
      'MISSING_TARGET_URI',
      'Migration aborted: TARGET_MONGODB_URI environment variable is required and cannot be empty.',
      sensitiveUris
    );
  }

  // 3. Parse and strictly verify URI target database names
  let parsedSource;
  let parsedTarget;
  try {
    parsedSource = parseMongoUri(sourceUri.trim());
  } catch (err) {
    throw createMigrationError(
      'INVALID_SOURCE_URI',
      `Invalid SOURCE_MONGODB_URI: ${err.message}`,
      sensitiveUris
    );
  }

  try {
    parsedTarget = parseMongoUri(targetUri.trim());
  } catch (err) {
    throw createMigrationError(
      'INVALID_TARGET_URI',
      `Invalid TARGET_MONGODB_URI: ${err.message}`,
      sensitiveUris
    );
  }

  if (parsedSource.dbNameInUri !== REQUIRED_SOURCE_DB) {
    throw createMigrationError(
      'INVALID_SOURCE_DATABASE',
      `Migration aborted: SOURCE_MONGODB_URI must target database '${REQUIRED_SOURCE_DB}', found '${parsedSource.dbNameInUri || '(none)'}'.`,
      sensitiveUris
    );
  }

  if (parsedTarget.dbNameInUri !== REQUIRED_TARGET_DB) {
    throw createMigrationError(
      'INVALID_TARGET_DATABASE',
      `Migration aborted: TARGET_MONGODB_URI must target database '${REQUIRED_TARGET_DB}', found '${parsedTarget.dbNameInUri || '(none)'}'.`,
      sensitiveUris
    );
  }

  const sanitizedSource = sanitizeUri(sourceUri.trim());
  const sanitizedTarget = sanitizeUri(targetUri.trim());

  if (sanitizedSource === sanitizedTarget) {
    throw createMigrationError(
      'IDENTICAL_SOURCE_AND_TARGET',
      'Migration aborted: SOURCE_MONGODB_URI and TARGET_MONGODB_URI cannot point to the same database.',
      sensitiveUris
    );
  }

  return {
    sourceUri: sourceUri.trim(),
    targetUri: targetUri.trim(),
    sanitizedSource,
    sanitizedTarget,
    sourceDbName: parsedSource.dbNameInUri,
    targetDbName: parsedTarget.dbNameInUri,
    apply: Boolean(apply),
    dryRun: !apply,
  };
};

/**
 * Validates that a connected Mongoose connection targets the exact expected DB name.
 * @param {object} conn
 * @param {string} expectedDbName
 * @param {'source'|'target'} role
 */
function verifyConnectedDatabaseName(conn, expectedDbName, role) {
  const actualDbName = conn?.db?.databaseName || conn?.name;
  if (actualDbName !== expectedDbName) {
    const code = role === 'source' ? 'SOURCE_DB_RUNTIME_MISMATCH' : 'TARGET_DB_RUNTIME_MISMATCH';
    throw createMigrationError(
      code,
      `Migration aborted: Connected ${role} database is '${actualDbName || '(unknown)'}', expected '${expectedDbName}'.`
    );
  }
}

/**
 * Normalizes an ObjectId or string reference to a lowercase 24-hex string key.
 * @param {any} id
 * @returns {string|null}
 */
function idKey(id) {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id.toString === 'function') return id.toString();
  return String(id);
}

/**
 * Validates a single curated source product document before any migration write.
 * @param {object} product
 * @param {Map<string, object>} sourceCategoriesById
 * @param {Set<string>} globalSkuSet
 */
export function validateSourceProduct(product, sourceCategoriesById, globalSkuSet) {
  if (!product || typeof product !== 'object') {
    throw createMigrationError('INVALID_PRODUCT', 'Product record is empty or invalid.');
  }

  const label = `${product.name || 'Unnamed'} (${product.slug || 'no-slug'})`;

  if (product.status !== 'ACTIVE') {
    throw createMigrationError(
      'INACTIVE_PRODUCT',
      `Product '${label}' must have status 'ACTIVE' before migration (found '${product.status}').`
    );
  }

  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length === 0) {
    throw createMigrationError(
      'MISSING_PRODUCT_IMAGES',
      `Product '${label}' has 0 images. At least 1 image is required.`
    );
  }

  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];
    if (!img?.url || typeof img.url !== 'string' || !/^https:\/\/[^\s]+$/i.test(img.url.trim())) {
      throw createMigrationError(
        'INVALID_PRODUCT_IMAGE_URL',
        `Product '${label}' image #${idx + 1} has missing or non-HTTPS URL.`
      );
    }
  }

  const primaryImages = images.filter((img) => img.isPrimary === true);
  if (primaryImages.length !== 1) {
    throw createMigrationError(
      'INVALID_PRIMARY_IMAGE_COUNT',
      `Product '${label}' must have exactly 1 primary image (found ${primaryImages.length}).`
    );
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const activeVariants = variants.filter((v) => v && v.isActive !== false);
  if (activeVariants.length === 0) {
    throw createMigrationError(
      'MISSING_ACTIVE_VARIANTS',
      `Product '${label}' must have at least 1 active variant.`
    );
  }

  for (const v of variants) {
    const sku = v?.sku ? String(v.sku).trim().toUpperCase() : '';
    if (!sku) {
      throw createMigrationError(
        'MISSING_VARIANT_SKU',
        `Product '${label}' contains a variant without a valid SKU.`
      );
    }
    if (globalSkuSet.has(sku)) {
      throw createMigrationError(
        'DUPLICATE_CURATED_SKU',
        `Duplicate SKU '${sku}' detected across curated products (conflict at '${label}').`
      );
    }
    globalSkuSet.add(sku);

    if (typeof v.price !== 'number' || v.price < 1 || typeof v.mrp !== 'number' || v.mrp < 1) {
      throw createMigrationError(
        'INVALID_VARIANT_PRICING',
        `Product '${label}' variant '${sku}' has invalid price/MRP.`
      );
    }
    if (v.price > v.mrp) {
      throw createMigrationError(
        'PRICE_EXCEEDS_MRP',
        `Product '${label}' variant '${sku}' selling price (${v.price}) exceeds MRP (${v.mrp}).`
      );
    }
    const stock = v.inventory?.stock;
    if (typeof stock !== 'number' || stock < 0) {
      throw createMigrationError(
        'INVALID_VARIANT_STOCK',
        `Product '${label}' variant '${sku}' has invalid stock (${stock}).`
      );
    }
  }

  const catKey = idKey(product.category);
  const leafCat = catKey ? sourceCategoriesById.get(catKey) : null;
  if (!leafCat) {
    throw createMigrationError(
      'INVALID_PRODUCT_CATEGORY',
      `Product '${label}' references missing source category '${catKey || 'null'}'.`
    );
  }
  if (leafCat.isActive === false) {
    throw createMigrationError(
      'INACTIVE_PRODUCT_CATEGORY',
      `Product '${label}' references inactive category '${leafCat.slug}'.`
    );
  }
}

/**
 * Resolves the closed dependency set of categories needed for migration:
 * - 6 required root categories
 * - 15 curated child categories
 * - Any additional active categories referenced by the 12 curated products
 *   plus all ancestor/parent categories required for valid trees.
 *
 * Returns categories sorted strictly in topological order (parents before children).
 *
 * @param {Array<object>} allSourceCategories
 * @param {Array<object>} curatedProducts
 * @returns {Array<object>}
 */
export function resolveOrderedCategoryDependencies(allSourceCategories, curatedProducts) {
  const byId = new Map();
  const bySlug = new Map();

  for (const cat of allSourceCategories) {
    if (!cat || !cat._id || !cat.slug) continue;
    const normalizedSlug = String(cat.slug).trim().toLowerCase();
    byId.set(idKey(cat._id), { ...cat, slug: normalizedSlug });
    bySlug.set(normalizedSlug, { ...cat, slug: normalizedSlug });
  }

  const selectedBySlug = new Map();

  const includeWithAncestors = (catDoc, contextDesc) => {
    const visited = new Set();
    let current = catDoc;

    while (current) {
      const currKey = idKey(current._id);
      if (visited.has(currKey)) {
        throw createMigrationError(
          'CATEGORY_CYCLE_DETECTED',
          `Circular parentId cycle detected in category '${current.slug}'.`
        );
      }
      visited.add(currKey);

      if (current.isActive === false) {
        throw createMigrationError(
          'INACTIVE_REQUIRED_CATEGORY',
          `Category '${current.slug}' (required by ${contextDesc}) is inactive in source database.`
        );
      }

      selectedBySlug.set(current.slug, current);

      const parentIdStr = idKey(current.parentId);
      if (!parentIdStr) break;

      const parentCat = byId.get(parentIdStr);
      if (!parentCat) {
        throw createMigrationError(
          'MISSING_PARENT_CATEGORY',
          `Category '${current.slug}' references missing parent category '${parentIdStr}'.`
        );
      }
      current = parentCat;
    }
  };

  // 1. Validate & include the 6 required root categories
  for (const rootSlug of REQUIRED_ROOT_CATEGORY_SLUGS) {
    const rootCat = bySlug.get(rootSlug);
    if (!rootCat) {
      throw createMigrationError(
        'MISSING_REQUIRED_ROOT_CATEGORY',
        `Required root category '${rootSlug}' was not found in source database.`
      );
    }
    includeWithAncestors(rootCat, `required root category '${rootSlug}'`);
  }

  // 2. Validate & include the 15 curated child categories
  for (const childSlug of REQUIRED_CHILD_CATEGORY_SLUGS) {
    const childCat = bySlug.get(childSlug);
    if (!childCat) {
      throw createMigrationError(
        'MISSING_REQUIRED_CHILD_CATEGORY',
        `Required curated child category '${childSlug}' was not found in source database.`
      );
    }
    includeWithAncestors(childCat, `required child category '${childSlug}'`);
  }

  // 3. Include any additional active categories referenced by the 12 curated products
  for (const prod of curatedProducts) {
    const leafId = idKey(prod.category);
    const leafCat = leafId ? byId.get(leafId) : null;
    if (!leafCat) {
      throw createMigrationError(
        'INVALID_PRODUCT_CATEGORY',
        `Curated product '${prod.slug}' references unknown category '${leafId || 'null'}'.`
      );
    }
    includeWithAncestors(leafCat, `product '${prod.slug}' category`);

    for (const treeId of prod.categoryTree || []) {
      const treeCat = byId.get(idKey(treeId));
      if (treeCat && treeCat.isActive !== false) {
        includeWithAncestors(treeCat, `product '${prod.slug}' categoryTree`);
      }
    }
  }

  // 4. Sort strictly top-down (ancestors before descendants)
  const sorted = [];
  const placedSlugs = new Set();
  const remaining = Array.from(selectedBySlug.values()).sort(
    (a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  let guard = 0;
  while (sorted.length < selectedBySlug.size) {
    guard++;
    if (guard > selectedBySlug.size + 5) {
      throw createMigrationError(
        'CATEGORY_SORT_FAILED',
        'Unable to topologically sort category hierarchy due to unresolved parent references.'
      );
    }

    let progress = false;
    for (const cat of remaining) {
      if (placedSlugs.has(cat.slug)) continue;
      const parentIdStr = idKey(cat.parentId);
      if (!parentIdStr) {
        sorted.push(cat);
        placedSlugs.add(cat.slug);
        progress = true;
      } else {
        const parentCat = byId.get(parentIdStr);
        if (parentCat && placedSlugs.has(parentCat.slug)) {
          sorted.push(cat);
          placedSlugs.add(cat.slug);
          progress = true;
        }
      }
    }

    if (!progress) {
      throw createMigrationError(
        'CATEGORY_SORT_DEADLOCK',
        'Category dependency sorting stalled on unresolved parent links.'
      );
    }
  }

  return sorted;
}

/**
 * Sanitizes and recomputes priceSummary and searchKeywords on a product payload
 * without mutating source objects.
 *
 * @param {object} srcProd
 * @param {object} destLeafCategory
 * @returns {object}
 */
export function buildDestinationProductPayload(srcProd, destLeafCategory) {
  const cleanImages = (srcProd.images || []).map((img, idx) => ({
    url: String(img.url).trim(),
    publicId: img.publicId ? String(img.publicId).trim() : null,
    width: img.width ?? null,
    height: img.height ?? null,
    format: img.format ? String(img.format).trim() : null,
    bytes: img.bytes ?? null,
    alt: img.alt ? String(img.alt).trim() : '',
    isPrimary: Boolean(img.isPrimary),
    displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : idx,
    color: img.color ? String(img.color).trim() : '',
  }));

  const cleanVariants = (srcProd.variants || []).map((v) => ({
    sku: String(v.sku).trim().toUpperCase(),
    barcode: v.barcode ?? null,
    attributes: {
      color: {
        name: v.attributes?.color?.name ? String(v.attributes.color.name).trim() : '',
        hex: v.attributes?.color?.hex ? String(v.attributes.color.hex).trim() : '',
      },
      size: v.attributes?.size ? String(v.attributes.size).trim() : '',
      custom: v.attributes?.custom || {},
    },
    price: v.price,
    mrp: v.mrp,
    inventory: {
      stock: v.inventory?.stock ?? 0,
      reserved: 0, // Always reset transient reservations on migration
      lowStockThreshold: v.inventory?.lowStockThreshold ?? 5,
    },
    weightInGrams: v.weightInGrams ?? 250,
    dimensionsInCm: {
      length: v.dimensionsInCm?.length ?? 0,
      width: v.dimensionsInCm?.width ?? 0,
      height: v.dimensionsInCm?.height ?? 0,
    },
    images: Array.isArray(v.images) ? v.images.map((u) => String(u).trim()).filter(Boolean) : [],
    isActive: v.isActive !== false,
  }));

  const rebuiltCategoryTree = [
    ...(destLeafCategory.ancestors || []).map((a) => a._id),
    destLeafCategory._id,
  ];

  // Recompute priceSummary & searchKeywords via Mongoose Product model helper methods
  const tempProductDoc = new Product({
    name: srcProd.name,
    slug: String(srcProd.slug).trim().toLowerCase(),
    brand: srcProd.brand,
    description: srcProd.description,
    shortDescription: srcProd.shortDescription || '',
    category: destLeafCategory._id,
    categoryTree: rebuiltCategoryTree,
    gender: srcProd.gender || 'UNISEX',
    images: cleanImages,
    specifications: (srcProd.specifications || []).map((s) => ({
      name: String(s.name).trim(),
      value: String(s.value).trim(),
    })),
    variants: cleanVariants,
    status: 'ACTIVE',
    isFeatured: Boolean(srcProd.isFeatured),
    isNewArrival: Boolean(srcProd.isNewArrival),
    isBestseller: Boolean(srcProd.isBestseller),
    tags: Array.isArray(srcProd.tags) ? srcProd.tags.map((t) => String(t).trim().toLowerCase()) : [],
    ratings: { average: 0, count: 0 }, // Reset ratings for clean staging database without reviews
    seo: srcProd.seo || undefined,
    model3d: srcProd.model3d || undefined,
  });

  tempProductDoc.recalculatePriceSummary();
  tempProductDoc.generateSearchKeywords();

  return {
    name: tempProductDoc.name,
    slug: tempProductDoc.slug,
    brand: tempProductDoc.brand,
    description: tempProductDoc.description,
    shortDescription: tempProductDoc.shortDescription,
    category: tempProductDoc.category,
    categoryTree: tempProductDoc.categoryTree,
    gender: tempProductDoc.gender,
    images: cleanImages,
    specifications: tempProductDoc.specifications.map((s) => ({ name: s.name, value: s.value })),
    variants: cleanVariants,
    priceSummary: { ...tempProductDoc.priceSummary.toObject?.() || tempProductDoc.priceSummary },
    status: 'ACTIVE',
    isFeatured: tempProductDoc.isFeatured,
    isNewArrival: tempProductDoc.isNewArrival,
    isBestseller: tempProductDoc.isBestseller,
    tags: [...tempProductDoc.tags],
    ratings: { average: 0, count: 0 },
    searchKeywords: tempProductDoc.searchKeywords,
    ...(srcProd.seo ? { seo: srcProd.seo } : {}),
    ...(srcProd.model3d ? { model3d: srcProd.model3d } : {}),
  };
}

/**
 * Executes the safe catalog-only migration from `test` to `luxecart_staging`.
 *
 * @param {object} options
 * @param {string} [options.sourceUri]
 * @param {string} [options.targetUri]
 * @param {string} options.confirmSource
 * @param {string} options.confirmTarget
 * @param {boolean} [options.apply=false]
 * @param {object} [options.injectedConnections] - Optional mocked/in-memory connections for testing
 * @returns {Promise<object>} Migration summary report
 */
export async function migrateCatalogToStaging(options = {}) {
  const sensitiveUris = [
    options.sourceUri ?? process.env.SOURCE_MONGODB_URI,
    options.targetUri ?? process.env.TARGET_MONGODB_URI,
  ].filter(Boolean);

  // 1. Validate inputs & URIs fail-closed before connecting anywhere
  const config = validateMigrationInputs(options);

  console.log('\n================================================================');
  console.log('  LUXECART CATALOG MIGRATION UTILITY (test -> luxecart_staging)');
  console.log('================================================================');
  console.log(`Mode:        ${config.apply ? 'APPLY (Destination writes ENABLED)' : 'DRY-RUN (Read-only validation, ZERO writes)'}`);
  console.log(`Source URI:  ${config.sanitizedSource} [DB: ${config.sourceDbName}]`);
  console.log(`Target URI:  ${config.sanitizedTarget} [DB: ${config.targetDbName}]`);
  console.log('Collections: categories, products ONLY (all private collections excluded)');
  console.log('================================================================\n');

  let sourceConn = options.injectedConnections?.sourceConn || null;
  let targetConn = options.injectedConnections?.targetConn || null;
  const ownsConnections = !options.injectedConnections;

  try {
    // 2. Establish isolated source (read-only preference) & target connections
    if (ownsConnections) {
      sourceConn = await mongoose
        .createConnection(config.sourceUri, {
          readPreference: 'secondaryPreferred',
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        })
        .asPromise();

      targetConn = await mongoose
        .createConnection(config.targetUri, {
          autoIndex: false,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        })
        .asPromise();
    }

    // 3. Runtime database-name verification before any query or write
    verifyConnectedDatabaseName(sourceConn, REQUIRED_SOURCE_DB, 'source');
    verifyConnectedDatabaseName(targetConn, REQUIRED_TARGET_DB, 'target');

    // Bind ONLY Category & Product models on each connection (prohibited collections untouched)
    const SourceCategory = options.injectedConnections?.SourceCategory || sourceConn.model('Category', Category.schema);
    const SourceProduct = options.injectedConnections?.SourceProduct || sourceConn.model('Product', Product.schema);
    const TargetCategory = options.injectedConnections?.TargetCategory || targetConn.model('Category', Category.schema);
    const TargetProduct = options.injectedConnections?.TargetProduct || targetConn.model('Product', Product.schema);

    // 4. Read curated catalog strictly from source (`test`)
    const [allSourceCategories, curatedSourceProducts] = await Promise.all([
      SourceCategory.find({}).lean(),
      SourceProduct.find({ slug: { $in: CURATED_PRODUCT_SLUGS } }).lean(),
    ]);

    // Ensure ALL 12 curated slugs exist in source
    const foundSlugSet = new Set(curatedSourceProducts.map((p) => String(p.slug).trim().toLowerCase()));
    const missingSlugs = CURATED_PRODUCT_SLUGS.filter((slug) => !foundSlugSet.has(slug));
    if (missingSlugs.length > 0 || curatedSourceProducts.length !== CURATED_PRODUCT_SLUGS.length) {
      throw createMigrationError(
        'INCOMPLETE_SOURCE_CATALOG',
        `Source database '${REQUIRED_SOURCE_DB}' is missing ${missingSlugs.length} curated product(s): ${missingSlugs.join(', ')}.`,
        sensitiveUris
      );
    }

    // 5. Resolve & validate closed category dependency graph (6 roots + 15 children + extras)
    const orderedCategories = resolveOrderedCategoryDependencies(allSourceCategories, curatedSourceProducts);
    const sourceCategoriesById = new Map(allSourceCategories.map((c) => [idKey(c._id), c]));

    // 6. Validate all 12 source products before planning or performing any write
    const globalSkuSet = new Set();
    for (const prod of curatedSourceProducts) {
      validateSourceProduct(prod, sourceCategoriesById, globalSkuSet);
    }

    // 7. Read existing target categories & products (read-only) for idempotent ID mapping
    const [existingTargetCategories, existingTargetProducts] = await Promise.all([
      TargetCategory.find({}).lean(),
      TargetProduct.find({ slug: { $in: CURATED_PRODUCT_SLUGS } }).select('_id slug').lean(),
    ]);

    const existingTargetCatBySlug = new Map(
      existingTargetCategories.map((c) => [String(c.slug).trim().toLowerCase(), c])
    );
    const existingTargetProdBySlug = new Map(
      existingTargetProducts.map((p) => [String(p.slug).trim().toLowerCase(), p])
    );

    // 8. Reconstruct category hierarchy using destination IDs
    const destCatMapBySlug = new Map();
    const categoryOperations = [];

    for (const srcCat of orderedCategories) {
      const existingDest = existingTargetCatBySlug.get(srcCat.slug);
      const destId = existingDest?._id || srcCat._id || new mongoose.Types.ObjectId();

      const parentSrc = srcCat.parentId ? sourceCategoriesById.get(idKey(srcCat.parentId)) : null;
      const parentSlug = parentSrc ? String(parentSrc.slug).trim().toLowerCase() : null;
      const destParent = parentSlug ? destCatMapBySlug.get(parentSlug) : null;

      if (parentSlug && !destParent) {
        throw createMigrationError(
          'UNRESOLVED_DESTINATION_PARENT',
          `Destination parent '${parentSlug}' was not resolved before child '${srcCat.slug}'.`,
          sensitiveUris
        );
      }

      const rebuiltAncestors = destParent
        ? [
            ...(destParent.ancestors || []),
            {
              _id: destParent._id,
              name: destParent.name,
              slug: destParent.slug,
            },
          ]
        : [];
      const rebuiltLevel = destParent ? (destParent.level ?? 0) + 1 : 0;

      const catPayload = {
        name: srcCat.name,
        slug: srcCat.slug,
        description: srcCat.description || '',
        parentId: destParent ? destParent._id : null,
        ancestors: rebuiltAncestors,
        level: rebuiltLevel,
        image: srcCat.image || { url: '', alt: '', publicId: '' },
        displayOrder: srcCat.displayOrder ?? 0,
        isActive: true,
        isFeatured: Boolean(srcCat.isFeatured),
        ...(srcCat.seo ? { seo: srcCat.seo } : {}),
      };

      const resolvedDestCat = { _id: destId, ...catPayload };
      destCatMapBySlug.set(srcCat.slug, resolvedDestCat);

      categoryOperations.push({
        slug: srcCat.slug,
        destId,
        action: existingDest ? 'UPDATE' : 'INSERT',
        payload: catPayload,
      });
    }

    // 9. Build destination product upsert payloads with remapped category & categoryTree
    const productOperations = [];
    const curatedOrderMap = new Map(CURATED_PRODUCT_SLUGS.map((s, idx) => [s, idx]));
    const orderedProducts = [...curatedSourceProducts].sort(
      (a, b) => (curatedOrderMap.get(a.slug) ?? 999) - (curatedOrderMap.get(b.slug) ?? 999)
    );

    for (const srcProd of orderedProducts) {
      const srcCat = sourceCategoriesById.get(idKey(srcProd.category));
      const srcCatSlug = String(srcCat.slug).trim().toLowerCase();
      const destLeafCategory = destCatMapBySlug.get(srcCatSlug);

      if (!destLeafCategory) {
        throw createMigrationError(
          'UNRESOLVED_DESTINATION_CATEGORY',
          `Failed to resolve destination category '${srcCatSlug}' for product '${srcProd.slug}'.`,
          sensitiveUris
        );
      }

      const prodPayload = buildDestinationProductPayload(srcProd, destLeafCategory);
      const existingDestProd = existingTargetProdBySlug.get(prodPayload.slug);

      productOperations.push({
        slug: prodPayload.slug,
        action: existingDestProd ? 'UPDATE' : 'INSERT',
        variantCount: prodPayload.variants.length,
        imageCount: prodPayload.images.length,
        payload: prodPayload,
      });
    }

    // 10. Execute idempotent upserts ONLY when --apply is set
    let categoriesUpserted = 0;
    let productsUpserted = 0;

    if (config.apply) {
      console.log('--- APPLYING CATEGORY UPSERTS (luxecart_staging) ---');
      for (const op of categoryOperations) {
        await TargetCategory.updateOne(
          { slug: op.slug },
          {
            $set: op.payload,
            $setOnInsert: { _id: op.destId },
          },
          { upsert: true }
        );
        categoriesUpserted++;
        console.log(`✔ [${op.action}] Category: ${op.slug} (level ${op.payload.level})`);
      }

      console.log('\n--- APPLYING CURATED PRODUCT UPSERTS (luxecart_staging) ---');
      for (const op of productOperations) {
        await TargetProduct.updateOne(
          { slug: op.slug },
          {
            $set: op.payload,
          },
          { upsert: true }
        );
        productsUpserted++;
        console.log(
          `✔ [${op.action}] Product: ${op.slug} | Variants: ${op.variantCount} | Images: ${op.imageCount} | Status: ${op.payload.status}`
        );
      }
    } else {
      console.log('--- DRY-RUN PLAN SUMMARY (ZERO WRITES EXECUTED) ---');
      console.log(`Categories validated for upsert: ${categoryOperations.length}`);
      console.log(`Products validated for upsert:   ${productOperations.length}`);
      for (const op of productOperations) {
        console.log(
          `  [DRY-RUN ${op.action}] ${op.slug} | Variants: ${op.variantCount} | Images: ${op.imageCount} | CategoryTree depth: ${op.payload.categoryTree.length}`
        );
      }
    }

    console.log('\n[Cloudinary Protection Notice]');
    console.log('  Migrated baseline images preserve existing public IDs under luxecart/products.');
    console.log('  No Cloudinary deletion, rename, or overwrite operations were executed.');
    console.log('  WARNING: Deleting a baseline image via Staging Admin UI destroys the shared Cloudinary asset.');

    return {
      dryRun: config.dryRun,
      apply: config.apply,
      sourceDb: config.sourceDbName,
      targetDb: config.targetDbName,
      categoriesPlanned: categoryOperations.length,
      productsPlanned: productOperations.length,
      categoriesUpserted,
      productsUpserted,
      categoryOperations,
      productOperations,
    };
  } catch (err) {
    throw createMigrationError(
      err.code || 'MIGRATION_FAILED',
      err.message || 'Catalog migration failed',
      sensitiveUris
    );
  } finally {
    if (ownsConnections) {
      if (sourceConn) await sourceConn.close().catch(() => {});
      if (targetConn) await targetConn.close().catch(() => {});
    }
  }
}

// CLI execution entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const getArg = (prefix) => {
    const match = args.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
  };

  const confirmSource = getArg('--confirm-source=');
  const confirmTarget = getArg('--confirm-target=');
  const apply = args.includes('--apply');

  migrateCatalogToStaging({
    confirmSource,
    confirmTarget,
    apply,
  })
    .then((summary) => {
      console.log(
        `\n[Migration ${summary.apply ? 'Completed' : 'Dry-Run Passed'}] Categories: ${summary.categoriesPlanned} planned / ${summary.categoriesUpserted} written | Products: ${summary.productsPlanned} planned / ${summary.productsUpserted} written.`
      );
      process.exit(0);
    })
    .catch((err) => {
      const safeMessage = sanitizeLogMessage(err.message, [
        process.env.SOURCE_MONGODB_URI,
        process.env.TARGET_MONGODB_URI,
      ]);
      console.error(`\n[Migration Aborted] [${err.code || 'ERROR'}] ${safeMessage}`);
      process.exit(1);
    });
}
