import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import checkinRoutes from './routes/checkinRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import housekeepingRoutes from './routes/housekeepingRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import amenityRoutes from './routes/amenityRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import procurementRoutes from './routes/procurementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';

import { notFound, errorHandler } from './utils/helpers.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Tahir Guest Palace API is running.' }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/purchase-requests', procurementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Tahir Guest Palace API listening on port ${PORT}`);
});
