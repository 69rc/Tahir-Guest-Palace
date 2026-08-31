import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { getRoles, getUsers, createUser, updateUser, getAuditLogs } from '../controllers/staffController.js';

const router = Router();
router.get('/roles', protect, getRoles);
router.get('/users', protect, getUsers);
router.post('/users', protect, requireRole('ADMIN', 'GENERAL_MANAGER', 'MANAGER'), createUser);
router.put('/users/:id', protect, requireRole('ADMIN', 'GENERAL_MANAGER'), updateUser);
router.get('/audit-logs', protect, requireRole('ADMIN'), getAuditLogs);

export default router;
