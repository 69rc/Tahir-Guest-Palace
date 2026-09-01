import { Router } from 'express';
import {
  publicHotelInfo, publicRoomTypes, publicRooms, publicMenu, publicRestaurants, publicBooking,
  publicAmenities, publicAmenityServices, publicConferenceHalls, publicEventInquiry,
} from '../controllers/publicBookingController.js';

const router = Router();
router.get('/hotel-info', publicHotelInfo);
router.get('/room-types', publicRoomTypes);
router.get('/rooms', publicRooms);
router.get('/restaurants', publicRestaurants);
router.get('/restaurants/:restaurantId/menu', publicMenu);
router.post('/booking', publicBooking);
router.get('/amenities', publicAmenities);
router.get('/amenities/:amenityId/services', publicAmenityServices);
router.get('/conference-halls', publicConferenceHalls);
router.post('/event-inquiry', publicEventInquiry);

export default router;
