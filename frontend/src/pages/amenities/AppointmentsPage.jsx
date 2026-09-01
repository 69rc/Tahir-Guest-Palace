import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Badge, Card, EmptyState, FilterChip } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const FILTERS = [
  { id: 'open', label: 'Open', match: (s) => ['PENDING', 'BOOKED', 'CONFIRMED'].includes(s) },
  { id: 'done', label: 'Done', match: (s) => s === 'COMPLETED' },
  { id: 'other', label: 'Cancelled', match: (s) => ['CANCELLED', 'NO_SHOW'].includes(s) },
  { id: 'all', label: 'All', match: () => true },
];

function apptLabel(status) {
  if (status === 'COMPLETED') return 'Done';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'NO_SHOW') return 'No show';
  if (status === 'CONFIRMED' || status === 'BOOKED') return 'Booked';
  return 'Waiting';
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [guests, setGuests] = useState([]);
  const [currentServices, setCurrentServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('open');
  const [form, setForm] = useState({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
  const toast = useToast();
  const { canAccess } = useAuth();

  const canBook = canAccess('appointments:manage');
  const canSettle = canAccess('appointments:fulfill') && canAccess('payments:record');
  const canCharge = canAccess('charge_amenity');

  const load = async () => {
    setLoading(true);
    try {
      const [ap, am] = await Promise.all([
        api.get('/amenities/service-appointments'),
        api.get('/amenities'),
      ]);
      setAppointments(ap.data);
      setAmenities(am.data);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openBook = async () => {
    setForm({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
    setCurrentServices([]);
    try { const g = await api.get('/guests'); setGuests(g.data?.length ? g.data : (g.data?.data || [])); } catch { /* ignore */ }
    setBookOpen(true);
  };

  const selectAmenity = async (amenity_id) => {
    setForm({ ...form, amenity_id, service_id: '' });
    setCurrentServices([]);
    try { const d = await api.get(`/amenities/${amenity_id}`); setCurrentServices(d.data.services || []); } catch { /* ignore */ }
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    if (!form.guest_id && !form.customer_name.trim()) {
      toast.error('Name the walk-in, or pick a hotel guest.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/amenities/service-appointments', form);
      toast.success('Booked');
      setBookOpen(false);
      setForm({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const settle = async (charge) => {
    setSaving(true);
    try {
      await api.post(`/amenities/service-appointments/${settleTarget.id}/settle`, { charge_to_room: charge, amount: settleTarget.price });
      toast.success(charge ? 'Added to room bill' : 'Payment recorded');
      setSettleOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const counts = useMemo(() => {
    const map = {};
    FILTERS.forEach((f) => { map[f.id] = appointments.filter((a) => f.match(a.status)).length; });
    return map;
  }, [appointments]);

  const visible = appointments.filter((a) => (FILTERS.find((f) => f.id === filter) || FILTERS[0]).match(a.status));

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/amenities" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Amenities</Link>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Amenities</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Bookings</h1>
          <p className="text-sm text-ink-500 mt-1">Spa, barber, pool and gym appointments.</p>
        </div>
        {canBook && <Button onClick={openBook}><Plus size={16} /> New booking</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} label={f.label} count={counts[f.id]} />
        ))}
      </div>

      {visible.length === 0 ? (
        <Card><EmptyState title="No bookings here" message="Book a slot from an amenity." /></Card>
      ) : (
        <Card>
          <div className="divide-y divide-ink-100">
            {visible.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{r.guest_name || r.customer_name || 'Walk-in'}</p>
                  <p className="text-xs text-ink-500">
                    {r.amenity_name || 'Amenity'}{r.service_name ? ` · ${r.service_name}` : ''} · {fmtDateTime(r.start_time)}
                  </p>
                </div>
                <p className="font-bold text-ink-900">{naira(r.price)}</p>
                <Badge status={r.status}>{apptLabel(r.status)}</Badge>
                {['PENDING', 'BOOKED', 'CONFIRMED'].includes(r.status) && canSettle && (
                  <Button size="sm" variant="secondary" onClick={() => { setSettleTarget(r); setSettleOpen(true); }}>Settle</Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="New booking" wide>
        <form onSubmit={createAppointment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amenity</label>
              <select className="input" required value={form.amenity_id} onChange={(e) => selectAmenity(e.target.value)}>
                <option value="">Pick a place…</option>
                {amenities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service</label>
              <select className="input" value={form.service_id} onChange={(e) => {
                const s = currentServices.find((x) => String(x.id) === e.target.value);
                setForm({ ...form, service_id: e.target.value, price: s ? s.price : form.price });
              }}>
                <option value="">Visit only</option>
                {currentServices.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.price)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hotel guest</label>
              <select className="input" value={form.guest_id} onChange={(e) => setForm({ ...form, guest_id: e.target.value })}>
                <option value="">Walk-in</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Walk-in name</label>
              <input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Needed if not a hotel guest" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start</label>
              <input type="datetime-local" className="input" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="datetime-local" className="input" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Price (₦)</label>
            <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setBookOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Book</Button>
          </div>
        </form>
      </Modal>

      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title="Settle">
        <p className="text-sm text-ink-600 mb-4">
          Collect <b>{naira(settleTarget?.price)}</b> for {settleTarget?.service_name || 'this visit'}.
        </p>
        <div className="flex flex-col gap-2">
          {canCharge && <Button onClick={() => settle(true)} loading={saving}>Put on room bill</Button>}
          <Button variant="secondary" onClick={() => settle(false)} loading={saving}>They paid now</Button>
        </div>
      </Modal>
    </div>
  );
}
