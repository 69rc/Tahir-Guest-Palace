import pool from '../config/db.js';
import { genNumber } from '../utils/common.js';

// Build a guest's unified folio: room charges, restaurant, other services, payments.
export async function getGuestFolio(guestId) {
  const invoices = await pool.query(
    `SELECT * FROM invoices WHERE guest_id = $1 ORDER BY created_at`,
    [guestId]
  );
  const payments = await pool.query(
    `SELECT * FROM payments WHERE guest_id = $1 AND category <> 'DEPOSIT' ORDER BY created_at`,
    [guestId]
  );

  const rows = invoices.rows;
  let roomTotal = 0, restaurantTotal = 0, otherTotal = 0;

  const items = [];
  for (const inv of rows) {
    const lines = await pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [inv.id]
    );
    for (const li of lines.rows) {
      const desc = (li.description || '').toUpperCase();
      let bucket = 'OTHER';
      if (desc.includes('ROOM') || desc.includes('NIGHT') || desc.includes('STAY')) bucket = 'ROOM';
      else if (desc.includes('RESTAURANT') || desc.includes('JOLLOF') || desc.includes('CHICKEN') ||
               desc.includes('DRINK') || desc.includes('MEAL') || desc.includes('ORDER')) bucket = 'RESTAURANT';
      items.push({
        type: bucket,
        description: li.description,
        amount: Number(li.line_total),
        invoice_no: inv.invoice_no,
        date: inv.created_at,
      });
    }
  }

  const charges = items.reduce(
    (acc, it) => {
      acc[it.type] = (acc[it.type] || 0) + it.amount;
      return acc;
    },
    {}
  );
  roomTotal = charges.ROOM || 0;
  restaurantTotal = charges.RESTAURANT || 0;
  otherTotal = charges.OTHER || 0;

  const totalCharges = roomTotal + restaurantTotal + otherTotal;
  const totalPaid = payments.rows.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharges - totalPaid;

  return {
    guest_id: guestId,
    items,
    roomTotal,
    restaurantTotal,
    otherTotal,
    totalCharges,
    payments: payments.rows,
    totalPaid,
    balance,
  };
}

// Create/update an invoice item line and refresh invoice totals + balance
export async function addInvoiceLine(invoiceId, description, amount) {
  const up = await pool.query(
    `UPDATE invoices SET subtotal = subtotal + $2, total = total + $2
     WHERE id = $1 RETURNING *`,
    [invoiceId, amount]
  );
  const inv = up.rows[0];
  if (inv) {
    await pool.query(
      `UPDATE invoices SET balance = total - paid
       WHERE id = $1`,
      [invoiceId]
    );
    await pool.query(
      `UPDATE invoices SET status = CASE
         WHEN total <= 0 THEN 'UNPAID'
         WHEN paid >= total THEN 'PAID'
         WHEN paid > 0 THEN 'PARTIAL'
         ELSE 'UNPAID' END
       WHERE id = $1`,
      [invoiceId]
    );
  }
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,$2,1,$3,$3)`,
    [invoiceId, description, amount]
  );
  return up.rows[0];
}

// Find or create an open folio invoice for a guest/reservation
export async function getOrCreateFolioInvoice({ guestId, reservationId }) {
  const existing = await pool.query(
    `SELECT * FROM invoices WHERE guest_id = $1 AND status IN ('UNPAID','PARTIAL')
     ORDER BY created_at DESC LIMIT 1`,
    [guestId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const { rows } = await pool.query(
    `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, discount, tax, total, paid, balance, status)
     VALUES ($1,$2,$3,'HOTEL',0,0,0,0,0,0,'UNPAID') RETURNING *`,
    [genNumber('INV'), guestId, reservationId || null]
  );
  return rows[0];
}
