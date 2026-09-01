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

// ---------- PUBLIC AMENITIES ----------
export const publicAmenities = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, category, description, status, location, operating_hours, price, pricing_type, capacity, image
     FROM amenities WHERE status='ACTIVE' ORDER BY id`);
  res.json({ success: true, data: rows });
});

export const publicAmenityServices = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.description, s.price, s.pricing_type, s.duration_min, s.capacity, s.image
     FROM amenity_services s
     LEFT JOIN amenities a ON a.id=s.amenity_id
     WHERE s.amenity_id=$1 AND s.status='ACTIVE' ORDER BY s.id`, [req.params.amenityId]);
  res.json({ success: true, data: rows });
});

// ---------- PUBLIC CONFERENCE HALLS ----------
export const publicConferenceHalls = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, capacity, location, description, rate, rate_type, facilities, status
     FROM conference_halls WHERE status IN ('AVAILABLE','RESERVED') ORDER BY id`);
  res.json({ success: true, data: rows });
});

export const publicEventInquiry = asyncHandler(async (req, res) => {
  const { customer_name, organization, phone, email, hall_id, event_type, event_date, start_time, end_time, attendees, notes } = req.body;
  if (!customer_name || !hall_id || !event_date) throw new ApiError(400, 'Name, hall and date required.');

  const hall = await pool.query(`SELECT * FROM conference_halls WHERE id=$1`, [hall_id]);
  if (hall.rows.length === 0) throw new ApiError(404, 'Conference hall not found.');

  const { rows } = await pool.query(
    `INSERT INTO event_bookings (booking_no, customer_name, organization, phone, email, hall_id, event_type, event_date, start_time, end_time, attendees, rate, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'INQUIRY',$13) RETURNING *`,
    [genNumber('EVT'), customer_name, organization || null, phone || null, email || null, hall_id,
     event_type || 'Other', event_date, start_time || '09:00', end_time || '17:00', attendees || 0,
     hall.rows[0].rate || 0, notes || null]);

  res.status(201).json({
    success: true,
    message: 'Event inquiry submitted. Our events team will contact you shortly.',
    data: { booking_no: rows[0].booking_no, hall: hall.rows[0].name },
  });
});
