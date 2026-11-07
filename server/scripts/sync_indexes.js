/**
 * LUXECART PRODUCTION-SAFE MONGODB INDEX MANAGEMENT UTILITY
 *
 * Operational Rules:
 * 1. Default mode is strictly read-only / dry-run.
 * 2. Never calls Model.syncIndexes().
 * 3. Never drops, prunes, or modifies existing indexes.
 * 4. Never logs unmasked credentials or connection URIs.
 * 5. Requires explicit --apply AND --confirm-db=<exact_database_name> for write execution.
 * 6. Validates collection default collation and exact index options.
 * 7. Executes strict binary preflight blocker checks before authorizing unique index creation.
 * 8. Reports application normalization anomalies separately without blocking binary indexes.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';

// Ensure environment variables are loaded from server/.env or current working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import all 15 Mongoose models
import Address from '../src/modules/addresses/address.model.js';
import Cart from '../src/modules/cart/cart.model.js';
import Category from '../src/modules/categories/category.model.js';
import Content from '../src/modules/content/content.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import ImportJob from '../src/modules/import/importJob.model.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Order from '../src/modules/orders/order.model.js';
import Product from '../src/modules/products/product.model.js';
import Return from '../src/modules/returns/return.model.js';
import Review from '../src/modules/reviews/review.model.js';
import StoreSettings from '../src/modules/settings/storeSettings.model.js';
import SupportTicket from '../src/modules/support/supportTicket.model.js';
import User from '../src/modules/users/user.model.js';
import Wishlist from '../src/modules/wishlist/wishlist.model.js';

export const ALL_MODELS = [
  Address,
  Cart,
  Category,
  Content,
  Coupon,
  ImportJob,
  MockShipment,
  Order,
  Product,
  Return,
  Review,
  StoreSettings,
  SupportTicket,
  User,
  Wishlist,
];

/**
 * Sanitizes MongoDB connection URIs to avoid logging credentials.
 * @param {string} uri
 * @returns {string}
 */
export function maskUri(uri) {
  if (!uri || typeof uri !== 'string') return '[UNDEFINED_URI]';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@]+)(?::([^@]+))?@/i, (match, prefix, user, pass) => {
    return `${prefix}****:****@`;
  });
}

/**
 * Masks an email address for privacy-safe reporting (e.g. j***n@example.com).
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (typeof email !== 'string') return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Redacts sensitive fields (passwords, tokens, phone numbers, customer names, secrets)
 * and masks email addresses recursively to prevent PII exposure in reports.
 * @param {any} data
 * @returns {any}
 */
export function sanitizeForReport(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return maskEmail(data);
    }
    return data;
  }
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeForReport);
  }

  const SENSITIVE_FIELDS = new Set([
    'password',
    'passwordhash',
    'refreshtoken',
    'refreshtokens',
    'resetpasswordtoken',
    'resetpasswordexpire',
    'emailverificationtoken',
    'phone',
    'phonenumber',
    'name',
    'firstname',
    'lastname',
    'otp',
    'secret',
    'token',
  ]);

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey === 'email' || lowerKey.endsWith('email')) {
      sanitized[key] = typeof val === 'string' ? maskEmail(val) : (Array.isArray(val) ? val.map(maskEmail) : '[MASKED_EMAIL]');
    } else if (key === '_id' && typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      sanitized[key] = maskEmail(val);
    } else if (key === 'rawVariants' && Array.isArray(val)) {
      sanitized[key] = val.map((v) => (typeof v === 'string' && v.includes('@') ? maskEmail(v) : v));
    } else {
      sanitized[key] = sanitizeForReport(val);
    }
  }
  return sanitized;
}

/**
 * Recursively checks whether a canonicalized structure contains an unsupported value marker.
 */
export function hasUnsupportedValue(val) {
  if (!val || typeof val !== 'object') return false;
  if (val.__unsupported === true) return true;
  if (Array.isArray(val)) return val.some(hasUnsupportedValue);
  return Object.values(val).some(hasUnsupportedValue);
}

/**
 * Canonicalizes an object or value recursively for deterministic deep comparison.
 * Handles Dates, Regular Expressions, ObjectIds, BSON primitives, nested objects, and arrays.
 * Preserves BSON type distinctions and flags unsupported types.
 */
