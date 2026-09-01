import { Router } from 'express';
import { protect, requireRole, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getRoles, getUsers, createUser, updateUser, getAuditLogs, resetPassword,
  getPermissions, createRole, updateRolePermissions,
} from '../controllers/staffController.js';

const router = Router();
router.get('/', protect, required(PERMISSIONS.STAFF_VIEW), getUsers);
router.get('/roles', protect, required(PERMISSIONS.STAFF_VIEW), getRoles);
router.get('/permissions', protect, requireRole('SUPER_ADMIN', 'ADMIN'), getPermissions);
router.post('/roles', protect, requireRole('SUPER_ADMIN', 'ADMIN'), createRole);
router.put('/roles/:id/permissions', protect, requireRole('SUPER_ADMIN', 'ADMIN'), updateRolePermissions);
router.get('/users', protect, required(PERMISSIONS.STAFF_VIEW), getUsers);
router.post('/users', protect, requireRole('SUPER_ADMIN', 'ADMIN'), createUser);
router.put('/users/:id', protect, requireRole('SUPER_ADMIN', 'ADMIN'), updateUser);
router.post('/users/:id/reset-password', protect, requireRole('SUPER_ADMIN', 'ADMIN'), resetPassword);
router.get('/audit-logs', protect, required(PERMISSIONS.AUDIT_VIEW), getAuditLogs);

export default router;
