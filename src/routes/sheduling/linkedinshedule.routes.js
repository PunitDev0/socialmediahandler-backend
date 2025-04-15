import express from 'express';
import { uploadMiddleware } from '../../middleware/uploadMiddleware.js'
import { scheduleLinkedInPost } from '../../controller/Sheduling/linkedinPost.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.post('/schedule', authenticate, uploadMiddleware.array('media', 5), scheduleLinkedInPost);

export default router;