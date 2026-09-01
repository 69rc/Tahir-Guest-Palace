import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';
import { consumeOrderStock } from '../services/stockService.js';
import { reconcileInvoice } from '../services/folioService.js';
import { assertRestaurantAccess, resolveRestaurantContext, getAssignedRestaurantIds } from '../utils/restaurantAccess.js';

export const getRestaurants = asyncHandler(async (req, res) => {
  const { restaurantIds: assigned } = await getAssignedRestaurantIds(req.user);
  let q = `SELECT r.*, (SELECT COUNT(*) FROM restaurant_tables t WHERE t.restaurant_id=r.id) AS tables_count,
             (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id=r.id AND o.status IN ('OPEN','PAID')) AS active_orders
           FROM restaurants r`;
  const params = [];
  if (assigned !== null) {
    params.push(assigned);
    q += ` WHERE r.id = ANY($1::int[])`;
  }
  q += ` ORDER BY r.id`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows, assigned });
});

export const createRestaurant = asyncHandler(async (req, res) => {
  const { name, description, tax_rate, service_charge } = req.body;
  if (!name) throw new ApiError(400, 'Restaurant name required.');
  const { rows } = await pool.query(
    `INSERT INTO restaurants (name, description, tax_rate, service_charge) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description, tax_rate || 0, (service_charge ?? 0)]
  );
  await audit(req.user?.id, 'CREATE_RESTAURANT', 'restaurants', rows[0].id);
  res.status(201).json({ success: true, data: rows[0] });
});

// ---- Tables ----
export const getTables = asyncHandler(async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const { rows } = await pool.query(
    `SELECT t.*, r.name AS restaurant_name FROM restaurant_tables t
     LEFT JOIN restaurants r ON r.id=t.restaurant_id
     WHERE t.restaurant_id=$1 ORDER BY substring(t.table_number from '^[0-9]+')::int NULLS LAST, t.table_number`, [restaurantId]);
  res.json({ success: true, data: rows });
});

export const createTable = asyncHandler(async (req, res) => {
  const { restaurant_id, table_number, capacity, status } = req.body;
  if (!restaurant_id || !table_number) throw new ApiError(400, 'Restaurant and table number required.');
  await assertRestaurantAccess(req.user, restaurant_id);
  const { rows } = await pool.query(
    `INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [restaurant_id, table_number, capacity || 4, status || 'AVAILABLE']
  );
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const tbl = await pool.query('SELECT * FROM restaurant_tables WHERE id=$1', [req.params.id]);
  if (tbl.rows.length === 0) throw new ApiError(404, 'Table not found.');
  await assertRestaurantAccess(req.user, tbl.rows[0].restaurant_id);
  const { rows } = await pool.query(
    `UPDATE restaurant_tables SET status=$2 WHERE id=$1 RETURNING *`, [req.params.id, status]);
  res.json({ success: true, data: rows[0] });
});

// ---- Menu ----
export const getMenu = asyncHandler(async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const categories = await pool.query(
    `SELECT * FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order, id`, [restaurantId]);
  const items = await pool.query(
    `SELECT m.*, c.name AS category_name FROM menu_items m
     LEFT JOIN menu_categories c ON c.id=m.category_id
     WHERE m.restaurant_id=$1 ORDER BY m.category_id, m.id`, [restaurantId]);
  res.json({ success: true, data: { categories: categories.rows, items: items.rows } });
});

export const createMenuCategory = asyncHandler(async (req, res) => {
  const { restaurant_id, name, sort_order } = req.body;
  if (!restaurant_id || !name) throw new ApiError(400, 'Restaurant and category name required.');
  await assertRestaurantAccess(req.user, restaurant_id);
  const { rows } = await pool.query(
    `INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *`,
    [restaurant_id, name, sort_order || 0]);
  res.status(201).json({ success: true, data: rows[0] });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const { restaurant_id, category_id, name, description, price, cost, is_available } = req.body;
  if (!restaurant_id || !name) throw new ApiError(400, 'Restaurant and item name required.');
  await assertRestaurantAccess(req.user, restaurant_id);
  const { rows } = await pool.query(
    `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, cost, is_available)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,TRUE)) RETURNING *`,
    [restaurant_id, category_id || null, name, description, price || 0, cost || 0, is_available]);
  res.status(201).json({ success: true, data: rows[0] });
});

