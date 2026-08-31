import { Router } from 'express';
import {
  publicHotelInfo, publicRoomTypes, publicRooms, publicMenu, publicRestaurants, publicBooking,
} from '../controllers/publicBookingController.js';

const router = Router();
router.get('/hotel-info', publicHotelInfo);
router.get('/room-types', publicRoomTypes);
router.get('/rooms', publicRooms);
router.get('/restaurants', publicRestaurants);
router.get('/restaurants/:restaurantId/menu', publicMenu);
router.post('/booking', publicBooking);

export default router;
