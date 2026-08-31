import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';

export const getReservations = asyncHandler(async (req, res) => {
  const q = `
    SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone,
           rm.room_number, rt.name AS room_type_name
    FROM reservations r
    LEFT JOIN guests g ON g.id = r.guest_id
    LEFT JOIN rooms rm ON rm.id = r.room_id
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    ORDER BY r.created_at DESC`;
  const { rows } = await pool.query(q);
  res.json({ success: true, data: rows });
});

export const getReservation = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const r = await pool.query(
    `SELECT r.*, g.*, rm.room_number, rt.name AS room_type_name
     FROM reservations r
     LEFT JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = $1`,
    [id]
  );
  if (r.rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  res.json({ success: true, data: r.rows[0] });
});

// nights * rate - discount
function calculateTotals(checkIn, checkOut, rate, discount) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const subtotal = nights * Number(rate);
  const discountAmt = Number(discount || 0);
  const total = Math.max(0, subtotal - discountAmt);
  return { nights, subtotal, discount: discountAmt, total };
}

export const createReservation = asyncHandler(async (req, res) => {
  const {
    guest_id, full_name, phone, email, address, id_type, id_number, nationality,
    room_id, room_type_id, check_in_date, check_out_date,
    adults, children, rate, discount, deposit, payment_method, special_requests,
  } = req.body;

  if (!check_in_date || !check_out_date) throw new ApiError(400, 'Check-in and check-out dates are required.');
  if (new Date(check_out_date) <= new Date(check_in_date)) throw new ApiError(400, 'Check-out must be after check-in.');

  let gid = guest_id;
  if (!gid) {
    if (!full_name) throw new ApiError(400, 'Guest name or existing guest is required.');
    const g = await pool.query(
      `INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [full_name, phone, email, address, id_type, id_number, nationality || 'Nigerian']
    );
    gid = g.rows[0].id;
  }

  // Determine room
  let rid = room_id;
  if (!rid && room_type_id) {
    const avail = await pool.query(
      `SELECT rm.id FROM rooms rm
       LEFT JOIN reservations res ON res.room_id = rm.id AND res.status IN ('CONFIRMED','CHECKED_IN','PENDING')
         AND res.check_in_date < $2 AND res.check_out_date > $1
       WHERE rm.room_type_id = $3 AND rm.status = 'AVAILABLE'
         AND res.id IS NULL
       ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number LIMIT 1`,
      [check_in_date, check_out_date, room_type_id]
    );
    if (avail.rows.length === 0) throw new ApiError(400, 'No available room for the selected type and dates.');
    rid = avail.rows[0].id;
  }
  if (!rid) throw new ApiError(400, 'A room must be assigned.');

  // Prevent double booking
  const clash = await pool.query(
    `SELECT res.id, rm.room_number FROM reservations res
     JOIN rooms rm ON rm.id = res.room_id
     WHERE res.room_id = $1 AND res.status IN ('CONFIRMED','CHECKED_IN','PENDING')
       AND res.check_in_date < $3 AND res.check_out_date > $2
     LIMIT 1`,
    [rid, check_in_date, check_out_date]
  );
  if (clash.rows.length > 0 && String(clash.rows[0].id) !== String(req.body.reservation_id)) {
    throw new ApiError(400, `Double booking prevented: room ${clash.rows[0].room_number} already reserved for these dates.`);
  }

  const room = await pool.query('SELECT * FROM rooms WHERE id = $1', [rid]);
  if (room.rows.length === 0) throw new ApiError(404, 'Room not found.');
  const actualRate = rate ?? room.rows[0].price_per_night;
  const { nights, subtotal, discount: d, total } = calculateTotals(check_in_date, check_out_date, actualRate, discount);

  const { rows } = await pool.query(
    `INSERT INTO reservations
      (reservation_no, guest_id, room_id, room_type_id, check_in_date, check_out_date,
       adults, children, rate, discount, deposit, payment_method, special_requests, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [genNumber('RES'), gid, rid, room.rows[0].room_type_id, check_in_date, check_out_date,
     adults || 1, children || 0, actualRate, d, deposit || 0, payment_method || null,
     special_requests || null, 'CONFIRMED']
  );

  // Reservation deposit if any
  if (deposit > 0) {
    const inv = await pool.query(
      `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, discount, tax, total, paid, balance, status)
       VALUES ($1,$2,$3,'HOTEL',$4,0,0,$4,$4,0,'PAID') RETURNING *`,
      [genNumber('INV'), gid, rows[0].id, total]
    );
    await pool.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
       VALUES ($1,'Room stay ('||$2||' nights × ₦'||$3||')',1,$4,$4)`,
      [inv.rows[0].id, nights, actualRate, total]
    );
    await pool.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note)
       VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Deposit for reservation')`,
      [genNumber('PAY'), gid, rows[0].id, inv.rows[0].id, deposit, payment_method || 'CASH']
    );
  }

  // Mark room RESERVED
  await pool.query(`UPDATE rooms SET status='RESERVED' WHERE id=$1 AND status='AVAILABLE'`, [rid]);

  await audit(req.user?.id, 'CREATE_RESERVATION', 'reservations', rows[0].id, { reservation_no: rows[0].reservation_no });
  res.status(201).json({ success: true, data: rows[0], calc: { nights, subtotal, discount: d, total } });
});

export const updateReservationStatus = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const allowed = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'];
  if (!allowed.includes(status)) throw new ApiError(400, 'Invalid status.');
  const { rows } = await pool.query(
    `UPDATE reservations SET status=$2 WHERE id=$1 RETURNING *`,
    [id, status]
  );
  if (rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  // Release room if cancelled/no-show
  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    await pool.query(
      `UPDATE rooms SET status='AVAILABLE' WHERE id=$1 AND status='RESERVED'`,
      [rows[0].room_id]
    );
  }
  await audit(req.user?.id, 'UPDATE_RESERVATION_STATUS', 'reservations', id, { status });
  res.json({ success: true, data: rows[0] });
});

export const cancelReservation = asyncHandler(async (req, res) => {
  req.body.status = 'CANCELLED';
  return updateReservationStatus(req, res);
});
