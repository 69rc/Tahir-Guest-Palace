import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit, genNumber } from '../utils/common.js';

export const openShift = asyncHandler(async (req, res) => {
  const { staff_user_id, opening_cash } = req.body;

  // Check no OTHER open shift for this staff
  const open = await pool.query(
    `SELECT * FROM cashier_shifts WHERE staff_user_id=$1 AND status='OPEN'`, [staff_user_id || req.user?.id]
  );
  if (open.rows.length > 0) {
    throw new ApiError(400, `Cashier already has an open shift (${open.rows[0].shift_no}). Close it first.`);
  }

  const shiftNo = genNumber('SHIFT');
  const { rows } = await pool.query(
    `INSERT INTO cashier_shifts (shift_no, staff_user_id, opening_cash, status)
     VALUES ($1,$2,$3,'OPEN') RETURNING *`,
    [shiftNo, staff_user_id || req.user?.id, opening_cash || 0]
  );

  await audit(req.user?.id, 'SHIFT_OPEN', 'cashier_shifts', rows[0].id, { shift_no: shiftNo, opening_cash: opening_cash || 0 });
  res.status(201).json({ success: true, data: rows[0] });
});

export const getCurrentShift = asyncHandler(async (req, res) => {
  const uid = req.query.staff_user_id || req.user?.id;
  const { rows } = await pool.query(
    `SELECT * FROM cashier_shifts WHERE staff_user_id=$1 AND status='OPEN' ORDER BY opened_at DESC LIMIT 1`, [uid]
  );
  if (!rows.length) return res.json({ success: true, data: null });

  const shift = rows[0];
  // Aggregate payments for this shift
  const agg = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE method = 'CASH'),0) AS cash_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'POS'),0) AS pos_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'TRANSFER' OR method = 'BANK_TRANSFER' OR method = 'BANK'),0) AS transfer_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'CARD'),0) AS card_total,
       COALESCE(SUM(amount) FILTER (WHERE method IN ('CASH','POS','TRANSFER','BANK_TRANSFER','BANK','CARD')),0) AS gross_sales,
       COALESCE(SUM(amount) FILTER (WHERE category = 'REFUND'),0) AS refund_total,
       COUNT(*) AS total_transactions
     FROM payments WHERE shift_id=$1`, [shift.id]
  );

  const expected = Number(shift.opening_cash) + Number(agg.rows[0].gross_sales) - Number(agg.rows[0].refund_total);

  res.json({
    success: true,
    data: {
      shift,
      totals: agg.rows[0],
      expectedCash: expected,
      difference: shift.closing_cash != null ? Number(shift.closing_cash) - expected : null,
    }
  });
});

export const getShifts = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let q = `SELECT s.*, u.full_name AS cashier_name FROM cashier_shifts s LEFT JOIN users u ON u.id=s.staff_user_id`;
  const params = [];
  if (status) {
    params.push(status);
    q += ` WHERE s.status=$1`;
  }
  q += ` ORDER BY s.opened_at DESC LIMIT 100`;
  const { rows } = await pool.query(q, params);
  res.json({ success: true, data: rows });
});

export const getShiftDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shift = await pool.query(
    `SELECT s.*, u.full_name AS cashier_name FROM cashier_shifts s LEFT JOIN users u ON u.id=s.staff_user_id WHERE s.id=$1`, [id]
  );
  if (!shift.rows.length) throw new ApiError(404, 'Shift not found.');

  const payments = await pool.query(
    `SELECT p.*, g.full_name AS guest_name, i.invoice_no
     FROM payments p
     LEFT JOIN guests g ON g.id = p.guest_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.shift_id=$1 ORDER BY p.created_at DESC`, [id]
  );

  const agg = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE method = 'CASH'),0) AS cash_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'POS'),0) AS pos_total,
       COALESCE(SUM(amount) FILTER (WHERE method IN ('TRANSFER','BANK_TRANSFER','BANK')),0) AS transfer_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'CARD'),0) AS card_total,
       COALESCE(SUM(amount) FILTER (WHERE category = 'REFUND'),0) AS refund_total,
       COALESCE(SUM(amount) FILTER (WHERE method IN ('CASH','POS','TRANSFER','BANK_TRANSFER','BANK','CARD')),0) AS gross_sales,
       COUNT(*) AS total_transactions
     FROM payments WHERE shift_id=$1`, [id]
  );

  res.json({ success: true, data: { shift: shift.rows[0], payments: payments.rows, totals: agg.rows[0] } });
});

