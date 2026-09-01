import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit, genNumber } from '../utils/common.js';
import {
  getGuestFolio, reconcileInvoice, applyGuestPayment,
} from '../services/folioService.js';
import { expireMissedStays } from './reservationController.js';

export const getCurrentStays = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, rm.room_number,
            rt.name AS room_type_name, ci.checkin_time
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     LEFT JOIN check_ins ci ON ci.reservation_id = r.id
     WHERE r.status = 'CHECKED_IN'
     ORDER BY CASE
                WHEN r.check_out_date < CURRENT_DATE THEN 0
                WHEN r.check_out_date = CURRENT_DATE THEN 1
                ELSE 2
              END,
              r.check_out_date, ci.checkin_time DESC`
  );
  res.json({ success: true, data: rows });
});

export const getReservationsForCheckin = asyncHandler(async (_req, res) => {
  await expireMissedStays();
  const { rows } = await pool.query(
    `SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, rm.room_number, rt.name AS room_type_name,
            rt.base_price AS type_price,
            COALESCE(inv.total, 0) AS stay_total,
            COALESCE(inv.paid, r.deposit, 0) AS stay_paid,
            COALESCE(inv.balance, 0) AS stay_balance
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     LEFT JOIN LATERAL (
       SELECT i.total, i.paid, i.balance
       FROM invoices i
       WHERE i.reservation_id = r.id AND i.invoice_type = 'HOTEL'
       ORDER BY i.created_at DESC
       LIMIT 1
     ) inv ON TRUE
     WHERE r.status = 'CONFIRMED'
       AND r.check_out_date > CURRENT_DATE
     ORDER BY CASE
                WHEN r.check_in_date < CURRENT_DATE THEN 0
                WHEN r.check_in_date = CURRENT_DATE THEN 1
                ELSE 2
              END,
              r.check_in_date`
  );
  res.json({ success: true, data: rows });
});

export const checkIn = asyncHandler(async (req, res) => {
  const { reservation_id, amount_paid, payment_method } = req.body;
  const r = await pool.query(
    `SELECT r.*, g.full_name FROM reservations r
     JOIN guests g ON g.id = r.guest_id WHERE r.id = $1`,
    [reservation_id]
  );
  if (r.rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  const resv = r.rows[0];
  if (resv.status === 'CHECKED_IN') throw new ApiError(400, 'Guest is already checked in.');
  if (resv.status === 'NO_SHOW') {
    throw new ApiError(400, 'This booking was missed. The stay has ended and the payment is kept. Make a new reservation.');
  }
  if (resv.status !== 'CONFIRMED') throw new ApiError(400, `Reservation status is ${resv.status}; cannot check in.`);
  if (String(resv.check_out_date).slice(0, 10) <= new Date().toLocaleDateString('en-CA')) {
    throw new ApiError(400, 'This booking has ended. The guest missed the stay. Payment is kept — make a new reservation.');
  }

  const room = await pool.query('SELECT * FROM rooms WHERE id=$1', [resv.room_id]);
  if (room.rows.length === 0) throw new ApiError(404, 'Room not found.');
  if (room.rows[0].status === 'MAINTENANCE') throw new ApiError(400, 'Room is under maintenance.');
  if (room.rows[0].status === 'OCCUPIED') throw new ApiError(400, 'Room is currently occupied.');

  const paidNow = Number(amount_paid) || 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (paidNow > 0) {
      await applyGuestPayment(client, {
        guestId: resv.guest_id,
        reservationId: resv.id,
        amount: paidNow,
        method: payment_method || 'CASH',
        note: 'Payment at check-in',
        receivedBy: req.user?.id,
        category: 'ROOM',
      });
      await client.query(
        `UPDATE reservations SET deposit = COALESCE(deposit,0) + $2,
                payment_method = COALESCE($3, payment_method)
         WHERE id=$1`,
        [reservation_id, paidNow, payment_method || null]
      );
    }
    await client.query('UPDATE reservations SET status=$2 WHERE id=$1', [reservation_id, 'CHECKED_IN']);
    await client.query('UPDATE rooms SET status=$2 WHERE id=$1', [resv.room_id, 'OCCUPIED']);
    await client.query(
      `INSERT INTO check_ins (reservation_id, guest_id, room_id, checked_in_by) VALUES ($1,$2,$3,$4)`,
      [reservation_id, resv.guest_id, resv.room_id, req.user?.id]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await audit(req.user?.id, 'CHECK_IN', 'reservations', reservation_id, {
    guest: resv.full_name,
    room_id: resv.room_id,
    reservation_no: resv.reservation_no,
    paid: paidNow,
  });
  const roomNo = room.rows[0].room_number;
  const msg = paidNow > 0
    ? `Guest checked in to room ${roomNo}. Collected ₦${paidNow.toLocaleString()}.`
    : `Guest checked in to room ${roomNo}.`;
  res.json({ success: true, message: msg });
});

export const checkOutPreview = asyncHandler(async (req, res) => {
  const { reservation_id } = req.params;
  const r = await pool.query(
    `SELECT r.*, g.full_name AS guest_name, g.phone, g.email, rm.room_number,
            rt.name AS room_type_name, ci.checkin_time
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     LEFT JOIN check_ins ci ON ci.reservation_id = r.id
     WHERE r.id = $1`,
    [reservation_id]
  );
  if (r.rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  const resv = r.rows[0];

  const nights = Math.max(
    1,
    Math.round((new Date(resv.check_out_date) - new Date(resv.check_in_date)) / 86400000)
  );
  const roomCharge = nights * Number(resv.rate || 0);
  const folio = await getGuestFolio(resv.guest_id);

  res.json({
    success: true,
    data: {
      reservation: resv,
      nights,
      roomCharge,
      roomRate: Number(resv.rate),
      folio,
    },
  });
});

export const checkOut = asyncHandler(async (req, res) => {
  const { reservation_id, payment_method, amount_paid } = req.body;
  const r = await pool.query(
    `SELECT r.*, g.full_name FROM reservations r
     JOIN guests g ON g.id = r.guest_id WHERE r.id = $1`,
    [reservation_id]
  );
  if (r.rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  const resv = r.rows[0];
  if (resv.status === 'CHECKED_OUT') throw new ApiError(400, 'Already checked out.');
  let paymentApplied = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hasRoomLine = await client.query(
      `SELECT 1 FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.guest_id=$1
         AND (i.reservation_id=$2 OR i.reservation_id IS NULL)
         AND (ii.description ILIKE '%night%' OR ii.description ILIKE 'Room %')
       LIMIT 1`,
      [resv.guest_id, resv.id]
    );
    if (hasRoomLine.rows.length === 0 && Number(resv.rate) > 0) {
      const nights = Math.max(
        1,
        Math.round((new Date(resv.check_out_date) - new Date(resv.check_in_date)) / 86400000)
      );
      const roomCharge = nights * Number(resv.rate) - Number(resv.discount || 0);
      const existing = await client.query(
        `SELECT * FROM invoices WHERE guest_id=$1 AND status IN ('UNPAID','PARTIAL')
         ORDER BY CASE WHEN reservation_id IS NOT DISTINCT FROM $2 THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
        [resv.guest_id, resv.id]
      );
      let invId = existing.rows[0]?.id;
      if (!invId) {
        const created = await client.query(
          `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal,discount,tax,total,paid,balance,status)
           VALUES ($1,$2,$3,'HOTEL',0,0,0,0,0,0,'UNPAID') RETURNING id`,
          [genNumber('INV'), resv.guest_id, resv.id]
        );
        invId = created.rows[0].id;
      }
      if (roomCharge > 0) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5)`,
          [invId, `Room ${nights} nights × ₦${Number(resv.rate).toLocaleString()}`, nights, resv.rate, roomCharge]
        );
        await reconcileInvoice(client, invId);
      }
    }

    if (Number(amount_paid) > 0) {
      paymentApplied = await applyGuestPayment(client, {
        guestId: resv.guest_id,
        reservationId: resv.id,
        amount: amount_paid,
        method: payment_method || 'CASH',
        note: 'Checkout settlement',
        receivedBy: req.user?.id,
        category: 'ROOM',
      });
    }

    await client.query(
      `INSERT INTO check_outs (reservation_id, guest_id, room_id, checked_out_by) VALUES ($1,$2,$3,$4)`,
      [reservation_id, resv.guest_id, resv.room_id, req.user?.id]
    );
    await client.query('UPDATE reservations SET status=$2 WHERE id=$1', [reservation_id, 'CHECKED_OUT']);
    await client.query('UPDATE rooms SET status=$2 WHERE id=$1', [resv.room_id, 'CLEANING']);

    const openTask = await client.query(
      `SELECT id FROM housekeeping_tasks
       WHERE room_id=$1 AND task_status IN ('PENDING','ASSIGNED','IN_PROGRESS')
       ORDER BY created_at DESC LIMIT 1`,
      [resv.room_id]
    );
    if (openTask.rows.length) {
      await client.query(
        `UPDATE housekeeping_tasks
         SET status='DIRTY', priority='HIGH', note=COALESCE(note, 'After check-out'),
             due_time=COALESCE(due_time, now() + interval '2 hours')
         WHERE id=$1`,
        [openTask.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO housekeeping_tasks (room_id, status, task_status, priority, reported_by, note, due_time)
         VALUES ($1,'DIRTY','PENDING','HIGH',$2,'After check-out', now() + interval '2 hours')`,
        [resv.room_id, req.user?.id]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await audit(req.user?.id, 'CHECK_OUT', 'reservations', reservation_id, {
    guest: resv.full_name,
    room_id: resv.room_id,
    reservation_no: resv.reservation_no,
    paid: paymentApplied,
    room_status: 'CLEANING',
  });

  const folio = await getGuestFolio(resv.guest_id);
  res.json({
    success: true,
    message: `Guest checked out. Room moved to cleaning.`,
    data: { folio, roomNumber: resv.room_id },
  });
});
