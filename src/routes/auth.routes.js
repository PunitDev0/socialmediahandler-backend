// auth.routes.js
import express from 'express';
import { login, register, getCurrentUser } from '../controller/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { checkAuth } from '../middleware/checkAuth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/check', checkAuth);
router.get('/me', authenticate, getCurrentUser); // New route for current user

export default router;