import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { genNumber, audit } from '../utils/common.js';
import { getGuestFolio } from '../services/folioService.js';

export const getPayments = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, g.full_name AS guest_name, inv.invoice_no, u.full_name AS received_by_name
     FROM payments p
     LEFT JOIN guests g ON g.id=p.guest_id
     LEFT JOIN invoices inv ON inv.id=p.invoice_id
     LEFT JOIN users u ON u.id=p.received_by
     ORDER BY p.created_at DESC LIMIT 200`);
  res.json({ success: true, data: rows });
});

export const createPayment = asyncHandler(async (req, res) => {
  const { guest_id, reservation_id, invoice_id, amount, method, category, note } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Valid amount required.');
  if (!method) throw new ApiError(400, 'Payment method required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let invId = invoice_id;
    if (!invId && guest_id) {
      const open = await client.query(
        `SELECT id FROM invoices WHERE guest_id=$1 AND status IN ('UNPAID','PARTIAL')
         ORDER BY created_at DESC LIMIT 1`, [guest_id]);
      if (open.rows.length) invId = open.rows[0].id;
    }

    // Auto-assign to cashier's open shift if present
    const openShift = await client.query(
      `SELECT id FROM cashier_shifts WHERE staff_user_id=$1 AND status='OPEN' LIMIT 1`, [req.user?.id]
    );
    const shiftId = openShift.rows.length ? openShift.rows[0].id : null;

    const payment = await client.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by, shift_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [genNumber('PAY'), guest_id || null, reservation_id || null, invId || null, amount, method, category || 'ROOM', note, req.user?.id, shiftId]);
    if (invId) {
      await client.query(`UPDATE invoices SET paid=paid+$2 WHERE id=$1`, [invId, amount]);
      await client.query(
        `UPDATE invoices SET balance=total-paid,
           status=CASE WHEN total-paid<=0.01 THEN 'PAID' WHEN paid>0 THEN 'PARTIAL' ELSE 'UNPAID' END
         WHERE id=$1`, [invId]);
    }
    await client.query('COMMIT');
    await audit(req.user?.id, 'CREATE_PAYMENT', 'payments', payment.rows[0].id, { amount, method });
    res.status(201).json({ success: true, data: payment.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const getInvoices = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, g.full_name AS guest_name, rm.room_number
     FROM invoices i
     LEFT JOIN guests g ON g.id=i.guest_id
     LEFT JOIN reservations r ON r.id=i.reservation_id
     LEFT JOIN rooms rm ON rm.id=r.room_id
     ORDER BY i.created_at DESC LIMIT 200`);
  res.json({ success: true, data: rows });
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const p = await pool.query(
    `SELECT p.*, g.full_name AS guest_name, g.phone AS guest_phone, g.email AS guest_email,
            inv.invoice_no, u.full_name AS cashier_name, ord.order_no
     FROM payments p
     LEFT JOIN guests g ON g.id=p.guest_id
     LEFT JOIN invoices inv ON inv.id=p.invoice_id
     LEFT JOIN users u ON u.id=p.received_by
     LEFT JOIN orders ord ON ord.id=p.order_id
     WHERE p.id=$1`, [req.params.id]);
  if (p.rows.length === 0) throw new ApiError(404, 'Payment not found.');
  res.json({ success: true, data: p.rows[0] });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const inv = await pool.query(
    `SELECT i.*, g.full_name AS guest_name, g.phone, g.email, g.address, rm.room_number,
            rt.name AS room_type_name
     FROM invoices i
     LEFT JOIN guests g ON g.id=i.guest_id
     LEFT JOIN reservations r ON r.id=i.reservation_id
     LEFT JOIN rooms rm ON rm.id=r.room_id
     LEFT JOIN room_types rt ON rt.id=rm.room_type_id
     WHERE i.id=$1`, [req.params.id]);
  if (inv.rows.length === 0) throw new ApiError(404, 'Invoice not found.');
  const items = await pool.query(
    `SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id`, [req.params.id]);
  const payments = await pool.query(
    `SELECT * FROM payments WHERE invoice_id=$1 ORDER BY created_at`, [req.params.id]);
  res.json({ success: true, data: { ...inv.rows[0], items: items.rows, payments: payments.rows } });
});

export const getGuestFolioController = asyncHandler(async (req, res) => {
  const folio = await getGuestFolio(req.params.guestId);
  res.json({ success: true, data: folio });
});