export function canonicalizeValue(val) {
  if (val === null || val === undefined) return val;

  // Unsupported JS types (functions, symbols)
  if (typeof val === 'function' || typeof val === 'symbol') {
    return { __unsupported: true, type: typeof val };
  }

  // Primitive types (number, string, boolean, bigint)
  if (typeof val !== 'object') {
    return { __type: typeof val, val };
  }

  // Date objects
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    return {
      __type: 'date',
      val: isNaN(val.getTime()) ? 'Invalid Date' : val.toISOString(),
      time: val.getTime(),
    };
  }

  // Regular expressions
  if (val instanceof RegExp || Object.prototype.toString.call(val) === '[object RegExp]') {
    return {
      __type: 'regexp',
      source: val.source,
      flags: val.flags || '',
    };
  }

  // MongoDB ObjectId instances (or ObjectId-like mocks with toHexString or _bsontype)
  if (typeof val.toHexString === 'function' || val._bsontype === 'ObjectID' || val._bsontype === 'ObjectId') {
    const idStr = typeof val.toHexString === 'function' ? val.toHexString() : (val.id ? val.id.toString('hex') : String(val));
    return { __type: 'objectId', val: idStr };
  }

  // Other BSON types with _bsontype (Long, Decimal128, Int32, Double, Timestamp, Binary, etc.)
  if (val._bsontype) {
    const bType = String(val._bsontype);
    if (typeof val.toString === 'function') {
      return { __type: `bson_${bType}`, val: val.toString() };
    }
    return { __unsupported: true, type: `bson_${bType}` };
  }

  // Arrays
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }

  // Plain objects
  const sorted = {};
  const keys = Object.keys(val).sort();
  for (const k of keys) {
    sorted[k] = canonicalizeValue(val[k]);
  }
  return sorted;
}

/**
 * Deep equality helper for index options (partialFilterExpression, collation, weights, etc.)
 * Compares nested structures deterministically regardless of object property ordering.
 * Fails safe (returns false) if either option contains unsupported types.
 */
export function areOptionsEqual(optA, optB) {
  if (!optA && !optB) return true;
  if (!optA || !optB) return false;

  const canA = canonicalizeValue(optA);
  const canB = canonicalizeValue(optB);

  // Fail safe: unsupported values must never be assumed equal
  if (hasUnsupportedValue(canA) || hasUnsupportedValue(canB)) {
    return false;
  }

  if (optA === optB) return true;
  return JSON.stringify(canA) === JSON.stringify(canB);
}

/**
 * Normalizes index keys to check equality regardless of JS object key insertion variations.
 */
export function areKeysEqual(keyA, keyB) {
  if (!keyA || !keyB) return false;
  const entriesA = Object.entries(keyA);
  const entriesB = Object.entries(keyB);
  if (entriesA.length !== entriesB.length) return false;
  for (let i = 0; i < entriesA.length; i++) {
    const [fieldA, valA] = entriesA[i];
    const [fieldB, valB] = entriesB[i];
    if (fieldA !== fieldB) return false;
    if (valA !== valB) return false;
  }
  return true;
}

/**
 * Inspects a collection's default collation options from the database.
 * @param {object} db - MongoDB Database instance
 * @param {string} collectionName
 * @returns {Promise<{ verified: boolean, collation: object|null, isDefaultSimple: boolean, reason?: string }>}
 */
export async function inspectCollectionCollation(db, collectionName) {
  try {
    if (!db || typeof db.listCollections !== 'function') {
      return { verified: false, collation: null, isDefaultSimple: false, reason: 'Database handle not available' };
    }
    const collections = await db.listCollections({ name: collectionName }, { maxTimeMS: 5000 }).toArray();
    if (!collections || collections.length === 0) {
      // Collection does not exist yet; default collation is simple
      return { verified: true, collation: null, isDefaultSimple: true };
    }
    const collInfo = collections[0];
    const collation = collInfo.options?.collation || null;
    return {
      verified: true,
      collation,
      isDefaultSimple: !collation || collation.locale === 'simple',
    };
  } catch (err) {
    return { verified: false, collation: null, isDefaultSimple: false, reason: err.message };
  }
}

/**
 * Registry of all 17 unique-index preflight blocker checks and normalization checks.
 */
