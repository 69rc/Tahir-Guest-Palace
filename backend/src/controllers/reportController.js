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

// Combined management report — total hotel revenue across all categories
export const getCombinedReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const p = [];
  const c = [];
  const ep = [];
  const ec = [];
  if (from) { p.push(from); c.push(`p.created_at >= $${p.length}::date`); ep.push(from); ec.push(`e.incurred_at >= $${ep.length}::date`); }
  if (to) { p.push(to); c.push(`p.created_at <= $${p.length}::date + interval '1 day'`); ep.push(to); ec.push(`e.incurred_at <= $${ep.length}::date + interval '1 day'`); }
  const where = c.length ? `WHERE ${c.join(' AND ')}` : '';
  const expWhere = ec.length ? `WHERE ${ec.join(' AND ')}` : '';

  const byCategory = await pool.query(
    `SELECT COALESCE(p.category,'OTHER') AS category, COALESCE(SUM(p.amount),0) AS revenue, COUNT(*) AS transactions
     FROM payments p ${where} GROUP BY 1 ORDER BY revenue DESC`, p);

  const totalRevenue = byCategory.rows.reduce((s, r) => s + Number(r.revenue), 0);

  const byMonth = await pool.query(
    `SELECT to_char(p.created_at,'YYYY-MM') AS month,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='ROOM' OR p.category='OTHER'),0) AS hotel,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='RESTAURANT'),0) AS restaurant,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='SPA'),0) AS spa,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='BARBERSHOP'),0) AS barbershop,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='AMENITY'),0) AS amenity,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='EVENT'),0) AS events,
            COALESCE(SUM(p.amount),0) AS total
     FROM payments p ${where} GROUP BY 1 ORDER BY 1`, p);

  const totalExpenses = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses e ${expWhere}`, ep);

  res.json({
    success: true,
    data: {
      byCategory: byCategory.rows,
      totalRevenue,
      totalExpenses: Number(totalExpenses.rows[0].total),
      netRevenue: totalRevenue - Number(totalExpenses.rows[0].total),
      byMonth: byMonth.rows,
    },
  });
});

// Hotel management KPIs calculated from real DB records.
export const getKPIs = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const start = from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);

  const totalRoomsRes = await pool.query('SELECT COUNT(*) FROM rooms');
  const totalRooms = Number(totalRoomsRes.rows[0].count) || 1;

  // Occupied room-nights & sold rooms in range (from check-ins/check-outs spanning range)
  const occupancy = await pool.query(
    `WITH days AS (
       SELECT generate_series($1::date, $2::date, '1 day')::date AS day
     )
     SELECT COUNT(*) AS occupied_nights,
            COUNT(DISTINCT d.day) AS days_in_range
     FROM days d
     JOIN reservations r
       ON r.guest_id IS NOT NULL
      AND r.status IN ('CHECKED_IN','CHECKED_OUT')
      AND r.check_in_date <= d.day
      AND (r.check_out_date > d.day OR r.check_out_date IS NULL)
      AND r.check_out_date <= $2::date + interval '1 day'
     `, [start, end]
  );

  // Distinct occupied room-nights
  const occNights = await pool.query(
    `WITH days AS (SELECT generate_series($1::date, $2::date, '1 day')::date AS day)
     SELECT COUNT(*) AS occupied_nights,
            COUNT(DISTINCT (r.room_id, d.day)) AS room_nights
     FROM days d
     JOIN reservations r
       ON r.status IN ('CHECKED_IN','CHECKED_OUT')
      AND r.room_id IS NOT NULL
      AND r.check_in_date <= d.day
      AND COALESCE(r.check_out_date, r.check_in_date + 1) > d.day
     `, [start, end]
  );

  // Room revenue (payments categorized ROOM/OTHER within range)
  const roomRevenue = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
     WHERE category IN ('ROOM','OTHER') AND created_at >= $1::date AND created_at < $2::date + interval '1 day'`,
    [start, end]
  );
  const roomRev = Number(roomRevenue.rows[0].revenue);

  const availableNights = totalRooms * occNights.rows[0].days_in_range;
  const soldNights = Number(occNights.rows[0].room_nights);
  const roomsAvailablePerDay = totalRooms;
  const soldRooms = soldNights;

  const adr = soldRooms > 0 ? roomRev / soldRooms : 0;
  const revpar = availableNights > 0 ? roomRev / totalRooms / Math.max(1, occNights.rows[0].days_in_range) : 0;

  // Average length of stay from completed stays in range
  const alos = await pool.query(
    `SELECT COALESCE(AVG(COALESCE(r.check_out_date, r.check_in_date + 1) - r.check_in_date),0) AS avg_los
     FROM reservations r
     WHERE r.status='CHECKED_OUT' AND r.check_out_date >= $1::date AND r.check_out_date <= $2::date`,
    [start, end]
  );

  // Cancellation & no-show rates based on all reservations
  const rates = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status='CANCELLED') AS cancelled,
       COUNT(*) FILTER (WHERE status='NO_SHOW') AS no_show
     FROM reservations WHERE created_at >= $1::date AND created_at <= $2::date + interval '1 day'`,
    [start, end]
  );
  const r = rates.rows[0];
  const cancellationRate = Number(r.total) > 0 ? (Number(r.cancelled) / Number(r.total)) * 100 : 0;
  const noShowRate = Number(r.total) > 0 ? (Number(r.no_show) / Number(r.total)) * 100 : 0;

  res.json({
    success: true,
    data: {
      period: { from: start, to: end },
      totalRooms,
      occupancyPercent: availableNights > 0 ? (soldNights / availableNights) * 100 : 0,
      soldNights,
      availableNights,
      averageDailyRate: adr,
      revpar,
      averageLengthOfStay: Number(alos.rows[0].avg_los) || 0,
      cancellationRate,
      noShowRate,
      roomRevenue: roomRev,
    },
  });
});

// Department revenue breakdown for today/week/month/custom range
export const getDepartmentRevenue = asyncHandler(async (req, res) => {
  const { period = 'today', from, to } = req.query;
  let start, end;
  if (period === 'custom' && from && to) {
    start = from; end = to;
  } else if (period === 'week') {
    const d = new Date();
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).toISOString().slice(0, 10);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 6).toISOString().slice(0, 10);
  } else if (period === 'month') {
    const d = new Date();
    start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  } else { // today
    start = new Date().toISOString().slice(0, 10);
    end = new Date().toISOString().slice(0, 10);
  }

  // Restaurant revenue per outlet (from paid orders)
  const restaurants = await pool.query(
    `SELECT COALESCE(res.name, 'Outlet') AS name,
            COALESCE(SUM(o.total),0) AS revenue
     FROM restaurants res
     LEFT JOIN orders o ON o.restaurant_id = res.id AND o.status='PAID'
       AND o.created_at >= $1::date AND o.created_at < $2::date + interval '1 day'
     GROUP BY res.id, res.name ORDER BY revenue DESC`, [start, end]
  );

  // Service revenue (spa, barbershop, amenities) from payments
  const services = await pool.query(
    `SELECT category, COALESCE(SUM(amount),0) AS revenue FROM payments
     WHERE category IN ('SPA','BARBERSHOP','AMENITY')
       AND created_at >= $1::date AND created_at < $2::date + interval '1 day'
     GROUP BY category`, [start, end]
  );

  const roomDep = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
     WHERE category='ROOM' AND created_at >= $1::date AND created_at < $2::date + interval '1 day'`, [start, end]
  );
  const eventDep = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
     WHERE category='EVENT' AND created_at >= $1::date AND created_at < $2::date + interval '1 day'`, [start, end]
  );
  const otherDep = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
     WHERE category='OTHER' AND created_at >= $1::date AND created_at < $2::date + interval '1 day'`, [start, end]
  );

  const serviceMap = {};
  services.rows.forEach(x => { serviceMap[x.category] = Number(x.revenue); });

  res.json({
    success: true,
    data: {
      period: { from: start, to: end },
      rooms: Number(roomDep.rows[0].revenue),
      restaurants: restaurants.rows,
      spa: serviceMap.SPA || 0,
      barbershop: serviceMap.BARBERSHOP || 0,
      poolServices: serviceMap.AMENITY || 0,
      events: Number(eventDep.rows[0].revenue),
      other: Number(otherDep.rows[0].revenue),
    },
  });
});
