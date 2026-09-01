import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getHousekeeping, getHousekeepingStatus, getHousekeepingDashboard,
  createHousekeepingTask, updateHousekeepingTask, deleteHousekeepingTask, getStaffWorkload
} from '../controllers/housekeepingController.js';

const router = Router();

router.get('/', protect, required(PERMISSIONS.HOUSEKEEPING_VIEW), getHousekeeping);
router.get('/status', protect, required(PERMISSIONS.HOUSEKEEPING_VIEW), getHousekeepingStatus);
router.get('/dashboard', protect, required(PERMISSIONS.HOUSEKEEPING_VIEW), getHousekeepingDashboard);
router.get('/staff-workload', protect, required(PERMISSIONS.HOUSEKEEPING_VIEW), getStaffWorkload);
router.post('/', protect, required(PERMISSIONS.HOUSEKEEPING_PERFORM), createHousekeepingTask);
router.put('/:id', protect, required(PERMISSIONS.HOUSEKEEPING_PERFORM), updateHousekeepingTask);
router.delete('/:id', protect, required(PERMISSIONS.HOUSEKEEPING_PERFORM), deleteHousekeepingTask);

export default router;
