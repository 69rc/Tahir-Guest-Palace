import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getRestaurants, createRestaurant,
  getTables, createTable, updateTableStatus,
  getMenu, createMenuCategory, createMenuItem,
  createOrder, getOrder, getOrders, getActiveOrders, chargeToRoom, payOrder,
} from '../controllers/restaurantController.js';

const router = Router();

router.get('/', protect, getRestaurants);
router.post('/', protect, createRestaurant);

router.get('/:restaurantId/tables', protect, getTables);
router.post('/tables', protect, createTable);
router.put('/tables/:id/status', protect, updateTableStatus);

router.get('/:restaurantId/menu', protect, getMenu);
router.post('/menu-categories', protect, createMenuCategory);
router.post('/menu-items', protect, createMenuItem);

router.get('/:restaurantId/orders', protect, getOrders);
router.get('/:restaurantId/orders/active', protect, getActiveOrders);
router.post('/orders', protect, createOrder);
router.get('/orders/:id', protect, getOrder);
router.post('/orders/:id/charge-to-room', protect, chargeToRoom);
router.post('/orders/:id/pay', protect, payOrder);

export default router;
