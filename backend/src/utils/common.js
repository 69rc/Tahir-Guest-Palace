import pool from '../config/db.js';

export function genNumber(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${day}-${rand}`;
}

export function naira(n) {
  const num = Number(n) || 0;
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(d, opts = {}) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
}

export async function audit(userId, action, entityType, entityId, details, ip, oldValue, newValue) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId || null, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null, ip || null,
       oldValue != null ? JSON.stringify(oldValue) : null, newValue != null ? JSON.stringify(newValue) : null]
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateOnly(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
