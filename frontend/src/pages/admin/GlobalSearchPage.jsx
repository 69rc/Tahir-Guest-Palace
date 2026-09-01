import { useEffect, useRef, useState } from 'react';
import { Search, Users, CalendarCheck2, BedDouble, FileText, Receipt, Wallet, CalendarDays, Wrench, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, EmptyState } from '../../components/ui/index.jsx';
import { Badge } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';

const SECTIONS = [
  { key: 'guests', label: 'Guests', icon: Users, perm: true, link: (g) => `/guests`, rowsName: 'full_name' },
  { key: 'reservations', label: 'Reservations', icon: CalendarCheck2, link: (r) => `/reservations` },
  { key: 'rooms', label: 'Rooms', icon: BedDouble, link: (r) => `/rooms` },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'orders', label: 'Orders', icon: Receipt },
  { key: 'payments', label: 'Payments', icon: Wallet },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'tickets', label: 'Maintenance', icon: Wrench },
  { key: 'staff', label: 'Staff', icon: UserCog },
];

export default function GlobalSearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const toast = useToast();
  const debounce = useRef();

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!q || q.trim().length < 2) { setResults(null); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q]);

  const isEmpty = results && SECTIONS.every((s) => (results[s.key] || []).length === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Global Search</h1>
        <p className="text-sm text-ink-500 mt-0.5">Search across guests, reservations, rooms, invoices, orders, payments, events, maintenance and staff</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least 2 characters to search…"
            className="input pl-10 py-3 text-base"
          />
        </div>
        {searching && <p className="text-xs text-ink-400 mt-2">Searching…</p>}
      </Card>

      {!results && (
        <EmptyState icon={Search} title="Search the hotel" message="Find any record across the system by typing a name or reference number above." />
      )}

      {results && isEmpty && (
        <EmptyState icon={Search} title="No results" message={`Nothing matched “${q}”. Try a different term.`} />
      )}

      {results && !isEmpty && (
        <div className="space-y-5">
          {SECTIONS.map((s) => {
            const items = results[s.key] || [];
            if (items.length === 0) return null;
            return (
              <Card key={s.key}>
                <CardHeader title={`${s.label} (${items.length})`} />
                <div className="divide-y divide-ink-100">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        {s.key === 'guests' && <p className="text-sm font-semibold text-ink-800">{item.full_name}</p>}
                        {s.key === 'guests' && <p className="text-xs text-ink-500">{item.phone || ''} · {item.email || ''}</p>}
                        {s.key === 'reservations' && <p className="text-sm font-semibold text-ink-800">{item.reservation_no} · {item.full_name}</p>}
                        {s.key === 'reservations' && <p className="text-xs text-ink-500">Room {item.room_number || '—'} · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'rooms' && <p className="text-sm font-semibold text-ink-800">Room {item.room_number}</p>}
                        {s.key === 'rooms' && <p className="text-xs text-ink-500">Floor {item.floor || '—'} · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'invoices' && <p className="text-sm font-semibold text-ink-800">{item.invoice_no} · {item.full_name || 'Walk-in'}</p>}
                        {s.key === 'invoices' && <p className="text-xs text-ink-500">{naira(item.total)} · balance {naira(item.balance)} · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'orders' && <p className="text-sm font-semibold text-ink-800">{item.order_no} · {item.full_name || 'Walk-in'}</p>}
                        {s.key === 'orders' && <p className="text-xs text-ink-500">{item.restaurant_name || ''} · {naira(item.total)} · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'payments' && <p className="text-sm font-semibold text-ink-800">{item.payment_no} · {item.full_name || 'Walk-in'}</p>}
                        {s.key === 'payments' && <p className="text-xs text-ink-500">{item.method} · {naira(item.amount)} · {fmtDate(item.created_at)}</p>}
                        {s.key === 'events' && <p className="text-sm font-semibold text-ink-800">{item.customer_name}</p>}
                        {s.key === 'events' && <p className="text-xs text-ink-500">{item.booking_no} · {fmtDate(item.event_date)} · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'tickets' && <p className="text-sm font-semibold text-ink-800">{item.ticket_no}</p>}
                        {s.key === 'tickets' && <p className="text-xs text-ink-500">{item.location} · <Badge status={item.priority}>{item.priority}</Badge> · <Badge status={item.status}>{item.status}</Badge></p>}
                        {s.key === 'staff' && <p className="text-sm font-semibold text-ink-800">{item.full_name}</p>}
                        {s.key === 'staff' && <p className="text-xs text-ink-500">@{item.username}</p>}
                      </div>
                      {s.link && <Link to={s.link()} className="btn-secondary !px-2.5 !py-1.5 !text-xs">View</Link>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
