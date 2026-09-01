import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, DoorOpen, ChefHat, Receipt } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Badge, Card, EmptyState, FilterChip } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function EventsPage() {
  const [bookings, setBookings] = useState([]);
  const [halls, setHalls] = useState([]);
  const [evServices, setEvServices] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', organization: '', phone: '', email: '', hall_id: '',
    event_type: 'Conference', event_date: '', start_time: '09:00', end_time: '17:00',
    attendees: 0, rate: 0, discount: 0, deposit: 0, restaurant_id: '', services: [], notes: '',
  });
  const [svcSelection, setSvcSelection] = useState([]);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'TRANSFER', note: '' });
  const [filter, setFilter] = useState('open');
  const toast = useToast();
  const { canAccess } = useAuth();

  const canManage = canAccess('events:manage');
  const canPay = canAccess('events:manage'); // payment needs EVENTS_MANAGE or PAYMENTS_RECORD; frontend shows if either

  const load = async () => {
    setLoading(true);
    try {
      const [b, h, s, r] = await Promise.all([
        api.get('/events/events'),
        api.get('/events/halls'),
        api.get('/events/services'),
        api.get('/restaurants'),
      ]);
      setBookings(b.data);
      setHalls(h.data);
      setEvServices(s.data);
      setRestaurants(r.data?.length ? r.data : (r.data?.data || []));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openBook = () => { setSvcSelection([]); setBookOpen(true); };

  const toggleSvc = (id) => {
    setSvcSelection((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((x) => String(x.service_id) === String(id));
      if (idx >= 0) copy.splice(idx, 1);
      else {
        const svc = evServices.find((x) => String(x.id) === String(id));
        copy.push({ service_id: id, quantity: 1, unit_price: svc ? svc.price : 0 });
      }
      return copy;
    });
  };

  const setSvcQty = (id, qty) => {
    setSvcSelection((prev) => prev.map((x) => (String(x.service_id) === String(id) ? { ...x, quantity: qty } : x)));
  };

  const createBooking = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/events/events', { ...form, services: svcSelection });
      toast.success('Event booking created');
      setBookOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const openPay = (b) => { setPayTarget(b); setPayForm({ amount: Number(b.balance) || 0, method: 'TRANSFER', note: '' }); setPayOpen(true); };

  const recordPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/events/events/${payTarget.id}/payment`, payForm);
      toast.success('Payment recorded');
      setPayOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const eventLabel = (s) => {
    if (s === 'COMPLETED') return 'Done';
    if (s === 'CANCELLED') return 'Cancelled';
    if (s === 'CONFIRMED') return 'Booked';
    return s || 'Open';
  };

  const kind = (s) => {
    if (s === 'CANCELLED') return 'other';
    if (s === 'COMPLETED') return 'done';
    return 'open';
  };

  const counts = {
    open: bookings.filter((b) => kind(b.status) === 'open').length,
    done: bookings.filter((b) => kind(b.status) === 'done').length,
    other: bookings.filter((b) => kind(b.status) === 'other').length,
    all: bookings.length,
  };
  const visible = bookings.filter((b) => filter === 'all' || kind(b.status) === filter);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Conference</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Events</h1>
          <p className="text-sm text-ink-500 mt-1">Hall hire and event bookings — separate from restaurant sales.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/events/halls" className="btn-secondary"><DoorOpen size={16} /> Halls</Link>
          <Link to="/events/services" className="btn-secondary"><ChefHat size={16} /> Add-ons</Link>
          {canManage && <Button onClick={openBook}><Plus size={16} /> New booking</Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'open'} onClick={() => setFilter('open')} label="Upcoming" count={counts.open} />
        <FilterChip active={filter === 'done'} onClick={() => setFilter('done')} label="Done" count={counts.done} />
        <FilterChip active={filter === 'other'} onClick={() => setFilter('other')} label="Cancelled" count={counts.other} />
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={counts.all} />
      </div>

      {visible.length === 0 ? (
        <Card><EmptyState title="No events here" message="Book a hall for a conference or celebration." /></Card>
      ) : (
        <Card>
          <div className="divide-y divide-ink-100">
            {visible.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{r.customer_name}</p>
                  <p className="text-xs text-ink-500">
                    {r.hall_name || 'Hall'} · {r.event_type} · {fmtDate(r.event_date)}
                    {r.organization ? ` · ${r.organization}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ink-900">{naira(r.rate)}</p>
                  {Number(r.balance) > 0 && <p className="text-xs text-amber-600">Due {naira(r.balance)}</p>}
                </div>
                <Badge status={r.status}>{eventLabel(r.status)}</Badge>
                {canPay && Number(r.balance) > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => openPay(r)}><Receipt size={14} /> Pay</Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="New Event Booking" wide>
        <form onSubmit={createBooking} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Organization</label>
              <input className="input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Conference Hall *</label>
              <select className="input" required value={form.hall_id} onChange={(e) => setForm({ ...form, hall_id: e.target.value, rate: halls.find((x) => String(x.id) === e.target.value)?.rate || form.rate })}>
                <option value="">— Select —</option>
                {halls.map((h) => <option key={h.id} value={h.id}>{h.name} — {naira(h.rate)}/day</option>)}
              </select>
            </div>
            <div>
              <label className="label">Event Type</label>
              <select className="input" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {['Conference','Seminar','Wedding','Birthday','Corporate Meeting','Training','Exhibition','Other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Start</label>
              <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Attendees</label>
              <input type="number" className="input" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
            </div>
            <div>
              <label className="label">Catering Outlet</label>
              <select className="input" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
                <option value="">— None —</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Rate (₦)</label>
              <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
            <div>
              <label className="label">Discount (₦)</label>
              <input type="number" className="input" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div>
              <label className="label">Deposit (₦)</label>
              <input type="number" className="input" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Event Services / Add-ons</label>
            <div className="grid grid-cols-2 gap-2">
              {evServices.map((s) => {
                const sel = svcSelection.find((x) => String(x.service_id) === String(s.id));
                return (
                  <div key={s.id} className="flex items-center justify-between border border-ink-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{s.name}</p>
                      <p className="text-xs text-ink-500">{naira(s.price)} / {s.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sel && <input type="number" className="input !w-16 !py-1" min="1" value={sel.quantity} onChange={(e) => setSvcQty(s.id, e.target.value)} />}
                      <Button type="button" size="sm" variant={sel ? 'danger' : 'secondary'} onClick={() => toggleSvc(s.id)}>{sel ? 'Remove' : 'Add'}</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setBookOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Booking</Button>
          </div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Event Payment">
        <form onSubmit={recordPayment} className="space-y-4">
          <p className="text-sm text-ink-600">Booking for <b>{payTarget?.customer_name}</b> · balance <b className="text-amber-600">{naira(payTarget?.balance)}</b></p>
          <div>
            <label className="label">Amount (₦)</label>
            <input type="number" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {['CASH','POS','TRANSFER','CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
