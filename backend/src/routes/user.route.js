import express from 'express';
import { userSignupController, getUserController, updateUserController, updateUserCookieController } from '../controllers/user.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js';


const router = express.Router();

router.post('/signin', userSignupController);

router.get('/get', verifyFirebaseToken, getUserController); 

router.post('/update', verifyFirebaseToken, updateUserController);

router.post('/update-cookie', verifyFirebaseToken, updateUserCookieController)

export default router;
