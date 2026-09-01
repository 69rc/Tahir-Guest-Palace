import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit, genNumber } from '../utils/common.js';

export const getPurchaseRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 100 } = req.query;
  let where = '';
  const params = [];
  let idx = 1;
  if (status) {
    params.push(status);
    where = ` WHERE pr.status=$1`;
  }
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT pr.*, u.full_name AS requested_by_name,
            ap.full_name AS approved_by_name, p.purchase_no
     FROM purchase_requests pr
     LEFT JOIN users u ON u.id = pr.requested_by
     LEFT JOIN users ap ON ap.id = pr.approved_by
     LEFT JOIN purchases p ON p.id = pr.purchase_id
     ${where}
     ORDER BY pr.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  res.json({ success: true, data: rows, total: rows.length, page, limit });
});

export const getPurchaseRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT pr.*, u.full_name AS requested_by_name, ap.full_name AS approved_by_name
     FROM purchase_requests pr
     LEFT JOIN users u ON u.id = pr.requested_by
     LEFT JOIN users ap ON ap.id = pr.approved_by
     WHERE pr.id=$1`, [id]
  );
  if (!rows.length) throw new ApiError(404, 'Purchase request not found.');
  const { rows: items } = await pool.query(
    `SELECT pri.*, ii.name AS inventory_item_name FROM purchase_request_items pri
     LEFT JOIN inventory_items ii ON ii.id = pri.inventory_item_id
     WHERE pri.request_id=$1`, [id]
  );
  res.json({ success: true, data: { ...rows[0], items } });
});

export const createPurchaseRequest = asyncHandler(async (req, res) => {
  const { department, reason, items } = req.body;
  if (!items || !items.length) throw new ApiError(400, 'At least one item is required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestNo = genNumber('PRQ');
    const { rows } = await client.query(
      `INSERT INTO purchase_requests (request_no, requested_by, department, reason, status)
       VALUES ($1,$2,$3,$4,'PENDING') RETURNING *`,
      [requestNo, req.user?.id, department || null, reason || null]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_request_items (request_id, inventory_item_id, item_name, quantity, unit_price, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [rows[0].id, item.inventory_item_id || null, item.item_name, item.quantity || 1,
         item.unit_price || 0, item.notes || null]
      );
    }
    await client.query('COMMIT');
    await audit(req.user?.id, 'PURCHASE_REQUEST_CREATE', 'purchase_requests', rows[0].id, { request_no: requestNo });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const approvePurchaseRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved } = req.body;
  const { rows } = await pool.query(
    `UPDATE purchase_requests SET status=$2, approved_by=$3, approved_at=now()
     WHERE id=$1 RETURNING *`,
    [id, approved === false ? 'REJECTED' : 'APPROVED', req.user?.id]
  );
  if (!rows.length) throw new ApiError(404, 'Request not found.');
  await audit(req.user?.id, 'PURCHASE_REQUEST_APPROVE', 'purchase_requests', id, { status: rows[0].status });
  res.json({ success: true, data: rows[0] });
});

export const convertToPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { supplier_id, expected_delivery } = req.body;
  if (!supplier_id) throw new ApiError(400, 'Supplier is required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query('SELECT * FROM purchase_requests WHERE id=$1', [id]);
    if (!request.rows.length) throw new ApiError(404, 'Request not found.');
    if (request.rows[0].status !== 'APPROVED') throw new ApiError(400, 'Only approved requests can be converted.');

    const { rows: items } = await client.query(
      'SELECT * FROM purchase_request_items WHERE request_id=$1', [id]
    );

    const purchaseNo = genNumber('PO');
    const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
    const { rows } = await client.query(
      `INSERT INTO purchases (purchase_no, supplier_id, total, note, status, expected_delivery, created_by)
       VALUES ($1,$2,$3,$4,'APPROVED',$5,$6) RETURNING *`,
      [purchaseNo, supplier_id, total, `From request ${request.rows[0].request_no}`, expected_delivery || null, req.user?.id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [rows[0].id, item.inventory_item_id, item.item_name, item.quantity, item.unit_price, Number(item.quantity) * Number(item.unit_price)]
      );
    }

    await client.query(
      `UPDATE purchase_requests SET status='CONVERTED', purchase_id=$2 WHERE id=$1`, [id, rows[0].id]
    );

    await client.query('COMMIT');
    await audit(req.user?.id, 'PURCHASE_ORDER_CREATE', 'purchases', rows[0].id, { purchase_no: purchaseNo });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const recordGoodsReceived = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { received_items } = req.body;
  if (!received_items || !received_items.length) throw new ApiError(400, 'Received items required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const purchase = await client.query('SELECT * FROM purchases WHERE id=$1', [id]);
    if (!purchase.rows.length) throw new ApiError(404, 'Purchase not found.');

    for (const item of received_items) {
      const { purchase_item_id, quantity_ordered, quantity_received, damaged, notes } = item;
      const accepted = Math.max(0, (quantity_received || 0) - (damaged || 0));

      if (accepted > 0 && item.inventory_item_id) {
        // Update stock with the accepted quantity only
        await client.query(
          `UPDATE inventory_items SET quantity = quantity + $2 WHERE id=$1`,
          [item.inventory_item_id, accepted]
        );
        await client.query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note, created_by)
           VALUES ($1,'IN',$2,'PURCHASE',$3,$4,$5)`,
          [item.inventory_item_id, accepted, id, `Goods received - accepted ${accepted} of ${quantity_received}`, req.user?.id]
        );
      }

      await client.query(
        `UPDATE purchase_items SET quantity_received=$2, damaged_quantity=$3, accepted_quantity=$4, received_date=now(), notes=$5
         WHERE id=$1`,
        [purchase_item_id, quantity_received || 0, damaged || 0, accepted, notes || null]
      );
    }

    await client.query(
      `UPDATE purchases SET status='RECEIVED', received_date=now(), payment_status='RECEIVED' WHERE id=$1`, [id]
    );

    await client.query('COMMIT');
    await audit(req.user?.id, 'GOODS_RECEIVED', 'purchases', id, { purchase_no: purchase.rows[0].purchase_no });
    res.json({ success: true, message: 'Goods received and stock updated.' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
