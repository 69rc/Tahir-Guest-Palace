import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getRoomTypes, getRooms, getRoom, createRoomType, createRoom, updateRoom, getAvailableRooms,
} from '../controllers/roomController.js';

const router = Router();
router.get('/types', protect, getRoomTypes);
router.post('/types', protect, createRoomType);
router.get('/available', protect, getAvailableRooms);
router.get('/', protect, getRooms);
router.post('/', protect, createRoom);
router.get('/:id', protect, getRoom);
router.put('/:id', protect, updateRoom);

export default router;
