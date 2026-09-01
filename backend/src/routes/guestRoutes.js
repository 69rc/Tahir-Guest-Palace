import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getGuests, getGuest, createGuest, updateGuest, getGuest360, updateGuestPreferences,
} from '../controllers/guestController.js';

const router = Router();
router.get('/', protect, required(PERMISSIONS.GUESTS_VIEW), getGuests);
router.post('/', protect, required(PERMISSIONS.GUESTS_MANAGE), createGuest);
router.get('/:id', protect, required(PERMISSIONS.GUESTS_VIEW), getGuest);
router.get('/:id/guest360', protect, required(PERMISSIONS.GUEST_360), getGuest360);
router.put('/:id/preferences', protect, required(PERMISSIONS.GUESTS_MANAGE), updateGuestPreferences);
router.put('/:id', protect, required(PERMISSIONS.GUESTS_MANAGE), updateGuest);

export default router;
