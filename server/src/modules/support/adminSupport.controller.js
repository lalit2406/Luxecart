import supportService from './support.service.js';
import {
  validateAdminTicketStatus,
  validateAdminTicketMessage,
  validateAdminTicketAssignment,
  validateAdminTicketPriority,
  validateAdminTicketQuery,
} from '../../validators/support.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Admin: List all customer support tickets
 */
export const getAdminTickets = async (req, res, next) => {
  try {
    const validation = validateAdminTicketQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await supportService.getAdminTickets(validation.sanitized);

    return sendSuccess(res, 200, 'Admin support tickets retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get support ticket details
 */
export const getAdminTicketByNumber = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const ticket = await supportService.getAdminTicketByNumber(ticketNumber);

    return sendSuccess(res, 200, 'Support ticket retrieved successfully', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update ticket status
 */
export const updateAdminTicketStatus = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateAdminTicketStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.updateAdminTicketStatus(
      ticketNumber,
      validation.sanitized.status,
      validation.sanitized.note,
      req.user.id
    );

    return sendSuccess(res, 200, 'Support ticket status updated successfully', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Add reply message to ticket
 */
export const addAdminMessage = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateAdminTicketMessage(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.addAdminMessage(
      ticketNumber,
      validation.sanitized.message,
      req.user.id
    );

    return sendSuccess(res, 200, 'Admin message posted to ticket thread', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Assign ticket to administrator
 */
export const assignAdminTicket = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateAdminTicketAssignment(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.assignAdminTicket(
      ticketNumber,
      validation.sanitized.assignedTo,
      req.user.id
    );

    return sendSuccess(res, 200, 'Support ticket assignment updated', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update ticket priority
 */
export const updateAdminTicketPriority = async (req, res, next) => {
  try {
    const { ticketNumber } = req.params;
    const validation = validateAdminTicketPriority(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const ticket = await supportService.updateAdminTicketPriority(
      ticketNumber,
      validation.sanitized.priority,
      req.user.id
    );

    return sendSuccess(res, 200, 'Support ticket priority updated', {
      ticket,
    });
  } catch (error) {
    next(error);
  }
};
