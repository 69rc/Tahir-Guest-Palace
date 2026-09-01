import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getInventoryCategories, createInventoryCategory,
  getInventory, createInventoryItem, adjustStock, getStockMovements, getLowStock,
  getSuppliers, createSupplier,
  getPurchases, getPurchase, createPurchase, updatePurchaseStatus,
} from '../controllers/inventoryController.js';

const router = Router();

router.get('/categories', protect, required(PERMISSIONS.CATEGORIES_VIEW), getInventoryCategories);
router.post('/categories', protect, required(PERMISSIONS.CATEGORIES_MANAGE), createInventoryCategory);
router.get('/suppliers', protect, required(PERMISSIONS.SUPPLIERS_VIEW), getSuppliers);
router.post('/suppliers', protect, required(PERMISSIONS.SUPPLIERS_MANAGE), createSupplier);
router.get('/purchases', protect, required(PERMISSIONS.PURCHASES_VIEW), getPurchases);
router.post('/purchases', protect, required(PERMISSIONS.PURCHASES_MANAGE), createPurchase);
router.get('/purchases/:id', protect, required(PERMISSIONS.PURCHASES_VIEW), getPurchase);
router.put('/purchases/:id/status', protect, required(PERMISSIONS.PURCHASES_MANAGE), updatePurchaseStatus);
router.post('/adjust', protect, required(PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_WASTAGE), adjustStock);
router.get('/movements', protect, required(PERMISSIONS.INVENTORY_VIEW), getStockMovements);
router.get('/low-stock', protect, required(PERMISSIONS.LOW_STOCK_VIEW), getLowStock);
router.get('/', protect, required(PERMISSIONS.INVENTORY_VIEW), getInventory);
router.post('/', protect, required(PERMISSIONS.INVENTORY_MANAGE), createInventoryItem);

export default router;
