import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';

export const getInventoryCategories = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_categories ORDER BY name');
  res.json({ success: true, data: rows });
});

export const createInventoryCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new ApiError(400, 'Name required.');
  const { rows } = await pool.query(
    `INSERT INTO inventory_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`, [name]);
  if (rows.length === 0) throw new ApiError(400, 'Category already exists.');
  res.status(201).json({ success: true, data: rows[0] });
});

export const getInventory = asyncHandler(async (req, res) => {
  const restaurantId = req.query.restaurantId;
  let q = `SELECT i.*, c.name AS category_name, s.name AS supplier_name, r.name AS restaurant_name
           FROM inventory_items i
           LEFT JOIN inventory_categories c ON c.id=i.category_id
           LEFT JOIN suppliers s ON s.id=i.supplier_id
           LEFT JOIN restaurants r ON r.id=i.restaurant_id`;
  const params = [];
  if (restaurantId) { params.push(restaurantId); q += ` WHERE i.restaurant_id=$1`; }
  q += ` ORDER BY i.name`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  const { name, restaurant_id, category_id, unit, cost_price, selling_price, quantity, min_quantity, supplier_id } = req.body;
  if (!name) throw new ApiError(400, 'Item name required.');
  const { rows } = await pool.query(
    `INSERT INTO inventory_items (name, restaurant_id, category_id, unit, cost_price, selling_price, quantity, min_quantity, supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, restaurant_id || null, category_id || null, unit || 'pcs', cost_price || 0, selling_price || 0,
     quantity || 0, min_quantity || 0, supplier_id || null]);
  const item = rows[0];
  if (quantity > 0) {
    await pool.query(
      `INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, note, created_by)
       VALUES ($1,'PURCHASE',$2,'OPENING','Opening stock', $3)`,
      [item.id, quantity, req.user?.id]);
  }
  await audit(req.user?.id, 'CREATE_INVENTORY', 'inventory_items', item.id, { name });
  res.status(201).json({ success: true, data: item });
});

export async function changeStock(client, itemId, type, qty, refType, refId, note, userId) {
  const sign = type === 'PURCHASE' || type === 'ADDITION' || type === 'ADJUSTMENT_UP' ? 1 : -1;
  const item = await client.query('SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE', [itemId]);
  if (item.rows.length === 0) throw new ApiError(404, 'Inventory item not found.');
  let newQty = Number(item.rows[0].quantity) + sign * Number(qty);
  if (newQty < 0) newQty = 0;
  await client.query(`UPDATE inventory_items SET quantity=$2 WHERE id=$1`, [itemId, newQty]);
  await client.query(
    `INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [itemId, type, qty, refType || null, refId || null, note || null, userId || null]);
  return { item: item.rows[0], newQty };
}

export const adjustStock = asyncHandler(async (req, res) => {
  const { item_id, type, quantity, note } = req.body;
  const allowed = ['SALE', 'ADJUSTMENT', 'WASTAGE', 'ADDITION'];
  if (!allowed.includes(type)) throw new ApiError(400, 'Invalid transaction type.');
  if (!quantity || quantity <= 0) throw new ApiError(400, 'Quantity must be positive.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stock = await changeStock(client, item_id, type, quantity, null, null, note, req.user?.id);
    await client.query('COMMIT');
    res.json({ success: true, data: { newQty: stock.newQty } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const getStockMovements = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, i.name AS item_name, i.unit, u.full_name AS user_name
     FROM inventory_transactions t
     LEFT JOIN inventory_items i ON i.id=t.item_id
     LEFT JOIN users u ON u.id=t.created_by
     ORDER BY t.created_at DESC LIMIT 200`);
  res.json({ success: true, data: rows });
});

export const getLowStock = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, c.name AS category_name, s.name AS supplier_name
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON c.id=i.category_id
     LEFT JOIN suppliers s ON s.id=i.supplier_id
     WHERE i.is_active=TRUE AND i.quantity <= i.min_quantity
     ORDER BY (i.quantity - i.min_quantity)`);
  res.json({ success: true, data: rows });
});

// ---- Suppliers ----
export const getSuppliers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name');
  res.json({ success: true, data: rows });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  if (!name) throw new ApiError(400, 'Supplier name required.');
  const { rows } = await pool.query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, contact_person, phone, email, address]);
  res.status(201).json({ success: true, data: rows[0] });
});

// ---- Purchases ----
export const getPurchases = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, s.name AS supplier_name, u.full_name AS created_by_name
     FROM purchases p
     LEFT JOIN suppliers s ON s.id=p.supplier_id
     LEFT JOIN users u ON u.id=p.created_by
     ORDER BY p.created_at DESC`);
  res.json({ success: true, data: rows });
});

export const getPurchase = asyncHandler(async (req, res) => {
  const purchase = await pool.query(
    `SELECT p.*, s.name AS supplier_name FROM purchases p
     LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=$1`, [req.params.id]);
  if (purchase.rows.length === 0) throw new ApiError(404, 'Purchase not found.');
  const items = await pool.query(
    `SELECT * FROM purchase_items WHERE purchase_id=$1`, [req.params.id]);
  res.json({ success: true, data: { ...purchase.rows[0], items: items.rows } });
});

export const createPurchase = asyncHandler(async (req, res) => {
  const { supplier_id, restaurant_id, items, note, payment_status } = req.body;
  if (!supplier_id || !Array.isArray(items) || items.length === 0)
    throw new ApiError(400, 'Supplier and at least one item required.');

  const client = await pool.connect();
  let created;
  try {
    await client.query('BEGIN');
    let total = 0;
    const lines = [];
    for (const it of items) {
      const inv = await client.query('SELECT * FROM inventory_items WHERE id=$1', [it.item_id]);
      if (inv.rows.length === 0) throw new ApiError(404, `Inventory item ${it.item_id} not found.`);
      const qty = Number(it.quantity);
      const price = Number(it.unit_price ?? inv.rows[0].cost_price);
      const line = qty * price;
      total += line;
      lines.push({ item: inv.rows[0], qty, price, line });
    }
    const purchase = await client.query(
      `INSERT INTO purchases (purchase_no, supplier_id, restaurant_id, total, payment_status, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [genNumber('PUR'), supplier_id, restaurant_id || null, total, payment_status || 'UNPAID', note, req.user?.id]);
    created = purchase.rows[0];

    for (const l of lines) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [created.id, l.item.id, l.item.name, l.qty, l.price, l.line]);
      await changeStock(client, l.item.id, 'PURCHASE', l.qty, 'purchases', created.id, `Purchase ${created.purchase_no}`, req.user?.id);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await audit(req.user?.id, 'CREATE_PURCHASE', 'purchases', created.id, { total });
  res.status(201).json({ success: true, data: created });
});

export const updatePurchaseStatus = asyncHandler(async (req, res) => {
  const { payment_status } = req.body;
  const { rows } = await pool.query(
    `UPDATE purchases SET payment_status=$2 WHERE id=$1 RETURNING *`, [req.params.id, payment_status]);
  if (rows.length === 0) throw new ApiError(404, 'Purchase not found.');
  res.json({ success: true, data: rows[0] });
});
