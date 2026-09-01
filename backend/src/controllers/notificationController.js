import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';

async function notify(userId, title, message, category, entityType, entityId) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, category, entity_type, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, title, message, category, entityType || null, entityId || null]
    );
  } catch (e) {
    console.error('Notification insert error:', e.message);
  }
}

export const getNotifications = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id=$1 OR user_id IS NULL
     ORDER BY created_at DESC LIMIT 100`, [req.user?.id]
  );
  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false`, [req.user?.id]
  );
  res.json({ success: true, data: rows, unread: Number(count) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE notifications SET is_read=true WHERE id=$1`, [id]);
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await pool.query(`UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false`, [req.user?.id]);
  res.json({ success: true });
});

export const generateSystemNotifications = asyncHandler(async (req, res) => {
  // Hotel alerts - upcoming check-ins/outs
  const upcomingCheckins = await pool.query(
    `SELECT r.id, r.reservation_no, g.full_name, r.check_in_date, r.room_id, rm.room_number
     FROM reservations r
     LEFT JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     WHERE r.status IN ('CONFIRMED','PENDING')
       AND r.check_in_date BETWEEN now() AND now() + INTERVAL '2 days'`
  );
  for (const r of upcomingCheckins.rows) {
    await notify(null, 'Upcoming check-in', `${r.full_name} (${r.room_number}) checks in ${new Date(r.check_in_date).toLocaleDateString()}`, 'hotel', 'reservation', r.id);
  }

  const upcomingCheckouts = await pool.query(
    `SELECT r.id, r.reservation_no, g.full_name, r.check_out_date, rm.room_number
     FROM reservations r
     LEFT JOIN guests g ON g.id = r.guest_id
     LEFT JOIN rooms rm ON rm.id = r.room_id
     WHERE r.status = 'CHECKED_IN'
       AND r.check_out_date BETWEEN now() AND now() + INTERVAL '1 day'`
  );
  for (const r of upcomingCheckouts.rows) {
    await notify(null, 'Upcoming check-out', `${r.full_name} (${r.room_number}) checks out ${new Date(r.check_out_date).toLocaleDateString()}`, 'hotel', 'reservation', r.id);
  }

  // Inventory - low stock / out of stock
  const lowStock = await pool.query(
    `SELECT id, name, quantity, min_quantity FROM inventory_items
     WHERE quantity <= min_quantity AND is_active = true`
  );
  for (const i of lowStock.rows) {
    await notify(null, 'Low stock', `${i.name} is at ${i.quantity} (min ${i.min_quantity})`, 'inventory', 'inventory_item', i.id);
  }

  // Pending purchase orders
  const pendingPO = await pool.query(
    `SELECT id, purchase_no, supplier_id FROM purchases WHERE payment_status='PENDING' OR status='PENDING'`
  );
  for (const p of pendingPO.rows) {
    await notify(null, 'Pending purchase order', `Purchase ${p.purchase_no} has not been fully processed`, 'inventory', 'purchase', p.id);
  }

  // Maintenance - critical tickets / overdue
  const critical = await pool.query(
    `SELECT id, ticket_no, priority, location FROM maintenance_tickets
     WHERE priority='CRITICAL' AND status NOT IN ('RESOLVED','CLOSED')`
  );
  for (const t of critical.rows) {
    await notify(null, 'CRITICAL maintenance', `${t.ticket_no} at ${t.location} is CRITICAL`, 'maintenance', 'maintenance_ticket', t.id);
  }

  // Events - upcoming
  const upcomingEvents = await pool.query(
    `SELECT id, booking_no, customer_name, event_date FROM event_bookings
     WHERE status NOT IN ('CANCELLED') AND event_date BETWEEN now() AND now() + INTERVAL '7 days'`
  );
  for (const e of upcomingEvents.rows) {
    await notify(null, 'Upcoming event', `${e.customer_name}'s event (${e.booking_no}) on ${new Date(e.event_date).toLocaleDateString()}`, 'events', 'event_booking', e.id);
  }

  // Finance - outstanding invoices
  const outstanding = await pool.query(
    `SELECT i.id, i.invoice_no, i.balance, g.full_name FROM invoices i
     LEFT JOIN guests g ON g.id=i.guest_id
     WHERE i.status IN ('PARTIAL','UNPAID') AND i.balance > 0`
  );
  for (const i of outstanding.rows) {
    await notify(null, 'Outstanding invoice', `Invoice ${i.invoice_no} for ${i.full_name || 'guest'} has balance ₦${Number(i.balance).toLocaleString()}`, 'finance', 'invoice', i.id);
  }

  res.json({ success: true, message: 'System notifications generated.' });
});

export const clearAll = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE user_id=$1', [req.user?.id]);
  res.json({ success: true });
});
