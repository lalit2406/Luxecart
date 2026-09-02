import mongoose from 'mongoose';
import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_CONTENT_SORT_FIELDS,
} from '../modules/content/content.constants.js';

const PROHIBITED_FIELDS = [
  'userId',
  'createdBy',
  'updatedBy',
  'ownerId',
  'password',
  'token',
  'price',
  'pricing',
  'cost',
  'inventory',
  'stock',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
];

const URL_OR_PATH_REGEX = /^(https?:\/\/|\/|\.\/)[^\s]+$/;

/**
 * Validate Admin Content Creation
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCreateContent = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited injected fields
  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied by client`);
    }
  }

  // 1. Type (Required enum)
  if (!body.type || typeof body.type !== 'string') {
    errors.push('Content type is required');
  } else {
    const cleanType = String(body.type).trim().toUpperCase();
    if (!ALLOWED_CONTENT_TYPES.includes(cleanType)) {
      errors.push(`Invalid content type '${body.type}'. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    } else {
      sanitized.type = cleanType;
    }
  }

  // 2. Title (Required string, max 200)
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    errors.push('Title is required');
  } else {
    const cleanTitle = body.title.trim();
    if (cleanTitle.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    } else {
      sanitized.title = cleanTitle;
    }
  }

  // 3. Subtitle (Optional string, max 500)
  if (body.subtitle !== undefined && body.subtitle !== null) {
    if (typeof body.subtitle !== 'string') {
      errors.push('Subtitle must be a string');
    } else {
      const cleanSub = body.subtitle.trim();
      if (cleanSub.length > 500) {
        errors.push('Subtitle cannot exceed 500 characters');
      } else {
        sanitized.subtitle = cleanSub;
      }
    }
  } else {
    sanitized.subtitle = '';
  }

  // 4. Image URL (Optional string, max 2000)
  if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== '') {
    if (typeof body.imageUrl !== 'string') {
      errors.push('imageUrl must be a string');
    } else {
      const cleanUrl = body.imageUrl.trim();
      if (cleanUrl.length > 2000) {
        errors.push('imageUrl cannot exceed 2000 characters');
      } else if (!URL_OR_PATH_REGEX.test(cleanUrl)) {
        errors.push('imageUrl must be a valid URL or path');
      } else {
        sanitized.imageUrl = cleanUrl;
      }
    }
  } else {
    sanitized.imageUrl = '';
  }

  // 5. Mobile Image URL (Optional string, max 2000)
  if (body.mobileImageUrl !== undefined && body.mobileImageUrl !== null && body.mobileImageUrl !== '') {
    if (typeof body.mobileImageUrl !== 'string') {
      errors.push('mobileImageUrl must be a string');
    } else {
      const cleanMobUrl = body.mobileImageUrl.trim();
      if (cleanMobUrl.length > 2000) {
        errors.push('mobileImageUrl cannot exceed 2000 characters');
      } else if (!URL_OR_PATH_REGEX.test(cleanMobUrl)) {
        errors.push('mobileImageUrl must be a valid URL or path');
      } else {
        sanitized.mobileImageUrl = cleanMobUrl;
      }
    }
  } else {
    sanitized.mobileImageUrl = '';
  }

  // 6. CTA Text (Optional string, max 100)
  if (body.ctaText !== undefined && body.ctaText !== null) {
    if (typeof body.ctaText !== 'string') {
      errors.push('ctaText must be a string');
    } else {
      const cleanCta = body.ctaText.trim();
      if (cleanCta.length > 100) {
        errors.push('ctaText cannot exceed 100 characters');
      } else {
        sanitized.ctaText = cleanCta;
      }
    }
  } else {
    sanitized.ctaText = '';
  }

  // 7. CTA Link (Optional string, max 500)
  if (body.ctaLink !== undefined && body.ctaLink !== null && body.ctaLink !== '') {
    if (typeof body.ctaLink !== 'string') {
      errors.push('ctaLink must be a string');
    } else {
      const cleanLink = body.ctaLink.trim();
      if (cleanLink.length > 500) {
        errors.push('ctaLink cannot exceed 500 characters');
      } else {
        sanitized.ctaLink = cleanLink;
      }
    }
  } else {
    sanitized.ctaLink = '';
  }

  // 8. Display Order (Optional integer >= 0, default 0)
  if (body.displayOrder !== undefined && body.displayOrder !== null) {
    const orderNum = Number(body.displayOrder);
    if (!Number.isInteger(orderNum) || orderNum < 0) {
      errors.push('displayOrder must be a non-negative integer');
    } else {
      sanitized.displayOrder = orderNum;
    }
  } else {
    sanitized.displayOrder = 0;
  }

  // 9. isActive (Optional boolean, default true)
  if (body.isActive !== undefined && body.isActive !== null) {
    if (typeof body.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    } else {
      sanitized.isActive = body.isActive;
    }
  } else {
    sanitized.isActive = true;
  }

  // 10. Start Date & End Date (Optional Dates)
  let start = null;
  let end = null;

  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '') {
    const parsedStart = new Date(body.startDate);
    if (isNaN(parsedStart.getTime())) {
      errors.push('startDate must be a valid ISO date');
    } else {
      start = parsedStart;
      sanitized.startDate = parsedStart;
    }
  } else {
    sanitized.startDate = null;
  }

  if (body.endDate !== undefined && body.endDate !== null && body.endDate !== '') {
    const parsedEnd = new Date(body.endDate);
    if (isNaN(parsedEnd.getTime())) {
      errors.push('endDate must be a valid ISO date');
    } else {
      end = parsedEnd;
      sanitized.endDate = parsedEnd;
    }
  } else {
    sanitized.endDate = null;
  }

  if (start && end && end < start) {
    errors.push('endDate cannot be before startDate');
  }

  // 11. Target Category ID (Optional ObjectId)
  if (body.targetCategoryId !== undefined && body.targetCategoryId !== null && body.targetCategoryId !== '') {
    const catIdStr = String(body.targetCategoryId).trim();
    if (!mongoose.Types.ObjectId.isValid(catIdStr) || !/^[0-9a-fA-F]{24}$/.test(catIdStr)) {
      errors.push('targetCategoryId must be a valid 24-character hexadecimal ObjectId');
    } else {
      sanitized.targetCategoryId = new mongoose.Types.ObjectId(catIdStr);
    }
  } else {
    sanitized.targetCategoryId = null;
  }

  // 12. Target Product IDs (Optional array of ObjectIds)
  if (body.targetProductIds !== undefined && body.targetProductIds !== null) {
    if (!Array.isArray(body.targetProductIds)) {
      errors.push('targetProductIds must be an array of ObjectIds');
    } else {
      const productIds = [];
      for (const pId of body.targetProductIds) {
        const pIdStr = String(pId).trim();
        if (!mongoose.Types.ObjectId.isValid(pIdStr) || !/^[0-9a-fA-F]{24}$/.test(pIdStr)) {
          errors.push(`Invalid product ID '${pId}' in targetProductIds`);
        } else {
          productIds.push(new mongoose.Types.ObjectId(pIdStr));
        }
      }
      sanitized.targetProductIds = productIds;
    }
  } else {
    sanitized.targetProductIds = [];
  }

  // 13. Metadata (Optional key-value object of strings)
  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      errors.push('metadata must be an object');
    } else {
      const metaObj = {};
      for (const [key, value] of Object.entries(body.metadata)) {
        if (typeof key === 'string' && key.length <= 50) {
          metaObj[key] = String(value).slice(0, 500);
        }
      }
      sanitized.metadata = metaObj;
    }
  } else {
    sanitized.metadata = {};
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate Admin Content Update
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateUpdateContent = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited injected fields
  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied by client`);
    }
  }

  // 1. Type
  if (body.type !== undefined) {
    const cleanType = String(body.type).trim().toUpperCase();
    if (!ALLOWED_CONTENT_TYPES.includes(cleanType)) {
      errors.push(`Invalid content type '${body.type}'. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    } else {
      sanitized.type = cleanType;
    }
  }

  // 2. Title
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      errors.push('Title cannot be empty');
    } else {
      const cleanTitle = body.title.trim();
      if (cleanTitle.length > 200) {
        errors.push('Title cannot exceed 200 characters');
      } else {
        sanitized.title = cleanTitle;
      }
    }
  }

  // 3. Subtitle
  if (body.subtitle !== undefined) {
    if (body.subtitle === null) {
      sanitized.subtitle = '';
    } else if (typeof body.subtitle !== 'string') {
      errors.push('Subtitle must be a string');
    } else {
      const cleanSub = body.subtitle.trim();
      if (cleanSub.length > 500) {
        errors.push('Subtitle cannot exceed 500 characters');
      } else {
        sanitized.subtitle = cleanSub;
      }
    }
  }

  // 4. Image URL
  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null || body.imageUrl === '') {
      sanitized.imageUrl = '';
    } else if (typeof body.imageUrl !== 'string') {
      errors.push('imageUrl must be a string');
    } else {
      const cleanUrl = body.imageUrl.trim();
      if (cleanUrl.length > 2000) {
        errors.push('imageUrl cannot exceed 2000 characters');
      } else if (!URL_OR_PATH_REGEX.test(cleanUrl)) {
        errors.push('imageUrl must be a valid URL or path');
      } else {
        sanitized.imageUrl = cleanUrl;
      }
    }
  }

  // 5. Mobile Image URL
  if (body.mobileImageUrl !== undefined) {
    if (body.mobileImageUrl === null || body.mobileImageUrl === '') {
      sanitized.mobileImageUrl = '';
    } else if (typeof body.mobileImageUrl !== 'string') {
      errors.push('mobileImageUrl must be a string');
    } else {
      const cleanMobUrl = body.mobileImageUrl.trim();
      if (cleanMobUrl.length > 2000) {
        errors.push('mobileImageUrl cannot exceed 2000 characters');
      } else if (!URL_OR_PATH_REGEX.test(cleanMobUrl)) {
        errors.push('mobileImageUrl must be a valid URL or path');
      } else {
        sanitized.mobileImageUrl = cleanMobUrl;
      }
    }
  }

  // 6. CTA Text
  if (body.ctaText !== undefined) {
    if (body.ctaText === null) {
      sanitized.ctaText = '';
    } else if (typeof body.ctaText !== 'string') {
      errors.push('ctaText must be a string');
    } else {
      const cleanCta = body.ctaText.trim();
      if (cleanCta.length > 100) {
        errors.push('ctaText cannot exceed 100 characters');
      } else {
        sanitized.ctaText = cleanCta;
      }
    }
  }

  // 7. CTA Link
  if (body.ctaLink !== undefined) {
    if (body.ctaLink === null || body.ctaLink === '') {
      sanitized.ctaLink = '';
    } else if (typeof body.ctaLink !== 'string') {
      errors.push('ctaLink must be a string');
    } else {
      const cleanLink = body.ctaLink.trim();
      if (cleanLink.length > 500) {
        errors.push('ctaLink cannot exceed 500 characters');
      } else {
        sanitized.ctaLink = cleanLink;
      }
    }
  }

  // 8. Display Order
  if (body.displayOrder !== undefined && body.displayOrder !== null) {
    const orderNum = Number(body.displayOrder);
    if (!Number.isInteger(orderNum) || orderNum < 0) {
      errors.push('displayOrder must be a non-negative integer');
    } else {
      sanitized.displayOrder = orderNum;
    }
  }

  // 9. isActive
  if (body.isActive !== undefined && body.isActive !== null) {
    if (typeof body.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    } else {
      sanitized.isActive = body.isActive;
    }
  }

  // 10. Start Date & End Date
  let start = undefined;
  let end = undefined;

  if (body.startDate !== undefined) {
    if (body.startDate === null || body.startDate === '') {
      sanitized.startDate = null;
    } else {
      const parsedStart = new Date(body.startDate);
      if (isNaN(parsedStart.getTime())) {
        errors.push('startDate must be a valid ISO date');
      } else {
        start = parsedStart;
        sanitized.startDate = parsedStart;
      }
    }
  }

  if (body.endDate !== undefined) {
    if (body.endDate === null || body.endDate === '') {
      sanitized.endDate = null;
    } else {
      const parsedEnd = new Date(body.endDate);
      if (isNaN(parsedEnd.getTime())) {
        errors.push('endDate must be a valid ISO date');
      } else {
        end = parsedEnd;
        sanitized.endDate = parsedEnd;
      }
    }
  }

  if (start && end && end < start) {
    errors.push('endDate cannot be before startDate');
  }

  // 11. Target Category ID
  if (body.targetCategoryId !== undefined) {
    if (body.targetCategoryId === null || body.targetCategoryId === '') {
      sanitized.targetCategoryId = null;
    } else {
      const catIdStr = String(body.targetCategoryId).trim();
      if (!mongoose.Types.ObjectId.isValid(catIdStr) || !/^[0-9a-fA-F]{24}$/.test(catIdStr)) {
        errors.push('targetCategoryId must be a valid 24-character hexadecimal ObjectId');
      } else {
        sanitized.targetCategoryId = new mongoose.Types.ObjectId(catIdStr);
      }
    }
  }

  // 12. Target Product IDs
  if (body.targetProductIds !== undefined) {
    if (body.targetProductIds === null) {
      sanitized.targetProductIds = [];
    } else if (!Array.isArray(body.targetProductIds)) {
      errors.push('targetProductIds must be an array of ObjectIds');
    } else {
      const productIds = [];
      for (const pId of body.targetProductIds) {
        const pIdStr = String(pId).trim();
        if (!mongoose.Types.ObjectId.isValid(pIdStr) || !/^[0-9a-fA-F]{24}$/.test(pIdStr)) {
          errors.push(`Invalid product ID '${pId}' in targetProductIds`);
        } else {
          productIds.push(new mongoose.Types.ObjectId(pIdStr));
        }
      }
      sanitized.targetProductIds = productIds;
    }
  }

  // 13. Metadata
  if (body.metadata !== undefined) {
    if (body.metadata === null) {
      sanitized.metadata = {};
    } else if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      errors.push('metadata must be an object');
    } else {
      const metaObj = {};
      for (const [key, value] of Object.entries(body.metadata)) {
        if (typeof key === 'string' && key.length <= 50) {
          metaObj[key] = String(value).slice(0, 500);
        }
      }
      sanitized.metadata = metaObj;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate Toggle Content Active Status
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateToggleContent = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied by client`);
    }
  }

  if (body.isActive === undefined || typeof body.isActive !== 'boolean') {
    errors.push('isActive is required and must be a boolean');
  } else {
    sanitized.isActive = body.isActive;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate Reorder Content Sequence
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateReorderContent = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied by client`);
    }
  }

  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    errors.push('orderedIds must be a non-empty array of content IDs');
  } else {
    const seenIds = new Set();
    const validIds = [];

    for (let i = 0; i < body.orderedIds.length; i++) {
      const idStr = String(body.orderedIds[i]).trim();
      if (!mongoose.Types.ObjectId.isValid(idStr) || !/^[0-9a-fA-F]{24}$/.test(idStr)) {
        errors.push(`orderedIds[${i}] '${body.orderedIds[i]}' is not a valid 24-character ObjectId`);
      } else if (seenIds.has(idStr)) {
        errors.push(`Duplicate ID '${idStr}' in orderedIds`);
      } else {
        seenIds.add(idStr);
        validIds.push(new mongoose.Types.ObjectId(idStr));
      }
    }

    if (errors.length === 0) {
      sanitized.orderedIds = validIds;
    }
  }

  if (body.type !== undefined && body.type !== null && body.type !== '') {
    const cleanType = String(body.type).trim().toUpperCase();
    if (!ALLOWED_CONTENT_TYPES.includes(cleanType)) {
      errors.push(`Invalid content type '${body.type}'. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    } else {
      sanitized.type = cleanType;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate Admin Content Query Parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminContentQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    type: null,
    isActive: null,
    search: '',
    sortBy: 'displayOrder',
    sortOrder: 'asc',
  };

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {
      isValid: false,
      errors: ['Query parameters must be an object'],
      sanitized: {},
    };
  }

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.type) {
    const cleanType = String(query.type).trim().toUpperCase();
    if (!ALLOWED_CONTENT_TYPES.includes(cleanType)) {
      errors.push(`type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    } else {
      sanitized.type = cleanType;
    }
  }

  if (query.isActive !== undefined && query.isActive !== null && query.isActive !== '') {
    const strVal = String(query.isActive).trim().toLowerCase();
    if (strVal === 'true') {
      sanitized.isActive = true;
    } else if (strVal === 'false') {
      sanitized.isActive = false;
    } else {
      errors.push("isActive must be 'true' or 'false'");
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim();
    if (!ALLOWED_CONTENT_SORT_FIELDS.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${ALLOWED_CONTENT_SORT_FIELDS.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};
