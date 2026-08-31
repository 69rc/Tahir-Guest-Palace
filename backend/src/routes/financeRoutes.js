import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getPayments, createPayment, getInvoices, getInvoice, getGuestFolioController,
  getExpenses, createExpense, getRevenue, getAccounting,
} from '../controllers/financeController.js';

const router = Router();

router.get('/payments', protect, getPayments);
router.post('/payments', protect, createPayment);
router.get('/invoices', protect, getInvoices);
router.get('/invoices/:id', protect, getInvoice);
router.get('/folio/:guestId', protect, getGuestFolioController);
router.get('/expenses', protect, getExpenses);
router.post('/expenses', protect, createExpense);
router.get('/revenue', protect, getRevenue);
router.get('/accounting', protect, getAccounting);

export default router;
