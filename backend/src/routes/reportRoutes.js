import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { getHotelReport, getRestaurantReport, getInventoryReport } from '../controllers/reportController.js';

const router = Router();
router.get('/hotel', protect, getHotelReport);
router.get('/restaurant', protect, getRestaurantReport);
router.get('/inventory', protect, getInventoryReport);

export default router;
