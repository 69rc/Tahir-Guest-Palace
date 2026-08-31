import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { getHousekeeping, getHousekeepingStatus, updateHousekeeping } from '../controllers/housekeepingController.js';

const router = Router();
router.get('/', protect, getHousekeeping);
router.get('/status', protect, getHousekeepingStatus);
router.post('/', protect, updateHousekeeping);

export default router;
