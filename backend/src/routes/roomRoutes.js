import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getRoomTypes, getRooms, getRoom, createRoomType, createRoom, updateRoom, getAvailableRooms,
} from '../controllers/roomController.js';

const router = Router();
router.get('/types', protect, required(PERMISSIONS.ROOM_TYPES_VIEW), getRoomTypes);
router.post('/types', protect, required(PERMISSIONS.ROOM_TYPES_MANAGE), createRoomType);
router.get('/available', protect, required(PERMISSIONS.ROOMS_VIEW), getAvailableRooms);
router.get('/', protect, required(PERMISSIONS.ROOMS_VIEW), getRooms);
router.post('/', protect, required(PERMISSIONS.ROOMS_MANAGE), createRoom);
router.get('/:id', protect, required(PERMISSIONS.ROOMS_VIEW), getRoom);
router.put('/:id', protect, required(PERMISSIONS.ROOMS_MANAGE), updateRoom);

export default router;