export const UNIQUE_INDEX_REGISTRY = {
  'users': {
    email: {
      keyPattern: { email: 1 },
      isSparse: false,
      scalarPaths: ['email'],
      blockerPipeline: [
        { $group: { _id: '$email', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { email: { $type: 'string' } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$email' } } },
            rawVariants: { $addToSet: '$email' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
    googleId: {
      keyPattern: { googleId: 1 },
      isSparse: true,
      scalarPaths: ['googleId'],
      // Sparse index: only indexes documents where googleId field exists in BSON (including null)
      blockerPipeline: [
        { $match: { googleId: { $exists: true } } },
        { $group: { _id: '$googleId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null, // No normalization setter on googleId
    },
  },
  'carts': {
    userId: {
      keyPattern: { userId: 1 },
      isSparse: false,
      scalarPaths: ['userId'],
      blockerPipeline: [
        { $group: { _id: '$userId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null,
    },
  },
  'wishlists': {
    userId: {
      keyPattern: { userId: 1 },
      isSparse: false,
      scalarPaths: ['userId'],
      blockerPipeline: [
        { $group: { _id: '$userId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null,
    },
  },
  'storesettings': {
    singletonKey: {
      keyPattern: { singletonKey: 1 },
      isSparse: false,
      scalarPaths: ['singletonKey'],
      blockerPipeline: [
        {
          $group: {
            _id: '$singletonKey',
            count: { $sum: 1 },
            ids: { $push: '$_id' },
            detectedTypes: { $addToSet: { $type: '$singletonKey' } },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null,
    },
  },
  'categories': {
    slug: {
      keyPattern: { slug: 1 },
      isSparse: false,
      scalarPaths: ['slug'],
      blockerPipeline: [
        { $group: { _id: '$slug', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { slug: { $type: 'string' } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$slug' } } },
            rawVariants: { $addToSet: '$slug' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
  },
  'products': {
    slug: {
      keyPattern: { slug: 1 },
      isSparse: false,
      scalarPaths: ['slug'],
      blockerPipeline: [
        { $group: { _id: '$slug', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { slug: { $type: 'string' } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$slug' } } },
            rawVariants: { $addToSet: '$slug' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
    'variants.sku': {
      keyPattern: { 'variants.sku': 1 },
      isSparse: true,
      scalarPaths: ['variants.sku'], // variants is expected array; variants.sku inside elements must be scalar
      // Cross-document duplicate SKU check (blocks index build only if distinct product documents share a SKU)
      blockerPipeline: [
        { $unwind: '$variants' },
        { $match: { 'variants.sku': { $exists: true } } },
        {
          $group: {
            _id: '$variants.sku',
            distinctProductIds: { $addToSet: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$distinctProductIds' }, 1] } } },
      ],
      // Normalization anomaly check: case/trim anomalies across products OR repeated SKUs inside one product
      anomalyPipeline: [
        { $unwind: '$variants' },
        { $match: { 'variants.sku': { $exists: true } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$variants.sku' } } },
            rawVariants: { $addToSet: '$variants.sku' },
            distinctProductIds: { $addToSet: '$_id' },
            totalVariants: { $sum: 1 },
          },
        },
        {
          $match: {
            $or: [
              { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } },
              { $expr: { $gt: ['$totalVariants', { $size: '$distinctProductIds' }] } },
            ],
          },
        },
      ],
    },
  },
  'coupons': {
    code: {
      keyPattern: { code: 1 },
      isSparse: false,
      scalarPaths: ['code'],
      blockerPipeline: [
        { $group: { _id: '$code', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { code: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$code' } } },
            rawVariants: { $addToSet: '$code' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
  },
  'orders': {
    orderNumber: {
      keyPattern: { orderNumber: 1 },
      isSparse: false,
      scalarPaths: ['orderNumber'],
      blockerPipeline: [
        { $group: { _id: '$orderNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { orderNumber: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$orderNumber' } } },
            rawVariants: { $addToSet: '$orderNumber' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
    'userId_idempotencyKey': {
      keyPattern: { userId: 1, idempotencyKey: 1 },
      isSparse: false,
      scalarPaths: ['userId', 'idempotencyKey'],
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      blockerPipeline: [
        { $match: { idempotencyKey: { $type: 'string' } } },
        {
          $group: {
            _id: { userId: '$userId', idempotencyKey: '$idempotencyKey' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { idempotencyKey: { $type: 'string' } } },
        {
          $group: {
            _id: { userId: '$userId', trimmedKey: { $trim: { input: '$idempotencyKey' } } },
            rawKeys: { $addToSet: '$idempotencyKey' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawKeys' }, 1] } } },
      ],
    },
  },
  'returns': {
    returnNumber: {
      keyPattern: { returnNumber: 1 },
      isSparse: false,
      scalarPaths: ['returnNumber'],
      blockerPipeline: [
        { $group: { _id: '$returnNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { returnNumber: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$returnNumber' } } },
            rawVariants: { $addToSet: '$returnNumber' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
  },
  'reviews': {
    'productId_userId': {
      keyPattern: { productId: 1, userId: 1 },
      isSparse: false,
      scalarPaths: ['productId', 'userId'],
      blockerPipeline: [
        {
          $group: {
            _id: { productId: '$productId', userId: '$userId' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null,
    },
  },
  'supporttickets': {
    ticketNumber: {
      keyPattern: { ticketNumber: 1 },
      isSparse: false,
      scalarPaths: ['ticketNumber'],
      blockerPipeline: [
        { $group: { _id: '$ticketNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { ticketNumber: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$ticketNumber' } } },
            rawVariants: { $addToSet: '$ticketNumber' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
  },
  'mockshipments': {
    orderId: {
      keyPattern: { orderId: 1 },
      isSparse: false,
      scalarPaths: ['orderId'],
      blockerPipeline: [
        { $group: { _id: '$orderId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: null,
    },
    orderNumber: {
      keyPattern: { orderNumber: 1 },
      isSparse: false,
      scalarPaths: ['orderNumber'],
      blockerPipeline: [
        { $group: { _id: '$orderNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { orderNumber: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$orderNumber' } } },
            rawVariants: { $addToSet: '$orderNumber' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
    awbNumber: {
      keyPattern: { awbNumber: 1 },
      isSparse: false,
      scalarPaths: ['awbNumber'],
      blockerPipeline: [
        { $group: { _id: '$awbNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ],
      anomalyPipeline: [
        { $match: { awbNumber: { $type: 'string' } } },
        {
          $group: {
            _id: { $toUpper: { $trim: { input: '$awbNumber' } } },
            rawVariants: { $addToSet: '$awbNumber' },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        { $match: { $expr: { $gt: [{ $size: '$rawVariants' }, 1] } } },
      ],
    },
  },
};

/**
 * Detects if any document in the collection contains unexpected array-valued data
 * on schema paths that are defined as scalar.
 * Fails closed: returns verified: false on any query error or missing collection handle.
 * @param {object} collection - MongoDB Collection instance
 * @param {Array<string>} scalarPaths - Array of scalar field path strings
 * @returns {Promise<{ verified: boolean, hasUnexpectedArray: boolean, affectedCount: number, affectedDocs: Array<object>, error?: string }>}
 */
export async function checkUnexpectedArrays(collection, scalarPaths) {
  if (!scalarPaths || scalarPaths.length === 0) {
    return { verified: true, hasUnexpectedArray: false, affectedCount: 0, affectedDocs: [] };
  }
  if (!collection || typeof collection.find !== 'function') {
    return { verified: false, hasUnexpectedArray: false, affectedCount: 0, affectedDocs: [], error: 'Collection handle not available' };
  }

  const conditions = scalarPaths.map((p) => ({ [p]: { $type: 'array' } }));
  const query = conditions.length === 1 ? conditions[0] : { $or: conditions };

  try {
    const projection = { _id: 1 };
    for (const p of scalarPaths) {
      projection[p] = 1;
    }
    const cursorOrPromise = collection.find(query, { projection, maxTimeMS: 5000 });
    const cursor = (cursorOrPromise && typeof cursorOrPromise.then === 'function') ? await cursorOrPromise : cursorOrPromise;
    const docs = typeof cursor?.toArray === 'function' ? await cursor.toArray() : (Array.isArray(cursor) ? cursor : []);

    return {
      verified: true,
      hasUnexpectedArray: docs.length > 0,
      affectedCount: docs.length,
      affectedDocs: sanitizeForReport(docs),
    };
  } catch (err) {
    return {
      verified: false,
      hasUnexpectedArray: false,
      affectedCount: 0,
      affectedDocs: [],
      error: err.message,
    };
  }
}

/**
 * Runs the unique index blocker check for a specific unique index.
 * @param {object} collection - MongoDB Collection instance
 * @param {object} preflightConfig
 * @returns {Promise<{ passed: boolean, duplicateCount: number, duplicates: Array<object>, error?: string }>}
 */
export async function runUniquePreflightBlocker(collection, preflightConfig) {
  try {
    if (!collection || typeof collection.aggregate !== 'function') {
      return { passed: false, duplicateCount: 0, duplicates: [], error: 'Collection handle not available' };
    }
    const cursorOrPromise = collection.aggregate(preflightConfig.blockerPipeline, {
      collation: { locale: 'simple' },
      maxTimeMS: 5000,
    });
    const cursor = (cursorOrPromise && typeof cursorOrPromise.then === 'function') ? await cursorOrPromise : cursorOrPromise;
    const results = typeof cursor?.toArray === 'function' ? await cursor.toArray() : (Array.isArray(cursor) ? cursor : []);

    return {
      passed: results.length === 0,
      duplicateCount: results.length,
      duplicates: sanitizeForReport(results),
    };
  } catch (err) {
    return { passed: false, duplicateCount: 0, duplicates: [], error: err.message };
  }
}

/**
 * Runs the informational normalization anomaly check.
 * @param {object} collection
 * @param {object} preflightConfig
 * @returns {Promise<{ hasAnomalies: boolean, anomalyCount: number, anomalies: Array<object>, error?: string }>}
 */
export async function runNormalizationAnomalyCheck(collection, preflightConfig) {
  if (!preflightConfig.anomalyPipeline) {
    return { hasAnomalies: false, anomalyCount: 0, anomalies: [] };
  }
  try {
    if (!collection || typeof collection.aggregate !== 'function') {
      return { hasAnomalies: false, anomalyCount: 0, anomalies: [], error: 'Collection handle not available' };
    }
    const cursorOrPromise = collection.aggregate(preflightConfig.anomalyPipeline, {
      collation: { locale: 'simple' },
      maxTimeMS: 5000,
    });
    const cursor = (cursorOrPromise && typeof cursorOrPromise.then === 'function') ? await cursorOrPromise : cursorOrPromise;
    const results = typeof cursor?.toArray === 'function' ? await cursor.toArray() : (Array.isArray(cursor) ? cursor : []);

    return {
      hasAnomalies: results.length > 0,
      anomalyCount: results.length,
      anomalies: sanitizeForReport(results),
    };
  } catch (err) {
    return { hasAnomalies: false, anomalyCount: 0, anomalies: [], error: err.message };
  }
}

/**
 * Compares declared schema indexes against actual live indexes in the collection.
 * @param {Array<Array>} declaredIndexes - Schema indexes from model.schema.indexes()
 * @param {Array<object>} existingIndexes - Actual indexes from collection.indexes()
 * @param {boolean} isCollationVerified - Whether collection collation is verified
 * @returns {Array<object>} Classified index inventory
 */
export function compareIndexes(declaredIndexes, existingIndexes, isCollationVerified = true) {
  const inventory = [];

  for (const [keyPattern, options] of declaredIndexes) {
    const isUnique = Boolean(options && options.unique);
    const isSparse = Boolean(options && options.sparse);
    const isText = Object.values(keyPattern).includes('text');
    const partialFilter = options?.partialFilterExpression;
    const declaredCollation = options?.collation;

    if (!isCollationVerified) {
      inventory.push({
        keyPattern,
        options: options || {},
        status: 'NOT_VERIFIED',
        reason: 'Collection collation could not be established',
        existingIndex: null,
      });
      continue;
    }

    // Find matching existing index
    let matchedExisting = null;

    if (isText) {
      matchedExisting = existingIndexes.find(
        (ex) =>
          ex.key &&
          (ex.key._fts === 'text' || Object.values(ex.key).includes('text')) &&
          (ex.name === options?.name || areOptionsEqual(ex.weights, options?.weights))
      );
    } else {
      matchedExisting = existingIndexes.find((ex) => areKeysEqual(ex.key, keyPattern));
    }

    if (!matchedExisting) {
      inventory.push({
        keyPattern,
        options: options || {},
        status: 'MISSING',
        reason: 'Index does not exist in collection',
        existingIndex: null,
      });
      continue;
    }

    // Compare relevant options
    const existingIsUnique = Boolean(matchedExisting.unique);
    const existingIsSparse = Boolean(matchedExisting.sparse);
    const existingPartialFilter = matchedExisting.partialFilterExpression;
    const existingCollation = matchedExisting.collation;

    const uniqueMatches = isUnique === existingIsUnique;
    const sparseMatches = isSparse === existingIsSparse;
    const partialMatches = areOptionsEqual(partialFilter, existingPartialFilter);
    const collationMatches = areOptionsEqual(declaredCollation, existingCollation);

    if (uniqueMatches && sparseMatches && partialMatches && collationMatches) {
      inventory.push({
        keyPattern,
        options: options || {},
        status: 'PRESENT_AND_MATCHING',
        reason: 'Key pattern and all relevant options match database',
        existingIndex: matchedExisting,
      });
    } else {
      const optionDiffs = [];
      if (!uniqueMatches) optionDiffs.push(`unique (declared: ${isUnique}, db: ${existingIsUnique})`);
      if (!sparseMatches) optionDiffs.push(`sparse (declared: ${isSparse}, db: ${existingIsSparse})`);
      if (!partialMatches) optionDiffs.push('partialFilterExpression mismatch');
      if (!collationMatches) optionDiffs.push('collation mismatch');

      inventory.push({
        keyPattern,
        options: options || {},
        status: 'PRESENT_WITH_DIFFERENT_OPTIONS',
        reason: `Options differ: ${optionDiffs.join('; ')}`,
        existingIndex: matchedExisting,
      });
    }
  }

  return inventory;
}

/**
 * Main index synchronization execution engine.
 * @param {object} options
 * @param {object} [options.db] - Optional injected db instance (for testing/dry-run without Atlas)
 * @param {boolean} [options.apply=false] - Whether to apply missing index creation
 * @param {string} [options.confirmDb] - Exact DB name confirmation required for apply mode
 * @param {string} [options.collectionFilter] - Optional collection filter
 * @param {boolean} [options.silent=false] - Suppress console output
 * @returns {Promise<object>} Run summary report
 */
export async function runIndexSync({
  db: injectedDb = null,
  apply = false,
  confirmDb = null,
  collectionFilter = null,
  silent = false,
} = {}) {
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('\n' + '='.repeat(78));
  log('         LUXECART SAFE PRODUCTION MONGODB INDEX MANAGEMENT UTILITY         ');
  log('='.repeat(78));

  let db = injectedDb;
  let shouldCloseConnection = false;

  if (!db) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required when no db instance is injected.');
    }
    log(`[Mode] Connecting to MongoDB: ${maskUri(mongoUri)}`);
    const conn = await connectDB(mongoUri, { isProduction: true });
    db = conn.connection.db;
    shouldCloseConnection = true;
  }

  const activeDbName = db.databaseName || (db.client && db.client.s && db.client.s.options && db.client.s.options.dbName) || 'unknown';
  log(`[Database] Active Connected Database: ${activeDbName}`);

  // Safety Gate: Validate confirmation flags if apply is requested
  const isApplyMode = Boolean(apply);
  if (isApplyMode) {
    if (!confirmDb) {
      throw new Error(
        `APPLY ABORTED: Missing required confirmation flag '--confirm-db=<database_name>'. ` +
        `To create missing indexes, you must explicitly confirm the target database name: --confirm-db=${activeDbName}`
      );
    }
    if (confirmDb !== activeDbName) {
      throw new Error(
        `APPLY ABORTED: Database confirmation mismatch! Expected '--confirm-db=${activeDbName}', but received '--confirm-db=${confirmDb}'. ` +
        `Refusing to modify indexes on an unconfirmed database.`
      );
    }
    log(`[SAFETY GATE PASSED] Confirmed target database: '${activeDbName}'. Apply mode is ACTIVE.`);
  } else {
    log(`[Mode] DRY-RUN / READ-ONLY MODE. No database writes, modifications, or drops will occur.`);
  }

  const report = {
    databaseName: activeDbName,
    isApplyMode,
    collections: {},
    totals: {
      declared: 0,
      matching: 0,
      initiallyMissing: 0,
      eligible: 0,
      missing: 0,
      differentOptions: 0,
      conflictingData: 0,
      notVerified: 0,
      created: 0,
      failed: 0, // Strict tracking: incremented on any index creation failure
      dropped: 0, // Strict invariant: must always be 0
    },
    normalizationAnomalies: [],
    preflightBlockers: [],
    safetyConfirmation: 'Zero indexes were deleted, dropped, or modified.',
  };

  const modelsToProcess = collectionFilter
    ? ALL_MODELS.filter((m) => m.collection.name === collectionFilter)
    : ALL_MODELS;

  if (modelsToProcess.length === 0) {
    log(`[Warning] No matching models found for filter: '${collectionFilter}'`);
    return report;
  }

  for (const model of modelsToProcess) {
    const collName = model.collection.name;
    const modelName = model.modelName;
    const collectionHandle = db.collection(collName);

    log(`\n--- Inspecting Collection: ${collName} (${modelName}) ---`);

    // 1. Inspect Collection Default Collation
    const collationInfo = await inspectCollectionCollation(db, collName);
    const collationDisplay = collationInfo.collation
      ? JSON.stringify(collationInfo.collation)
      : 'simple (binary default)';
    log(`  Collation: ${collationDisplay} [Verified: ${collationInfo.verified}]`);

    // 2. Fetch Existing Indexes from Database
    let existingIndexes = [];
    let isInventoryVerified = true;
    let inventoryError = null;
    try {
      existingIndexes = await collectionHandle.indexes({ maxTimeMS: 5000 });
    } catch (err) {
      isInventoryVerified = false;
      inventoryError = err.message;
      log(`  ✖ [INVENTORY_ERROR] Unable to retrieve existing indexes for ${collName}: ${err.message}`);
    }

    log(`  Existing Database Indexes: ${isInventoryVerified ? existingIndexes.length : '[UNVERIFIED]'}`);

    // 3. Compare Declared Schema Indexes vs Existing Database Indexes
    const declaredIndexes = model.schema.indexes();
    report.totals.declared += declaredIndexes.length;

    let classifiedInventory = [];
    if (!isInventoryVerified) {
      // REV-02: Fail closed on inventory retrieval failure. Never replace with [].
      // Mark all declared indexes as NOT_VERIFIED and do not classify as missing.
      for (const [keyPattern, options] of declaredIndexes) {
        classifiedInventory.push({
          keyPattern,
          options: options || {},
          status: 'NOT_VERIFIED',
          reason: `Collection index inventory failed: ${inventoryError}`,
          existingIndex: null,
          eligibleForCreation: false,
        });
        report.totals.notVerified++;
      }
    } else {
      classifiedInventory = compareIndexes(declaredIndexes, existingIndexes, collationInfo.verified);
      for (const item of classifiedInventory) {
        if (item.status === 'MISSING') {
          report.totals.initiallyMissing++;
        }
      }
    }

    // 4. Run Preflight Blocker Checks for Missing Unique Indexes (only if inventory is verified)
    const preflightConfigs = UNIQUE_INDEX_REGISTRY[collName] || {};

    if (isInventoryVerified) {
      for (const item of classifiedInventory) {
        if (item.status === 'PRESENT_AND_MATCHING') {
          report.totals.matching++;
        } else if (item.status === 'PRESENT_WITH_DIFFERENT_OPTIONS') {
          report.totals.differentOptions++;
        } else if (item.status === 'NOT_VERIFIED') {
          report.totals.notVerified++;
        } else if (item.status === 'MISSING') {
          // Check if this missing index is a declared unique index
          const isUnique = Boolean(item.options && item.options.unique);
          if (isUnique) {
            // Find corresponding preflight configuration
            const uniqueKeyName = Object.keys(item.keyPattern).join('_');
            const preflightConfig =
              preflightConfigs[uniqueKeyName] ||
              Object.values(preflightConfigs).find((cfg) => areKeysEqual(cfg.keyPattern, item.keyPattern));

            if (preflightConfig) {
              // SEC-IDX-01, SEC-IDX-04, and REV-01: Explicitly check for unexpected array-valued fields on scalar paths
              const arrayCheck = await checkUnexpectedArrays(collectionHandle, preflightConfig.scalarPaths);
              if (!arrayCheck.verified) {
                // REV-01: Fail closed on array inspection query failure
                item.status = 'NOT_VERIFIED';
                item.reason = `Array preflight inspection failed: ${arrayCheck.error || 'Unknown query error'}. Refusing index creation.`;
                item.eligibleForCreation = false;
                report.totals.notVerified++;
              } else if (arrayCheck.hasUnexpectedArray) {
                item.status = 'CONFLICTING_DATA';
                item.reason = `Unexpected array-valued data detected on scalar path(s): ${preflightConfig.scalarPaths.join(', ')} (${arrayCheck.affectedCount} documents affected). Refusing index creation.`;
                item.eligibleForCreation = false;
                report.totals.conflictingData++;
                report.preflightBlockers.push({
                  collection: collName,
                  keyPattern: item.keyPattern,
                  type: 'UNEXPECTED_ARRAY_IN_SCALAR_PATH',
                  scalarPaths: preflightConfig.scalarPaths,
                  duplicateCount: arrayCheck.affectedCount,
                  duplicates: arrayCheck.affectedDocs,
                });
              } else {
                // Run exact binary blocker check
                const blockerRes = await runUniquePreflightBlocker(collectionHandle, preflightConfig);
                if (blockerRes.error) {
                  item.status = 'NOT_VERIFIED';
                  item.reason = `Unique key blocker aggregation failed: ${blockerRes.error}. Refusing index creation.`;
                  item.eligibleForCreation = false;
                  report.totals.notVerified++;
                } else if (!blockerRes.passed) {
                  item.status = 'CONFLICTING_DATA';
                  item.reason = `Unique key collision detected in existing data (${blockerRes.duplicateCount} conflicting keys).`;
                  item.eligibleForCreation = false;
                  report.totals.conflictingData++;
                  report.preflightBlockers.push({
                    collection: collName,
                    keyPattern: item.keyPattern,
                    type: 'EXACT_BINARY_DUPLICATE_KEY',
                    duplicateCount: blockerRes.duplicateCount,
                    duplicates: blockerRes.duplicates,
                  });
                } else {
                  item.eligibleForCreation = true;
                  report.totals.eligible++;
                  report.totals.missing++;
                }

                // Run informational normalization anomaly check
                const anomalyRes = await runNormalizationAnomalyCheck(collectionHandle, preflightConfig);
                if (anomalyRes.hasAnomalies) {
                  report.normalizationAnomalies.push({
                    collection: collName,
                    keyPattern: item.keyPattern,
                    anomalyCount: anomalyRes.anomalyCount,
                    anomalies: anomalyRes.anomalies,
                  });
                }
              }
            } else {
              // Unique index lacks verified preflight definition
              item.status = 'NOT_VERIFIED';
              item.reason = 'Unique index lacks verified preflight validation configuration.';
              item.eligibleForCreation = false;
              report.totals.notVerified++;
            }
          } else {
            item.eligibleForCreation = true;
            report.totals.eligible++;
            report.totals.missing++;
          }
        }
      }
    }

    // 5. In Apply Mode: Create Eligible Missing Indexes
    for (const item of classifiedInventory) {
      if (isApplyMode && item.eligibleForCreation && item.status === 'MISSING') {
        try {
          const createOptions = {};
          if (item.options.name) createOptions.name = item.options.name;
          if (item.options.unique) createOptions.unique = true;
          if (item.options.sparse) createOptions.sparse = true;
          if (item.options.partialFilterExpression) createOptions.partialFilterExpression = item.options.partialFilterExpression;
          if (item.options.collation) createOptions.collation = item.options.collation;
          if (item.options.weights) createOptions.weights = item.options.weights;

          await collectionHandle.createIndex(item.keyPattern, createOptions);
          item.status = 'CREATED';
          report.totals.created++;
          report.totals.missing--;
          log(`  ✔ [CREATED] Index created on ${JSON.stringify(item.keyPattern)} with options: ${JSON.stringify(createOptions)}`);
        } catch (err) {
          item.status = 'CREATION_FAILED';
          item.error = err.message;
          report.totals.failed++;
          log(`  ✖ [CREATION_FAILED] ${JSON.stringify(item.keyPattern)}: ${err.message}`);
        }
      }
    }

    report.collections[collName] = {
      modelName,
      defaultCollation: collationDisplay,
      isCollationVerified: collationInfo.verified,
      isInventoryVerified,
      inventoryError: inventoryError || null,
      existingCount: isInventoryVerified ? existingIndexes.length : null,
      declaredCount: declaredIndexes.length,
      inventory: classifiedInventory,
    };

    // Print Status Table for this Collection
    for (const item of classifiedInventory) {
      const badge =
        item.status === 'PRESENT_AND_MATCHING' ? '✔ [MATCHING]' :
        item.status === 'CREATED' ? '✔ [CREATED]' :
        item.status === 'MISSING' ? '✚ [MISSING]' :
        item.status === 'PRESENT_WITH_DIFFERENT_OPTIONS' ? '⚠ [DIFF_OPTIONS]' :
        item.status === 'CONFLICTING_DATA' ? '✖ [CONFLICTING_DATA]' :
        '❓ [NOT_VERIFIED]';

      log(`    ${badge} ${JSON.stringify(item.keyPattern)} -> ${item.status} (${item.reason || ''})`);
    }
  }

  // Summary Reporting
  log('\n' + '='.repeat(78));
  log('                           FINAL SYNCHRONIZATION SUMMARY                           ');
  log('='.repeat(78));
  log(`Total Declared Indexes Inspected: ${report.totals.declared}`);
  log(`  - Present & Matching:           ${report.totals.matching}`);
  log(`  - Present w/ Different Options: ${report.totals.differentOptions}`);
  log(`  - Conflicting Data (Blocked):   ${report.totals.conflictingData}`);
  log(`  - Not Verified (Unverified):    ${report.totals.notVerified}`);
  log(`  - Initially Missing:            ${report.totals.initiallyMissing}`);
  log(`  - Eligible for Creation:        ${report.totals.eligible}`);
  if (isApplyMode) {
    log(`  - Successfully Created:         ${report.totals.created}`);
    log(`  - Creation Failures (Failed):   ${report.totals.failed}`);
    log(`  - Remaining Missing After Run:  ${report.totals.missing}`);
  } else {
    log(`  - Missing & Ready to Create:    ${report.totals.eligible}`);
  }
  log(`  - Indexes Dropped / Pruned:     ${report.totals.dropped} (Strict invariant: never drops)`);

  if (report.preflightBlockers.length > 0) {
    log('\n' + '!'.repeat(78));
    log(`  CRITICAL: ${report.preflightBlockers.length} UNIQUE INDEX BLOCKERS DETECTED`);
    log('!'.repeat(78));
    for (const blocker of report.preflightBlockers) {
      log(`  Collection: '${blocker.collection}', Key: ${JSON.stringify(blocker.keyPattern)}`);
      log(`  Duplicate Records (${blocker.duplicateCount}):`, JSON.stringify(sanitizeForReport(blocker.duplicates), null, 2));
    }
  }

  if (report.normalizationAnomalies.length > 0) {
    log('\n' + '-'.repeat(78));
    log(`  INFORMATIONAL: ${report.normalizationAnomalies.length} NORMALIZATION ANOMALIES (Non-blocking)`);
    log('-'.repeat(78));
    for (const anomaly of report.normalizationAnomalies) {
      log(`  Collection: '${anomaly.collection}', Key: ${JSON.stringify(anomaly.keyPattern)}`);
      log(`  Anomaly Count: ${anomaly.anomalyCount}`);
      if (anomaly.anomalies && anomaly.anomalies.length > 0) {
        log(`  Sample Anomalies (Masked):`, JSON.stringify(sanitizeForReport(anomaly.anomalies.slice(0, 3)), null, 2));
      }
    }
  }

  log('\n[SAFETY CONFIRMATION] ' + report.safetyConfirmation);
  log('='.repeat(78) + '\n');

  if (shouldCloseConnection) {
    await disconnectDB();
  }

  return report;
}

// CLI Execution Entry Point
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const args = process.argv.slice(2);
  const applyFlag = args.includes('--apply');
  const confirmDbArg = args.find((a) => a.startsWith('--confirm-db='));
  const confirmDb = confirmDbArg ? confirmDbArg.split('=')[1] : null;
  const collectionArg = args.find((a) => a.startsWith('--collection='));
  const collectionFilter = collectionArg ? collectionArg.split('=')[1] : null;

  runIndexSync({
    apply: applyFlag,
    confirmDb,
    collectionFilter,
  })
    .then((report) => {
      if (
        report.totals.conflictingData > 0 ||
        report.totals.failed > 0 ||
        report.totals.notVerified > 0
      ) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error('\n✖ Fatal Index Management Error:', err.message);
      process.exit(1);
    });
}
