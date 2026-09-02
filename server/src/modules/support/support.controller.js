import supportService from './support.service.js';
import {
  validateCreateTicket,
  validateCustomerTicketMessage,
  validateCustomerTicketStatus,
  validateCustomerTicketQuery,
} from '../../validators/support.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Customer creates a support ticket
 */
export const createTicket = async (req, res, next) => {
  try {
    const validation = validateCreateTicket(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.createTicket(validation.sanitized, req.user.id);

    return sendSuccess(res, 201, 'Support ticket created successfully', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer gets their support tickets
 */
export const getMyTickets = async (req, res, next) => {
  try {
    const validation = validateCustomerTicketQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await supportService.getCustomerTickets(req.user.id, validation.sanitized);

    return sendSuccess(res, 200, 'Support tickets retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer gets ticket detail by ticketNumber
 */
export const getTicketByNumber = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const ticket = await supportService.getCustomerTicketByNumber(ticketNumber, req.user.id);

    return sendSuccess(res, 200, 'Support ticket retrieved successfully', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer adds a message to ticket thread
 */
export const addCustomerMessage = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateCustomerTicketMessage(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.addCustomerMessage(
      ticketNumber,
      validation.sanitized.message,
      req.user.id
    );

    return sendSuccess(res, 200, 'Message added to support ticket thread', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer closes their ticket
 */
export const updateCustomerTicketStatus = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateCustomerTicketStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.closeCustomerTicket(
      ticketNumber,
      validation.sanitized.note,
      req.user.id
    );

    return sendSuccess(res, 200, 'Support ticket closed successfully', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};
