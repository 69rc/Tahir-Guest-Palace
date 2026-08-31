import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getReservations, getReservation, createReservation, updateReservationStatus, cancelReservation,
} from '../controllers/reservationController.js';

const router = Router();
router.get('/', protect, getReservations);
router.post('/', protect, createReservation);
router.get('/:id', protect, getReservation);
router.put('/:id/status', protect, updateReservationStatus);
router.post('/:id/cancel', protect, cancelReservation);

export default router;
