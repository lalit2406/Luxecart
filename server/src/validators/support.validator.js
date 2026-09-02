import mongoose from 'mongoose';
import {
  SUPPORT_STATUS,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  isValidSupportStatus,
  isValidSupportCategory,
  isValidSupportPriority,
} from '../modules/support/supportStateMachine.js';

const PROHIBITED_CREATE_TICKET_FIELDS = [
  'userId',
  'ticketNumber',
  'status',
  'statusHistory',
  'senderId',
  'senderType',
  'resolvedAt',
  'closedAt',
  'createdAt',
  'updatedAt',
  'assignedTo',
  'priority',
  'orderId',
  'returnId',
  'messages',
];

/**
 * Validate customer ticket creation payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCreateTicket = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request payload must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject injected fields
  for (const field of PROHIBITED_CREATE_TICKET_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied during ticket creation`);
    }
  }

  // Check allowed keys only
  const allowedKeys = ['subject', 'category', 'message', 'orderNumber', 'returnNumber'];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key) && !PROHIBITED_CREATE_TICKET_FIELDS.includes(key)) {
      errors.push(`Field '${key}' is not permitted in ticket creation`);
    }
  }

  // Subject validation
  if (!body.subject || typeof body.subject !== 'string' || body.subject.trim() === '') {
    errors.push('Ticket subject is required');
  } else {
    const trimmedSubject = body.subject.trim();
    if (trimmedSubject.length < 3 || trimmedSubject.length > 200) {
      errors.push('Ticket subject must be between 3 and 200 characters');
    } else {
      sanitized.subject = trimmedSubject;
    }
  }

  // Category validation
  if (!body.category || typeof body.category !== 'string') {
    errors.push(`Ticket category is required and must be one of: ${SUPPORT_CATEGORIES.join(', ')}`);
  } else {
    const cat = body.category.trim().toUpperCase();
    if (!isValidSupportCategory(cat)) {
      errors.push(`Invalid ticket category '${body.category}'. Allowed: ${SUPPORT_CATEGORIES.join(', ')}`);
    } else {
      sanitized.category = cat;
    }
  }

  // Initial Message validation
  if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
    errors.push('Ticket initial message is required');
  } else {
    const trimmedMessage = body.message.trim();
    if (trimmedMessage.length < 5 || trimmedMessage.length > 3000) {
      errors.push('Ticket message must be between 5 and 3000 characters');
    } else {
      sanitized.message = trimmedMessage;
    }
  }

  // Optional orderNumber
  if (body.orderNumber !== undefined && body.orderNumber !== null) {
    if (typeof body.orderNumber !== 'string' || body.orderNumber.trim() === '') {
      errors.push('orderNumber must be a non-empty string if provided');
    } else {
      sanitized.orderNumber = body.orderNumber.trim().toUpperCase();
    }
  }

  // Optional returnNumber
  if (body.returnNumber !== undefined && body.returnNumber !== null) {
    if (typeof body.returnNumber !== 'string' || body.returnNumber.trim() === '') {
      errors.push('returnNumber must be a non-empty string if provided');
    } else {
      sanitized.returnNumber = body.returnNumber.trim().toUpperCase();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate customer ticket message addition
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCustomerTicketMessage = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  for (const field of ['senderId', 'senderType', 'createdAt', 'userId', 'status']) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be provided by client`);
    }
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
    errors.push('Message is required and cannot be empty');
  } else {
    const trimmed = body.message.trim();
    if (trimmed.length > 3000) {
      errors.push('Message cannot exceed 3000 characters');
    } else {
      sanitized.message = trimmed;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate customer ticket closure
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCustomerTicketStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  if (!body.status || typeof body.status !== 'string' || body.status.trim().toUpperCase() !== 'CLOSED') {
    errors.push("Customers may only transition ticket status to 'CLOSED'");
  } else {
    sanitized.status = 'CLOSED';
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      errors.push('Note must be a string');
    } else if (body.note.trim().length > 500) {
      errors.push('Note cannot exceed 500 characters');
    } else {
      sanitized.note = body.note.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate admin ticket status update
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminTicketStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  for (const field of ['userId', 'ticketNumber', 'assignedTo', 'priority', 'orderId', 'returnId', 'senderId']) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be updated via status endpoint`);
    }
  }

  if (!body.status || typeof body.status !== 'string') {
    errors.push(`Status is required and must be one of: ${Object.values(SUPPORT_STATUS).join(', ')}`);
  } else {
    const statusVal = body.status.trim().toUpperCase();
    if (!isValidSupportStatus(statusVal)) {
      errors.push(`Invalid support status '${body.status}'`);
    } else {
      sanitized.status = statusVal;
    }
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      errors.push('Note must be a string');
    } else if (body.note.trim().length > 500) {
      errors.push('Note cannot exceed 500 characters');
    } else {
      sanitized.note = body.note.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate admin message addition
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminTicketMessage = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  for (const field of ['senderId', 'senderType', 'createdAt', 'userId']) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be provided by client`);
    }
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
    errors.push('Message is required and cannot be empty');
  } else {
    const trimmed = body.message.trim();
    if (trimmed.length > 3000) {
      errors.push('Message cannot exceed 3000 characters');
    } else {
      sanitized.message = trimmed;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate admin assignment
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminTicketAssignment = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  if (body.assignedTo === undefined) {
    errors.push('assignedTo is required (valid admin ObjectId or null)');
  } else if (body.assignedTo === null) {
    sanitized.assignedTo = null;
  } else if (typeof body.assignedTo === 'string' && mongoose.Types.ObjectId.isValid(body.assignedTo.trim())) {
    sanitized.assignedTo = body.assignedTo.trim();
  } else {
    errors.push('assignedTo must be a valid MongoDB ObjectId or null');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate admin priority update
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminTicketPriority = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be an object'],
      sanitized: {},
    };
  }

  if (!body.priority || typeof body.priority !== 'string') {
    errors.push(`Priority is required and must be one of: ${SUPPORT_PRIORITIES.join(', ')}`);
  } else {
    const pVal = body.priority.trim().toUpperCase();
    if (!isValidSupportPriority(pVal)) {
      errors.push(`Invalid priority '${body.priority}'. Allowed: ${SUPPORT_PRIORITIES.join(', ')}`);
    } else {
      sanitized.priority = pVal;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate query params for customer ticket listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCustomerTicketQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 10,
  };

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push('limit must be an integer between 1 and 50');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.status) {
    const statusVal = query.status.trim().toUpperCase();
    if (!isValidSupportStatus(statusVal)) {
      errors.push(`Invalid status filter '${query.status}'`);
    } else {
      sanitized.status = statusVal;
    }
  }

  if (query.category) {
    const catVal = query.category.trim().toUpperCase();
    if (!isValidSupportCategory(catVal)) {
      errors.push(`Invalid category filter '${query.category}'`);
    } else {
      sanitized.category = catVal;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate query params for admin ticket listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAdminTicketQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.status) {
    const statusVal = query.status.trim().toUpperCase();
    if (!isValidSupportStatus(statusVal)) {
      errors.push(`Invalid status filter '${query.status}'`);
    } else {
      sanitized.status = statusVal;
    }
  }

  if (query.category) {
    const catVal = query.category.trim().toUpperCase();
    if (!isValidSupportCategory(catVal)) {
      errors.push(`Invalid category filter '${query.category}'`);
    } else {
      sanitized.category = catVal;
    }
  }

  if (query.priority) {
    const pVal = query.priority.trim().toUpperCase();
    if (!isValidSupportPriority(pVal)) {
      errors.push(`Invalid priority filter '${query.priority}'`);
    } else {
      sanitized.priority = pVal;
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search query cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.sortBy) {
    const allowedSortFields = ['createdAt', 'updatedAt', 'priority', 'status'];
    if (!allowedSortFields.includes(query.sortBy.trim())) {
      errors.push(`sortBy must be one of: ${allowedSortFields.join(', ')}`);
    } else {
      sanitized.sortBy = query.sortBy.trim();
    }
  }

  if (query.sortOrder) {
    const orderVal = query.sortOrder.trim().toLowerCase();
    if (!['asc', 'desc'].includes(orderVal)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = orderVal;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};
