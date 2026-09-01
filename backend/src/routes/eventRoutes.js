import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getHalls, createHall, updateHall,
  getEventServices, createEventService, updateEventService,
  getEventBookings, getEventBooking, createEventBooking, updateEventBooking, recordEventPayment,
  getEventReport,
} from '../controllers/eventController.js';

const router = Router();

// Conference halls
router.get('/halls', protect, required(PERMISSIONS.HALLS_VIEW), getHalls);
router.post('/halls', protect, required(PERMISSIONS.HALLS_MANAGE), createHall);
router.put('/halls/:id', protect, required(PERMISSIONS.HALLS_MANAGE), updateHall);

// Event services (catering, equipment...)
router.get('/services', protect, required(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENT_SERVICES_MANAGE), getEventServices);
router.post('/services', protect, required(PERMISSIONS.EVENT_SERVICES_MANAGE), createEventService);
router.put('/services/:id', protect, required(PERMISSIONS.EVENT_SERVICES_MANAGE), updateEventService);

// Event bookings
router.get('/events', protect, required(PERMISSIONS.EVENTS_VIEW), getEventBookings);
router.get('/events/reports', protect, required(PERMISSIONS.EVENT_REPORTS_VIEW), getEventReport);
router.get('/events/:id', protect, required(PERMISSIONS.EVENTS_VIEW), getEventBooking);
router.post('/events', protect, required(PERMISSIONS.EVENTS_MANAGE), createEventBooking);
router.put('/events/:id', protect, required(PERMISSIONS.EVENTS_MANAGE), updateEventBooking);
router.post('/events/:id/payment', protect, required(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PAYMENTS_RECORD), recordEventPayment);

export default router;
