import pool from '../config/db.js';

import { asyncHandler, ApiError } from '../utils/helpers.js';

// Consolidated reports router acts on queries below
export const getHotelReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const cond = [];
  if (from) { params.push(from); cond.push(`r.check_in_date >= $${params.length}::date`); }
  if (to) { params.push(to); cond.push(`r.check_in_date <= $${params.length}::date`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const reservations = await pool.query(
    `SELECT r.*, g.full_name AS guest_name, rm.room_number FROM reservations r
     LEFT JOIN guests g ON g.id=r.guest_id LEFT JOIN rooms rm ON rm.id=r.room_id
     ${where} ORDER BY r.check_in_date`, params);

  const checkins = await pool.query(
    `SELECT ci.*, g.full_name, rm.room_number FROM check_ins ci
     LEFT JOIN guests g ON g.id=ci.guest_id LEFT JOIN rooms rm ON rm.id=ci.room_id
     ORDER BY ci.checkin_time`);
  const checkouts = await pool.query(
    `SELECT co.*, g.full_name, rm.room_number FROM check_outs co
     LEFT JOIN guests g ON g.id=co.guest_id LEFT JOIN rooms rm ON rm.id=co.room_id
     ORDER BY co.checkout_time`);

  const counts = await pool.query(
    `SELECT status, COUNT(*) FROM reservations ${where} GROUP BY status`);
  const roomCounts = await pool.query(`SELECT status, COUNT(*) FROM rooms GROUP BY status`);

  res.json({
    success: true,
    data: {
      reservations: reservations.rows,
      checkins: checkins.rows,
      checkouts: checkouts.rows,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.count)])),
      roomCounts: roomCounts.rows,
    },
  });
});

export const getRestaurantReport = asyncHandler(async (req, res) => {
  const { from, to, restaurant_id } = req.query;
  const params = [];
  const cond = [];
  let resConds = '';
  if (restaurant_id) { params.push(restaurant_id); resConds = `AND o.restaurant_id=$${params.length}`; }

  const dailySales = await pool.query(
    `SELECT to_char(o.created_at,'YYYY-MM-DD') AS day, res.name AS restaurant_name,
            COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS total
     FROM orders o JOIN restaurants res ON res.id=o.restaurant_id
     WHERE o.status='PAID' ${resConds}
     GROUP BY 1,2 ORDER BY 1`);

  const byRestaurant = await pool.query(
    `SELECT res.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total),0) AS total
     FROM restaurants res LEFT JOIN orders o ON o.restaurant_id=res.id AND o.status='PAID'
     GROUP BY res.id, res.name ORDER BY total DESC`);

  const byItem = await pool.query(
    `SELECT oi.item_name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.line_total),0) AS total
     FROM order_items oi JOIN orders o ON o.id=oi.order_id
     WHERE o.status='PAID' ${resConds}
     GROUP BY oi.item_name ORDER BY total DESC LIMIT 20`);

  const byCategory = await pool.query(
    `SELECT mc.name AS category, COALESCE(SUM(oi.line_total),0) AS total
     FROM order_items oi
     JOIN menu_items mi ON mi.id=oi.menu_item_id
     JOIN menu_categories mc ON mc.id=mi.category_id
     JOIN orders o ON o.id=oi.order_id
     WHERE o.status='PAID' ${resConds}
     GROUP BY mc.name ORDER BY total DESC`);

  res.json({ success: true, data: { dailySales: dailySales.rows, byRestaurant: byRestaurant.rows, byItem: byItem.rows, byCategory: byCategory.rows } });
});

export const getInventoryReport = asyncHandler(async (req, res) => {
  const lowStock = await pool.query(
    `SELECT i.*, c.name AS category_name FROM inventory_items i
     LEFT JOIN inventory_categories c ON c.id=i.category_id
     WHERE i.is_active AND i.quantity <= i.min_quantity
     ORDER BY (i.quantity - i.min_quantity)`);
  const purchases = await pool.query(
    `SELECT p.*, s.name AS supplier_name FROM purchases p
     LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.created_at DESC`);
  const movements = await pool.query(
    `SELECT t.type, COUNT(*) AS count, COALESCE(SUM(t.quantity),0) AS qty
     FROM inventory_transactions t GROUP BY t.type`);
  const summary = await pool.query(`SELECT COUNT(*) AS items, COALESCE(SUM(quantity*cost_price),0) AS stock_value FROM inventory_items WHERE is_active`);

  res.json({ success: true, data: { lowStock: lowStock.rows, purchases: purchases.rows, movements: movements.rows, summary: summary.rows[0] } });
});
