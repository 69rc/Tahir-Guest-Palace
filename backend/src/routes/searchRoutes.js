import { Router } from 'express';
import { protect, required } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { globalSearch } from '../controllers/searchController.js';

const router = Router();
router.get('/', protect, required(PERMISSIONS.GLOBAL_SEARCH), globalSearch);

export default router;
