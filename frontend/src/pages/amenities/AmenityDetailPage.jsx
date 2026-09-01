import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, CalendarClock, CreditCard, Waves, Dumbbell, Flower2, Scissors, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, Badge, FilterChip } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ICON = { POOL: Waves, FITNESS: Dumbbell, SPA: Flower2, BARBERSHOP: Scissors, OTHER: Sparkles };

function apptLabel(status) {
  if (status === 'COMPLETED') return 'Done';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'NO_SHOW') return 'No show';
  if (status === 'CONFIRMED' || status === 'BOOKED') return 'Booked';
  return 'Waiting';
}

export default function AmenityDetailPage() {
  const { id } = useParams();
  const [amenity, setAmenity] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('services');
  const [svcOpen, setSvcOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [guests, setGuests] = useState([]);
  const [svcForm, setSvcForm] = useState({ name: '', price: 0, duration_min: 60, capacity: 1 });
  const [apptForm, setApptForm] = useState({ service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0, notes: '' });
  const toast = useToast();
  const { canAccess } = useAuth();

  const canManage = canAccess('amenities:manage', 'services:manage');
  const canBook = canAccess('appointments:manage');
  const canSettle = canAccess('appointments:fulfill') && canAccess('payments:record');
  const canCharge = canAccess('charge_amenity');

  const load = async () => {
    setLoading(true);
    try {
      const [a, ap] = await Promise.all([
        api.get(`/amenities/${id}`),
        api.get(`/amenities/service-appointments?amenity_id=${id}`),
      ]);
      setAmenity(a.data);
      setAppointments(ap.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const openBook = async () => {
    try {
      const g = await api.get('/guests');
      setGuests(g.data?.length ? g.data : (g.data?.data || []));
    } catch { /* ignore */ }
    setApptOpen(true);
  };

  const createService = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/amenities/services', { ...svcForm, amenity_id: id });
      toast.success('Service added');
      setSvcOpen(false);
      setSvcForm({ name: '', price: 0, duration_min: 60, capacity: 1 });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    if (!apptForm.guest_id && !apptForm.customer_name.trim()) {
      toast.error('Name the guest, or pick a hotel guest.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/amenities/service-appointments', { ...apptForm, amenity_id: id });
      toast.success('Booked');
      setApptOpen(false);
      setApptForm({ service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0, notes: '' });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const openSettle = (a) => { setSettleTarget(a); setSettleOpen(true); };

  const settle = async (charge) => {
    setSaving(true);
    try {
      await api.post(`/amenities/service-appointments/${settleTarget.id}/settle`, { charge_to_room: charge, amount: settleTarget.price });
      toast.success(charge ? 'Added to room bill' : 'Payment recorded');
      setSettleOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  const Icon = ICON[amenity?.category] || Sparkles;
  const services = amenity?.services || [];
  const openNow = amenity?.status === 'ACTIVE';

  return (
    <div className="space-y-5">
      <div>
        <Link to="/amenities" className="btn-secondary !py-1.5 !text-xs mb-3 inline-flex items-center gap-1"><ArrowLeft size={14} /> Amenities</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Icon size={24} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Amenities</p>
              <h1 className="text-2xl font-bold text-ink-900">{amenity.name}</h1>
              <p className="text-sm text-ink-500">{[amenity.location, amenity.operating_hours].filter(Boolean).join(' · ') || 'Hotel facility'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge status={openNow ? 'PAID' : 'CANCELLED'}>{openNow ? 'Open' : 'Closed'}</Badge>
            {canManage && <Button variant="secondary" onClick={() => setSvcOpen(true)}><Plus size={16} /> Add service</Button>}
            {canBook && <Button onClick={openBook}><CalendarClock size={16} /> Book</Button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={tab === 'services'} onClick={() => setTab('services')} label="Services" count={services.length} />
        <FilterChip active={tab === 'appointments'} onClick={() => setTab('appointments')} label="Bookings" count={appointments.length} />
      </div>

      {tab === 'services' ? (
        services.length === 0 ? (
          <Card><p className="p-8 text-center text-sm text-ink-500">No services yet. Add treatments or slots this place sells.</p></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {services.map((s) => (
              <Card key={s.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink-900">{s.name}</p>
                  <p className="text-sm text-ink-500 mt-0.5">{s.duration_min ? `${s.duration_min} min` : 'Timed as booked'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-ink-900">{naira(s.price)}</p>
                  <Badge status={s.status === 'ACTIVE' ? 'PAID' : 'CANCELLED'}>{s.status === 'ACTIVE' ? 'On sale' : 'Off'}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        appointments.length === 0 ? (
          <Card><p className="p-8 text-center text-sm text-ink-500">No bookings yet.</p></Card>
        ) : (
          <Card>
            <div className="divide-y divide-ink-100">
              {appointments.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{r.guest_name || r.customer_name || 'Walk-in'}</p>
                    <p className="text-xs text-ink-500">
                      {r.service_name || 'Visit'} · {fmtDateTime(r.start_time)}
                    </p>
                  </div>
                  <p className="font-bold text-ink-900">{naira(r.price)}</p>
                  <Badge status={r.status}>{apptLabel(r.status)}</Badge>
                  {['PENDING', 'BOOKED', 'CONFIRMED'].includes(r.status) && canSettle && (
                    <Button size="sm" variant="secondary" onClick={() => openSettle(r)}>Settle</Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      )}

      <Modal open={svcOpen} onClose={() => setSvcOpen(false)} title="Add service">
        <form onSubmit={createService} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Minutes</label>
              <input type="number" className="input" value={svcForm.duration_min} onChange={(e) => setSvcForm({ ...svcForm, duration_min: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSvcOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={apptOpen} onClose={() => setApptOpen(false)} title="New booking" wide>
        <form onSubmit={createAppointment} className="space-y-4">
          <div>
            <label className="label">Service</label>
            <select className="input" value={apptForm.service_id} onChange={(e) => {
              const s = services.find((x) => String(x.id) === e.target.value);
              setApptForm({ ...apptForm, service_id: e.target.value, price: s ? s.price : apptForm.price });
            }}>
              <option value="">Visit only</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.price)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hotel guest</label>
              <select className="input" value={apptForm.guest_id} onChange={(e) => setApptForm({ ...apptForm, guest_id: e.target.value })}>
                <option value="">Walk-in</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Walk-in name</label>
              <input className="input" value={apptForm.customer_name} onChange={(e) => setApptForm({ ...apptForm, customer_name: e.target.value })} placeholder="Needed if not a hotel guest" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start</label>
              <input type="datetime-local" className="input" required value={apptForm.start_time} onChange={(e) => setApptForm({ ...apptForm, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="datetime-local" className="input" required value={apptForm.end_time} onChange={(e) => setApptForm({ ...apptForm, end_time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Price (₦)</label>
            <input type="number" className="input" value={apptForm.price} onChange={(e) => setApptForm({ ...apptForm, price: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setApptOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Book</Button>
          </div>
        </form>
      </Modal>

      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title="Settle">
        <p className="text-sm text-ink-600 mb-4">
          Collect <b>{naira(settleTarget?.price)}</b> for {settleTarget?.guest_name || settleTarget?.customer_name || 'this guest'}.
        </p>
        <div className="flex flex-col gap-2">
          {canCharge && <Button onClick={() => settle(true)} loading={saving}><CreditCard size={15} /> Put on room bill</Button>}
          <Button variant="secondary" onClick={() => settle(false)} loading={saving}>They paid now</Button>
        </div>
      </Modal>
    </div>
  );
}
