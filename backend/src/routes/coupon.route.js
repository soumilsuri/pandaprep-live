// backend/src/routes/coupon.routes.js - NEW FILE
import express from 'express';
import { validateCouponController, applyCouponController } from '../controllers/coupon.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js'; 

const router = express.Router();

router.post('/validate', verifyFirebaseToken, validateCouponController);
router.post('/apply', verifyFirebaseToken, applyCouponController);

export default router;