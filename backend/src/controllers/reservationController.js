import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit, openShiftId } from '../utils/common.js';

async function forfeitBooking(resv, status, action, userId) {
  await pool.query(`UPDATE reservations SET status=$2 WHERE id=$1`, [resv.id, status]);
  await pool.query(
    `UPDATE rooms SET status='AVAILABLE' WHERE id=$1 AND status='RESERVED'`,
    [resv.room_id]
  );
  await pool.query(
    `UPDATE invoices SET status='CANCELLED', total=paid, balance=0
     WHERE reservation_id=$1 AND invoice_type='HOTEL' AND status IN ('UNPAID','PARTIAL','PAID')`,
    [resv.id]
  );
  await audit(userId, action, 'reservations', resv.id, {
    reservation_no: resv.reservation_no,
    room_id: resv.room_id,
    deposit: Number(resv.deposit) || 0,
    deposit_kept: Number(resv.deposit) > 0,
  });
}

/** Missed the whole stay (never checked in, checkout date has passed). Room freed, money already paid is kept. */
export async function expireMissedStays() {
  const { rows } = await pool.query(
    `SELECT * FROM reservations
     WHERE status IN ('CONFIRMED','PENDING')
       AND check_out_date <= CURRENT_DATE`
  );
  for (const resv of rows) {
    await forfeitBooking(resv, 'NO_SHOW', 'NO_SHOW', null);
  }
  return rows.length;
}

export const getReservations = asyncHandler(async (req, res) => {
  await expireMissedStays();
  const q = `
    SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone,
           rm.room_number, rt.name AS room_type_name
    FROM reservations r
    LEFT JOIN guests g ON g.id = r.guest_id
    LEFT JOIN rooms rm ON rm.id = r.room_id
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    ORDER BY CASE r.status
               WHEN 'CONFIRMED' THEN 1
               WHEN 'CHECKED_IN' THEN 2
               WHEN 'PENDING' THEN 3
               WHEN 'CHECKED_OUT' THEN 4
               ELSE 5
             END,
             r.check_in_date DESC, r.created_at DESC`;
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
  const inv = await pool.query(
    `SELECT total, paid, balance FROM invoices
     WHERE reservation_id=$1 AND invoice_type='HOTEL'
     ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  const stay = inv.rows[0] || {};
  res.json({
    success: true,
    data: {
      ...r.rows[0],
      stay_total: Number(stay.total || 0),
      stay_paid: Number(stay.paid != null ? stay.paid : r.rows[0].deposit || 0),
      stay_balance: Number(stay.balance || 0),
    },
  });
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
  const roomRate = Number(room.rows[0].price_per_night);
  const rateBlank = rate === undefined || rate === null || rate === '';
  const actualRate = rateBlank ? roomRate : Number(rate);
  if (!Number.isFinite(actualRate) || actualRate < 0) {
    throw new ApiError(400, 'Rate must be a valid number.');
  }
  const { nights, subtotal, discount: d, total } = calculateTotals(check_in_date, check_out_date, actualRate, discount);
  const depositAmt = Number(deposit) || 0;
  const adultCount = Number(adults) > 0 ? Number(adults) : 1;
  const childCount = Number(children) > 0 ? Number(children) : 0;
  const paidAmt = depositAmt;
  const balanceAmt = Math.max(0, total - paidAmt);
  const invStatus = paidAmt >= total && total > 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID');

  const { rows } = await pool.query(
    `INSERT INTO reservations
      (reservation_no, guest_id, room_id, room_type_id, check_in_date, check_out_date,
       adults, children, rate, discount, deposit, payment_method, special_requests, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [genNumber('RES'), gid, rid, room.rows[0].room_type_id, check_in_date, check_out_date,
     adultCount, childCount, actualRate, d, depositAmt, payment_method || null,
     special_requests || null, 'CONFIRMED']
  );

  // Open the guest folio with the room charge. Amount paid now (if any) is recorded
  // as a payment against this invoice so the balance stays correct.
  const inv = await pool.query(
    `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, discount, tax, total, paid, balance, status)
     VALUES ($1,$2,$3,'HOTEL',$4,$5,0,$6,$7,$8,$9) RETURNING *`,
    [genNumber('INV'), gid, rows[0].id, subtotal, d, total, paidAmt, balanceAmt, invStatus]
  );
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,$2,$3,$4,$5)`,
    [inv.rows[0].id, `Room ${nights} nights × ₦${Number(actualRate).toLocaleString()}`, nights, actualRate, subtotal]
  );
  if (paidAmt > 0) {
    const shiftId = await openShiftId(req.user?.id);
    await pool.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by, shift_id)
       VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Payment on reservation',$7,$8)`,
      [genNumber('PAY'), gid, rows[0].id, inv.rows[0].id, paidAmt, payment_method || 'CASH', req.user?.id, shiftId]
    );
  }

  // Mark room RESERVED
  await pool.query(`UPDATE rooms SET status='RESERVED' WHERE id=$1 AND status='AVAILABLE'`, [rid]);

  await audit(req.user?.id, 'CREATE_RESERVATION', 'reservations', rows[0].id, {
    reservation_no: rows[0].reservation_no,
    room_id: rid,
    nights,
    rate: actualRate,
    total,
    deposit: depositAmt,
    payment_method: payment_method || null,
  });
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
  const id = req.params.id;
  const { rows: existing } = await pool.query('SELECT * FROM reservations WHERE id=$1', [id]);
  if (!existing.length) throw new ApiError(404, 'Reservation not found.');
  const resv = existing[0];
  if (resv.status === 'CANCELLED') throw new ApiError(400, 'Reservation is already cancelled.');
  if (resv.status === 'CHECKED_OUT') throw new ApiError(400, 'Cannot cancel a stay that has already checked out.');
  if (resv.status === 'CHECKED_IN') {
    throw new ApiError(400, 'Guest is already in house. Check them out instead of cancelling.');
  }

  const depositAmt = Number(resv.deposit) || 0;
  await forfeitBooking(resv, 'CANCELLED', 'CANCEL_RESERVATION', req.user?.id);

  res.json({
    success: true,
    data: { ...resv, status: 'CANCELLED' },
    message: depositAmt > 0
      ? `Reservation cancelled. Deposit of ₦${depositAmt.toLocaleString()} is kept by the hotel.`
      : 'Reservation cancelled. Room is available again.',
  });
});

