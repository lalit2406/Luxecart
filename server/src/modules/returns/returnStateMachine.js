/**
 * LuxeCart Return State Machine
 * Authoritative lifecycle definitions and transition validator for customer returns
 */

export const RETURN_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  RECEIVED: 'RECEIVED',
  REFUNDED: 'REFUNDED',
  REJECTED: 'REJECTED',
});

/**
 * Return Transition Matrix:
 * Maps each return status to the strictly allowed subsequent statuses.
 */
export const ALLOWED_RETURN_TRANSITIONS = Object.freeze({
  [RETURN_STATUS.REQUESTED]: [RETURN_STATUS.APPROVED, RETURN_STATUS.REJECTED],
  [RETURN_STATUS.APPROVED]: [RETURN_STATUS.PICKUP_SCHEDULED, RETURN_STATUS.REJECTED],
  [RETURN_STATUS.PICKUP_SCHEDULED]: [RETURN_STATUS.RECEIVED, RETURN_STATUS.REJECTED],
  [RETURN_STATUS.RECEIVED]: [RETURN_STATUS.REFUNDED],
  [RETURN_STATUS.REFUNDED]: [], // Terminal state
  [RETURN_STATUS.REJECTED]: [], // Terminal state
});

/**
 * Terminal statuses that cannot transition into any other status
 */
export const TERMINAL_RETURN_STATUSES = Object.freeze([
  RETURN_STATUS.REFUNDED,
  RETURN_STATUS.REJECTED,
]);

/**
 * Determine if a status string is a valid recognized return status
 * @param {string} status
 * @returns {boolean}
 */
export const isValidReturnStatus = (status) => {
  return typeof status === 'string' && Object.values(RETURN_STATUS).includes(status);
};

/**
 * Retrieve the list of valid next statuses for a given current return status
 * @param {string} currentStatus
 * @returns {string[]}
 */
export const getAllowedReturnTransitions = (currentStatus) => {
  return ALLOWED_RETURN_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if a return status is terminal
 * @param {string} status
 * @returns {boolean}
 */
export const isTerminalReturnStatus = (status) => {
  return TERMINAL_RETURN_STATUSES.includes(status);
};

/**
 * Determine if a transition from `fromStatus` to `toStatus` is legal
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export const canTransitionReturn = (fromStatus, toStatus) => {
  if (!isValidReturnStatus(fromStatus) || !isValidReturnStatus(toStatus)) {
    return false;
  }
  if (fromStatus === toStatus) {
    return false; // Duplicate transitions are strictly forbidden
  }

  const allowed = ALLOWED_RETURN_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

/**
 * Assert that a return transition is valid.
 * Throws standard application error if invalid.
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export const assertValidReturnTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) {
    const error = new Error('Both current status and target status are required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (!isValidReturnStatus(fromStatus)) {
    const error = new Error(`'${fromStatus}' is not a valid recognized return status`);
    error.statusCode = 400;
    error.code = 'INVALID_RETURN_STATUS';
    throw error;
  }

  if (!isValidReturnStatus(toStatus)) {
    const error = new Error(`'${toStatus}' is not a valid target return status`);
    error.statusCode = 400;
    error.code = 'INVALID_RETURN_STATUS';
    throw error;
  }

  if (fromStatus === toStatus) {
    const error = new Error(`Return is already in '${fromStatus}' status`);
    error.statusCode = 409;
    error.code = 'INVALID_RETURN_TRANSITION';
    throw error;
  }

  if (isTerminalReturnStatus(fromStatus)) {
    const error = new Error(
      `Cannot change status of a return in terminal '${fromStatus}' state`
    );
    error.statusCode = 409;
    error.code = 'INVALID_RETURN_TRANSITION';
    throw error;
  }

  const allowed = ALLOWED_RETURN_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const allowedList = allowed.length > 0 ? allowed.join(', ') : 'none';
    const error = new Error(
      `Invalid return status transition from '${fromStatus}' to '${toStatus}'. Allowed target states: [${allowedList}]`
    );
    error.statusCode = 409;
    error.code = 'INVALID_RETURN_TRANSITION';
    throw error;
  }
};
