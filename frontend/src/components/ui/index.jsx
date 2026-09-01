import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Inbox, Loader2 } from 'lucide-react';
import { STATUS_COLORS, initials, naira } from '../../utils/format.js';
import { stayTotals } from '../../utils/stay.js';

const colorMap = {
  green: 'bg-green-100 text-green-700 ring-green-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  violet: 'bg-violet-100 text-violet-700 ring-violet-200',
  red: 'bg-red-100 text-red-700 ring-red-200',
  gray: 'bg-ink-100 text-ink-600 ring-ink-200',
};

export function Badge({ status, children }) {
  const color = STATUS_COLORS[status] || 'gray';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${colorMap[color]}`}>
      {children || status}
    </span>
  );
}

export function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border ${
        active ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-100 hover:bg-ink-50'
      }`}
    >
      {label}
      {count != null && (
        <span className={active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
      )}
    </button>
  );
}

export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-ink-100">
      <div>
        <h3 className="text-sm font-bold text-ink-800">{title}</h3>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide, size }) {
  if (!open) return null;
  const width = size === 'xl' ? 'max-w-5xl' : size === 'lg' || wide ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-pop w-full ${width} mt-8 mb-8 animate-[popIn_.15s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-bold text-ink-800">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', loading, disabled, className = '', ...rest }) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizes = {
    sm: '!text-xs !px-2.5 !py-1.5',
    md: '',
    lg: '!px-5 !py-2.5',
  };
  return (
    <button
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-500">
      <Loader2 className="animate-spin" size={32} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center text-ink-400 mb-4">
        <Icon size={26} />
      </div>
      <h3 className="text-sm font-bold text-ink-800">{title}</h3>
      {message && <p className="text-sm text-ink-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ columns, rows, keyField = 'id', empty, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title={empty?.title || 'No records'}
        message={empty?.message}
        icon={empty?.icon}
        action={empty?.action}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr className="bg-ink-50">
            {columns.map((c) => (
              <th key={c.key} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? 'cursor-pointer hover:bg-ink-50' : ''} transition-colors`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`td ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '', onFocus }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="input pl-9"
        autoComplete="off"
      />
    </div>
  );
}

export function GuestPicker({ guests = [], value, onSelect, placeholder = 'Type a name or phone to find a guest…', showAllOnEmpty = false }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = guests.find((g) => String(g.id) === String(value));

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = !s
      ? (showAllOnEmpty ? guests : [])
      : guests.filter((g) => [g.full_name, g.phone, g.email, g.room_number].some((v) => (v || '').toLowerCase().includes(s)));
    return pool.slice(0, 12);
  }, [guests, q, showAllOnEmpty]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {initials(selected.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">{selected.full_name}</p>
            <p className="text-xs text-ink-500 truncate">{selected.phone || selected.email || 'Existing guest'}</p>
          </div>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-brand-700 hover:underline shrink-0"
          onClick={() => onSelect(null)}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <SearchInput
        value={q}
        onChange={(v) => { setQ(v); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (q.trim().length >= 1 || showAllOnEmpty) && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-ink-200 rounded-xl shadow-pop max-h-60 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-500">{q.trim() ? 'No match. Keep typing.' : 'No guests in house.'}</p>
          ) : (
            matches.map((g) => (
              <button
                type="button"
                key={g.id}
                className="w-full text-left px-3 py-2.5 hover:bg-ink-50 flex items-center gap-3"
                onClick={() => {
                  onSelect(g);
                  setQ('');
                  setOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {initials(g.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{g.full_name}</p>
                  <p className="text-xs text-ink-500 truncate">{[g.phone, g.email].filter(Boolean).join(' · ') || 'No contact'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const FOLIO_LABELS = {
  ROOM: 'Room',
  RESTAURANT: 'Restaurant',
  SPA: 'Spa',
  BARBERSHOP: 'Barbershop',
  AMENITY: 'Other services',
  EVENT: 'Events',
  OTHER: 'Other',
};

export function FolioBill({ folio, title = 'Guest bill' }) {
  const items = folio?.items || [];
  const grouped = items.reduce((acc, it) => {
    const key = it.type || 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});
  const order = ['ROOM', 'RESTAURANT', 'SPA', 'BARBERSHOP', 'AMENITY', 'EVENT', 'OTHER'];
  const balance = Number(folio?.balance || 0);

  return (
    <div className="rounded-xl border border-ink-100 p-4 space-y-3 text-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-ink-500">No charges on this stay yet.</p>
      ) : (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {order.filter((k) => grouped[k]?.length).map((k) => (
            <div key={k}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1">{FOLIO_LABELS[k] || k}</p>
              {grouped[k].map((it, i) => (
                <div key={`${k}-${i}`} className="flex justify-between gap-3 py-0.5">
                  <span className="text-ink-600 truncate">{it.description}</span>
                  <span className="font-medium text-ink-900 shrink-0">{naira(it.amount)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5 border-t border-ink-100 pt-2">
        <div className="flex justify-between text-ink-600">
          <span>Total charges</span>
          <span className="font-semibold text-ink-900">{naira(folio?.totalCharges)}</span>
        </div>
        <div className="flex justify-between text-green-700">
          <span>Paid so far</span>
          <span className="font-semibold">{naira(folio?.totalPaid)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Balance due</span>
          <span className={balance > 0 ? 'text-amber-600' : 'text-green-600'}>
            {balance > 0 ? naira(balance) : 'Settled'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function StayBill({
  nights,
  rate,
  discount,
  paid,
  paymentMethod,
  onRate,
  onDiscount,
  onPaid,
  onMethod,
  paidLabel = 'Amount paid now',
}) {
  const t = stayTotals({ nights, rate, discount, paid });
  const noDates = !nights;
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/70 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Stay bill</p>
      {noDates ? (
        <p className="text-sm text-ink-500">Pick check-out after check-in to see nights and total.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between col-span-2 sm:col-span-1">
              <span className="text-ink-500">Nights</span>
              <span className="font-semibold text-ink-900">{t.nights}</span>
            </div>
            <div>
              <label className="label">Rate / night (₦)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={rate}
                onChange={(e) => onRate?.(e.target.value)}
                placeholder="Room rate"
              />
            </div>
            <div>
              <label className="label">Discount (₦)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={discount}
                onChange={(e) => onDiscount?.(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{paidLabel} (₦)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={paid}
                onChange={(e) => onPaid?.(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Payment method</label>
              <select className="input" value={paymentMethod} onChange={(e) => onMethod?.(e.target.value)}>
                {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-lg bg-white border border-ink-100 px-3 py-2 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>{t.nights} night{t.nights === 1 ? '' : 's'} × {naira(t.rate)}</span>
              <span>{naira(t.subtotal)}</span>
            </div>
            {t.discount > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Discount</span>
                <span>−{naira(t.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-ink-900 border-t border-ink-100 pt-1.5">
              <span>Total for stay</span>
              <span>{naira(t.total)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Paid now</span>
              <span>{naira(t.paid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Balance</span>
              <span className={t.balance > 0 ? 'text-amber-600' : 'text-green-600'}>
                {t.balance > 0 ? naira(t.balance) : 'Settled'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, color = 'brand', sub, onClick, active }) {
  const colors = {
    brand: 'text-brand-600 bg-brand-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    violet: 'text-violet-600 bg-violet-50',
    purple: 'text-violet-600 bg-violet-50',
    red: 'text-red-600 bg-red-50',
  };
  const inner = (
    <>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colors[color] || colors.brand}`}>
            <Icon size={22} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500 truncate">{label}</p>
          <p className="text-xl font-bold text-ink-900 leading-tight truncate">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
      {onClick && (
        <p className="mt-2 text-[11px] font-semibold text-brand-600">View details</p>
      )}
    </>
  );
  const cls = `p-5 w-full text-left ${onClick ? 'cursor-pointer hover:border-ink-300 transition-shadow hover:shadow-card' : ''} ${active ? 'ring-2 ring-brand-400 border-brand-300' : ''}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`card ${cls}`}>
        {inner}
      </button>
    );
  }
  return <Card className={cls}>{inner}</Card>;
}
