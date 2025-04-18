// routes/linkedin.routes.mjs
import { Router } from 'express';
import {
  startLinkedInAuth,
  handleLinkedInCallback,

} from '../controller/linkedin.controller.js'
import { authenticate } from '../middleware/auth.js';
import { handleFacebookCallback, startFacebookAuth } from '../controller/facebook.controller.js';

const router = Router();

// LinkedIn OAuth Routes
router.get('/auth',authenticate, startFacebookAuth);
router.get('/callback/linkedin', handleFacebookCallback);
// router.get('/token', getTokenStatus);
// router.get('/logout', logout);

export default router;