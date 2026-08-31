import pool from '../config/db.js';
import { asyncHandler } from '../utils/helpers.js';
import { naira } from '../utils/common.js';

const today = () => new Date().toISOString().slice(0, 10);

async function answerQuestion(q) {
  const text = (q || '').toLowerCase();

  // Revenue
  if (/(revenue|earned|income|made|profit).*(today|day)/.test(text) || /today.*revenue/i.test(text) || /revenue.*today/i.test(text)) {
    const r = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE created_at::date = $1`, [today()]);
    return { answer: `Today's total revenue is ${naira(r.rows[0].total)}.` };
  }
  if (/revenue|income|earned|made/.test(text) && !/today/.test(text)) {
    const r = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments`);
    const e = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`);
    return { answer: `Total revenue is ${naira(r.rows[0].total)} and total expenses are ${naira(e.rows[0].total)}, giving a net of ${naira(Number(r.rows[0].total) - Number(e.rows[0].total))}.` };
  }

  // Occupied rooms
  if (/how many.*(occupied|room).*occup|occupied.*rooms|rooms.*occupied/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM rooms WHERE status='OCCUPIED'`);
    return { answer: `${r.rows[0].c} rooms are currently occupied.` };
  }
  if (/available/.test(text) && /room/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM rooms WHERE status='AVAILABLE'`);
    return { answer: `${r.rows[0].c} rooms are currently available.` };
  }
  if (/reserved/.test(text) && /room/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM rooms WHERE status='RESERVED'`);
    return { answer: `${r.rows[0].c} rooms are currently reserved.` };
  }
  if (/cleaning/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM rooms WHERE status='CLEANING'`);
    return { answer: `${r.rows[0].c} rooms are under cleaning.` };
  }
  if (/check.?in/.test(text) && /today/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM check_ins WHERE checkin_time::date=$1`, [today()]);
    return { answer: `${r.rows[0].c} check-ins happened today.` };
  }
  if (/check.?out/.test(text) && /today/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM check_outs WHERE checkout_time::date=$1`, [today()]);
    return { answer: `${r.rows[0].c} check-outs happened today.` };
  }

  // Restaurant comparison
  if (/restaurant.*(most|best)|which.*restaurant.*(money|earn|sale)/.test(text)) {
    const r = await pool.query(
      `SELECT res.name, COALESCE(SUM(o.total),0) AS total FROM restaurants res
       LEFT JOIN orders o ON o.restaurant_id=res.id AND o.status='PAID'
       GROUP BY res.id, res.name ORDER BY total DESC LIMIT 1`);
    if (r.rows.length) return { answer: `${r.rows[0].name} made the most money with ${naira(r.rows[0].total)} in completed sales.` };
  }

  // Low stock
  if (/low.*stock|stock.*low/.test(text)) {
    const r = await pool.query(`SELECT name, quantity, min_quantity FROM inventory_items WHERE is_active AND quantity<=min_quantity ORDER BY (quantity-min_quantity)`);
    if (r.rows.length === 0) return { answer: 'No items are currently low in stock.' };
    const list = r.rows.slice(0, 5).map((i) => `${i.name} (${i.quantity}/${i.min_quantity})`).join(', ');
    return { answer: `${r.rows.length} items are low in stock: ${list}` + (r.rows.length > 5 ? '...' : '') + '.' };
  }

  // Outstanding
  if (/outstanding|balance|owe/.test(text)) {
    const r = await pool.query(`SELECT COALESCE(SUM(balance),0) AS t FROM invoices WHERE status IN ('UNPAID','PARTIAL')`);
    return { answer: `Total outstanding balance across guests is ${naira(r.rows[0].t)}.` };
  }

  // Guests
  if (/how many.*guest|guests.*total|number of guests/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM guests`);
    return { answer: `There are ${r.rows[0].c} guest profiles in the system.` };
  }
  if (/reservation.*(today|count|number)|how many.*reservation/.test(text)) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM reservations WHERE created_at::date=$1`, [today()]);
    return { answer: `${r.rows[0].c} reservations were created today.` };
  }

  return null;
}

export async function ask(req, res, next) {
  try {
    const { question } = req.body;
    if (!question) return requireResult(res, null, question);
    const result = await answerQuestion(question);
    return requireResult(res, result, question);
  } catch (e) {
    next(e);
  }
}

function requireResult(res, result, question) {
  if (result) return res.json({ success: true, data: result });
  return res.json({
    success: false,
    data: {
      answer:
        'I can help with questions about the hotel operations, e.g. "What was today\'s revenue?", "How many rooms are occupied?", "Which rooms are available?", "Which restaurant made the most money?", "What items are low in stock?", or "How much is outstanding?". I answer using actual database figures.',
      needsMore: true,
    },
  });
}

export const dashboardQuickStats = asyncHandler(async (_req, res) => {
  const revenue = await pool.query(`SELECT COALESCE(SUM(amount),0) AS t FROM payments`);
  const rooms = await pool.query(`SELECT status, COUNT(*) AS c FROM rooms GROUP BY status`);
  const occupied = rooms.rows.find((r) => r.status === 'OCCUPIED');
  const lowStock = await pool.query(`SELECT COUNT(*) AS c FROM inventory_items WHERE quantity<=min_quantity AND is_active`);
  res.json({
    success: true,
    data: {
      revenue: revenue.rows[0].t,
      occupiedRooms: occupied ? Number(occupied.c) : 0,
      lowStockItems: Number(lowStock.rows[0].c),
    },
  });
});