export const getReservationCalendar = asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) throw new ApiError(400, 'Start and end dates are required.');
  if (new Date(end) <= new Date(start)) throw new ApiError(400, 'End date must be after start date.');

  // All reservations overlapping the range
  const { rows: reservations } = await pool.query(
    `SELECT r.id, r.reservation_no, r.guest_id, r.room_id, g.full_name AS guest_name,
            g.phone AS guest_phone, r.check_in_date, r.check_out_date, r.status, r.rate,
            rm.room_number, rm.room_type_id, rt.name AS room_type_name,
            r.discount, r.deposit
     FROM reservations r
     LEFT JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     WHERE r.check_in_date < $2 AND r.check_out_date > $1
     ORDER BY r.check_in_date ASC`,
    [start, end]
  );

  // All rooms for the grid
  const { rows: rooms } = await pool.query(
    `SELECT rm.id, rm.room_number, rm.floor, rm.status, rm.price_per_night,
            rt.name AS room_type_name
     FROM rooms rm
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number`
  );

  // Rooms out of order for the range
  const { rows: outOfOrder } = await pool.query(
    `SELECT t.id AS ticket_id, t.room_id, rm.room_number, t.priority, t.status AS ticket_status
     FROM maintenance_tickets t
     JOIN rooms rm ON rm.id = t.room_id
     WHERE rm.status = 'OUT_OF_ORDER' AND t.status NOT IN ('RESOLVED','CLOSED')`
  );

  res.json({
    success: true,
    data: {
      rooms,
      reservations,
      outOfOrder,
    }
  });
});

export const updateReservationDates = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { check_in_date, check_out_date, room_id } = req.body;

  if (!check_in_date && !check_out_date && !room_id) {
    throw new ApiError(400, 'Provide at least one field to update.');
  }

  const { rows: existing } = await pool.query(
    `SELECT * FROM reservations WHERE id=$1`, [id]
  );
  if (!existing.length) throw new ApiError(404, 'Reservation not found.');
  const resv = existing[0];

  const newCheckIn = check_in_date || resv.check_in_date;
  const newCheckOut = check_out_date || resv.check_out_date;
  const newRoomId = room_id || resv.room_id;

  if (new Date(newCheckOut) <= new Date(newCheckIn)) {
    throw new ApiError(400, 'Check-out must be after check-in.');
  }

  // Validate target room is not OUT_OF_ORDER
  const room = await pool.query('SELECT * FROM rooms WHERE id=$1', [newRoomId]);
  if (!room.rows.length) throw new ApiError(404, 'Room not found.');
  if (room.rows[0].status === 'OUT_OF_ORDER' || room.rows[0].status === 'MAINTENANCE') {
    throw new ApiError(400, `Cannot book room ${room.rows[0].room_number}: it is out of order/maintenance.`);
  }

  // Conflict prevention (excluding self)
  const clash = await pool.query(
    `SELECT res.id, rm.room_number FROM reservations res
     JOIN rooms rm ON rm.id = res.room_id
     WHERE res.room_id = $1 AND res.id != $2
       AND res.status IN ('CONFIRMED','CHECKED_IN','PENDING')
       AND res.check_in_date < $4 AND res.check_out_date > $3
     LIMIT 1`,
    [newRoomId, id, newCheckIn, newCheckOut]
  );
  if (clash.rows.length > 0) {
    throw new ApiError(400, `Conflict: room ${clash.rows[0].room_number} is already booked for these dates.`);
  }

  const { rows } = await pool.query(
    `UPDATE reservations SET check_in_date=$2, check_out_date=$3, room_id=$4 WHERE id=$1 RETURNING *`,
    [id, newCheckIn, newCheckOut, newRoomId]
  );

  // Recompute totals for room charge if invoice exists & dates changed
  const nights = Math.max(1, Math.round((new Date(newCheckOut) - new Date(newCheckIn)) / (1000 * 60 * 60 * 24)));
  const newTotal = Math.max(0, nights * Number(room.rows[0].price_per_night) - Number(resv.discount || 0));
  await pool.query(
    `UPDATE invoices SET subtotal=$2, total=$3 WHERE reservation_id=$1 AND invoice_type='HOTEL'`,
    [id, newTotal, newTotal]
  );

  await audit(req.user?.id, 'UPDATE_RESERVATION_DATES', 'reservations', id, {
    old_check_in: resv.check_in_date, new_check_in: newCheckIn,
    old_check_out: resv.check_out_date, new_check_out: newCheckOut,
  });
  res.json({ success: true, data: rows[0] });
});
