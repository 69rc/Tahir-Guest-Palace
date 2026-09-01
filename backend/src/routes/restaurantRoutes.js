import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getRestaurants, createRestaurant, updateRestaurant,
  getTables, createTable, updateTableStatus,
  getMenu, createMenuCategory, createMenuItem, updateMenuItem,
  createOrder, getOrder, getOrders, getActiveOrders, chargeToRoom, payOrder, getInHouseRooms,
} from '../controllers/restaurantController.js';
import { assertRestaurantAccess } from '../utils/restaurantAccess.js';

const router = Router();

// Enforce that a user may only access restaurant resources they are assigned to.
// Guards every route carrying a :restaurantId path parameter.
async function restrictRestaurant(req, _res, next) {
  try {
    await assertRestaurantAccess(req.user, req.params.restaurantId);
    next();
  } catch (e) {
    next(e);
  }
}

router.get('/', protect, required(PERMISSIONS.RESTAURANTS_VIEW), getRestaurants);
router.post('/', protect, required(PERMISSIONS.RESTAURANTS_MANAGE), createRestaurant);
router.get('/in-house', protect, required(PERMISSIONS.CHARGE_ROOM), getInHouseRooms);
router.put('/:id', protect, required(PERMISSIONS.RESTAURANTS_MANAGE), updateRestaurant);

router.get('/:restaurantId/tables', protect, required(PERMISSIONS.TABLES_VIEW), restrictRestaurant, getTables);
router.post('/tables', protect, required(PERMISSIONS.TABLES_MANAGE), createTable);
router.put('/tables/:id/status', protect, required(PERMISSIONS.TABLES_MANAGE), updateTableStatus);

router.get('/:restaurantId/menu', protect, required(PERMISSIONS.MENU_VIEW), restrictRestaurant, getMenu);
router.post('/menu-categories', protect, required(PERMISSIONS.MENU_MANAGE), createMenuCategory);
router.post('/menu-items', protect, required(PERMISSIONS.MENU_MANAGE), createMenuItem);
router.put('/menu-items/:id', protect, required(PERMISSIONS.MENU_MANAGE), updateMenuItem);

router.get('/:restaurantId/orders', protect, required(PERMISSIONS.ORDERS_VIEW), restrictRestaurant, getOrders);
router.get('/:restaurantId/orders/active', protect, required(PERMISSIONS.ORDERS_VIEW), restrictRestaurant, getActiveOrders);
router.post('/orders', protect, required(PERMISSIONS.ORDERS_MANAGE), createOrder);
router.get('/orders/:id', protect, required(PERMISSIONS.ORDERS_VIEW), getOrder);
router.post('/orders/:id/charge-to-room', protect, required(PERMISSIONS.CHARGE_ROOM), chargeToRoom);
router.post('/orders/:id/pay', protect, required(PERMISSIONS.ORDERS_MANAGE), payOrder);

export default router;
