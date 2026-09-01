export function isoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toYmd(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nightsBetween(checkIn, checkOut) {
  const a = toYmd(checkIn);
  const b = toYmd(checkOut);
  if (!a || !b) return 0;
  const start = new Date(`${a}T12:00:00`);
  const end = new Date(`${b}T12:00:00`);
  const n = Math.round((end - start) / 86400000);
  return Math.max(0, n);
}

export function stayTotals({ nights, rate, discount = 0, paid = 0 }) {
  const n = Number(nights) || 0;
  const r = Number(rate) || 0;
  const d = Number(discount) || 0;
  const p = Number(paid) || 0;
  const subtotal = n * r;
  const total = Math.max(0, subtotal - d);
  const balance = Math.max(0, total - p);
  return { nights: n, rate: r, subtotal, discount: d, total, paid: p, balance };
}

export function dueKind(checkOutDate, today = isoDate(0)) {
  const out = toYmd(checkOutDate);
  if (!out) return null;
  if (out < today) return 'overdue';
  if (out === today) return 'due';
  return null;
}

export function arrivalKind(checkInDate, today = isoDate(0)) {
  const inn = toYmd(checkInDate);
  if (!inn) return null;
  if (inn < today) return 'late';
  if (inn === today) return 'today';
  return null;
}

export function partyLabel(adults, children) {
  const a = Number(adults) || 0;
  const c = Number(children) || 0;
  const adultPart = `${a} adult${a === 1 ? '' : 's'}`;
  if (c <= 0) return adultPart;
  return `${adultPart} · ${c} child${c === 1 ? '' : 'ren'}`;
}
