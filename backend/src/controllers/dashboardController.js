import pool from '../config/db.js';

export async function getDashboard(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const roomCounts = await pool.query(`
      SELECT status, COUNT(*) AS count FROM rooms GROUP BY status
    `);
    const roomMap = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0, MAINTENANCE: 0 };
    roomCounts.rows.forEach((r) => (roomMap[r.status] = Number(r.count)));
    const totalRooms = Object.values(roomMap).reduce((a, b) => a + b, 0);

    const todayCounts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM check_ins WHERE checkin_time::date = $1::date) AS checkins,
         (SELECT COUNT(*) FROM check_outs WHERE checkout_time::date = $1::date) AS checkouts,
         (SELECT COUNT(*) FROM reservations WHERE check_in_date = $1::date AND status IN ('CONFIRMED','CHECKED_IN')) AS reservations_today`,
      [today]
    );

    const revenue = await pool.query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='ROOM' OR category='OTHER'), 0) AS hotel_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='RESTAURANT'), 0) AS restaurant_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='SPA'), 0) AS spa_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='BARBERSHOP'), 0) AS barbershop_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='AMENITY'), 0) AS pool_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE category='EVENT'), 0) AS event_revenue,
        COALESCE((SELECT SUM(amount) FROM payments), 0) AS total_revenue,
        COALESCE((SELECT SUM(amount) FROM payments WHERE created_at::date = CURRENT_DATE), 0) AS today_revenue,
        COALESCE((SELECT SUM(balance) FROM invoices WHERE status IN ('PARTIAL','UNPAID')), 0) AS outstanding,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE incurred_at::date = CURRENT_DATE), 0) AS today_expenses,
        COALESCE((SELECT SUM(amount) FROM expenses), 0) AS total_expenses
    `);

    // Food & beverage by outlet (incl. Frosty Pops flagged outlet type)
    const outletSales = await pool.query(`
      SELECT res.id, res.name, res.outlet_type,
             COALESCE(SUM(o.total), 0) AS total
      FROM restaurants res
      LEFT JOIN orders o ON o.restaurant_id = res.id AND o.status NOT IN ('CANCELLED','OPEN')
      GROUP BY res.id, res.name, res.outlet_type
      ORDER BY res.id
    `);

    // Events
    const events = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM event_bookings WHERE event_date = CURRENT_DATE AND status NOT IN ('CANCELLED')) AS today_events,
        (SELECT COUNT(*) FROM event_bookings WHERE event_date >= CURRENT_DATE AND status NOT IN ('CANCELLED','COMPLETED')) AS upcoming_events,
        (SELECT COALESCE(SUM(rate + invoiced_amount - discount),0) FROM event_bookings WHERE status NOT IN ('CANCELLED')) AS event_revenue,
        (SELECT COALESCE(SUM(balance),0) FROM event_bookings WHERE status NOT IN ('CANCELLED','COMPLETED')) AS event_outstanding,
        (SELECT COUNT(*) FROM conference_halls WHERE status IN ('RESERVED','OCCUPIED')) AS halls_in_use
    `);
    const upcomingEvents = await pool.query(
      `SELECT b.id, b.booking_no, b.customer_name, b.event_date, b.start_time, h.name AS hall_name, b.status
       FROM event_bookings b LEFT JOIN conference_halls h ON h.id=b.hall_id
       WHERE b.event_date >= CURRENT_DATE AND b.status NOT IN ('CANCELLED','COMPLETED')
       ORDER BY b.event_date LIMIT 5`
    );

    const lowStock = await pool.query(
      `SELECT id, name, unit, quantity, min_quantity
       FROM inventory_items WHERE quantity <= min_quantity AND is_active = TRUE
       ORDER BY (quantity - min_quantity) LIMIT 8`
    );

    const recentReservations = await pool.query(
      `SELECT r.*, g.full_name AS guest_name, rm.room_number
       FROM reservations r
       LEFT JOIN guests g ON g.id = r.guest_id
       LEFT JOIN rooms rm ON rm.id = r.room_id
       ORDER BY r.created_at DESC LIMIT 6`
    );

    const recentPayments = await pool.query(
      `SELECT p.*, g.full_name AS guest_name
       FROM payments p LEFT JOIN guests g ON g.id = p.guest_id
       ORDER BY p.created_at DESC LIMIT 6`
    );

    const recentOrders = await pool.query(
      `SELECT o.*, res.name AS restaurant_name, t.table_number
       FROM orders o
       LEFT JOIN restaurants res ON res.id = o.restaurant_id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       ORDER BY o.created_at DESC LIMIT 6`
    );

    // Charts
    const revenueOverTime = await pool.query(`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
             SUM(amount) FILTER (WHERE category='ROOM' OR category='OTHER') AS hotel,
             SUM(amount) FILTER (WHERE category='RESTAURANT') AS restaurant,
             SUM(amount) FILTER (WHERE category='SPA' OR category='BARBERSHOP' OR category='AMENITY') AS services,
             SUM(amount) FILTER (WHERE category='EVENT') AS events,
             SUM(amount) AS total
      FROM payments
      WHERE created_at >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `);

    const occupancyByDay = await pool.query(`
      SELECT to_char(checkin_time, 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM check_ins WHERE checkin_time >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `);

    const restaurantSales = await pool.query(`
      SELECT res.name, COALESCE(SUM(o.total), 0) AS total
      FROM restaurants res
      LEFT JOIN orders o ON o.restaurant_id = res.id AND o.status NOT IN ('CANCELLED','OPEN')
      GROUP BY res.id, res.name
    `);

    const bookingTrends = await pool.query(`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM reservations WHERE created_at >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `);

    const housekeeping = await pool.query(
      `SELECT status, COUNT(*) AS count FROM housekeeping_tasks GROUP BY status`
    );

    res.json({
      success: true,
      data: {
        rooms: { ...roomMap, total: totalRooms },
        today: todayCounts.rows[0],
        revenue: revenue.rows[0],
        outletSales: restaurantSales.rows,
        events: events.rows[0],
        upcomingEvents: upcomingEvents.rows,
        lowStock: lowStock.rows,
        recentReservations: recentReservations.rows,
        recentPayments: recentPayments.rows,
        recentOrders: recentOrders.rows,
        charts: {
          revenueOverTime: revenueOverTime.rows,
          occupancyByDay: occupancyByDay.rows,
          restaurantSales: restaurantSales.rows,
          bookingTrends: bookingTrends.rows,
        },
        housekeeping: housekeeping.rows,
      },
    });
  } catch (e) {
    next(e);
  }
}
