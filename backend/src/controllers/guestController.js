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
  const { full_name, phone, email, address, id_type, id_number, nationality, notes, vip_status, guest_type, country, date_of_birth } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM guests WHERE id=$1', [id]);
  if (!existing.length) throw new ApiError(404, 'Guest not found.');

  const { rows } = await pool.query(
    `UPDATE guests SET
       full_name = COALESCE($2, full_name), phone = COALESCE($3, phone),
       email = COALESCE($4, email), address = COALESCE($5, address),
       id_type = COALESCE($6, id_type), id_number = COALESCE($7, id_number),
       nationality = COALESCE($8, nationality), notes = COALESCE($9, notes),
       vip_status = COALESCE($10, vip_status), guest_type = COALESCE($11, guest_type),
       country = COALESCE($12, country), date_of_birth = COALESCE($13, date_of_birth)
     WHERE id = $1 RETURNING *`,
    [id, full_name, phone, email, address, id_type, id_number, nationality, notes, vip_status, guest_type, country, date_of_birth]
  );
  await audit(req.user?.id, 'UPDATE_GUEST', 'guests', id, { vip_status, guest_type });
  res.json({ success: true, data: rows[0] });
});

export const getGuest360 = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const guest = await pool.query('SELECT * FROM guests WHERE id = $1', [id]);
  if (guest.rows.length === 0) throw new ApiError(404, 'Guest not found.');
  const g = guest.rows[0];

  // Current stay / reservation
  const currentReservation = await pool.query(
    `SELECT r.*, rm.room_number, rt.name AS room_type
     FROM reservations r
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     WHERE r.guest_id = $1 AND r.status IN ('CONFIRMED','CHECKED_IN')
     ORDER BY r.check_in_date LIMIT 1`,
    [id]
  );

  // Stay history
  const stayHistory = await pool.query(
    `SELECT r.*, rm.room_number, rt.name AS room_type,
            (SELECT checkout_time FROM check_outs WHERE reservation_id = r.id) AS checkout_time
     FROM reservations r
     LEFT JOIN rooms rm ON rm.id = r.room_id
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     WHERE r.guest_id = $1 AND r.status IN ('CHECKED_IN','CHECKED_OUT')
     ORDER BY r.check_in_date DESC`,
    [id]
  );

  const completedStays = stayHistory.rows.filter(r => r.status === 'CHECKED_OUT');
  const totalNights = stayHistory.rows.reduce((sum, r) => {
    const dur = (new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000;
    return sum + Math.max(1, Math.round(dur));
  }, 0);

  // Folio via service
  const { getGuestFolio } = await import('../services/folioService.js');
  const folio = await getGuestFolio(id);

  // Spending history by category from invoices
  const spending = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS room_spend FROM invoices
     WHERE guest_id=$1 AND invoice_type='ROOM'`, [id]
  );
  const restaurantSpend = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS restaurant_spend FROM invoices
     WHERE guest_id=$1 AND invoice_type='RESTAURANT'`, [id]
  );
  const amenitySpend = await pool.query(
    `SELECT inv.invoice_type, COALESCE(SUM(inv.total),0) AS total
     FROM invoices inv JOIN invoice_items ii ON ii.invoice_id = inv.id
     WHERE inv.guest_id=$1 AND inv.invoice_type IN ('SERVICE','AMENITY','SPA','BARBERSHOP')
     GROUP BY inv.invoice_type`, [id]
  );

  // Event spend
  const eventSpend = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS event_spend FROM invoices
     WHERE guest_id=$1 AND invoice_type='EVENT'`, [id]
  );

  // Preferences
  const prefs = await pool.query('SELECT * FROM guest_preferences WHERE guest_id=$1', [id]);

  // Total spending across all invoices
  const totalSpend = await pool.query(
    'SELECT COALESCE(SUM(total),0) AS total FROM invoices WHERE guest_id=$1', [id]
  );

  const amenityMap = {};
  amenitySpend.rows.forEach(r => { amenityMap[r.invoice_type] = r.total; });

  const serviceSpend = Object.values(amenityMap).reduce((a, b) => a + Number(b), 0);

  res.json({
    success: true,
    data: {
      guest: g,
      prefs: prefs.rows[0] || null,
      currentReservation: currentReservation.rows[0] || null,
      stayHistory: stayHistory.rows,
      stayStats: {
        previousStays: stayHistory.rows.length,
        completedStays: completedStays.length,
        totalNights,
      },
      folio: folio || null,
      spending: {
        room: Number(spending.rows[0].room_spend),
        restaurant: Number(restaurantSpend.rows[0].restaurant_spend),
        services: Number(serviceSpend),
        event: Number(eventSpend.rows[0].event_spend),
        lifetime: Number(totalSpend.rows[0].total),
        byCategory: amenityMap,
      }
    },
  });
});

export const updateGuestPreferences = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { room_preference, bed_preference, smoking_preference, food_preferences, special_requests, other_notes } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM guest_preferences WHERE guest_id=$1', [id]);
  if (existing.length) {
    const { rows } = await pool.query(
      `UPDATE guest_preferences SET
         room_preference=COALESCE($2, room_preference),
         bed_preference=COALESCE($3, bed_preference),
         smoking_preference=COALESCE($4, smoking_preference),
         food_preferences=COALESCE($5, food_preferences),
         special_requests=COALESCE($6, special_requests),
         other_notes=COALESCE($7, other_notes),
         updated_at=now()
       WHERE guest_id=$1 RETURNING *`,
      [id, room_preference, bed_preference, smoking_preference, food_preferences, special_requests, other_notes]
    );
    await audit(req.user?.id, 'UPDATE_GUEST_PREFS', 'guest_preferences', id, { guest_id: id });
    return res.json({ success: true, data: rows[0] });
  }

  const { rows } = await pool.query(
    `INSERT INTO guest_preferences (guest_id, room_preference, bed_preference, smoking_preference, food_preferences, special_requests, other_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, room_preference, bed_preference, smoking_preference, food_preferences, special_requests, other_notes]
  );
  await audit(req.user?.id, 'UPDATE_GUEST_PREFS', 'guest_preferences', id, { guest_id: id });
  res.status(201).json({ success: true, data: rows[0] });
});
