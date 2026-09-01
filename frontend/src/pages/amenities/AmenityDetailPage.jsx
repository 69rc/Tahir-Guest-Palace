import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, CalendarClock, CheckCircle2, CreditCard, Waves, Dumbbell, Flower2, Scissors } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, Table, Badge, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ICON = { POOL: Waves, FITNESS: Dumbbell, SPA: Flower2, BARBERSHOP: Scissors };

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
  const [rooms, setRooms] = useState([]);
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

  const loadOptions = async () => {
    try {
      const [g, r] = await Promise.all([api.get('/guests'), api.get('/rooms')]);
      setGuests(g.data?.length ? g.data : (g.data?.data || []));
      setRooms(r.data?.length ? r.data : (r.data?.data || []));
    } catch { /* ignore */ }
  };

  const openBook = () => {
    loadOptions();
    setApptOpen(true);
  };

  const createService = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/amenities/services', { ...svcForm, amenity_id: id });
      toast.success('Service created');
      setSvcOpen(false);
      setSvcForm({ name: '', price: 0, duration_min: 60, capacity: 1 });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/amenities/service-appointments', { ...apptForm, amenity_id: id });
      toast.success('Appointment booked');
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
      toast.success(charge ? 'Service charged to guest folio' : 'Service payment recorded');
      setSettleOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  const Icon = ICON[amenity?.category] || Waves;

  const apptCols = [
    { key: 'appointment_no', label: 'Ref' },
    { key: 'customer', label: 'Customer', render: (r) => r.guest_name || r.customer_name || '—' },
    { key: 'start_time', label: 'Start', render: (r) => fmtDateTime(r.start_time) },
    { key: 'service_name', label: 'Service', render: (r) => r.service_name || '—' },
    { key: 'staff_name', label: 'Staff', render: (r) => r.staff_name || '—' },
    { key: 'price', label: 'Price', align: 'right', render: (r) => naira(r.price) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      key: '_a', label: '', align: 'right',
      render: (r) => (['PENDING', 'BOOKED', 'CONFIRMED'].includes(r.status) && canSettle ? (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openSettle(r); }}><CheckCircle2 size={14} /> Settle</Button>
      ) : null),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link to="/amenities" className="btn-secondary !py-1.5 !text-xs mb-3 inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to Amenities</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Icon size={24} /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{amenity.name}</h1>
              <p className="text-sm text-ink-500">{amenity.location} · {amenity.operating_hours}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canManage && <Button variant="secondary" onClick={() => setSvcOpen(true)}><Plus size={16} /> Add Service</Button>}
            {canBook && <Button onClick={openBook}><CalendarClock size={16} /> New Appointment</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Base Price" value={naira(amenity.price)} icon={CreditCard} />
        <Stat label="Capacity" value={amenity.capacity || 0} icon={Waves} />
        <Stat label="Services" value={amenity.services?.length || 0} icon={Plus} />
        <Stat label="Bookings" value={appointments.length} icon={CalendarClock} />
      </div>

      <div className="flex gap-1 bg-ink-50 p-1 rounded-lg w-fit">
        <button className={`px-4 py-1.5 rounded-md text-sm font-semibold ${tab === 'services' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500'}`} onClick={() => setTab('services')}>Services</button>
        <button className={`px-4 py-1.5 rounded-md text-sm font-semibold ${tab === 'appointments' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500'}`} onClick={() => setTab('appointments')}>Appointments</button>
      </div>

      {tab === 'services' ? (
        <Card>
          <div className="pb-3"><h3 className="text-sm font-bold text-ink-800">Services &amp; Pricing</h3></div>
          <Table
            columns={[
              { key: 'name', label: 'Service' },
              { key: 'duration_min', label: 'Duration (min)', render: (r) => r.duration_min || '—' },
              { key: 'price', label: 'Price', align: 'right', render: (r) => naira(r.price) },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
            ]}
            rows={amenity.services || []}
            empty={{ title: 'No services', message: 'Add services and pricing for this facility.' }}
          />
        </Card>
      ) : (
        <Card>
          <Table
            columns={apptCols}
            rows={appointments || []}
            empty={{ title: 'No appointments', message: 'Book a slot for this facility.' }}
          />
        </Card>
      )}

      <Modal open={svcOpen} onClose={() => setSvcOpen(false)} title="Add Service">
        <form onSubmit={createService} className="space-y-4">
          <div>
            <label className="label">Service Name *</label>
            <input className="input" required value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" className="input" value={svcForm.duration_min} onChange={(e) => setSvcForm({ ...svcForm, duration_min: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSvcOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={apptOpen} onClose={() => setApptOpen(false)} title="New Appointment" wide>
        <form onSubmit={createAppointment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Service</label>
              <select className="input" value={apptForm.service_id} onChange={(e) => {
                const s = (amenity.services || []).find((x) => String(x.id) === e.target.value);
                setApptForm({ ...apptForm, service_id: e.target.value, price: s ? s.price : apptForm.price });
              }}>
                <option value="">— Select —</option>
                {(amenity.services || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.price)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Guest</label>
              <select className="input" value={apptForm.guest_id} onChange={(e) => setApptForm({ ...apptForm, guest_id: e.target.value })}>
                <option value="">— Walk-in / none —</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Customer Name (if walk-in)</label>
            <input className="input" value={apptForm.customer_name} onChange={(e) => setApptForm({ ...apptForm, customer_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start *</label>
              <input type="datetime-local" className="input" required value={apptForm.start_time} onChange={(e) => setApptForm({ ...apptForm, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End *</label>
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

      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title={`Settle ${settleTarget?.service_name || 'Appointment'}`}>
        <p className="text-sm text-ink-600 mb-4">
          Charge <b className="text-ink-900">{naira(settleTarget?.price)}</b> for <b className="text-ink-900">{settleTarget?.guest_name || settleTarget?.customer_name || 'this guest'}</b>.
        </p>
        <div className="flex flex-col gap-2">
          {canCharge && <Button onClick={() => settle(true)} loading={saving}>Charge to Room Folio</Button>}
          <Button variant="secondary" onClick={() => settle(false)} loading={saving}>Record as Direct Payment</Button>
        </div>
      </Modal>
    </div>
  );
}
