import express from 'express';

import {createContactLogController} from '../controllers/contact-logs.controller.js';

const router = express.Router();

router.post('/contact', createContactLogController);

export default router;