import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getPayments, createPayment, getInvoices, getInvoice, getGuestFolioController,
  getExpenses, createExpense, getRevenue, getAccounting, getPaymentById,
} from '../controllers/financeController.js';

const router = Router();

router.get('/payments', protect, required(PERMISSIONS.PAYMENTS_VIEW), getPayments);
router.post('/payments', protect, required(PERMISSIONS.PAYMENTS_RECORD), createPayment);
router.get('/payments/:id', protect, required(PERMISSIONS.PAYMENTS_VIEW), getPaymentById);
router.get('/invoices', protect, required(PERMISSIONS.INVOICES_VIEW), getInvoices);
router.get('/invoices/:id', protect, required(PERMISSIONS.INVOICES_VIEW), getInvoice);
router.get('/folio/:guestId', protect, required(PERMISSIONS.FOLIOS_VIEW), getGuestFolioController);
router.get('/expenses', protect, required(PERMISSIONS.EXPENSES_VIEW), getExpenses);
router.post('/expenses', protect, required(PERMISSIONS.EXPENSES_RECORD, PERMISSIONS.RESTAURANT_EXPENSES), createExpense);
router.get('/revenue', protect, required(PERMISSIONS.REVENUE_VIEW), getRevenue);
router.get('/accounting', protect, required(PERMISSIONS.ACCOUNTING_VIEW), getAccounting);

export default router;
