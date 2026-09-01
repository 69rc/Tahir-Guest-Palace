import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';
import { getOrCreateFolioInvoice, addInvoiceLine } from '../services/folioService.js';

// Map an amenity's category to a finance payment category
function paymentCategory(amenity) {
  const cat = (amenity.category || '').toUpperCase();
  if (cat.includes('SPA')) return 'SPA';
  if (cat.includes('BARBER')) return 'BARBERSHOP';
  return 'AMENITY';
}

// ---------- AMENITIES ----------
export const getAmenities = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*,
            (SELECT COUNT(*) FROM amenity_services s WHERE s.amenity_id=a.id) AS services_count,
            (SELECT COUNT(*) FROM service_appointments ap WHERE ap.amenity_id=a.id) AS bookings_count
     FROM amenities a ORDER BY a.id`
  );
  res.json({ success: true, data: rows });
});

export const getAmenity = asyncHandler(async (req, res) => {
  const a = await pool.query(`SELECT * FROM amenities WHERE id=$1`, [req.params.id]);
  if (a.rows.length === 0) throw new ApiError(404, 'Amenity not found.');
  const services = await pool.query(
    `SELECT * FROM amenity_services WHERE amenity_id=$1 ORDER BY id`, [req.params.id]);
  res.json({ success: true, data: { ...a.rows[0], services: services.rows } });
});

export const createAmenity = asyncHandler(async (req, res) => {
  const { name, category, description, status, location, operating_hours, price, pricing_type, capacity, image, notes } = req.body;
  if (!name) throw new ApiError(400, 'Amenity name required.');
  const { rows } = await pool.query(
    `INSERT INTO amenities (name, category, description, status, location, operating_hours, price, pricing_type, capacity, image, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [name, category || null, description || null, status || 'ACTIVE', location || null,
     operating_hours || null, price || 0, pricing_type || 'FREE', capacity || null, image || null, notes || null]);
  await audit(req.user?.id, 'CREATE_AMENITY', 'amenities', rows[0].id, { name });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateAmenity = asyncHandler(async (req, res) => {
  const { name, category, description, status, location, operating_hours, price, pricing_type, capacity, image, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE amenities SET name=COALESCE($2,name), category=COALESCE($3,category), description=COALESCE($4,description),
       status=COALESCE($5,status), location=COALESCE($6,location), operating_hours=COALESCE($7,operating_hours),
       price=COALESCE($8,price), pricing_type=COALESCE($9,pricing_type), capacity=COALESCE($10,capacity),
       image=COALESCE($11,image), notes=COALESCE($12,notes)
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, category, description, status, location, operating_hours, price, pricing_type, capacity, image, notes]);
  if (rows.length === 0) throw new ApiError(404, 'Amenity not found.');
  await audit(req.user?.id, 'UPDATE_AMENITY', 'amenities', rows[0].id, { name });
  res.json({ success: true, data: rows[0] });
});

