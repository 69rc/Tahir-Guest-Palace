import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber } from '../utils/common.js';

export const publicHotelInfo = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Tahir Guest Palace',
      location: 'Kano, Nigeria',
      currency: 'NGN',
    },
  });
});

export const publicRoomTypes = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM room_types ORDER BY base_price');
  res.json({ success: true, data: rows });
});

export const publicRooms = asyncHandler(async (req, res) => {
  const { check_in, check_out, room_type_id } = req.query;
  let q = `SELECT rm.id, rm.room_number, rm.floor, rm.price_per_night, rm.description,
                  rt.name AS room_type, rt.capacity
           FROM rooms rm LEFT JOIN room_types rt ON rt.id=rm.room_type_id
           WHERE rm.status='AVAILABLE'`;
  const params = [];
  if (room_type_id) { params.push(room_type_id); q += ` AND rm.room_type_id=$${params.length}`; }
  if (check_in && check_out) {
    params.push(check_in, check_out);
    q += ` AND rm.id NOT IN (
        SELECT room_id FROM reservations
        WHERE status IN ('CONFIRMED','CHECKED_IN','PENDING')
          AND check_in_date < $${params.length} AND check_out_date > $${params.length - 1}
      )`;
  }
  q += ` ORDER BY rm.price_per_night`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const publicMenu = asyncHandler(async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const cats = await pool.query(`SELECT * FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order,id`, [restaurantId]);
  const items = await pool.query(`SELECT * FROM menu_items WHERE restaurant_id=$1 AND is_available ORDER BY id`, [restaurantId]);
  res.json({ success: true, data: { categories: cats.rows, items: items.rows } });
});

export const publicRestaurants = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, description FROM restaurants WHERE is_active');
  res.json({ success: true, data: rows });
});

export const publicBooking = asyncHandler(async (req, res) => {
  const {
    full_name, phone, email, room_id, check_in_date, check_out_date, adults, children, special_requests,
  } = req.body;
  if (!full_name || !check_in_date || !check_out_date) throw new ApiError(400, 'Name and dates required.');
  if (new Date(check_out_date) <= new Date(check_in_date)) throw new ApiError(400, 'Check-out must be after check-in.');

  const room = await pool.query('SELECT * FROM rooms WHERE id=$1', [room_id]);
  if (room.rows.length === 0) throw new ApiError(404, 'Room not found.');

  const clash = await pool.query(
    `SELECT res.id FROM reservations res WHERE res.room_id=$1 AND res.status IN ('CONFIRMED','CHECKED_IN','PENDING')
     AND res.check_in_date < $3 AND res.check_out_date > $2 LIMIT 1`,
    [room_id, check_in_date, check_out_date]);
  if (clash.rows.length) throw new ApiError(400, 'Room is not available for the selected dates.');

  const nights = Math.round((new Date(check_out_date) - new Date(check_in_date)) / 86400000);
  const rate = Number(room.rows[0].price_per_night);
  const total = nights * rate;

  const guest = await pool.query(
    `INSERT INTO guests (full_name, phone, email, nationality) VALUES ($1,$2,$3,'Nigerian') RETURNING *`,
    [full_name, phone, email]);

  const resv = await pool.query(
    `INSERT INTO reservations (reservation_no, guest_id, room_id, room_type_id, check_in_date, check_out_date,
       adults, children, rate, discount, deposit, status, source, special_requests)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,'PENDING','online', $10) RETURNING *`,
    [genNumber('RES'), guest.rows[0].id, room_id, room.rows[0].room_type_id, check_in_date, check_out_date,
     adults || 1, children || 0, rate, special_requests || null]);

  res.status(201).json({
    success: true,
    message: 'Booking request received. Payment is simulated for the demo.',
    data: { reservation_no: resv.rows[0].reservation_no, total, nights, rate },
  });
});
