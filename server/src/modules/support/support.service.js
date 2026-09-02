import SupportTicket from './supportTicket.model.js';
import Order from '../orders/order.model.js';
import Return from '../returns/return.model.js';
import User from '../users/user.model.js';
import { generateTicketNumber } from '../../utils/ticketNumber.js';
import {
  SUPPORT_STATUS,
  assertValidSupportTransition,
} from './supportStateMachine.js';

class SupportService {
  /**
   * Create a support ticket for a customer
   * @param {object} payload
   * @param {string} userId
   * @returns {Promise<Document>}
   */
  async createTicket({ subject, category, message, orderNumber, returnNumber } = {}, userId) {
    let orderId = null;
    let resolvedOrderNumber = null;
    let returnId = null;
    let resolvedReturnNumber = null;

    // 1. Resolve and verify Order if provided
    if (orderNumber) {
      const order = await Order.findOne({
        orderNumber: orderNumber.trim().toUpperCase(),
        userId,
      });

      if (!order) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        error.code = 'ORDER_NOT_FOUND';
        throw error;
      }

      orderId = order._id;
      resolvedOrderNumber = order.orderNumber;
    }

    // 2. Resolve and verify Return if provided
    if (returnNumber) {
      const returnDoc = await Return.findOne({
        returnNumber: returnNumber.trim().toUpperCase(),
        userId,
      });

      if (!returnDoc) {
        const error = new Error('Return not found');
        error.statusCode = 404;
        error.code = 'RETURN_NOT_FOUND';
        throw error;
      }

      returnId = returnDoc._id;
      resolvedReturnNumber = returnDoc.returnNumber;
    }

    // 3. Verify Order/Return relationship if both provided
    if (orderId && returnId) {
      const returnDoc = await Return.findById(returnId);
      if (
        returnDoc.orderId.toString() !== orderId.toString() &&
        returnDoc.orderNumber !== resolvedOrderNumber
      ) {
        const error = new Error('Return does not belong to the specified order');
        error.statusCode = 400;
        error.code = 'RETURN_ORDER_MISMATCH';
        throw error;
      }
    }

    // 4. Generate unique Ticket Number
    const ticketNumber = await generateTicketNumber();

    // 5. Build Initial Message and Status History
    const initialMessage = {
      senderType: 'CUSTOMER',
      senderId: userId,
      message: message.trim(),
      createdAt: new Date(),
    };

    const initialHistory = {
      status: SUPPORT_STATUS.OPEN,
      changedAt: new Date(),
      changedBy: userId,
      note: 'Ticket created by customer',
    };

    // 6. Create Support Ticket
    const ticket = await SupportTicket.create({
      ticketNumber,
      userId,
      orderId,
      orderNumber: resolvedOrderNumber,
      returnId,
      returnNumber: resolvedReturnNumber,
      subject: subject.trim(),
      category,
      priority: 'NORMAL',
      status: SUPPORT_STATUS.OPEN,
      messages: [initialMessage],
      statusHistory: [initialHistory],
    });

