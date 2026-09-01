import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getPurchaseRequests, getPurchaseRequest, createPurchaseRequest,
  approvePurchaseRequest, convertToPurchaseOrder, recordGoodsReceived
} from '../controllers/procurementController.js';

const router = Router();

router.get('/', protect, required(PERMISSIONS.PURCHASE_REQUESTS_VIEW), getPurchaseRequests);
router.get('/:id', protect, required(PERMISSIONS.PURCHASE_REQUESTS_VIEW), getPurchaseRequest);
router.post('/', protect, required(PERMISSIONS.PURCHASE_REQUESTS_CREATE), createPurchaseRequest);
router.post('/:id/approve', protect, required(PERMISSIONS.PURCHASE_REQUESTS_APPROVE), approvePurchaseRequest);
router.post('/:id/convert', protect, required(PERMISSIONS.PURCHASE_REQUESTS_APPROVE), convertToPurchaseOrder);
router.post('/:id/receive', protect, required(PERMISSIONS.GOODS_RECEIVED), recordGoodsReceived);

export default router;
