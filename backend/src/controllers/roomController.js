import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

export const getRoomTypes = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM room_types ORDER BY base_price');
  res.json({ success: true, data: rows });
});

export const getRooms = asyncHandler(async (req, res) => {
  const status = req.query.status;
  let q = `SELECT rm.*, rt.name AS room_type, rt.capacity,
             stay.guest_name AS current_guest,
             stay.guest_phone,
             stay.reservation_id AS current_reservation_id,
             stay.reservation_status,
             stay.check_in_date,
             stay.check_out_date
           FROM rooms rm
           LEFT JOIN room_types rt ON rt.id = rm.room_type_id
           LEFT JOIN LATERAL (
             SELECT r.id AS reservation_id, r.status AS reservation_status,
                    r.check_in_date, r.check_out_date,
                    g.full_name AS guest_name, g.phone AS guest_phone
             FROM reservations r
             JOIN guests g ON g.id = r.guest_id
             WHERE r.room_id = rm.id AND r.status IN ('CHECKED_IN','CONFIRMED')
             ORDER BY CASE WHEN r.status = 'CHECKED_IN' THEN 0 ELSE 1 END, r.check_in_date
             LIMIT 1
           ) stay ON TRUE`;
  const params = [];
  if (status) {
    params.push(status);
    q += ` WHERE rm.status = $${params.length}`;
  }
  q += ` ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const getRoom = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const room = await pool.query(
    `SELECT rm.*, rt.name AS room_type, rt.capacity FROM rooms rm
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id WHERE rm.id = $1`,
    [id]
  );
  if (room.rows.length === 0) throw new ApiError(404, 'Room not found.');
  const roomRow = room.rows[0];

  const current = await pool.query(
    `SELECT r.*, g.full_name AS guest_name
     FROM reservations r JOIN guests g ON g.id = r.guest_id
     WHERE r.room_id = $1 AND r.status IN ('CHECKED_IN','CONFIRMED')
     ORDER BY r.check_in_date LIMIT 1`,
    [id]
  );

  const history = await pool.query(
    `SELECT r.*, g.full_name AS guest_name,
            (SELECT checkout_time FROM check_outs WHERE reservation_id = r.id) AS checkout_time
     FROM reservations r JOIN guests g ON g.id = r.guest_id
     WHERE r.room_id = $1 ORDER BY r.check_in_date DESC LIMIT 10`,
    [id]
  );

  const housekeeping = await pool.query(
    `SELECT * FROM housekeeping_tasks WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );

  res.json({
    success: true,
    data: {
      room: roomRow,
      current: current.rows[0] || null,
      history: history.rows,
      housekeeping: housekeeping.rows[0] || null,
    },
  });
});

export const createRoomType = asyncHandler(async (req, res) => {
  const { name, base_price, capacity, description } = req.body;
  if (!name) throw new ApiError(400, 'Room type name is required.');
  const { rows } = await pool.query(
    `INSERT INTO room_types (name, base_price, capacity, description)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, base_price || 0, capacity || 2, description || null]
  );
  await audit(req.user?.id, 'CREATE_ROOM_TYPE', 'room_types', rows[0].id);
  res.status(201).json({ success: true, data: rows[0] });
});

export const createRoom = asyncHandler(async (req, res) => {
  const { room_number, room_type_id, floor, price_per_night, status, description } = req.body;
  if (!room_number) throw new ApiError(400, 'Room number is required.');
  const { rows } = await pool.query(
    `INSERT INTO rooms (room_number, room_type_id, floor, price_per_night, status, description)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (room_number) DO NOTHING RETURNING *`,
    [room_number, room_type_id, floor || 1, price_per_night || 0, status || 'AVAILABLE', description || null]
  );
  if (rows.length === 0) throw new ApiError(400, 'Room number already exists.');
  await audit(req.user?.id, 'CREATE_ROOM', 'rooms', rows[0].id, { room_number });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { room_number, room_type_id, floor, price_per_night, status, description } = req.body;
  const { rows } = await pool.query(
    `UPDATE rooms SET
       room_number = COALESCE($2, room_number),
       room_type_id = COALESCE($3, room_type_id),
       floor = COALESCE($4, floor),
       price_per_night = COALESCE($5, price_per_night),
       status = COALESCE($6, status),
       description = COALESCE($7, description)
     WHERE id = $1 RETURNING *`,
    [id, room_number, room_type_id, floor, price_per_night, status, description]
  );
  if (rows.length === 0) throw new ApiError(404, 'Room not found.');
  await audit(req.user?.id, 'UPDATE_ROOM', 'rooms', id, rows[0]);
  res.json({ success: true, data: rows[0] });
});

export const getAvailableRooms = asyncHandler(async (req, res) => {
  const { check_in, check_out, room_type_id } = req.query;
  let q = `SELECT rm.*, rt.name AS room_type FROM rooms rm
           LEFT JOIN room_types rt ON rt.id = rm.room_type_id
           WHERE rm.status = 'AVAILABLE'`;
  const params = [];
  if (room_type_id) {
    params.push(room_type_id);
    q += ` AND rm.room_type_id = $${params.length}`;
  }
  // exclude rooms with overlapping confirmed reservations
  if (check_in && check_out) {
    params.push(check_in, check_out);
    q += ` AND rm.id NOT IN (
        SELECT room_id FROM reservations
        WHERE status IN ('CONFIRMED','CHECKED_IN','PENDING')
          AND check_in_date < $${params.length}
          AND check_out_date > $${params.length - 1}
      )`;
  }
  q += ` ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});
