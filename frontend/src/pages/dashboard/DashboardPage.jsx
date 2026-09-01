import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble, Wallet, LogIn, AlertTriangle, CalendarCheck2,
  Receipt, UtensilsCrossed, ChevronRight, Flower2, Scissors, Waves,
  CalendarDays, DoorOpen,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, CardHeader, Stat, PageLoader, EmptyState, Modal } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

const PIE_COLORS = ['#0e9f6e', '#1c64f2', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

export default function DashboardPage() {
  const { canAccess } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null);
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

  const { rooms, today, revenue, outletSales, events, upcomingEvents, recentReservations, recentPayments, recentOrders, charts } = data;

  const revChart = (charts.revenueOverTime || []).map((r) => ({
    day: r.day,
    Hotel: Number(r.hotel) || 0,
    Restaurant: Number(r.restaurant) || 0,
    Services: Number(r.services) || 0,
    Events: Number(r.events) || 0,
  }));

  const occupancy = (charts.occupancyByDay || []).map((r) => ({ day: r.day, Stays: Number(r.count) }));
  const restaurantSales = (charts.restaurantSales || []).map((r) => ({ name: r.name, value: Number(r.total) }));

  const occRate = rooms.total ? Math.round((rooms.OCCUPIED / rooms.total) * 100) : 0;
  const drillTitle = {
    revenue: 'Revenue breakdown',
    rooms: 'Room occupancy',
    arrivals: "Today's arrivals & departures",
    outstanding: 'Outstanding balances',
  };

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Revenue"
          value={naira(revenue.total_revenue)}
          icon={Wallet}
          color="green"
          sub={`Hotel: ${naira(revenue.hotel_revenue)} · Restaurant: ${naira(revenue.restaurant_revenue)}`}
          onClick={() => setDrill('revenue')}
          active={drill === 'revenue'}
        />
        <Stat
          label="Rooms"
          value={`${rooms.OCCUPIED}/${rooms.total}`}
          icon={BedDouble}
          color="blue"
          sub={`${occRate}% occupied · ${rooms.AVAILABLE} available`}
          onClick={() => setDrill('rooms')}
          active={drill === 'rooms'}
        />
        <Stat
          label="Today's Check-ins"
          value={today.checkins}
          icon={LogIn}
          color="brand"
          sub={`${today.checkouts} check-outs · ${today.reservations_today} reservations`}
          onClick={() => setDrill('arrivals')}
          active={drill === 'arrivals'}
        />
        <Stat
          label="Outstanding"
          value={naira(revenue.outstanding)}
          icon={AlertTriangle}
          color={Number(revenue.outstanding) > 0 ? 'amber' : 'green'}
          sub="Unsettled guest folios"
          onClick={() => setDrill('outstanding')}
          active={drill === 'outstanding'}
        />
      </div>

      <Modal open={!!drill} onClose={() => setDrill(null)} title={drillTitle[drill] || 'Details'} size="xl">
        {drill === 'revenue' && (
          <RevenueDrill revenue={revenue} events={events} outletSales={outletSales} revChart={revChart} restaurantSales={restaurantSales} canAccess={canAccess} />
        )}
        {drill === 'rooms' && (
          <RoomsDrill rooms={rooms} occRate={occRate} occupancy={occupancy} canAccess={canAccess} />
        )}
        {drill === 'arrivals' && (
          <ArrivalsDrill today={today} recentReservations={recentReservations} canAccess={canAccess} />
        )}
        {drill === 'outstanding' && (
          <OutstandingDrill revenue={revenue} recentPayments={recentPayments} canAccess={canAccess} />
        )}
      </Modal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Spa Revenue" value={naira(revenue.spa_revenue)} icon={Flower2} color="purple" sub="Spa services" />
        <Stat label="Barbershop Revenue" value={naira(revenue.barbershop_revenue)} icon={Scissors} color="brand" sub="Grooming services" />
        <Stat label="Pool / Amenity Revenue" value={naira(revenue.pool_revenue)} icon={Waves} color="blue" sub="Pool & amenity charges" />
        <Stat label="Event Revenue" value={naira(events.event_revenue)} icon={CalendarDays} color="amber" sub={`${events.upcoming_events} upcoming · ${events.halls_in_use} halls in use`} />
      </div>

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
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

function Breakdown({ label, value, icon: Icon, color }) {
  return (
    <div className="p-3 rounded-lg bg-ink-50">
      <div className="flex items-center gap-2 text-ink-500">
        {Icon && <Icon size={14} className={color} />}
        <p className="text-xs truncate">{label}</p>
      </div>
      <p className="text-lg font-bold text-ink-900 mt-1">{naira(value)}</p>
    </div>
  );
}

function RevenueDrill({ revenue, events, outletSales, revChart, restaurantSales, canAccess }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Breakdown label="Hotel / rooms" value={revenue.hotel_revenue} icon={BedDouble} color="text-blue-600" />
        <Breakdown label="Restaurant" value={revenue.restaurant_revenue} icon={UtensilsCrossed} color="text-green-600" />
        <Breakdown label="Spa" value={revenue.spa_revenue} icon={Flower2} color="text-violet-600" />
        <Breakdown label="Barbershop" value={revenue.barbershop_revenue} icon={Scissors} color="text-brand-600" />
        <Breakdown label="Pool / amenities" value={revenue.pool_revenue} icon={Waves} color="text-blue-600" />
        <Breakdown label="Events" value={events.event_revenue} icon={CalendarDays} color="text-amber-600" />
        <Breakdown label="Today" value={revenue.today_revenue} icon={Wallet} color="text-green-600" />
        <Breakdown label="Total" value={revenue.total_revenue} icon={Wallet} color="text-ink-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-ink-500 mb-2">Last 14 days</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => naira(v)} labelFormatter={(l) => fmtDate(l)} />
                <Legend />
                <Area type="monotone" dataKey="Hotel" stroke="#1c64f2" fill="#1c64f2" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Restaurant" stroke="#0e9f6e" fill="#0e9f6e" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Services" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-500 mb-2">Restaurant sales by outlet</p>
          <div className="h-56 flex items-center justify-center">
            {restaurantSales.length === 0 ? (
              <EmptyState title="No restaurant data" message="Sales will appear once orders are completed." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={restaurantSales} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
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
        </div>
      </div>

      {outletSales && outletSales.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {outletSales.map((o, i) => (
            <div key={o.id || i} className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-500 truncate">{o.name}</p>
              <p className="text-lg font-bold text-ink-900">{naira(o.total)}</p>
            </div>
          ))}
        </div>
      )}

      {canAccess(PERM.REVENUE_VIEW) && (
        <Link to="/finance/revenue" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          Open full revenue report <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function RoomsDrill({ rooms, occRate, occupancy, canAccess }) {
  const statuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg bg-blue-50">
          <p className="text-xs text-ink-500">Occupancy</p>
          <p className="text-lg font-bold text-ink-900">{occRate}%</p>
        </div>
        {statuses.map((s) => (
          <div key={s} className="p-3 rounded-lg bg-ink-50">
            <p className="text-xs text-ink-500 capitalize">{s.toLowerCase()}</p>
            <p className="text-lg font-bold text-ink-900">{rooms[s] || 0}</p>
          </div>
        ))}
      </div>
      <div className="h-52">
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
      {canAccess(PERM.ROOMS_VIEW) && (
        <Link to="/rooms" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          Go to rooms <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function ArrivalsDrill({ today, recentReservations, canAccess }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-brand-50">
          <p className="text-xs text-ink-500">Checked in today</p>
          <p className="text-2xl font-bold text-ink-900">{today.checkins}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-50">
          <p className="text-xs text-ink-500">Checked out today</p>
          <p className="text-2xl font-bold text-ink-900">{today.checkouts}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-50">
          <p className="text-xs text-ink-500">Reservations today</p>
          <p className="text-2xl font-bold text-ink-900">{today.reservations_today}</p>
        </div>
      </div>
      <div className="divide-y divide-ink-100 border border-ink-100 rounded-lg">
        {recentReservations.slice(0, 5).map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-800">{r.guest_name}</p>
              <p className="text-xs text-ink-500">Room {r.room_number || '—'} · {fmtDate(r.check_in_date)}</p>
            </div>
            <Badge status={r.status}>{r.status}</Badge>
          </div>
        ))}
      </div>
      {canAccess(PERM.CHECKIN_VIEW) && (
        <Link to="/checkin" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          Open check-in desk <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function OutstandingDrill({ revenue, recentPayments, canAccess }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-amber-50">
          <p className="text-xs text-ink-500">Unsettled folios</p>
          <p className="text-lg font-bold text-ink-900">{naira(revenue.outstanding)}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-50">
          <p className="text-xs text-ink-500">Today's expenses</p>
          <p className="text-lg font-bold text-ink-900">{naira(revenue.today_expenses)}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-50">
          <p className="text-xs text-ink-500">All expenses</p>
          <p className="text-lg font-bold text-ink-900">{naira(revenue.total_expenses)}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-ink-500 mb-2">Latest payments</p>
        <div className="divide-y divide-ink-100 border border-ink-100 rounded-lg">
          {recentPayments.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold">{naira(p.amount)}</p>
                <p className="text-xs text-ink-500">{p.guest_name || 'Walk-in'} · {p.method}</p>
              </div>
              <Badge status={p.category}>{p.category}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {canAccess(PERM.INVOICES_VIEW) && (
          <Link to="/finance/invoices" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            View invoices <ChevronRight size={16} />
          </Link>
        )}
        {canAccess(PERM.PAYMENTS_VIEW) && (
          <Link to="/finance/payments" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            View payments <ChevronRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}
