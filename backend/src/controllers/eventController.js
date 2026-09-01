import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';
import { reconcileInvoice } from '../services/folioService.js';

// ---------- CONFERENCE HALLS ----------
export const getHalls = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.*,
            (SELECT COUNT(*) FROM event_bookings b WHERE b.hall_id=h.id AND b.status NOT IN ('CANCELLED')) AS bookings_count
     FROM conference_halls h ORDER BY h.id`);
  res.json({ success: true, data: rows });
});

export const createHall = asyncHandler(async (req, res) => {
  const { name, capacity, location, description, rate, rate_type, facilities, status } = req.body;
  if (!name) throw new ApiError(400, 'Hall name required.');
  const { rows } = await pool.query(
    `INSERT INTO conference_halls (name, capacity, location, description, rate, rate_type, facilities, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, capacity || 0, location || null, description || null, rate || 0, rate_type || 'DAILY',
     facilities ? JSON.stringify(facilities) : null, status || 'AVAILABLE']);
  await audit(req.user?.id, 'CREATE_HALL', 'conference_halls', rows[0].id, { name });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateHall = asyncHandler(async (req, res) => {
  const { name, capacity, location, description, rate, rate_type, facilities, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE conference_halls SET name=COALESCE($2,name), capacity=COALESCE($3,capacity),
       location=COALESCE($4,location), description=COALESCE($5,description), rate=COALESCE($6,rate),
       rate_type=COALESCE($7,rate_type), facilities=COALESCE($8,facilities::jsonb), status=COALESCE($9,status)
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, capacity, location, description, rate, rate_type, facilities ? JSON.stringify(facilities) : null, status]);
  if (rows.length === 0) throw new ApiError(404, 'Hall not found.');
  await audit(req.user?.id, 'UPDATE_HALL', 'conference_halls', rows[0].id, { name });
  res.json({ success: true, data: rows[0] });
});

// ---------- EVENT SERVICES ----------
export const getEventServices = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM event_services ORDER BY id`);
  res.json({ success: true, data: rows });
});

export const createEventService = asyncHandler(async (req, res) => {
  const { name, description, price, unit } = req.body;
  if (!name) throw new ApiError(400, 'Service name required.');
  const { rows } = await pool.query(
    `INSERT INTO event_services (name, description, price, unit) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description || null, price || 0, unit || 'pkg']);
  await audit(req.user?.id, 'CREATE_EVENT_SERVICE', 'event_services', rows[0].id, { name });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateEventService = asyncHandler(async (req, res) => {
  const { name, description, price, unit } = req.body;
  const { rows } = await pool.query(
    `UPDATE event_services SET name=COALESCE($2,name), description=COALESCE($3,description),
       price=COALESCE($4,price), unit=COALESCE($5,unit) WHERE id=$1 RETURNING *`,
    [req.params.id, name, description, price, unit]);
  if (rows.length === 0) throw new ApiError(404, 'Event service not found.');
  await audit(req.user?.id, 'UPDATE_EVENT_SERVICE', 'event_services', rows[0].id, { name });
  res.json({ success: true, data: rows[0] });
});

// ---------- EVENT BOOKINGS ----------
const HALL_BLOCKED = ['CANCELLED'];

export const getEventBookings = asyncHandler(async (req, res) => {
  const { status, from, to } = req.query;
  const p = [];
  const c = [];
  let q = `SELECT b.*, h.name AS hall_name, h.capacity AS hall_capacity, r.name AS restaurant_name
           FROM event_bookings b
           LEFT JOIN conference_halls h ON h.id=b.hall_id
           LEFT JOIN restaurants r ON r.id=b.restaurant_id`;
  if (status) { p.push(status); c.push(`b.status=$${p.length}`); }
  if (from) { p.push(from); c.push(`b.event_date >= $${p.length}::date`); }
  if (to) { p.push(to); c.push(`b.event_date <= $${p.length}::date`); }
  if (c.length) q += ` WHERE ${c.join(' AND ')}`;
  q += ` ORDER BY b.event_date DESC, b.start_time DESC LIMIT 300`;
  const { rows } = await pool.query(q, p);
  const out = [];
  for (const r of rows) {
    const svc = await pool.query(
      `SELECT ebs.*, es.name FROM event_booking_services ebs
       LEFT JOIN event_services es ON es.id=ebs.service_id WHERE ebs.booking_id=$1`, [r.id]);
    out.push({ ...r, services: svc.rows });
  }
  res.json({ success: true, data: out });
});