// ---- Orders / POS ----
export const createOrder = asyncHandler(async (req, res) => {
  const { table_id, items, discount } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    throw new ApiError(400, 'At least one item is required.');

  // Derive/validate the restaurant context from the authenticated user.
  // RESTAURANT_STAFF is always bound to their single assigned restaurant;
  // the client-supplied value is ignored and never trusted.
  const restaurant_id = await resolveRestaurantContext(req.user, req.body.restaurant_id);

  const restaurant = await pool.query('SELECT * FROM restaurants WHERE id=$1', [restaurant_id]);
  if (restaurant.rows.length === 0) throw new ApiError(404, 'Restaurant not found.');
  const rt = restaurant.rows[0];

  const client = await pool.connect();
  let created;
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    for (const it of items) {
      const mi = await client.query('SELECT * FROM menu_items WHERE id=$1', [it.menu_item_id]);
      if (mi.rows.length === 0) throw new ApiError(404, `Menu item ${it.menu_item_id} not found.`);
      subtotal += Number(mi.rows[0].price) * Number(it.quantity);
    }
    const disc = Number(discount || 0);
    const tax = (subtotal - disc) * Number(rt.tax_rate) / 100;
    const service = (subtotal - disc) * Number(rt.service_charge || 0) / 100;
    const total = subtotal - disc + tax + service;

    const order = await client.query(
      `INSERT INTO orders (order_no, restaurant_id, table_id, status, subtotal, discount, tax, service_charge, total, created_by)
       VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7,$8,$9) RETURNING *`,
      [genNumber('ORD'), restaurant_id, table_id || null, subtotal, disc, tax, service, total, req.user?.id]
    );
    created = order.rows[0];

    for (const it of items) {
      const mi = await client.query('SELECT * FROM menu_items WHERE id=$1', [it.menu_item_id]);
      const price = Number(mi.rows[0].price);
      const qty = Number(it.quantity);
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [created.id, it.menu_item_id, mi.rows[0].name, qty, price, price * qty]
      );
    }

    if (table_id) {
      await client.query(`UPDATE restaurant_tables SET status='OCCUPIED' WHERE id=$1`, [table_id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await audit(req.user?.id, 'CREATE_ORDER', 'orders', created.id, { total: created.total });
  res.status(201).json({ success: true, data: created });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await pool.query(
    `SELECT o.*, res.name AS restaurant_name, t.table_number
     FROM orders o LEFT JOIN restaurants res ON res.id=o.restaurant_id
     LEFT JOIN restaurant_tables t ON t.id=o.table_id WHERE o.id=$1`, [req.params.id]);
  if (order.rows.length === 0) throw new ApiError(404, 'Order not found.');
  await assertRestaurantAccess(req.user, order.rows[0].restaurant_id);
  const items = await pool.query(
    `SELECT * FROM order_items WHERE order_id=$1 ORDER BY id`, [req.params.id]);
  res.json({ success: true, data: { ...order.rows[0], items: items.rows } });
});

export const getOrders = asyncHandler(async (req, res) => {
  const restaurantId = req.params.restaurantId;
  let q = `SELECT o.*, res.name AS restaurant_name, t.table_number,
                  g.full_name AS guest_name
           FROM orders o
           LEFT JOIN restaurants res ON res.id=o.restaurant_id
           LEFT JOIN restaurant_tables t ON t.id=o.table_id
           LEFT JOIN guests g ON g.id=o.guest_id`;
  const params = [];
  if (restaurantId) { params.push(restaurantId); q += ` WHERE o.restaurant_id=$1`; }
  q += ` ORDER BY o.created_at DESC LIMIT 100`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const getActiveOrders = asyncHandler(async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const { rows } = await pool.query(
    `SELECT o.*, t.table_number, COUNT(oi.id) AS item_count
     FROM orders o LEFT JOIN restaurant_tables t ON t.id=o.table_id
     LEFT JOIN order_items oi ON oi.order_id=o.id
     WHERE o.restaurant_id=$1 AND o.status NOT IN ('CANCELLED','PAID')
     GROUP BY o.id, t.table_number ORDER BY o.created_at`, [restaurantId]);
  res.json({ success: true, data: rows });
});

// Charge to room
export const chargeToRoom = asyncHandler(async (req, res) => {
  const { order_id, room_id, guest_id } = req.body;
  if (!order_id) throw new ApiError(400, 'Order id required.');
  if (!room_id && !guest_id) throw new ApiError(400, 'Room number or guest required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let gid = guest_id;
    if (room_id && !gid) {
      const stay = await client.query(
        `SELECT r.guest_id, g.full_name FROM reservations r
         JOIN guests g ON g.id=r.guest_id
         JOIN rooms rm ON rm.id=r.room_id
         WHERE rm.id=$1 AND r.status='CHECKED_IN'
         ORDER BY r.check_in_date DESC LIMIT 1`, [room_id]);
      if (stay.rows.length === 0) throw new ApiError(400, 'No current guest found on that room.');
      gid = stay.rows[0].guest_id;
    }

    const order = await client.query('SELECT * FROM orders WHERE id=$1', [order_id]);
    if (order.rows.length === 0) throw new ApiError(404, 'Order not found.');
    if (order.rows[0].is_charged_to_room) throw new ApiError(400, 'Order already charged to a room.');
    await assertRestaurantAccess(req.user, order.rows[0].restaurant_id);

    // attach guest to order
    await client.query(`UPDATE orders SET guest_id=$2, is_charged_to_room=TRUE, status='PAID' WHERE id=$1`, [order_id, gid]);

    // Find open folio invoice
    let inv = await client.query(
      `SELECT * FROM invoices WHERE guest_id=$1 AND status IN ('UNPAID','PARTIAL')
       ORDER BY created_at DESC LIMIT 1`, [gid]);
    if (inv.rows.length === 0) {
      const created = await client.query(
        `INSERT INTO invoices (invoice_no, guest_id, invoice_type, subtotal,discount,tax,total,paid,balance,status)
         VALUES ($1,$2,'HOTEL',0,0,0,0,0,0,'UNPAID') RETURNING *`, [genNumber('INV'), gid]);
      inv = created.rows;
    }
    const invoice = inv.rows[0];

    const orderItems = await client.query(
      `SELECT oi.*, mi.name AS item_name FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id=oi.menu_item_id
       WHERE oi.order_id=$1`, [order_id]);

    const desc = orderItems.rows.map((i) => `${i.item_name || i.item_name} × ${i.quantity}`).join(', ');
    const total = Number(order.rows[0].total);

    await client.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
       VALUES ($1,$2,1,$3,$3)`,
      [invoice.id, `Restaurant order ${order.rows[0].order_no} — ${desc}`, total]
    );
    // rebuild totals/balance from persisted lines + payments
    await reconcileInvoice(client, invoice.id);

    // Consume stock inside the same transaction so charge + stock stay atomic
    await consumeOrderStock(order_id, order.rows[0].restaurant_id, req.user?.id, client);

    await client.query('COMMIT');
    const folio = await getGuestFolio(gid);
    await audit(req.user?.id, 'CHARGE_TO_ROOM', 'orders', order_id, { guest_id: gid, amount: total });
    res.json({ success: true, message: `Bill charged to guest's room folio.`, data: { guest_id: gid, total, folio } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const payOrder = asyncHandler(async (req, res) => {
  const { order_id, method } = req.body;
  const order = await pool.query('SELECT * FROM orders WHERE id=$1', [order_id]);
  if (order.rows.length === 0) throw new ApiError(404, 'Order not found.');
  const o = order.rows[0];
  await assertRestaurantAccess(req.user, o.restaurant_id);
  if (o.status === 'PAID') throw new ApiError(400, 'Order already paid.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `INSERT INTO invoices (invoice_no, guest_id, order_id, invoice_type, subtotal,discount,tax,total,paid,balance,status)
       VALUES ($1,$2,$3,'RESTAURANT',$4,$5,$6,$7,$7,0,'PAID') RETURNING *`,
      [genNumber('INV'), o.guest_id, o.id, o.subtotal, o.discount, o.tax, o.total]
    );
    const items = await client.query(`SELECT * FROM order_items WHERE order_id=$1`, [order_id]);
    for (const it of items.rows) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [inv.rows[0].id, it.item_name, it.quantity, it.unit_price, it.line_total]
      );
    }
    await client.query(
      `INSERT INTO payments (payment_no, guest_id, order_id, invoice_id, amount, method, category, note)
       VALUES ($1,$2,$3,$4,$5,$6,'RESTAURANT','Restaurant order payment')`,
      [genNumber('PAY'), o.guest_id, o.id, inv.rows[0].id, o.total, method || 'CASH']
    );
    await client.query(`UPDATE orders SET status='PAID', payment_method=$2 WHERE id=$1`, [order_id, method || 'CASH']);
    await client.query(`UPDATE restaurant_tables SET status='AVAILABLE' WHERE id=$1 AND status='OCCUPIED'`, [o.table_id]);
    // Consume stock inside the same transaction
    await consumeOrderStock(order_id, o.restaurant_id, req.user?.id, client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'PAY_ORDER', 'orders', order_id, { method });
  res.json({ success: true, message: 'Order paid.' });
});

export async function getGuestFolio(guestId) {
  const invoices = await pool.query(`SELECT * FROM invoices WHERE guest_id=$1`, [guestId]);
  const payments = await pool.query(`SELECT * FROM payments WHERE guest_id=$1`, [guestId]);
  let total = 0, paid = 0;
  invoices.rows.forEach((i) => (total += Number(i.total)));
  payments.rows.forEach((p) => (paid += Number(p.amount)));
  return { totalCharges: total, totalPaid: paid, balance: total - paid };
}