// ---------- AMENITY SERVICES ----------
export const getServices = asyncHandler(async (req, res) => {
  const amenityId = req.query.amenity_id;
  const params = [];
  let q = `SELECT s.*, a.name AS amenity_name, a.category FROM amenity_services s
           LEFT JOIN amenities a ON a.id=s.amenity_id`;
  if (amenityId) { params.push(amenityId); q += ` WHERE s.amenity_id=$1`; }
  q += ` ORDER BY s.id`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const createService = asyncHandler(async (req, res) => {
  const { amenity_id, name, description, price, pricing_type, duration_min, capacity, status, image, notes } = req.body;
  if (!amenity_id || !name) throw new ApiError(400, 'Amenity and service name required.');
  const { rows } = await pool.query(
    `INSERT INTO amenity_services (amenity_id, name, description, price, pricing_type, duration_min, capacity, status, image, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [amenity_id, name, description || null, price || 0, pricing_type || 'FIXED', duration_min || 30,
     capacity || null, status || 'ACTIVE', image || null, notes || null]);
  await audit(req.user?.id, 'CREATE_SERVICE', 'amenity_services', rows[0].id, { name });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateService = asyncHandler(async (req, res) => {
  const { name, description, price, pricing_type, duration_min, capacity, status, image, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE amenity_services SET name=COALESCE($2,name), description=COALESCE($3,description),
       price=COALESCE($4,price), pricing_type=COALESCE($5,pricing_type), duration_min=COALESCE($6,duration_min),
       capacity=COALESCE($7,capacity), status=COALESCE($8,status), image=COALESCE($9,image), notes=COALESCE($10,notes)
     WHERE id=$1 RETURNING *`,
    [req.params.id, name, description, price, pricing_type, duration_min, capacity, status, image, notes]);
  if (rows.length === 0) throw new ApiError(404, 'Service not found.');
  await audit(req.user?.id, 'UPDATE_SERVICE', 'amenity_services', rows[0].id, { name });
  res.json({ success: true, data: rows[0] });
});

// ---------- SERVICE APPOINTMENTS ----------
const BLOCKED_APPT = ['CANCELLED', 'NO_SHOW'];

function hasOverlap(db, { amenityId, staffId, start, end, excludeId }) {
  const conds = [];
  const params = [];
  if (amenityId) { params.push(amenityId); conds.push(`amenity_id=$1`); }
  if (staffId) { params.push(staffId); conds.push(`staff_user_id=${params.length === 1 ? '$' + params.length : '$' + params.length}`); }
  // simpler: build both checks via OR
}

export const getAppointments = asyncHandler(async (req, res) => {
  const { amenity_id, from, to, status } = req.query;
  const params = [];
  const conds = [];
  let q = `SELECT ap.*, a.name AS amenity_name, a.category,
                  s.name AS service_name, g.full_name AS guest_name,
                  st.full_name AS staff_name
           FROM service_appointments ap
           LEFT JOIN amenities a ON a.id=ap.amenity_id
           LEFT JOIN amenity_services s ON s.id=ap.service_id
           LEFT JOIN guests g ON g.id=ap.guest_id
           LEFT JOIN users st ON st.id=ap.staff_user_id`;
  if (amenity_id) { params.push(amenity_id); conds.push(`ap.amenity_id=$${params.length}`); }
  if (from) { params.push(from); conds.push(`ap.start_time >= $${params.length}::date`); }
  if (to) { params.push(to); conds.push(`ap.start_time <= $${params.length}::date + interval '1 day'`); }
  if (status) { params.push(status); conds.push(`ap.status=$${params.length}`); }
  if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
  q += ` ORDER BY ap.start_time DESC LIMIT 300`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const { amenity_id, service_id, guest_id, staff_user_id, customer_name, start_time, end_time, price, notes } = req.body;
  if (!amenity_id || !start_time || !end_time) throw new ApiError(400, 'Amenity, start and end time required.');
  if (new Date(end_time) <= new Date(start_time)) throw new ApiError(400, 'End time must be after start time.');

  const amenity = await pool.query(`SELECT * FROM amenities WHERE id=$1`, [amenity_id]);
  if (amenity.rows.length === 0) throw new ApiError(404, 'Amenity not found.');

  // Resolve price from service if not provided
  let finalPrice = Number(price || 0);
  if (service_id) {
    const svc = await pool.query(`SELECT * FROM amenity_services WHERE id=$1`, [service_id]);
    if (svc.rows.length > 0 && (!price || Number(price) === 0)) finalPrice = Number(svc.rows[0].price);
  }

  const staffId = staff_user_id || null;
  const start = new Date(start_time).toISOString();
  const end = new Date(end_time).toISOString();

  // Overlap check for the same amenity (conference halls/cabanas share the amenity slot)
  const overlap = await pool.query(
    `SELECT id FROM service_appointments
     WHERE amenity_id=$1 AND status NOT IN ('CANCELLED','NO_SHOW')
       AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)
     LIMIT 1`,
    [amenity_id, start, end]);
  if (overlap.rows.length > 0) throw new ApiError(409, 'That time slot is already booked.');

  // Staff overlap check
  if (staffId) {
    const staffOverlap = await pool.query(
      `SELECT id FROM service_appointments
       WHERE staff_user_id=$1 AND status NOT IN ('CANCELLED','NO_SHOW')
         AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)
       LIMIT 1`,
      [staffId, start, end]);
    if (staffOverlap.rows.length > 0) throw new ApiError(409, 'That staff member is unavailable in this slot.');
  }

  const { rows } = await pool.query(
    `INSERT INTO service_appointments (appointment_no, amenity_id, service_id, guest_id, staff_user_id, customer_name, start_time, end_time, price, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [genNumber('SAP'), amenity_id, service_id || null, guest_id || null, staffId, customer_name || null, start, end, finalPrice, notes || null, req.user?.id]);
  await audit(req.user?.id, 'CREATE_APPOINTMENT', 'service_appointments', rows[0].id, { amenity_id });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const { service_id, staff_user_id, start_time, end_time, price, status, notes } = req.body;
  const existing = await pool.query(`SELECT * FROM service_appointments WHERE id=$1`, [req.params.id]);
  if (existing.rows.length === 0) throw new ApiError(404, 'Appointment not found.');
  const cur = existing.rows[0];

  const newStart = start_time ? new Date(start_time).toISOString() : cur.start_time;
  const newEnd = end_time ? new Date(end_time).toISOString() : cur.end_time;
  const newStaff = staff_user_id !== undefined ? staff_user_id : cur.staff_user_id;

  if (start_time || end_time) {
    const overlap = await pool.query(
      `SELECT id FROM service_appointments
       WHERE amenity_id=$1 AND id<>$2 AND status NOT IN ('CANCELLED','NO_SHOW')
         AND tstzrange(start_time, end_time) && tstzrange($3::timestamptz, $4::timestamptz)
       LIMIT 1`,
      [cur.amenity_id, req.params.id, newStart, newEnd]);
    if (overlap.rows.length > 0) throw new ApiError(409, 'That time slot is already booked.');
  }

  const { rows } = await pool.query(
    `UPDATE service_appointments SET
       service_id=COALESCE($2,service_id), staff_user_id=COALESCE($3,staff_user_id),
       start_time=COALESCE($4,start_time), end_time=COALESCE($5,end_time),
       price=COALESCE($6,price), status=COALESCE($7,status), notes=COALESCE($8,notes)
     WHERE id=$1 RETURNING *`,
    [req.params.id, service_id, newStaff, start_time || null, end_time || null, price, status || null, notes]);
  if (rows.length === 0) throw new ApiError(404, 'Appointment not found.');
  await audit(req.user?.id, 'UPDATE_APPOINTMENT', 'service_appointments', rows[0].id, { status: rows[0].status });
  res.json({ success: true, data: rows[0] });
});

// Mark appointment fulfilled (COMPLETED) and settle payment: either paid directly or charged to room.
export const settleAppointment = asyncHandler(async (req, res) => {
  const { method, charge_to_room, room_id, guest_id, amount } = req.body;
  const appt = await pool.query(
    `SELECT ap.*, a.category, a.name AS amenity_name FROM service_appointments ap
     LEFT JOIN amenities a ON a.id=ap.amenity_id WHERE ap.id=$1`, [req.params.id]);
  if (appt.rows.length === 0) throw new ApiError(404, 'Appointment not found.');
  const a = appt.rows[0];
  const total = Number(amount !== undefined ? amount : a.price);

  // Determine guest for folio charging
  let gid = guest_id || a.guest_id;
  if (charge_to_room) {
    if (!room_id && !gid) throw new ApiError(400, 'Room number or guest required to charge to room.');
    if (room_id && !gid) {
      const stay = await pool.query(
        `SELECT r.guest_id FROM reservations r JOIN rooms rm ON rm.id=r.room_id
         WHERE rm.id=$1 AND r.status='CHECKED_IN' ORDER BY r.check_in_date DESC LIMIT 1`, [room_id]);
      if (stay.rows.length === 0) throw new ApiError(400, 'No current guest found on that room.');
      gid = stay.rows[0].guest_id;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE service_appointments SET status='COMPLETED', is_charged_to_room=$2, payment_status=$3, guest_id=COALESCE($4,guest_id)
       WHERE id=$1`,
      [req.params.id, !!charge_to_room, charge_to_room ? 'CHARGED' : 'PAID', gid || null]);

    const category = paymentCategory({ category: a.category });

    if (charge_to_room && gid) {
      // Attach to the guest's open folio invoice
      const invoice = await getOrCreateFolioInvoice({ guestId: gid, reservationId: null });
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,1,$3,$3)`,
        [invoice.id, `${a.amenity_name} — ${a.service_name || 'Service'} appointment`, total]);
      // reconcile within the transaction
      await client.query(
        `UPDATE invoices SET subtotal=subtotal+$2, total=total+$2,
           balance=balance+$2, status=CASE WHEN total<=0.01 THEN 'UNPAID' WHEN balance<=0.01 THEN 'PAID' ELSE 'PARTIAL' END
         WHERE id=$1`,
        [invoice.id, total]);
    } else if (total > 0) {
      // Direct payment: create a paid invoice + payment
      const inv = await client.query(
        `INSERT INTO invoices (invoice_no, guest_id, invoice_type, subtotal, discount, tax, total, paid, balance, status)
         VALUES ($1,$2,'SERVICE',0,0,0,$3,$3,0,'PAID') RETURNING *`,
        [genNumber('INV'), gid || null, total]);
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,1,$3,$3)`,
        [inv.rows[0].id, `${a.amenity_name} — ${a.service_name || 'Service'}`, total]);
      await client.query(
        `INSERT INTO payments (payment_no, guest_id, invoice_id, service_appointment_id, amount, method, category, note, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Service payment',$8)`,
        [genNumber('PAY'), gid || null, inv.rows[0].id, req.params.id, total, method || 'CASH', category, req.user?.id]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'SETTLE_APPOINTMENT', 'service_appointments', req.params.id, { total, charge_to_room });
  res.json({ success: true, message: charge_to_room ? 'Service charged to guest folio.' : 'Service payment recorded.', data: { total, gid } });
});

// ---------- SERVICE REPORTS ----------
export const getServiceReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const p = [];
  const c = [];
  if (from) { p.push(from); c.push(`ap.start_time >= $${p.length}::date`); }
  if (to) { p.push(to); c.push(`ap.start_time <= $${p.length}::date + interval '1 day'`); }
  const where = c.length ? `AND ${c.join(' AND ')}` : '';

  const byAmenity = await pool.query(
    `SELECT a.id, a.name AS amenity_name, a.category,
            COUNT(ap.id) AS bookings,
            COALESCE(SUM(ap.price),0) AS revenue,
            COALESCE(SUM(ap.price) FILTER (WHERE ap.is_charged_to_room),0) AS charged_revenue
     FROM amenities a
     LEFT JOIN service_appointments ap ON ap.amenity_id=a.id AND ap.status='COMPLETED' ${where}
     GROUP BY a.id ORDER BY revenue DESC`, p);

  const mostUsed = await pool.query(
    `SELECT s.id, s.name, COUNT(ap.id) AS bookings, COALESCE(SUM(ap.price),0) AS revenue
     FROM amenity_services s LEFT JOIN service_appointments ap ON ap.service_id=s.id AND ap.status='COMPLETED'
     GROUP BY s.id ORDER BY bookings DESC LIMIT 10`);
  res.json({ success: true, data: { amenities: byAmenity.rows, byService: mostUsed.rows } });
});