export const closeShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { closing_cash, notes } = req.body;
  if (closing_cash == null) throw new ApiError(400, 'Closing cash amount is required.');

  const shift = await pool.query(
    `SELECT * FROM cashier_shifts WHERE id=$1`, [id]
  );
  if (!shift.rows.length) throw new ApiError(404, 'Shift not found.');
  if (shift.rows[0].status === 'CLOSED') throw new ApiError(400, 'Shift already closed.');

  const agg = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE method = 'CASH'),0) AS cash_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'POS'),0) AS pos_total,
       COALESCE(SUM(amount) FILTER (WHERE method IN ('TRANSFER','BANK_TRANSFER','BANK')),0) AS transfer_total,
       COALESCE(SUM(amount) FILTER (WHERE method = 'CARD'),0) AS card_total,
       COALESCE(SUM(amount) FILTER (WHERE category = 'REFUND'),0) AS refund_total,
       COUNT(*) AS total_transactions
     FROM payments WHERE shift_id=$1`, [id]
  );

  const a = agg.rows[0];
  const expected = Number(shift.rows[0].opening_cash) + Number(a.cash_total) - Number(a.refund_total);
  const difference = Number(closing_cash) - expected;

  const { rows } = await pool.query(
    `UPDATE cashier_shifts SET
       closing_cash=$2, expected_cash=$3, difference=$4,
       cash_total=$5, pos_total=$6, transfer_total=$7, card_total=$8,
       refund_total=$9, total_transactions=$10, status='CLOSED', closed_at=now(), notes=$11
     WHERE id=$1 RETURNING *`,
    [id, closing_cash, expected, difference, a.cash_total, a.pos_total, a.transfer_total, a.card_total, a.refund_total, a.total_transactions, notes || null]
  );

  await audit(req.user?.id, 'SHIFT_CLOSE', 'cashier_shifts', id, {
    shift_no: shift.rows[0].shift_no, expected_cash: expected, closing_cash, difference
  });
  res.json({ success: true, data: rows[0], reconciliation: { expected_cash: expected, closing_cash: Number(closing_cash), difference } });
});

export const getShiftReports = asyncHandler(async (req, res) => {
  const { start, end } = req.query;

  const closedShifts = await pool.query(
    `SELECT s.*, u.full_name AS cashier_name
     FROM cashier_shifts s LEFT JOIN users u ON u.id=s.staff_user_id
     WHERE s.status='CLOSED'
     ${start ? 'AND s.closed_at >= $1' : ''}
     ${end ? 'AND s.closed_at <= $2' : ''}
     ORDER BY s.closed_at DESC`, [start, end].filter(Boolean)
  );

  // Cashier performance: sum by staff
  const performance = await pool.query(
    `SELECT u.id, u.full_name,
       COUNT(s.id) AS shifts_closed,
       COALESCE(SUM(s.gross_sales),0) AS total_sales,
       COALESCE(SUM(s.refund_total),0) AS total_refunds,
       COALESCE(SUM(s.difference),0) AS total_difference,
       COALESCE(SUM(s.gross_sales) - NULLIF(COUNT(s.id),0) * s.opening_cash, 0) AS net
     FROM users u
     LEFT JOIN cashier_shifts s ON s.staff_user_id = u.id AND s.status='CLOSED'
     GROUP BY u.id, u.full_name HAVING COUNT(s.id) > 0 ORDER BY total_sales DESC`
  );

  // Payment method totals across closed shifts
  const methodTotals = await pool.query(
    `SELECT
       COALESCE(SUM(cash_total),0) AS cash, COALESCE(SUM(pos_total),0) AS pos,
       COALESCE(SUM(transfer_total),0) AS transfer, COALESCE(SUM(card_total),0) AS card,
       COALESCE(SUM(refund_total),0) AS refunds, COALESCE(SUM(gross_sales),0) AS total
     FROM cashier_shifts WHERE status='CLOSED'`
  );

  // Reconciliation differences
  const differences = await pool.query(
    `SELECT s.shift_no, u.full_name, s.expected_cash, s.closing_cash, s.difference, s.closed_at
     FROM cashier_shifts s LEFT JOIN users u ON u.id=s.staff_user_id
     WHERE s.status='CLOSED' AND ABS(s.difference) > 0.01
     ORDER BY ABS(s.difference) DESC LIMIT 50`
  );

  res.json({
    success: true,
    data: {
      closedShifts: closedShifts.rows,
      performance: performance.rows,
      methodTotals: methodTotals.rows[0],
      differences: differences.rows,
    }
  });
});
