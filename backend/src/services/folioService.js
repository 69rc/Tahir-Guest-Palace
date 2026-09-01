import pool from '../config/db.js';
import { genNumber } from '../utils/common.js';

// Recompute an invoice's subtotal / total / balance / status from its persisted
// line items and payments so numbers never drift out of sync.
// Accepts an optional client so it can run inside the caller's transaction.
export async function reconcileInvoice(ref, invoiceId) {
  const db = ref || pool;
  const lines = await db.query(
    `SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM invoice_items WHERE invoice_id=$1`,
    [invoiceId]
  );
  const payments = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id=$1`,
    [invoiceId]
  );
  const subtotal = Number(lines.rows[0].subtotal);
  const paid = Number(payments.rows[0].paid);
  const inv = await db.query(`SELECT discount, tax FROM invoices WHERE id=$1`, [invoiceId]);
  const discount = Number(inv.rows[0]?.discount || 0);
  const tax = Number(inv.rows[0]?.tax || 0);
  const total = Math.max(0, subtotal - discount + tax);
  const balance = Math.max(0, total - paid);
  const status =
    total <= 0.01 ? 'UNPAID'
    : balance <= 0.01 ? 'PAID'
    : paid > 0 ? 'PARTIAL'
    : 'UNPAID';
  await db.query(
    `UPDATE invoices SET subtotal=$2, total=$3, balance=$4, status=$5 WHERE id=$1`,
    [invoiceId, subtotal, total, balance, status]
  );
  return { subtotal, total, discount, tax, paid, balance, status };
}

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
  let spaTotal = 0, barbershopTotal = 0, amenityTotal = 0, eventTotal = 0;

  const items = [];
  for (const inv of rows) {
    const lines = await pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [inv.id]
    );
    for (const li of lines.rows) {
      const desc = (li.description || '').toUpperCase();
      let bucket = 'OTHER';
      // Restaurant / room-service items first (they contain meal keywords)
      if (desc.includes('JOLLOF') || desc.includes('CHICKEN') || desc.includes('DRINK') ||
          desc.includes('MEAL') || desc.includes('ORDER') || desc.includes('RESTAURANT') ||
          desc.includes('ROOM SERVICE') || desc.includes('FOOD') || desc.includes('PASTA')) {
        bucket = 'RESTAURANT';
      } else if (desc.includes('ROOM') || desc.includes('NIGHT') || desc.includes('STAY')) {
        bucket = 'ROOM';
      } else if (desc.includes('SPA')) {
        bucket = 'SPA';
      } else if (desc.includes('BARBER')) {
        bucket = 'BARBERSHOP';
      } else if (desc.includes('POOL') || desc.includes('CABANA') || desc.includes('FITNESS') || desc.includes('GYM')) {
        bucket = 'AMENITY';
      } else if (desc.includes('EVENT') || desc.includes('CONFERENCE')) {
        bucket = 'EVENT';
      }
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
  spaTotal = charges.SPA || 0;
  barbershopTotal = charges.BARBERSHOP || 0;
  amenityTotal = charges.AMENITY || 0;
  eventTotal = charges.EVENT || 0;

  const totalCharges = roomTotal + restaurantTotal + otherTotal + spaTotal + barbershopTotal + amenityTotal + eventTotal;
  const totalPaid = payments.rows.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharges - totalPaid;

  return {
    guest_id: guestId,
    items,
    roomTotal,
    restaurantTotal,
    otherTotal,
    spaTotal,
    barbershopTotal,
    amenityTotal,
    eventTotal,
    totalCharges,
    payments: payments.rows,
    totalPaid,
    balance,
  };
}

// Create/update an invoice item line and refresh invoice totals + balance
export async function addInvoiceLine(client, invoiceId, description, amount, quantity = 1) {
  const db = client || pool;
  await db.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,$2,$3,$4,$5)`,
    [invoiceId, description, quantity, Number(amount) / Number(quantity), Number(amount)]
  );
  await reconcileInvoice(db, invoiceId);
  const up = await db.query(`SELECT * FROM invoices WHERE id=$1`, [invoiceId]);
  return up.rows[0];
}

export async function applyGuestPayment(db, {
  guestId, reservationId, amount, method, note, receivedBy, category = 'ROOM',
}) {
  const client = db || pool;
  let remaining = Number(amount) || 0;
  if (remaining <= 0) return 0;

  const open = await client.query(
    `SELECT * FROM invoices
     WHERE guest_id=$1 AND status IN ('UNPAID','PARTIAL')
     ORDER BY CASE WHEN reservation_id IS NOT DISTINCT FROM $2 THEN 0 ELSE 1 END, created_at`,
    [guestId, reservationId || null]
  );
  let invoices = open.rows;
  if (invoices.length === 0) {
    const created = await client.query(
      `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, discount, tax, total, paid, balance, status)
       VALUES ($1,$2,$3,'HOTEL',0,0,0,0,0,0,'UNPAID') RETURNING *`,
      [genNumber('INV'), guestId, reservationId || null]
    );
    invoices = created.rows;
  }

  let applied = 0;
  for (const inv of invoices) {
    if (remaining <= 0.009) break;
    const due = Math.max(0, Number(inv.balance));
    const pay = due > 0.009 ? Math.min(remaining, due) : remaining;
    if (pay <= 0.009) continue;
    await client.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [genNumber('PAY'), guestId, reservationId || null, inv.id, pay, method || 'CASH', category, note || null, receivedBy || null]
    );
    await reconcileInvoice(client, inv.id);
    remaining -= pay;
    applied += pay;
  }

  if (remaining > 0.009) {
    const inv = invoices[0];
    await client.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [genNumber('PAY'), guestId, reservationId || null, inv.id, remaining, method || 'CASH', category, note || null, receivedBy || null]
    );
    await reconcileInvoice(client, inv.id);
    applied += remaining;
  }
  return applied;
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
