import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble, Wallet, LogIn, LogOut, AlertTriangle, CalendarCheck2,
  Receipt, Building2, UtensilsCrossed, ChevronRight, Clock,
  Flower2, Scissors, Waves, CalendarDays, DoorOpen,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, CardHeader, Stat, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime, STATUS_COLORS } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

const PIE_COLORS = ['#0e9f6e', '#1c64f2', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

export default function DashboardPage() {
  const { canAccess } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dashboard');
        setData(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader label="Loading dashboard…" />;
  if (!data) return <EmptyState title="Could not load dashboard" message="Refresh the page to try again." />;

  const { rooms, today, revenue, outletSales, events, upcomingEvents, lowStock, recentReservations, recentPayments, recentOrders, charts, housekeeping } = data;

  const revChart = (charts.revenueOverTime || []).map((r) => ({
    day: r.day,
    Hotel: Number(r.hotel) || 0,
    Restaurant: Number(r.restaurant) || 0,
  }));

  const occupancy = (charts.occupancyByDay || []).map((r) => ({ day: r.day, Stays: Number(r.count) }));
  const restaurantSales = (charts.restaurantSales || []).map((r) => ({ name: r.name, value: Number(r.total) }));
  const bookingTrend = (charts.bookingTrends || []).map((r) => ({ day: r.day, Bookings: Number(r.count) }));

  const occRate = rooms.total ? Math.round((rooms.OCCUPIED / rooms.total) * 100) : 0;
  const currentOcc = `Rooms • ${occRate}%`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">Overview of Tahir Guest Palace operations</p>
        </div>
        <div className="flex gap-2">
          {canAccess(PERM.CHECKIN_VIEW) && (
            <Link to="/checkin" className="btn-primary">
              <LogIn size={16} /> Check-in
            </Link>
          )}
          {canAccess(PERM.POS_USE) && (
            <Link to="/restaurants/pos" className="btn-secondary">
              <UtensilsCrossed size={16} /> POS
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Revenue"
          value={naira(revenue.total_revenue)}
          icon={Wallet}
          color="green"
          sub={`Hotel: ${naira(revenue.hotel_revenue)} · Restaurant: ${naira(revenue.restaurant_revenue)}`}
        />
        <Stat
          label="Rooms"
          value={`${rooms.OCCUPIED}/${rooms.total}`}
          icon={BedDouble}
          color="blue"
          sub={`${currentOcc} · ${rooms.AVAILABLE} available`}
        />
        <Stat
          label="Today's Check-ins"
          value={today.checkins}
          icon={LogIn}
          color="brand"
          sub={`${today.checkouts} check-outs · ${today.reservations_today} reservations`}
        />
        <Stat
          label="Outstanding"
          value={naira(revenue.outstanding)}
          icon={AlertTriangle}
          color={Number(revenue.outstanding) > 0 ? 'amber' : 'green'}
          sub="Unsettled guest folios"
        />
      </div>

      {/* Services & Events Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Spa Revenue"
          value={naira(revenue.spa_revenue)}
          icon={Flower2}
          color="purple"
          sub="Spa services"
        />
        <Stat
          label="Barbershop Revenue"
          value={naira(revenue.barbershop_revenue)}
          icon={Scissors}
          color="brand"
          sub="Grooming services"
        />
        <Stat
          label="Pool / Amenity Revenue"
          value={naira(revenue.pool_revenue)}
          icon={Waves}
          color="blue"
          sub="Pool & amenity charges"
        />
        <Stat
          label="Event Revenue"
          value={naira(events.event_revenue)}
          icon={CalendarDays}
          color="amber"
          sub={`${events.upcoming_events} upcoming · ${events.halls_in_use} halls in use`}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Revenue (14 days)" subtitle="Hotel vs Restaurant payments" />
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gHotel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c64f2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1c64f2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e9f6e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0e9f6e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => naira(v)} labelFormatter={(l) => fmtDate(l)} />
                <Legend />
                <Area type="monotone" dataKey="Hotel" stroke="#1c64f2" fill="url(#gHotel)" />
                <Area type="monotone" dataKey="Restaurant" stroke="#0e9f6e" fill="url(#gRest)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Restaurant Sales" subtitle="Completed orders by outlet" />
          <div className="p-4 h-64 flex items-center justify-center">
            {restaurantSales.length === 0 ? (
              <EmptyState title="No restaurant data" message="Sales will appear once orders are completed." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={restaurantSales} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {restaurantSales.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => naira(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Guest Occupancy (14 days)" subtitle="Check-ins per day" />
          <div className="p-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancy} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => fmtDate(l)} />
                <Bar dataKey="Stays" fill="#1c64f2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming Events"
            action={
              <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {!upcomingEvents || upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" message="Events will appear here once booked." />
            ) : (
              upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <DoorOpen size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{ev.customer_name}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {ev.hall_name} · {fmtDate(ev.event_date)} · {ev.start_time?.slice(0, 5)}
                    </p>
                  </div>
                  <Badge status={ev.status}>{ev.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Outlet Sales */}
      {outletSales && outletSales.length > 0 && (
        <Card>
          <CardHeader title="Food & Beverage by Outlet" subtitle="Total sales by restaurant/outlet" />
          <div className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {outletSales.map((o, i) => (
                <div key={o.id || i} className="p-3 rounded-lg bg-ink-50">
                  <p className="text-xs text-ink-500 truncate">{o.name}</p>
                  <p className="text-lg font-bold text-ink-900">{naira(o.total)}</p>
                  <span className="text-[10px] font-medium text-ink-400 uppercase">{o.outlet_type || 'RESTAURANT'}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {recentReservations.length === 0 ? (
              <EmptyState title="No reservations yet" />
            ) : (
              recentReservations.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <CalendarCheck2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{r.guest_name}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {r.reservation_no} · Room {r.room_number || '—'} · {fmtDate(r.check_in_date)}
                    </p>
                  </div>
                  <Badge status={r.status}>{r.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Payments"
            action={
              <Link to="/finance/payments" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {recentPayments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                    <Wallet size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{naira(p.amount)}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {p.guest_name || 'Walk-in'} · {p.method} · {fmtDateTime(p.created_at)}
                    </p>
                  </div>
                  <Badge status={p.category}>{p.category}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Active Orders"
            action={
              <Link to="/restaurants/orders" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              recentOrders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Receipt size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{naira(o.total)}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {o.restaurant_name} · Table {o.table_number || '—'} · {fmtDateTime(o.created_at)}
                    </p>
                  </div>
                  <Badge status={o.status}>{o.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
