import mongoose from 'mongoose';
import { RETURN_STATUS, isValidReturnStatus } from '../modules/returns/returnStateMachine.js';

export const ALLOWED_RETURN_REASONS = [
  'WRONG_PRODUCT',
  'DAMAGED_PRODUCT',
  'DEFECTIVE_PRODUCT',
  'SIZE_FIT_ISSUE',
  'NOT_AS_EXPECTED',
  'OTHER',
];

export const ALLOWED_REFUND_METHODS = [
  'COD_CASH_REFUND',
  'BANK_TRANSFER',
  'STORE_CREDIT',
];

const ALLOWED_ADMIN_QUERY_STATUSES = [
  'ALL',
  'REQUESTED',
  'APPROVED',
  'PICKUP_SCHEDULED',
  'RECEIVED',
  'REFUNDED',
  'REJECTED',
];

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'returnNumber', 'totalRefundAmount'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

const PROHIBITED_CUSTOMER_ROOT_FIELDS = [
  'userId',
  'orderId',
  'status',
  'statusHistory',
  'changedBy',
  'pickupAddress',
  'pickupDetails',
  'refundDetails',
  'inventoryRestored',
  'totalRequestedUnits',
  'totalRefundAmount',
  'calculatedRefundAmount',
  'unitPrice',
  'purchasedQuantity',
  'productId',
  'variantId',
  'name',
  'brand',
  'sku',
  'image',
  'price',
  'mrp',
  'stock',
  'reserved',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
  'pricing',
];

const PROHIBITED_CUSTOMER_ITEM_FIELDS = [
  'productId',
  'variantId',
  'name',
  'brand',
  'sku',
  'image',
  'color',
  'size',
  'purchasedQuantity',
  'unitPrice',
  'calculatedRefundAmount',
  'price',
  'mrp',
  'stock',
  'reserved',
  'itemStatus',
  '_id',
  'id',
];

const PROHIBITED_ADMIN_STATUS_FIELDS = [
  'userId',
  'orderId',
  'orderNumber',
  'changedBy',
  'statusHistory',
  'inventoryRestored',
  'totalRequestedUnits',
  'totalRefundAmount',
  'calculatedRefundAmount',
  'unitPrice',
  'price',
  'mrp',
  'stock',
  'reserved',
  'pricing',
  'pickupAddress',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
];

const PROHIBITED_INSPECTION_ITEM_FIELDS = [
  'quantity',
  'requestedQuantity',
  'purchasedQuantity',
  'unitPrice',
  'calculatedRefundAmount',
  'stock',
  'reserved',
  'productId',
  'variantId',
  'name',
  'brand',
  'sku',
  'image',
  'color',
  'size',
  'reason',
  'pricing',
  'inventoryRestored',
  'changedBy',
  'userId',
  'orderId',
];

const PROHIBITED_REFUND_FIELDS = [
  'processedBy',
  'refundedAt',
  'totalRefundAmount',
  'amount',
  'currency',
  'paymentStatus',
  'transactionId',
  'gatewayResponse',
  'orderId',
  'userId',
  'stock',
  'reserved',
  'inventoryRestored',
  'pricing',
  'status',
  'changedBy',
];

/**
 * Validate customer return creation payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { items: Array<{ orderItemId: string, quantity: number, reason: string, customerNote?: string }> } }}
 */
