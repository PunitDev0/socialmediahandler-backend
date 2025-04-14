// routes/linkedin.routes.mjs
import { Router } from 'express';
import {
  startLinkedInAuth,
  handleLinkedInCallback,

} from '../controller/linkedin.controller.js'
import { authenticate } from '../middleware/auth.js';

const router = Router();

// LinkedIn OAuth Routes
router.get('/auth',authenticate, startLinkedInAuth);
router.get('/callback/linkedin', handleLinkedInCallback);
// router.get('/token', getTokenStatus);
// router.get('/logout', logout);

export default router;