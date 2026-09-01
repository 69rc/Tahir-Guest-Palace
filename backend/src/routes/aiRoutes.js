import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { ask, dashboardQuickStats } from '../controllers/aiController.js';

const router = Router();
router.post('/ask', protect, required(PERMISSIONS.AI_USE), ask);
router.get('/quick-stats', protect, required(PERMISSIONS.DASHBOARD), dashboardQuickStats);

export default router;
