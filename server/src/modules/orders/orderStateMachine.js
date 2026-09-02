/**
 * LuxeCart Order State Machine
 * Authoritative lifecycle definitions and transition validator
 */

export const ORDER_STATUS = Object.freeze({
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

/**
 * State Transition Matrix:
 * Maps each status to the strictly allowed subsequent statuses.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED], // Once shipped, order cannot be cancelled
  [ORDER_STATUS.DELIVERED]: [],                     // Terminal state
  [ORDER_STATUS.CANCELLED]: [],                     // Terminal state
});

/**
 * Terminal states that cannot transition into any other status
 */
export const TERMINAL_STATUSES = Object.freeze([
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
]);

/**
 * Determine if a transition from `fromStatus` to `toStatus` is legal
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export const canTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return false; // Duplicate transitions are forbidden

  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

/**
 * Retrieve the list of valid next statuses for a given current status
 * @param {string} currentStatus
 * @returns {string[]}
 */
export const getAllowedNextStatuses = (currentStatus) => {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if a status is terminal
 * @param {string} status
 * @returns {boolean}
 */
export const isTerminalStatus = (status) => {
  return TERMINAL_STATUSES.includes(status);
};

/**
 * Assert that a transition is valid. Throws standard 409 error if invalid.
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export const assertValidTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) {
    const error = new Error('Both current status and target status are required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (fromStatus === toStatus) {
    const error = new Error(`Order is already in '${fromStatus}' status`);
    error.statusCode = 409;
    error.code = 'INVALID_ORDER_TRANSITION';
    throw error;
  }

  if (isTerminalStatus(fromStatus)) {
    const error = new Error(
      `Cannot change status of an order in terminal '${fromStatus}' state`
    );
    error.statusCode = 409;
    error.code = 'INVALID_ORDER_TRANSITION';
    throw error;
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const allowedList = allowed.length > 0 ? allowed.join(', ') : 'none';
    const error = new Error(
      `Invalid status transition from '${fromStatus}' to '${toStatus}'. Allowed target states: [${allowedList}]`
    );
    error.statusCode = 409;
    error.code = 'INVALID_ORDER_TRANSITION';
    throw error;
  }
};
