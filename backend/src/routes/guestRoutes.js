import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getGuests, getGuest, createGuest, updateGuest,
} from '../controllers/guestController.js';

const router = Router();
router.get('/', protect, getGuests);
router.post('/', protect, createGuest);
router.get('/:id', protect, getGuest);
router.put('/:id', protect, updateGuest);

export default router;
