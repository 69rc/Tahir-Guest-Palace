import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { getDashboard } from '../controllers/dashboardController.js';

const router = Router();
router.get('/', protect, required(PERMISSIONS.DASHBOARD), getDashboard);
export default router;
