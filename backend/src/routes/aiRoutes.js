import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { ask, dashboardQuickStats } from '../controllers/aiController.js';

const router = Router();
router.post('/ask', protect, ask);
router.get('/quick-stats', protect, dashboardQuickStats);

export default router;
