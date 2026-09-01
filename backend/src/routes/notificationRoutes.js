import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getNotifications, markNotificationRead, markAllRead, generateSystemNotifications, clearAll
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', protect, required(PERMISSIONS.NOTIFICATIONS_VIEW), getNotifications);
router.post('/generate', protect, required(PERMISSIONS.NOTIFICATIONS_VIEW), generateSystemNotifications);
router.post('/read-all', protect, required(PERMISSIONS.NOTIFICATIONS_VIEW), markAllRead);
router.put('/:id/read', protect, required(PERMISSIONS.NOTIFICATIONS_VIEW), markNotificationRead);
router.delete('/clear', protect, required(PERMISSIONS.NOTIFICATIONS_VIEW), clearAll);

export default router;