export const getEventBooking = asyncHandler(async (req, res) => {
  const b = await pool.query(
    `SELECT b.*, h.name AS hall_name, r.name AS restaurant_name FROM event_bookings b
     LEFT JOIN conference_halls h ON h.id=b.hall_id
     LEFT JOIN restaurants r ON r.id=b.restaurant_id WHERE b.id=$1`, [req.params.id]);
  if (b.rows.length === 0) throw new ApiError(404, 'Event booking not found.');
  const svc = await pool.query(
    `SELECT ebs.*, es.name FROM event_booking_services ebs
     LEFT JOIN event_services es ON es.id=ebs.service_id WHERE ebs.booking_id=$1`, [req.params.id]);
  const payments = await pool.query(
    `SELECT * FROM payments WHERE event_booking_id=$1 ORDER BY created_at`, [req.params.id]);
  res.json({ success: true, data: { ...b.rows[0], services: svc.rows, payments: payments.rows } });
});

export const createEventBooking = asyncHandler(async (req, res) => {
  const { customer_name, organization, phone, email, hall_id, event_type, event_date, start_time, end_time, attendees, rate, discount, deposit, notes, services, restaurant_id } = req.body;
  if (!customer_name || !hall_id || !event_date) throw new ApiError(400, 'Customer, hall and event date required.');

  const s = start_time || '09:00';
  const e = end_time || '17:00';
  if (e <= s) throw new ApiError(400, 'End time must be after start time.');

  // Overlap prevention for the same hall + date
  const clash = await pool.query(
    `SELECT id FROM event_bookings
     WHERE hall_id=$1 AND event_date=$2 AND status NOT IN ('CANCELLED')
       AND (start_time,end_time) OVERLAPS ($3::time,$4::time)
     LIMIT 1`,
    [hall_id, event_date, s, e]);
  if (clash.rows.length > 0) throw new ApiError(409, 'The hall is already booked for that time slot.');

  const client = await pool.connect();
  let created;
  try {
    await client.query('BEGIN');

    const disc = Number(discount || 0);
    const base = Number(rate || 0) - disc;
    // Build services lines
    let servicesTotal = 0;
    const svcLines = [];
    if (Array.isArray(services)) {
      for (const sv of services) {
        const svc = await client.query(`SELECT * FROM event_services WHERE id=$1`, [sv.service_id]);
        if (svc.rows.length === 0) throw new ApiError(404, `Event service ${sv.service_id} not found.`);
        const qty = Number(sv.quantity || 1);
        const unitPrice = Number(sv.unit_price !== undefined ? sv.unit_price : svc.rows[0].price);
        const line = qty * unitPrice;
        servicesTotal += line;
        svcLines.push({ service: svc.rows[0], qty, unitPrice, line });
      }
    }

    const total = Math.max(0, base + servicesTotal);
    const dep = Number(deposit || 0);

    const b = await client.query(
      `INSERT INTO event_bookings (booking_no, customer_name, organization, phone, email, hall_id, event_type,
         event_date, start_time, end_time, attendees, rate, discount, deposit, balance, payment_status,
         invoiced_amount, restaurant_id, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [genNumber('EVT'), customer_name, organization || null, phone || null, email || null, hall_id,
       event_type || 'Other', event_date, s, e, attendees || 0, rate || 0, disc, dep,
       Math.max(0, total - dep), dep > 0 ? 'PARTIAL' : 'UNPAID', total, restaurant_id || null,
       'CONFIRMED', notes || null, req.user?.id]);
    created = b.rows[0];

    for (const sl of svcLines) {
      await client.query(
        `INSERT INTO event_booking_services (booking_id, service_id, service_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [created.id, sl.service.id, sl.service.name, sl.qty, sl.unitPrice, sl.line]);
    }

    // Create an EVENT invoice so payments/revenue flow into finance
    const inv = await client.query(
      `INSERT INTO invoices (invoice_no, invoice_type, subtotal, discount, tax, total, paid, balance, status)
       VALUES ($1,'EVENT',$2,$3,0,$4,$5,$6,$7) RETURNING *`,
      [genNumber('INV'), base + servicesTotal, disc, total, dep, Math.max(0, total - dep), dep > 0 ? 'PARTIAL' : 'UNPAID']);
    await client.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
       VALUES ($1,$2,1,$3,$3)`,
      [inv.rows[0].id, `Event ${created.booking_no} — ${customer_name} (Hall ${hall_id})`, base]);
    for (const sl of svcLines) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [inv.rows[0].id, `Event service — ${sl.service.name}`, sl.qty, sl.unitPrice, sl.line]);
    }
    await client.query(`UPDATE event_bookings SET invoice_id=$2 WHERE id=$1`, [created.id, inv.rows[0].id]);

    // Record deposit as a payment
    if (dep > 0) {
      await client.query(
        `INSERT INTO payments (payment_no, event_booking_id, invoice_id, amount, method, category, note, received_by)
         VALUES ($1,$2,$3,$4,$5,'EVENT',COALESCE($6,'Deposit'),$7)`,
        [genNumber('PAY'), created.id, inv.rows[0].id, dep, req.body.deposit_method || 'CASH', req.user?.id]);
      await client.query(`UPDATE invoices SET paid=paid+$2, balance=$3, status=CASE WHEN balance<=0.01 THEN 'PAID' WHEN paid>0 THEN 'PARTIAL' ELSE 'UNPAID' END WHERE id=$1`, [inv.rows[0].id, dep, Math.max(0, total - dep)]);
    }

    // Mark hall RESERVED if concrete booking
    await client.query(`UPDATE conference_halls SET status='RESERVED' WHERE id=$1 AND status='AVAILABLE'`, [hall_id]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'CREATE_EVENT', 'event_bookings', created.id, { customer_name, total: created.rate });
  res.status(201).json({ success: true, data: created });
});

export const updateEventBooking = asyncHandler(async (req, res) => {
  const { customer_name, organization, phone, email, hall_id, event_type, event_date, start_time, end_time, attendees, rate, discount, deposit, status, notes, restaurant_id, services } = req.body;
  const existing = await pool.query(`SELECT * FROM event_bookings WHERE id=$1`, [req.params.id]);
  if (existing.rows.length === 0) throw new ApiError(404, 'Event booking not found.');

  // Overlap check when hall/date/time changes
  if (hall_id || event_date || start_time || end_time) {
    const cur = existing.rows[0];
    const h = hall_id || cur.hall_id;
    const d = event_date || cur.event_date;
    const s = start_time || cur.start_time;
    const e = end_time || cur.end_time;
    const clash = await pool.query(
      `SELECT id FROM event_bookings WHERE hall_id=$1 AND event_date=$2 AND id<>$3
         AND status NOT IN ('CANCELLED') AND (start_time,end_time) OVERLAPS ($4::time,$5::time) LIMIT 1`,
      [h, d, req.params.id, s, e]);
    if (clash.rows.length > 0) throw new ApiError(409, 'The hall is already booked for that time slot.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rows = await client.query(
      `UPDATE event_bookings SET
         customer_name=COALESCE($2,customer_name), organization=COALESCE($3,organization),
         phone=COALESCE($4,phone), email=COALESCE($5,email), hall_id=COALESCE($6,hall_id),
         event_type=COALESCE($7,event_type), event_date=COALESCE($8,event_date),
         start_time=COALESCE($9,start_time), end_time=COALESCE($10,end_time),
         attendees=COALESCE($11,attendees), rate=COALESCE($12,rate), discount=COALESCE($13,discount),
         restaurant_id=COALESCE($14,restaurant_id), status=COALESCE($15,status), notes=COALESCE($16,notes)
       WHERE id=$1 RETURNING *`,
      [req.params.id, customer_name, organization, phone, email, hall_id, event_type, event_date,
       start_time, end_time, attendees, rate, discount, restaurant_id, status, notes]);
    const b = rows.rows[0];

    // Replace services if provided and recompute totals
    if (Array.isArray(services)) {
      await client.query(`DELETE FROM event_booking_services WHERE booking_id=$1`, [req.params.id]);
      let servicesTotal = 0;
      for (const sv of services) {
        const svc = await client.query(`SELECT * FROM event_services WHERE id=$1`, [sv.service_id]);
        const qty = Number(sv.quantity || 1);
        const unitPrice = Number(sv.unit_price !== undefined ? sv.unit_price : (svc.rows[0]?.price || 0));
        servicesTotal += qty * unitPrice;
        await client.query(
          `INSERT INTO event_booking_services (booking_id, service_id, service_name, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.params.id, sv.service_id, svc.rows[0]?.name || 'Service', qty, unitPrice, qty * unitPrice]);
      }
      // Update event invoice lines
      if (b.invoice_id) {
        await client.query(`DELETE FROM invoice_items WHERE invoice_id=$1 AND description LIKE 'Event service%'`, [b.invoice_id]);
        for (const sv of services) {
          const svc = await pool.query(`SELECT * FROM event_services WHERE id=$1`, [sv.service_id]);
          const qty = Number(sv.quantity || 1);
          const unitPrice = Number(sv.unit_price !== undefined ? sv.unit_price : (svc.rows[0]?.price || 0));
          await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
             VALUES ($1,$2,$3,$4,$5)`,
            [b.invoice_id, `Event service — ${svc.rows[0]?.name || 'Service'}`, qty, unitPrice, qty * unitPrice]);
        }
        if (b.invoice_id) await reconcileInvoice(client, b.invoice_id);
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'UPDATE_EVENT', 'event_bookings', req.params.id, { status });
  res.json({ success: true, data: existing.rows[0] });
});

// Record a payment against an event (deposit, partial, final)
export const recordEventPayment = asyncHandler(async (req, res) => {
  const { amount, method, note } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Valid amount required.');
  const ev = await pool.query(`SELECT * FROM event_bookings WHERE id=$1`, [req.params.id]);
  if (ev.rows.length === 0) throw new ApiError(404, 'Event booking not found.');
  const e = ev.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const amt = Number(amount);
    let invId = e.invoice_id;
    if (!invId) {
      const inv = await client.query(
        `INSERT INTO invoices (invoice_no, invoice_type, subtotal, discount, tax, total, paid, balance, status)
         VALUES ($1,'EVENT',$2,0,0,$2,0,$2,'UNPAID') RETURNING *`,
        [genNumber('INV'), e.rate + e.invoiced_amount - e.discount]);
      invId = inv.rows[0].id;
      await client.query(`UPDATE event_bookings SET invoice_id=$2 WHERE id=$1`, [req.params.id, invId]);
    }

    await client.query(
      `INSERT INTO payments (payment_no, event_booking_id, invoice_id, amount, method, category, note, received_by)
       VALUES ($1,$2,$3,$4,$5,'EVENT',COALESCE($6,'Event payment'),$7)`,
      [genNumber('PAY'), req.params.id, invId, amt, method || 'CASH', note, req.user?.id]);

    const invRow = await client.query(`SELECT * FROM invoices WHERE id=$1`, [invId]);
    const paidNow = Number(invRow.rows[0].paid) + amt;
    const newBalance = Math.max(0, Number(invRow.rows[0].total) - paidNow);
    const payStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIAL';
    await client.query(
      `UPDATE invoices SET paid=$2, balance=$3, status=$4 WHERE id=$1`,
      [invId, paidNow, newBalance, payStatus]);
    await client.query(
      `UPDATE event_bookings SET deposit=deposit+$2, balance=$3, payment_status=$4 WHERE id=$1`,
      [req.params.id, amt, newBalance, payStatus]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'EVENT_PAYMENT', 'event_bookings', req.params.id, { amount, method });
  res.json({ success: true, message: 'Event payment recorded.' });
});

// ---------- EVENT REPORTS ----------
export const getEventReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const p = [];
  const c = [];
  if (from) { p.push(from); c.push(`b.event_date >= $${p.length}::date`); }
  if (to) { p.push(to); c.push(`b.event_date <= $${p.length}::date`); }
  const where = c.length ? `WHERE ${c.join(' AND ')}` : '';

  const summary = await pool.query(
    `SELECT COUNT(*) AS total_events,
            COALESCE(SUM(rate + invoiced_amount - discount),0) AS revenue,
            COALESCE(SUM(deposit),0) AS paid,
            COALESCE(SUM(balance),0) AS outstanding
     FROM event_bookings b ${where}`, p);

  const byHall = await pool.query(
    `SELECT h.id, h.name, COUNT(b.id) AS events
     FROM conference_halls h LEFT JOIN event_bookings b ON b.hall_id=h.id
     GROUP BY h.id ORDER BY h.id`);

  const upcoming = await pool.query(
    `SELECT b.id, b.booking_no, b.customer_name, b.event_date, b.start_time, h.name AS hall_name, b.status
     FROM event_bookings b LEFT JOIN conference_halls h ON h.id=b.hall_id
     WHERE b.event_date >= CURRENT_DATE AND b.status NOT IN ('CANCELLED','COMPLETED')
     ORDER BY b.event_date LIMIT 20`);

  const byEventType = await pool.query(
    `SELECT COALESCE(event_type,'Other') AS event_type, COUNT(*) AS count, COALESCE(SUM(rate),0) AS revenue
     FROM event_bookings b ${where} GROUP BY 1 ORDER BY revenue DESC`, p);

  const servicesByEvent = await pool.query(
    `SELECT es.name, COUNT(ebs.id) AS used_count, COALESCE(SUM(ebs.line_total),0) AS revenue
     FROM event_services es LEFT JOIN event_booking_services ebs ON ebs.service_id=es.id
     GROUP BY es.id ORDER BY revenue DESC LIMIT 15`);

  res.json({ success: true, data: { summary: summary.rows[0], byHall: byHall.rows, upcoming: upcoming.rows, byEventType: byEventType.rows, services: servicesByEvent.rows } });
});