    return ticket;
  }

  /**
   * Get customer's support tickets with pagination and filtering
   * @param {string} userId
   * @param {object} query
   * @returns {Promise<{ tickets: Document[], pagination: object }>}
   */
  async getCustomerTickets(userId, { page = 1, limit = 10, status, category } = {}) {
    const filter = { userId };

    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const [total, tickets] = await Promise.all([
      SupportTicket.countDocuments(filter),
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get customer ticket by ticket number
   * @param {string} ticketNumber
   * @param {string} userId
   * @returns {Promise<Document>}
   */
  async getCustomerTicketByNumber(ticketNumber, userId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
      userId,
    })
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email role')
      .populate('statusHistory.changedBy', 'name email role');

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    return ticket;
  }

  /**
   * Add a customer message to a ticket thread
   * @param {string} ticketNumber
   * @param {string} messageText
   * @param {string} userId
   * @returns {Promise<Document>}
   */
  async addCustomerMessage(ticketNumber, messageText, userId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
      userId,
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    if (ticket.status === SUPPORT_STATUS.CLOSED) {
      const error = new Error('Closed tickets cannot receive new messages');
      error.statusCode = 409;
      error.code = 'TICKET_ALREADY_CLOSED';
      throw error;
    }

    ticket.messages.push({
      senderType: 'CUSTOMER',
      senderId: userId,
      message: messageText.trim(),
      createdAt: new Date(),
    });

    // If waiting for customer, transition back to IN_PROGRESS
    if (ticket.status === SUPPORT_STATUS.WAITING_FOR_CUSTOMER) {
      ticket.status = SUPPORT_STATUS.IN_PROGRESS;
      ticket.statusHistory.push({
        status: SUPPORT_STATUS.IN_PROGRESS,
        changedAt: new Date(),
        changedBy: userId,
        note: 'Customer replied to ticket thread',
      });
    }

    await ticket.save();

    return this.getCustomerTicketByNumber(ticketNumber, userId);
  }

  /**
   * Customer closes their own ticket
   * @param {string} ticketNumber
   * @param {string} note
   * @param {string} userId
   * @returns {Promise<Document>}
   */
  async closeCustomerTicket(ticketNumber, note, userId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
      userId,
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    assertValidSupportTransition(ticket.status, SUPPORT_STATUS.CLOSED);

    const historyEvent = {
      status: SUPPORT_STATUS.CLOSED,
      changedAt: new Date(),
      changedBy: userId,
      note: note ? note.trim() : 'Ticket closed by customer',
    };

    const updatedTicket = await SupportTicket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      {
        status: SUPPORT_STATUS.CLOSED,
        closedAt: new Date(),
        $push: { statusHistory: historyEvent },
      },
      { returnDocument: 'after' }
    )
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email role')
      .populate('statusHistory.changedBy', 'name email role');

    if (!updatedTicket) {
      const error = new Error('Ticket state was modified concurrently');
      error.statusCode = 409;
      error.code = 'TICKET_STATE_CONFLICT';
      throw error;
    }

    return updatedTicket;
  }

  /**
   * Admin: List support tickets with advanced search and filters
   * @param {object} query
   * @returns {Promise<{ tickets: Document[], pagination: object }>}
   */
  async getAdminTickets({
    page = 1,
    limit = 20,
    status,
    category,
    priority,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { ticketNumber: searchRegex },
        { orderNumber: searchRegex },
        { returnNumber: searchRegex },
        { subject: searchRegex },
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [total, tickets] = await Promise.all([
      SupportTicket.countDocuments(filter),
      SupportTicket.find(filter)
        .populate('userId', 'name email phone')
        .populate('assignedTo', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Get ticket details by ticket number
   * @param {string} ticketNumber
   * @returns {Promise<Document>}
   */
  async getAdminTicketByNumber(ticketNumber) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    })
      .populate('userId', 'name email phone role')
      .populate('assignedTo', 'name email role')
      .populate('messages.senderId', 'name email role')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('orderId')
      .populate('returnId');

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    return ticket;
  }

  /**
   * Admin: Update ticket status with state machine enforcement and concurrency protection
   * @param {string} ticketNumber
   * @param {string} status
   * @param {string} note
   * @param {string} adminUserId
   * @returns {Promise<Document>}
   */
  async updateAdminTicketStatus(ticketNumber, status, note, adminUserId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    assertValidSupportTransition(ticket.status, status);

    const historyEvent = {
      status,
      changedAt: new Date(),
      changedBy: adminUserId,
      note: note ? note.trim() : `Status changed to ${status} by admin`,
    };

    const updateFields = {
      status,
      $push: { statusHistory: historyEvent },
    };

    if (status === SUPPORT_STATUS.RESOLVED) {
      updateFields.resolvedAt = new Date();
    } else if (status === SUPPORT_STATUS.CLOSED) {
      updateFields.closedAt = new Date();
    }

    const updatedTicket = await SupportTicket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      updateFields,
      { returnDocument: 'after' }
    )
      .populate('userId', 'name email phone role')
      .populate('assignedTo', 'name email role')
      .populate('messages.senderId', 'name email role')
      .populate('statusHistory.changedBy', 'name email role');

    if (!updatedTicket) {
      const error = new Error('Ticket state was modified concurrently');
      error.statusCode = 409;
      error.code = 'TICKET_STATE_CONFLICT';
      throw error;
    }

    return updatedTicket;
  }

  /**
   * Admin: Add reply message to ticket thread
   * @param {string} ticketNumber
   * @param {string} messageText
   * @param {string} adminUserId
   * @returns {Promise<Document>}
   */
  async addAdminMessage(ticketNumber, messageText, adminUserId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    if (ticket.status === SUPPORT_STATUS.CLOSED) {
      const error = new Error('Closed tickets cannot receive new messages');
      error.statusCode = 409;
      error.code = 'TICKET_ALREADY_CLOSED';
      throw error;
    }

    ticket.messages.push({
      senderType: 'ADMIN',
      senderId: adminUserId,
      message: messageText.trim(),
      createdAt: new Date(),
    });

    await ticket.save();

    return this.getAdminTicketByNumber(ticketNumber);
  }

  /**
   * Admin: Assign ticket to an administrator
   * @param {string} ticketNumber
   * @param {string|null} assignedToAdminId
   * @param {string} adminUserId
   * @returns {Promise<Document>}
   */
  async assignAdminTicket(ticketNumber, assignedToAdminId, adminUserId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    if (assignedToAdminId !== null) {
      const targetUser = await User.findById(assignedToAdminId);
      if (!targetUser || targetUser.role !== 'ADMIN') {
        const error = new Error('Assigned user must be an active administrator');
        error.statusCode = 400;
        error.code = 'INVALID_ASSIGNMENT';
        throw error;
      }
    }

    ticket.assignedTo = assignedToAdminId;
    await ticket.save();

    return this.getAdminTicketByNumber(ticketNumber);
  }

  /**
   * Admin: Update ticket priority
   * @param {string} ticketNumber
   * @param {string} priority
   * @param {string} adminUserId
   * @returns {Promise<Document>}
   */
  async updateAdminTicketPriority(ticketNumber, priority, adminUserId) {
    const ticket = await SupportTicket.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    });

    if (!ticket) {
      const error = new Error(`Support ticket '${ticketNumber}' not found`);
      error.statusCode = 404;
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    ticket.priority = priority;
    await ticket.save();

    return this.getAdminTicketByNumber(ticketNumber);
  }
}

export const supportService = new SupportService();
export default supportService;