export const validateCreateReturn = (body = {}) => {
  const errors = [];
  const sanitized = {
    items: [],
  };

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized,
    };
  }

  // Reject prohibited injected fields
  for (const field of PROHIBITED_CUSTOMER_ROOT_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in return request payload`);
    }
  }

  // Optional orderNumber
  if (body.orderNumber !== undefined && body.orderNumber !== null) {
    if (typeof body.orderNumber !== 'string' || body.orderNumber.trim() === '') {
      errors.push('orderNumber must be a non-empty string');
    } else {
      sanitized.orderNumber = body.orderNumber.trim().toUpperCase();
    }
  }

  // 1. Items array validation
  if (!body.items || !Array.isArray(body.items)) {
    errors.push('Items array is required for return request');
  } else if (body.items.length === 0) {
    errors.push('Return request must contain at least one item');
  } else if (body.items.length > 50) {
    errors.push('Return request cannot contain more than 50 items');
  } else {
    const seenItemIds = new Set();

    body.items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`Item at index ${index} must be an object`);
        return;
      }

      // Reject prohibited item-level fields
      for (const field of PROHIBITED_CUSTOMER_ITEM_FIELDS) {
        if (item[field] !== undefined) {
          errors.push(`Item at index ${index} contains forbidden field '${field}'`);
        }
      }

      const itemSanitized = {};

      // 1.1 orderItemId
      if (!item.orderItemId || typeof item.orderItemId !== 'string') {
        errors.push(`Item at index ${index}: orderItemId is required`);
      } else if (!mongoose.Types.ObjectId.isValid(item.orderItemId.trim())) {
        errors.push(`Item at index ${index}: Invalid orderItemId format`);
      } else {
        const idStr = item.orderItemId.trim();
        if (seenItemIds.has(idStr)) {
          errors.push(`Item at index ${index}: Duplicate orderItemId '${idStr}' in return request`);
        } else {
          seenItemIds.add(idStr);
          itemSanitized.orderItemId = idStr;
        }
      }

      // 1.2 quantity (integer >= 1)
      if (item.quantity === undefined || item.quantity === null) {
        errors.push(`Item at index ${index}: quantity is required`);
      } else if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
        errors.push(`Item at index ${index}: quantity must be a positive integer`);
      } else {
        itemSanitized.quantity = item.quantity;
      }

      // 1.3 reason
      if (!item.reason || typeof item.reason !== 'string') {
        errors.push(`Item at index ${index}: Return reason is required`);
      } else if (!ALLOWED_RETURN_REASONS.includes(item.reason.trim())) {
        errors.push(`Item at index ${index}: Invalid return reason '${item.reason.trim()}'`);
      } else {
        itemSanitized.reason = item.reason.trim();
      }

      // 1.4 customerNote (optional, max 500)
      if (item.customerNote !== undefined && item.customerNote !== null) {
        if (typeof item.customerNote !== 'string') {
          errors.push(`Item at index ${index}: customerNote must be a string`);
        } else if (item.customerNote.trim().length > 500) {
          errors.push(`Item at index ${index}: customerNote cannot exceed 500 characters`);
        } else {
          itemSanitized.customerNote = item.customerNote.trim();
        }
      } else {
        itemSanitized.customerNote = '';
      }

      sanitized.items.push(itemSanitized);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate Admin Return Status Update payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { status: string, note?: string, pickupDetails?: object, refundDetails?: object } }}
 */
export const validateAdminReturnStatusUpdate = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized,
    };
  }

  // Reject prohibited injected fields
  for (const field of PROHIBITED_ADMIN_STATUS_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be modified via status update`);
    }
  }

  // 1. Target Status
  if (!body.status || typeof body.status !== 'string') {
    errors.push('Status is required');
  } else if (!isValidReturnStatus(body.status.trim())) {
    errors.push(`'${body.status.trim()}' is not a valid return status`);
  } else {
    sanitized.status = body.status.trim();
  }

  // 2. Note (Optional string, max 500)
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      errors.push('Note must be a string');
    } else if (body.note.trim().length > 500) {
      errors.push('Note cannot exceed 500 characters');
    } else {
      sanitized.note = body.note.trim();
    }
  }

  // 3. Pickup Details
  if (sanitized.status === 'PICKUP_SCHEDULED') {
    if (!body.pickupDetails || typeof body.pickupDetails !== 'object' || Array.isArray(body.pickupDetails)) {
      errors.push('pickupDetails object is required when status is PICKUP_SCHEDULED');
    } else {
      sanitized.pickupDetails = {};

      const allowedPickupKeys = ['courierName', 'courier', 'trackingNumber', 'scheduledDate'];
      for (const key of Object.keys(body.pickupDetails)) {
        if (!allowedPickupKeys.includes(key)) {
          errors.push(`Field '${key}' is not permitted in pickupDetails`);
        }
      }

      // Courier Name
      const rawCourier = body.pickupDetails.courierName !== undefined ? body.pickupDetails.courierName : body.pickupDetails.courier;
      if (rawCourier === undefined || rawCourier === null || typeof rawCourier !== 'string' || rawCourier.trim() === '') {
        errors.push('courierName is required when scheduling pickup');
      } else if (rawCourier.trim().length > 100) {
        errors.push('courierName cannot exceed 100 characters');
      } else {
        sanitized.pickupDetails.courierName = rawCourier.trim();
      }

      // Tracking Number
      if (body.pickupDetails.trackingNumber === undefined || body.pickupDetails.trackingNumber === null || typeof body.pickupDetails.trackingNumber !== 'string' || body.pickupDetails.trackingNumber.trim() === '') {
        errors.push('trackingNumber is required when scheduling pickup');
      } else if (body.pickupDetails.trackingNumber.trim().length > 100) {
        errors.push('trackingNumber cannot exceed 100 characters');
      } else {
        sanitized.pickupDetails.trackingNumber = body.pickupDetails.trackingNumber.trim();
      }

      // Scheduled Date
      if (body.pickupDetails.scheduledDate === undefined || body.pickupDetails.scheduledDate === null || body.pickupDetails.scheduledDate === '') {
        errors.push('scheduledDate is required when scheduling pickup');
      } else {
        const parsedDate = new Date(body.pickupDetails.scheduledDate);
        if (isNaN(parsedDate.getTime())) {
          errors.push('scheduledDate must be a valid date');
        } else if (parsedDate.getTime() < Date.now() - 60000) {
          errors.push('scheduledDate must be a future date');
        } else {
          sanitized.pickupDetails.scheduledDate = parsedDate;
        }
      }
    }
  } else if (body.pickupDetails !== undefined && body.pickupDetails !== null) {
    if (typeof body.pickupDetails !== 'object' || Array.isArray(body.pickupDetails)) {
      errors.push('pickupDetails must be an object');
    } else {
      sanitized.pickupDetails = {};

      const allowedPickupKeys = ['courierName', 'courier', 'trackingNumber', 'scheduledDate'];
      for (const key of Object.keys(body.pickupDetails)) {
        if (!allowedPickupKeys.includes(key)) {
          errors.push(`Field '${key}' is not permitted in pickupDetails`);
        }
      }

      const rawCourier = body.pickupDetails.courierName !== undefined ? body.pickupDetails.courierName : body.pickupDetails.courier;
      if (rawCourier !== undefined && rawCourier !== null) {
        if (typeof rawCourier !== 'string' || rawCourier.trim().length > 100) {
          errors.push('courierName must be a string up to 100 characters');
        } else {
          sanitized.pickupDetails.courierName = rawCourier.trim();
        }
      }

      if (body.pickupDetails.trackingNumber !== undefined && body.pickupDetails.trackingNumber !== null) {
        if (typeof body.pickupDetails.trackingNumber !== 'string' || body.pickupDetails.trackingNumber.trim().length > 100) {
          errors.push('trackingNumber must be a string up to 100 characters');
        } else {
          sanitized.pickupDetails.trackingNumber = body.pickupDetails.trackingNumber.trim();
        }
      }

      if (body.pickupDetails.scheduledDate !== undefined && body.pickupDetails.scheduledDate !== null) {
        const parsedDate = new Date(body.pickupDetails.scheduledDate);
        if (isNaN(parsedDate.getTime())) {
          errors.push('scheduledDate must be a valid date');
        } else {
          sanitized.pickupDetails.scheduledDate = parsedDate;
        }
      }
    }
  }

  // 4. Items Inspection (Mandatory when RECEIVED, prohibited otherwise)
  if (sanitized.status === 'RECEIVED') {
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      errors.push('items array is required with at least one inspection result when status is RECEIVED');
    } else {
      sanitized.items = [];
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`Item at index ${i} must be a valid inspection object`);
          continue;
        }

        // Check prohibited injected fields
        for (const field of PROHIBITED_INSPECTION_ITEM_FIELDS) {
          if (item[field] !== undefined) {
            errors.push(`Field '${field}' on item index ${i} cannot be supplied via status update`);
          }
        }

        const returnItemId = item.returnItemId || item.id || item._id;
        if (!returnItemId || typeof returnItemId !== 'string' || !mongoose.Types.ObjectId.isValid(returnItemId.trim())) {
          errors.push(`Valid returnItemId is required for item at index ${i}`);
        }

        if (!item.itemStatus || typeof item.itemStatus !== 'string') {
          errors.push(`itemStatus is required for item at index ${i}`);
        } else {
          const statusVal = item.itemStatus.trim().toUpperCase();
          if (statusVal === 'RESTOCKED') {
            errors.push(`itemStatus cannot be set to 'RESTOCKED' directly by client for item at index ${i} (server-authoritative upon inventory restoration)`);
          } else if (statusVal === 'PENDING') {
            errors.push(`itemStatus cannot be 'PENDING' during receipt inspection for item at index ${i}`);
          } else if (statusVal !== 'ACCEPTED' && statusVal !== 'REJECTED') {
            errors.push(`itemStatus must be either 'ACCEPTED' or 'REJECTED' for item at index ${i}`);
          } else {
            if (returnItemId && mongoose.Types.ObjectId.isValid(returnItemId.trim())) {
              sanitized.items.push({
                returnItemId: returnItemId.trim(),
                itemStatus: statusVal,
              });
            }
          }
        }
      }
    }
  } else if (body.items !== undefined) {
    errors.push("Field 'items' cannot be modified unless status is 'RECEIVED'");
  }

  // 5. Refund Details
  if (sanitized.status === 'REFUNDED') {
    if (!body.refundDetails || typeof body.refundDetails !== 'object' || Array.isArray(body.refundDetails)) {
      errors.push('refundDetails object is required when status is REFUNDED');
    } else {
      sanitized.refundDetails = {};

      for (const field of PROHIBITED_REFUND_FIELDS) {
        if (body.refundDetails[field] !== undefined) {
          errors.push(`Field '${field}' is not permitted in refundDetails`);
        }
      }

      const allowedRefundKeys = ['method', 'referenceNumber'];
      for (const key of Object.keys(body.refundDetails)) {
        if (!allowedRefundKeys.includes(key) && !PROHIBITED_REFUND_FIELDS.includes(key)) {
          errors.push(`Field '${key}' is not permitted in refundDetails`);
        }
      }

      // Method
      if (!body.refundDetails.method || typeof body.refundDetails.method !== 'string' || !ALLOWED_REFUND_METHODS.includes(body.refundDetails.method.trim())) {
        errors.push(`refundDetails.method is required and must be one of: ${ALLOWED_REFUND_METHODS.join(', ')}`);
      } else {
        sanitized.refundDetails.method = body.refundDetails.method.trim();
      }

      // Reference Number
      if (
        body.refundDetails.referenceNumber === undefined ||
        body.refundDetails.referenceNumber === null ||
        typeof body.refundDetails.referenceNumber !== 'string' ||
        body.refundDetails.referenceNumber.trim() === ''
      ) {
        errors.push('refundDetails.referenceNumber is required when status is REFUNDED');
      } else if (body.refundDetails.referenceNumber.trim().length > 100) {
        errors.push('refundDetails.referenceNumber cannot exceed 100 characters');
      } else {
        sanitized.refundDetails.referenceNumber = body.refundDetails.referenceNumber.trim();
      }
    }
  } else if (body.refundDetails !== undefined && body.refundDetails !== null) {
    if (typeof body.refundDetails !== 'object' || Array.isArray(body.refundDetails)) {
      errors.push('refundDetails must be an object');
    } else {
      sanitized.refundDetails = {};

      for (const field of PROHIBITED_REFUND_FIELDS) {
        if (body.refundDetails[field] !== undefined) {
          errors.push(`Field '${field}' is not permitted in refundDetails`);
        }
      }

      if (body.refundDetails.method !== undefined) {
        if (!ALLOWED_REFUND_METHODS.includes(body.refundDetails.method)) {
          errors.push(`Invalid refund method '${body.refundDetails.method}'`);
        } else {
          sanitized.refundDetails.method = body.refundDetails.method;
        }
      }

      if (body.refundDetails.referenceNumber !== undefined) {
        if (typeof body.refundDetails.referenceNumber !== 'string' || body.refundDetails.referenceNumber.length > 100) {
          errors.push('referenceNumber must be a string up to 100 characters');
        } else {
          sanitized.refundDetails.referenceNumber = body.refundDetails.referenceNumber.trim();
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate query parameters for admin return listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: { page: number, limit: number, status?: string, search?: string, sortBy: string, sortOrder: string } }}
 */
export const validateAdminReturnQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  // 1. Pagination Page
  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  // 2. Pagination Limit
  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be a positive integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  // 3. Status Filter
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const trimmedStatus = query.status.trim().toUpperCase();
    if (!ALLOWED_ADMIN_QUERY_STATUSES.includes(trimmedStatus)) {
      errors.push(`Invalid return status filter '${query.status}'. Allowed values: ${ALLOWED_ADMIN_QUERY_STATUSES.join(', ')}`);
    } else if (trimmedStatus !== 'ALL') {
      sanitized.status = trimmedStatus;
    }
  }

  // 4. Search Query
  if (query.search !== undefined && query.search !== null) {
    if (typeof query.search !== 'string') {
      errors.push('Search must be a string');
    } else if (query.search.trim().length > 100) {
      errors.push('Search query cannot exceed 100 characters');
    } else if (query.search.trim().length > 0) {
      sanitized.search = query.search.trim();
    }
  }

  // 5. Sort By
  if (query.sortBy !== undefined && query.sortBy !== null && query.sortBy !== '') {
    const trimmedSort = query.sortBy.trim();
    if (!ALLOWED_SORT_FIELDS.includes(trimmedSort)) {
      errors.push(`Invalid sortBy field '${query.sortBy}'. Allowed values: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    } else {
      sanitized.sortBy = trimmedSort;
    }
  }

  // 6. Sort Order
  if (query.sortOrder !== undefined && query.sortOrder !== null && query.sortOrder !== '') {
    const trimmedOrder = query.sortOrder.trim().toLowerCase();
    if (!ALLOWED_SORT_ORDERS.includes(trimmedOrder)) {
      errors.push(`Invalid sortOrder '${query.sortOrder}'. Allowed values: 'asc', 'desc'`);
    } else {
      sanitized.sortOrder = trimmedOrder;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};
