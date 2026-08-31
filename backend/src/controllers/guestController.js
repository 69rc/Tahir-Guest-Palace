import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

export const getGuests = asyncHandler(async (req, res) => {
  const search = req.query.search;
  let q = `SELECT * FROM guests`;
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    q += ` WHERE full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`;
  }
  q += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const getGuest = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const guest = await pool.query('SELECT * FROM guests WHERE id = $1', [id]);
  if (guest.rows.length === 0) throw new ApiError(404, 'Guest not found.');

  const currentReservation = await pool.query(
    `SELECT r.*, rm.room_number FROM reservations r
     LEFT JOIN rooms rm ON rm.id = r.room_id
     WHERE r.guest_id = $1 AND r.status IN ('CONFIRMED','CHECKED_IN')
     ORDER BY r.check_in_date LIMIT 1`,
    [id]
  );

  const previousStays = await pool.query(
    `SELECT r.*, rm.room_number,
            (SELECT checkout_time FROM check_outs WHERE reservation_id = r.id) AS checkout_time
     FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id
     WHERE r.guest_id = $1 AND r.status IN ('CHECKED_IN','CHECKED_OUT')
     ORDER BY r.check_in_date DESC`,
    [id]
  );

  const payments = await pool.query(
    `SELECT * FROM payments WHERE guest_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const orders = await pool.query(
    `SELECT o.*, res.name AS restaurant_name FROM orders o
     LEFT JOIN restaurants res ON res.id = o.restaurant_id
     WHERE o.guest_id = $1 ORDER BY o.created_at DESC`,
    [id]
  );

  const ledger = await pool.query(
    `SELECT i.id AS invoice_id, i.invoice_no, i.total, i.paid, i.balance
     FROM invoices i WHERE i.guest_id = $1 ORDER BY i.created_at DESC`,
    [id]
  );

  const outstanding = await pool.query(
    `SELECT COALESCE(SUM(balance),0) AS outstanding FROM invoices WHERE guest_id = $1 AND status IN ('PARTIAL','UNPAID')`,
    [id]
  );

  res.json({
    success: true,
    data: {
      guest: guest.rows[0],
      currentReservation: currentReservation.rows[0] || null,
      previousStays: previousStays.rows,
      payments: payments.rows,
      orders: orders.rows,
      ledger: ledger.rows,
      outstanding: outstanding.rows[0].outstanding,
    },
  });
});

export const createGuest = asyncHandler(async (req, res) => {
  const { full_name, phone, email, address, id_type, id_number, nationality, notes } = req.body;
  if (!full_name) throw new ApiError(400, 'Guest full name is required.');
  const { rows } = await pool.query(
    `INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [full_name, phone, email, address, id_type, id_number, nationality || 'Nigerian', notes]
  );
  await audit(req.user?.id, 'CREATE_GUEST', 'guests', rows[0].id, { full_name });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateGuest = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const fields = ['full_name', 'phone', 'email', 'address', 'id_type', 'id_number', 'nationality', 'notes'];
  const values = fields.map((f) => req.body[f] ?? null);
  const { rows } = await pool.query(
    `UPDATE guests SET
       full_name = COALESCE($2, full_name), phone = COALESCE($3, phone),
       email = COALESCE($4, email), address = COALESCE($5, address),
       id_type = COALESCE($6, id_type), id_number = COALESCE($7, id_number),
       nationality = COALESCE($8, nationality), notes = COALESCE($9, notes)
     WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  if (rows.length === 0) throw new ApiError(404, 'Guest not found.');
  await audit(req.user?.id, 'UPDATE_GUEST', 'guests', id);
  res.json({ success: true, data: rows[0] });
});
