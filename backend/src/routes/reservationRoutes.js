import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getReservations, getReservation, createReservation, updateReservationStatus, cancelReservation,
  getReservationCalendar, updateReservationDates,
} from '../controllers/reservationController.js';

const router = Router();
router.get('/', protect, required(PERMISSIONS.RESERVATIONS_VIEW), getReservations);
router.get('/calendar', protect, required(PERMISSIONS.RESERVATIONS_VIEW), getReservationCalendar);
router.post('/', protect, required(PERMISSIONS.RESERVATIONS_MANAGE), createReservation);
router.get('/:id', protect, required(PERMISSIONS.RESERVATIONS_VIEW), getReservation);
router.put('/:id', protect, required(PERMISSIONS.RESERVATIONS_MANAGE), updateReservationDates);
router.put('/:id/status', protect, required(PERMISSIONS.RESERVATIONS_MANAGE), updateReservationStatus);
router.post('/:id/cancel', protect, required(PERMISSIONS.RESERVATIONS_MANAGE), cancelReservation);

export default router;
