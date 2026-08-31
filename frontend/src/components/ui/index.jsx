import { X, Search, Inbox, Loader2 } from 'lucide-react';
import { STATUS_COLORS } from '../../utils/format.js';

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

export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-pop w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} mt-8 mb-8 animate-[popIn_.15s_ease-out]`}
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

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

export function Stat({ label, value, icon: Icon, color = 'brand', sub }) {
  const colors = {
    brand: 'text-brand-600 bg-brand-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    violet: 'text-violet-600 bg-violet-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon size={22} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500 truncate">{label}</p>
          <p className="text-xl font-bold text-ink-900 leading-tight truncate">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
    </Card>
  );
}