// ---- Expenses ----
export const getExpenses = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let q = `SELECT e.*, u.full_name AS incurred_by_name FROM expenses e
           LEFT JOIN users u ON u.id=e.incurred_by`;
  const params = [];
  const conds = [];
  if (from) { params.push(from); conds.push(`e.incurred_at >= $${params.length}::date`); }
  if (to) { params.push(to); conds.push(`e.incurred_at <= $${params.length}::date + interval '1 day'`); }
  if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
  q += ` ORDER BY e.incurred_at DESC LIMIT 200`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const createExpense = asyncHandler(async (req, res) => {
  const { category, description, amount, restaurant_id, paid_to, method } = req.body;
  if (!category || !amount || amount <= 0) throw new ApiError(400, 'Category and valid amount required.');
  const { rows } = await pool.query(
    `INSERT INTO expenses (category, description, amount, restaurant_id, paid_to, method, incurred_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [category, description, amount, restaurant_id || null, paid_to || null, method || 'CASH', req.user?.id]);
  await audit(req.user?.id, 'CREATE_EXPENSE', 'expenses', rows[0].id, { amount, category });
  res.status(201).json({ success: true, data: rows[0] });
});

// ---- Revenue / Accounting ----
export const getRevenue = asyncHandler(async (req, res) => {
  const { from, to, period } = req.query;
  const where = [];
  const params = [];
  if (from) { params.push(from); where.push(`p.created_at >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`p.created_at <= $${params.length}::date + interval '1 day'`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let periodSql = `to_char(p.created_at,'YYYY-MM-DD')`;
  if (period === 'week') periodSql = `to_char(date_trunc('week', p.created_at),'YYYY-MM-DD')`;
  if (period === 'month') periodSql = `to_char(date_trunc('month', p.created_at),'YYYY-MM')`;

  const total = await pool.query(
    `SELECT COALESCE(SUM(p.amount),0) AS total,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category IN ('ROOM','EVENT','OTHER','SPA','BARBERSHOP','AMENITY')),0) AS hotel,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='RESTAURANT'),0) AS restaurant,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='SPA'),0) AS spa,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='BARBERSHOP'),0) AS barbershop,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='AMENITY'),0) AS amenity,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='EVENT'),0) AS event
     FROM payments p ${whereSql}`, params);

  const byCategory = await pool.query(
    `SELECT p.category, COUNT(*) AS count, COALESCE(SUM(p.amount),0) AS total
     FROM payments p ${whereSql} GROUP BY p.category`, params);

  const timeSeries = await pool.query(
    `SELECT ${periodSql} AS period,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category IN ('ROOM','OTHER')),0) AS hotel,
            COALESCE(SUM(p.amount) FILTER (WHERE p.category='RESTAURANT'),0) AS restaurant,
            COALESCE(SUM(p.amount),0) AS total
     FROM payments p ${whereSql} GROUP BY 1 ORDER BY 1`, params);

  res.json({ success: true, data: { totals: total.rows[0], byCategory: byCategory.rows, timeSeries: timeSeries.rows } });
});

export const getAccounting = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const conds = [];
  if (from) { params.push(from); conds.push(`p.created_at >= $${params.length}::date`); }
  if (to) { params.push(to); conds.push(`p.created_at <= $${params.length}::date + interval '1 day'`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const income = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments p ${where}`, params);

  const expenseParams = [];
  const expenseConds = [];
  if (from) { expenseParams.push(from); expenseConds.push(`e.incurred_at >= $${expenseParams.length}::date`); }
  if (to) { expenseParams.push(to); expenseConds.push(`e.incurred_at <= $${expenseParams.length}::date + interval '1 day'`); }
  const exWhere = expenseConds.length ? `WHERE ${expenseConds.join(' AND ')}` : '';
  const expenses = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses e ${exWhere}`, expenseParams);

  const expenseByCategory = await pool.query(
    `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
     FROM expenses e ${exWhere} GROUP BY category ORDER BY total DESC`, expenseParams);

  const incomeByCategory = await pool.query(
    `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
     FROM payments p ${where} GROUP BY category`, params);

  const outstanding = await pool.query(
    `SELECT COALESCE(SUM(balance),0) AS total, COUNT(*) AS count
     FROM invoices WHERE status IN ('UNPAID','PARTIAL')`);

  const netIncome = Number(income.rows[0].total) - Number(expenses.rows[0].total);

  res.json({
    success: true,
    data: {
      income: Number(income.rows[0].total),
      expenses: Number(expenses.rows[0].total),
      netIncome,
      incomeByCategory: incomeByCategory.rows,
      expenseByCategory: expenseByCategory.rows,
      outstanding: outstanding.rows[0].total,
      outstandingCount: Number(outstanding.rows[0].count),
    },
  });
});
