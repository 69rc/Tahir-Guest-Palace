import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getCurrentStays, getReservationsForCheckin, checkIn, checkOutPreview, checkOut,
} from '../controllers/checkinController.js';

const router = Router();
router.get('/stays', protect, getCurrentStays);
router.get('/pending', protect, getReservationsForCheckin);
router.post('/checkin', protect, checkIn);
router.get('/preview/:reservation_id', protect, checkOutPreview);
router.post('/checkout', protect, checkOut);

export default router;
