import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getInventoryCategories, createInventoryCategory,
  getInventory, createInventoryItem, adjustStock, getStockMovements, getLowStock,
  getSuppliers, createSupplier,
  getPurchases, getPurchase, createPurchase, updatePurchaseStatus,
} from '../controllers/inventoryController.js';

const router = Router();

router.get('/categories', protect, getInventoryCategories);
router.post('/categories', protect, createInventoryCategory);
router.get('/suppliers', protect, getSuppliers);
router.post('/suppliers', protect, createSupplier);
router.get('/purchases', protect, getPurchases);
router.post('/purchases', protect, createPurchase);
router.get('/purchases/:id', protect, getPurchase);
router.put('/purchases/:id/status', protect, updatePurchaseStatus);
router.post('/adjust', protect, adjustStock);
router.get('/movements', protect, getStockMovements);
router.get('/low-stock', protect, getLowStock);
router.get('/', protect, getInventory);
router.post('/', protect, createInventoryItem);

export default router;
