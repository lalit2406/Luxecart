import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  getAdminTickets,
  getAdminTicketByNumber,
  updateAdminTicketStatus,
  addAdminMessage,
  assignAdminTicket,
  updateAdminTicketPriority,
} from './adminSupport.controller.js';

const router = Router();

// All admin support routes require authentication + ADMIN role
router.use(authenticate, requireRole('ADMIN'));

router.get('/tickets', getAdminTickets);
router.get('/tickets/:ticketNumber', getAdminTicketByNumber);
router.patch('/tickets/:ticketNumber/status', updateAdminTicketStatus);
router.post('/tickets/:ticketNumber/messages', addAdminMessage);
router.patch('/tickets/:ticketNumber/assignment', assignAdminTicket);
router.patch('/tickets/:ticketNumber/priority', updateAdminTicketPriority);

export default router;
