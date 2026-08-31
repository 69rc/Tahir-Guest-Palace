import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';
import { getGuestFolio, getOrCreateFolioInvoice, addInvoiceLine } from '../services/folioService.js';

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
     ORDER BY ci.checkin_time DESC`
  );
  res.json({ success: true, data: rows });
});

export const getReservationsForCheckin = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, g.full_name AS guest_name, rm.room_number, rt.name AS room_type_name,
            rt.base_price AS type_price
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.status = 'CONFIRMED'
     ORDER BY r.check_in_date LIMIT 20`
  );
  res.json({ success: true, data: rows });
});

export const checkIn = asyncHandler(async (req, res) => {
  const { reservation_id } = req.body;
  const r = await pool.query(
    `SELECT r.*, g.full_name FROM reservations r
     JOIN guests g ON g.id = r.guest_id WHERE r.id = $1`,
    [reservation_id]
  );
  if (r.rows.length === 0) throw new ApiError(404, 'Reservation not found.');
  const resv = r.rows[0];
  if (resv.status === 'CHECKED_IN') throw new ApiError(400, 'Guest is already checked in.');
  if (resv.status !== 'CONFIRMED') throw new ApiError(400, `Reservation status is ${resv.status}; cannot check in.`);

  const room = await pool.query('SELECT * FROM rooms WHERE id=$1', [resv.room_id]);
  if (room.rows.length === 0) throw new ApiError(404, 'Room not found.');
  if (room.rows[0].status === 'MAINTENANCE') throw new ApiError(400, 'Room is under maintenance.');
  if (room.rows[0].status === 'OCCUPIED') throw new ApiError(400, 'Room is currently occupied.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

  await audit(req.user?.id, 'CHECK_IN', 'reservations', reservation_id, { guest: resv.full_name });
  res.json({ success: true, message: `Guest checked in to room ${room.rows[0].room_number}.` });
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

  // Room charges
  const checkin = new Date(resv.checkin_time || resv.check_in_date);
  const today = new Date();
  let nights = resv.rate && resv.check_out_date
    ? Math.round((new Date(resv.check_out_date) - new Date(resv.check_in_date)) / 86400000)
    : Math.max(1, Math.round((today - checkin) / 86400000));
  nights = Math.max(1, nights);
  const roomCharge = nights * Number(resv.rate);

  const folio = await getGuestFolio(resv.guest_id);

  const result = {
    reservation: resv,
    nights,
    roomCharge,
    roomRate: Number(resv.rate),
    folio,
  };
  res.json({ success: true, data: result });
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

    // Ensure room charges are on the folio
    const folio = await getGuestFolioResv(client, resv.guest_id, resv.id);
    const inv = await getOrCreateFolioInvoiceResv(client, resv.guest_id, resv.id);
    const hasRoomLine = await client.query(
      `SELECT 1 FROM invoice_items WHERE invoice_id=$1 AND description ILIKE '%nights%'`,
      [inv.id]
    );
    const checkin = new Date(resv.checkin_time || resv.check_in_date);
    const nights = Math.max(1, Math.round((new Date() - checkin) / 86400000));
    const roomCharge = nights * Number(resv.rate);

    if (hasRoomLine.rows.length === 0 && roomCharge > 0) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$4)`,
        [inv.id, `Room ${nights} nights × ₦${Number(resv.rate).toLocaleString()}`, nights, roomCharge]
      );
      await client.query(
        `UPDATE invoices SET subtotal=subtotal+$2, total=total+$2 WHERE id=$1`,
        [inv.id, roomCharge]
      );
    }

    // Apply payment if provided
    if (amount_paid > 0) {
      await client.query(
        `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note)
         VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Checkout settlement')`,
        [genNumber('PAY'), resv.guest_id, resv.id, inv.id, amount_paid, payment_method || 'CASH']
      );
      await client.query(`UPDATE invoices SET paid=paid+$2 WHERE id=$1`, [inv.id, amount_paid]);
      paymentApplied = Number(amount_paid);
    }

    // Refresh totals/balance/status
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    // Recompute balances for all guest invoices
    const invs = await client2.query('SELECT id FROM invoices WHERE guest_id=$1', [resv.guest_id]);
    for (const inv of invs.rows) {
      await client2.query(
        `UPDATE invoices SET balance = total - paid,
           status = CASE WHEN total - paid <= 0.01 THEN 'PAID' WHEN paid>0 THEN 'PARTIAL' ELSE 'UNPAID' END
         WHERE id=$1`, [inv.id]);
    }
    await client2.query(
      `INSERT INTO check_outs (reservation_id, guest_id, room_id, checked_out_by) VALUES ($1,$2,$3,$4)`,
      [reservation_id, resv.guest_id, resv.room_id, req.user?.id]
    );
    await client2.query('UPDATE reservations SET status=$2 WHERE id=$1', [reservation_id, 'CHECKED_OUT']);
    await client2.query('UPDATE rooms SET status=$2 WHERE id=$1', [resv.room_id, 'CLEANING']);
    await client2.query('COMMIT');
  } catch (e) {
    await client2.query('ROLLBACK');
    throw e;
  } finally {
    client2.release();
  }

  await audit(req.user?.id, 'CHECK_OUT', 'reservations', reservation_id, {
    guest: resv.full_name, paid: paymentApplied,
  });

  const folio = await getGuestFolio(resv.guest_id);
  res.json({
    success: true,
    message: `Guest checked out. Room moved to CLEANING.`,
    data: { folio, roomNumber: resv.room_id },
  });
});

// Helper with client for transactions
async function getGuestFolioResv(client, guestId, resvId) {
  const invoices = await client.query(
    `SELECT * FROM invoices WHERE guest_id=$1 ORDER BY created_at`, [guestId]);
  const payments = await client.query(
    `SELECT * FROM payments WHERE guest_id=$1`, [guestId]);
  let total = 0, paid = 0;
  invoices.rows.forEach((i) => (total += Number(i.total)));
  payments.rows.forEach((p) => (paid += Number(p.amount)));
  return { totalCharges: total, totalPaid: paid, balance: total - paid };
}

async function getOrCreateFolioInvoiceResv(client, guestId, resvId) {
  const existing = await client.query(
    `SELECT * FROM invoices WHERE guest_id=$1 AND status IN ('UNPAID','PARTIAL')
     ORDER BY created_at DESC LIMIT 1`, [guestId]);
  if (existing.rows.length) return existing.rows[0];
  const { rows } = await client.query(
    `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal,discount,tax,total,paid,balance,status)
     VALUES ($1,$2,$3,'HOTEL',0,0,0,0,0,0,'UNPAID') RETURNING *`,
    [genNumber('INV'), guestId, resvId]);
  return rows[0];
}

import { genNumber } from '../utils/common.js';
