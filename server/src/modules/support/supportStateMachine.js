/**
 * LuxeCart Support Ticket State Machine
 * Authoritative lifecycle definitions and transition validator for customer support tickets
 */

export const SUPPORT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

export const SUPPORT_CATEGORIES = Object.freeze([
  'ORDER_ISSUE',
  'DELIVERY_ISSUE',
  'RETURN_ISSUE',
  'REFUND_ISSUE',
  'PRODUCT_ISSUE',
  'PAYMENT_ISSUE',
  'ACCOUNT_ISSUE',
  'OTHER',
]);

export const SUPPORT_PRIORITIES = Object.freeze([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

/**
 * Support Ticket Transition Matrix
 */
export const ALLOWED_SUPPORT_TRANSITIONS = Object.freeze({
  [SUPPORT_STATUS.OPEN]: [
    SUPPORT_STATUS.IN_PROGRESS,
    SUPPORT_STATUS.CLOSED,
  ],
  [SUPPORT_STATUS.IN_PROGRESS]: [
    SUPPORT_STATUS.WAITING_FOR_CUSTOMER,
    SUPPORT_STATUS.RESOLVED,
    SUPPORT_STATUS.CLOSED,
  ],
  [SUPPORT_STATUS.WAITING_FOR_CUSTOMER]: [
    SUPPORT_STATUS.IN_PROGRESS,
    SUPPORT_STATUS.RESOLVED,
    SUPPORT_STATUS.CLOSED,
  ],
  [SUPPORT_STATUS.RESOLVED]: [
    SUPPORT_STATUS.CLOSED,
  ],
  [SUPPORT_STATUS.CLOSED]: [], // Terminal state
});

export const TERMINAL_SUPPORT_STATUSES = Object.freeze([
  SUPPORT_STATUS.CLOSED,
]);

/**
 * Check if a status is a recognized support ticket status
 * @param {string} status
 * @returns {boolean}
 */
export const isValidSupportStatus = (status) => {
  return typeof status === 'string' && Object.values(SUPPORT_STATUS).includes(status);
};

/**
 * Check if a category is a recognized support ticket category
 * @param {string} category
 * @returns {boolean}
 */
export const isValidSupportCategory = (category) => {
  return typeof category === 'string' && SUPPORT_CATEGORIES.includes(category);
};

/**
 * Check if a priority is a recognized support ticket priority
 * @param {string} priority
 * @returns {boolean}
 */
export const isValidSupportPriority = (priority) => {
  return typeof priority === 'string' && SUPPORT_PRIORITIES.includes(priority);
};

/**
 * Get allowed next transitions
 * @param {string} currentStatus
 * @returns {string[]}
 */
export const getAllowedSupportTransitions = (currentStatus) => {
  return ALLOWED_SUPPORT_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if a status is terminal
 * @param {string} status
 * @returns {boolean}
 */
export const isTerminalSupportStatus = (status) => {
  return TERMINAL_SUPPORT_STATUSES.includes(status);
};

/**
 * Check if a transition is valid
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
export const isValidSupportTransition = (currentStatus, nextStatus) => {
  if (!isValidSupportStatus(currentStatus) || !isValidSupportStatus(nextStatus)) {
    return false;
  }
  if (currentStatus === nextStatus) {
    return false; // Idempotent/duplicate transitions handled separately
  }
  const allowed = ALLOWED_SUPPORT_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
};

/**
 * Assert that a transition is valid or throw a 409 error
 * @param {string} currentStatus
 * @param {string} nextStatus
 */
export const assertValidSupportTransition = (currentStatus, nextStatus) => {
  if (!isValidSupportStatus(nextStatus)) {
    const error = new Error(`Invalid target support ticket status '${nextStatus}'`);
    error.statusCode = 400;
    error.code = 'INVALID_TICKET_STATUS';
    throw error;
  }

  if (currentStatus === nextStatus) {
    const error = new Error(`Support ticket is already in status '${currentStatus}'`);
    error.statusCode = 409;
    error.code = 'DUPLICATE_TICKET_STATUS';
    throw error;
  }

  if (!isValidSupportTransition(currentStatus, nextStatus)) {
    const allowed = getAllowedSupportTransitions(currentStatus);
    const error = new Error(
      `Cannot transition support ticket from '${currentStatus}' to '${nextStatus}'. Allowed transitions: [${allowed.join(', ')}]`
    );
    error.statusCode = 409;
    error.code = 'INVALID_TICKET_TRANSITION';
    throw error;
  }
};
