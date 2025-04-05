import { Router } from 'express';
import {
  startLinkedInAuth,
  handleCallback,
  getTokenStatus
} from '../controller/linkedin.controller.mjs';

const router = Router();

router.get('/auth', startLinkedInAuth);
router.get('/callback', handleCallback);
router.get('/token', getTokenStatus);

export default router;
