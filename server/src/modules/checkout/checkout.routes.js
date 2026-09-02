import { Router } from 'express';
import { prepareCheckout } from './checkout.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Checkout preparation requires authenticated customer session
router.use(authenticate);

router.post('/prepare', prepareCheckout);

export default router;
