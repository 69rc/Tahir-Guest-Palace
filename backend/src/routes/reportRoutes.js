import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { getHotelReport, getRestaurantReport, getInventoryReport, getCombinedReport, getKPIs, getDepartmentRevenue } from '../controllers/reportController.js';

const router = Router();
router.get('/hotel', protect, required(PERMISSIONS.HOTEL_REPORTS_VIEW), getHotelReport);
router.get('/restaurant', protect, required(PERMISSIONS.RESTAURANT_REPORTS_VIEW), getRestaurantReport);
router.get('/inventory', protect, required(PERMISSIONS.INVENTORY_REPORTS_VIEW), getInventoryReport);
router.get('/combined', protect, required(PERMISSIONS.FINANCIAL_REPORTS_VIEW), getCombinedReport);
router.get('/kpis', protect, required(PERMISSIONS.KPIS_VIEW), getKPIs);
router.get('/department-revenue', protect, required(PERMISSIONS.KPIS_VIEW), getDepartmentRevenue);

export default router;
