import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  createTicket,
  getMyTickets,
  getTicketByNumber,
  addCustomerMessage,
  updateCustomerTicketStatus,
} from './support.controller.js';

const router = Router();

// All customer support routes require authentication
router.use(authenticate);

router.post('/tickets', createTicket);
router.get('/tickets', getMyTickets);
router.get('/tickets/:ticketNumber', getTicketByNumber);
router.post('/tickets/:ticketNumber/messages', addCustomerMessage);
router.patch('/tickets/:ticketNumber/status', updateCustomerTicketStatus);

export default router;
