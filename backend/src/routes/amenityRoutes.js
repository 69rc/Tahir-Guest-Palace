import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getAmenities, getAmenity, createAmenity, updateAmenity,
  getServices, createService, updateService,
  getAppointments, createAppointment, updateAppointment, settleAppointment,
  getServiceReport,
} from '../controllers/amenityController.js';

const router = Router();

// Amenities
router.get('/', protect, required(PERMISSIONS.AMENITIES_VIEW), getAmenities);
router.get('/reports', protect, required(PERMISSIONS.SERVICE_REPORTS_VIEW), getServiceReport);
router.post('/', protect, required(PERMISSIONS.AMENITIES_MANAGE), createAmenity);

// Services (configurable)
router.get('/services', protect, required(PERMISSIONS.SERVICES_VIEW), getServices);
router.post('/services', protect, required(PERMISSIONS.SERVICES_MANAGE), createService);
router.put('/services/:id', protect, required(PERMISSIONS.SERVICES_MANAGE), updateService);

// Service appointments (spa / barbershop / cabanas / bookable services)
router.get('/service-appointments', protect, required(PERMISSIONS.APPOINTMENTS_VIEW), getAppointments);
router.post('/service-appointments', protect, required(PERMISSIONS.APPOINTMENTS_MANAGE), createAppointment);
router.put('/service-appointments/:id', protect, required(PERMISSIONS.APPOINTMENTS_MANAGE), updateAppointment);
router.post('/service-appointments/:id/settle', protect, required(PERMISSIONS.APPOINTMENTS_FULFILL, PERMISSIONS.PAYMENTS_RECORD), settleAppointment);

// Amenity by id (must come after static routes to avoid shadowing)
router.get('/:id', protect, required(PERMISSIONS.AMENITIES_VIEW), getAmenity);
router.put('/:id', protect, required(PERMISSIONS.AMENITIES_MANAGE), updateAmenity);

export default router;
