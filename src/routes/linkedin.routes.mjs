// routes/linkedin.routes.mjs
import { Router } from 'express';
import {
  startLinkedInAuth,
  handleCallback,

} from '../controller/linkedin.controller.mjs'

const router = Router();

// LinkedIn OAuth Routes
router.get('/auth', startLinkedInAuth);
router.get('/callback/linkedin', handleCallback);
// router.get('/token', getTokenStatus);
// router.get('/logout', logout);

export default router;