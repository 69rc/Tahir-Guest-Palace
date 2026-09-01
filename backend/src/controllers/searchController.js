import pool from '../config/db.js';
import { asyncHandler } from '../utils/helpers.js';
import { SUPER_ROLES, ROLE_PERMISSIONS } from '../config/permissions.js';

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ success: true, data: { guests: [], reservations: [], rooms: [], invoices: [], orders: [], payments: [], events: [], tickets: [], staff: [] } });
  }
  const term = `%${q.trim()}%`;

  const role = req.user?.role_name;
  const allowed = SUPER_ROLES.includes(role) ? [] : (ROLE_PERMISSIONS[role] || []);
  const has = (perm) => SUPER_ROLES.includes(role) || allowed.includes(perm);

  const result = { guests: [], reservations: [], rooms: [], invoices: [], orders: [], payments: [], events: [], tickets: [], staff: [] };

  if (has('guests:view') || has('guest:360')) {
    const { rows } = await pool.query(
      `SELECT id, full_name, phone, email, vip_status FROM guests
       WHERE full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
       ORDER BY full_name LIMIT 10`, [term]
    );
    result.guests = rows;
  }

  if (has('reservations:view')) {
    const { rows } = await pool.query(
      `SELECT r.id, r.reservation_no, r.status, g.full_name, rm.room_number
       FROM reservations r
       LEFT JOIN guests g ON g.id=r.guest_id
       LEFT JOIN rooms rm ON rm.id=r.room_id
       WHERE r.reservation_no ILIKE $1 OR g.full_name ILIKE $1
       ORDER BY r.created_at DESC LIMIT 10`, [term]
    );
    result.reservations = rows;
  }

  if (has('rooms:view')) {
    const { rows } = await pool.query(
      `SELECT id, room_number, status, floor FROM rooms
       WHERE room_number ILIKE $1 ORDER BY room_number LIMIT 10`, [term]
    );
    result.rooms = rows;
  }

  if (has('invoices:view') || has('payments:view') || has('folios:view')) {
    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_no, i.total, i.paid, i.balance, i.status, g.full_name
       FROM invoices i LEFT JOIN guests g ON g.id=i.guest_id
       WHERE i.invoice_no ILIKE $1 OR g.full_name ILIKE $1
       ORDER BY i.created_at DESC LIMIT 10`, [term]
    );
    result.invoices = rows;
  }

  if (has('orders:view')) {
    const { rows } = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.total, g.full_name, res.name AS restaurant_name
       FROM orders o
       LEFT JOIN guests g ON g.id=o.guest_id
       LEFT JOIN restaurants res ON res.id=o.restaurant_id
       WHERE o.order_no ILIKE $1 OR g.full_name ILIKE $1
       ORDER BY o.created_at DESC LIMIT 10`, [term]
    );
    result.orders = rows;
  }

  if (has('payments:view')) {
    const { rows } = await pool.query(
      `SELECT p.id, p.payment_no, p.amount, p.method, p.category, p.created_at, g.full_name
       FROM payments p LEFT JOIN guests g ON g.id=p.guest_id
       WHERE p.payment_no ILIKE $1 OR g.full_name ILIKE $1
       ORDER BY p.created_at DESC LIMIT 10`, [term]
    );
    result.payments = rows;
  }

  if (has('events:view')) {
    const { rows } = await pool.query(
      `SELECT id, booking_no, customer_name, event_date, status FROM event_bookings
       WHERE booking_no ILIKE $1 OR customer_name ILIKE $1 OR organization ILIKE $1
       ORDER BY event_date LIMIT 10`, [term]
    );
    result.events = rows;
  }

  if (has('maintenance:view')) {
    const { rows } = await pool.query(
      `SELECT id, ticket_no, location, priority, status FROM maintenance_tickets
       WHERE ticket_no ILIKE $1 OR location ILIKE $1 OR description ILIKE $1
       ORDER BY created_at DESC LIMIT 10`, [term]
    );
    result.tickets = rows;
  }

  if (has('staff:view')) {
    const { rows } = await pool.query(
      `SELECT id, full_name, username, role_id FROM users
       WHERE full_name ILIKE $1 OR username ILIKE $1 ORDER BY full_name LIMIT 10`, [term]
    );
    result.staff = rows;
  }

  res.json({ success: true, data: result });
});
