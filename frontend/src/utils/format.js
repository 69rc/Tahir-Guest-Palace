export function naira(n, decimals = false) {
  const num = Number(n) || 0;
  return (
    '₦' +
    num.toLocaleString('en-NG', {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

export function fmtDate(d, opts = {}) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const STATUS_COLORS = {
  AVAILABLE: 'green',
  OCCUPIED: 'blue',
  RESERVED: 'amber',
  CLEANING: 'violet',
  MAINTENANCE: 'red',
  PENDING: 'gray',
  CONFIRMED: 'amber',
  CHECKED_IN: 'blue',
  CHECKED_OUT: 'gray',
  CANCELLED: 'red',
  NO_SHOW: 'red',
  OPEN: 'blue',
  PAID: 'green',
  PARTIAL: 'amber',
  UNPAID: 'red',
  CLEAN: 'green',
  DIRTY: 'gray',
  INSPECTED: 'green',
  COMPLETED: 'green',
  CASH: 'green',
  POS: 'blue',
  TRANSFER: 'violet',
  CARD: 'amber',

  ASSIGNED: 'blue',
  IN_PROGRESS: 'amber',
  WAITING_PARTS: 'violet',
  RESOLVED: 'green',
  CLOSED: 'gray',
  CRITICAL: 'red',
  LOW: 'gray',
  MEDIUM: 'amber',
  HIGH: 'amber',
  URGENT: 'red',

  APPROVED: 'green',
  REJECTED: 'red',
  CONVERTED: 'blue',
  RECEIVED: 'green',
  SENT: 'blue',
  DELIVERED: 'green',

  ACTIVE: 'green',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
  BOOKED: 'amber',
};

export function isFlagOn(v) {
  return v === true || v === 't' || v === 'true' || v === 1 || v === '1';
}

export const PAY_LABELS = { CASH: 'Cash', POS: 'POS', TRANSFER: 'Transfer', CARD: 'Card' };
export function payLabel(m) {
  return PAY_LABELS[m] || m || '—';
}
