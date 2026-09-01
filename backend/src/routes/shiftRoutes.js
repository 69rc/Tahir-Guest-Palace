import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  openShift, getCurrentShift, getShifts, getShiftDetail, closeShift, getShiftReports
} from '../controllers/shiftController.js';

const router = Router();

router.get('/reports', protect, required(PERMISSIONS.SHIFTS_CLOSE), getShiftReports);
router.get('/current', protect, required(PERMISSIONS.SHIFTS_VIEW), getCurrentShift);
router.get('/', protect, required(PERMISSIONS.SHIFTS_VIEW), getShifts);
router.post('/', protect, required(PERMISSIONS.SHIFTS_MANAGE), openShift);
router.get('/:id', protect, required(PERMISSIONS.SHIFTS_VIEW), getShiftDetail);
router.post('/:id/close', protect, required(PERMISSIONS.SHIFTS_CLOSE), closeShift);

export default router;
