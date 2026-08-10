import express from 'express';

import { createOrderController, verifyPaymentController } from '../controllers/razorpay.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js';

const router = express.Router();

router.post('/create-order', verifyFirebaseToken, createOrderController);
router.post('/verify-order', verifyFirebaseToken, verifyPaymentController);

export default router;