import express from 'express';
import { login, register } from '../controller/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { checkAuth } from '../middleware/checkAuth.js';


const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/check', checkAuth);

export default router;