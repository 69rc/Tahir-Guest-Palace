import { Router } from 'express';
import { login, me, changePassword } from '../controllers/authController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', protect, me);
router.post('/change-password', protect, changePassword);

export default router;
