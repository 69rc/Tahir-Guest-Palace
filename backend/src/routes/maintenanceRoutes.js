import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getMaintenanceTickets, getMaintenanceTicket, createMaintenanceTicket,
  updateMaintenanceTicket, deleteMaintenanceTicket,
  addMaintenancePart, issueMaintenancePart, getMaintenanceDashboard
} from '../controllers/maintenanceController.js';

const router = Router();

router.get('/dashboard', protect, required(PERMISSIONS.MAINTENANCE_VIEW), getMaintenanceDashboard);
router.get('/', protect, required(PERMISSIONS.MAINTENANCE_VIEW), getMaintenanceTickets);
router.get('/:id', protect, required(PERMISSIONS.MAINTENANCE_VIEW), getMaintenanceTicket);
router.post('/', protect, required(PERMISSIONS.MAINTENANCE_MANAGE), createMaintenanceTicket);
router.put('/:id', protect, required(PERMISSIONS.MAINTENANCE_MANAGE), updateMaintenanceTicket);
router.delete('/:id', protect, required(PERMISSIONS.MAINTENANCE_MANAGE), deleteMaintenanceTicket);
router.post('/:id/parts', protect, required(PERMISSIONS.MAINTENANCE_MANAGE), addMaintenancePart);
router.put('/:id/parts/:partId/issue', protect, required(PERMISSIONS.MAINTENANCE_MANAGE), issueMaintenancePart);

export default router;
