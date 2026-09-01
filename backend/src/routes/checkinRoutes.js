import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getCurrentStays, getReservationsForCheckin, checkIn, checkOutPreview, checkOut,
} from '../controllers/checkinController.js';

const router = Router();
router.get('/stays', protect, required(PERMISSIONS.CHECKIN_VIEW), getCurrentStays);
router.get('/pending', protect, required(PERMISSIONS.CHECKIN_VIEW), getReservationsForCheckin);
router.post('/checkin', protect, required(PERMISSIONS.CHECKIN_PERFORM), checkIn);
router.get('/preview/:reservation_id', protect, required(PERMISSIONS.CHECKIN_VIEW), checkOutPreview);
router.post('/checkout', protect, required(PERMISSIONS.CHECKOUT_PERFORM), checkOut);

export default router;
