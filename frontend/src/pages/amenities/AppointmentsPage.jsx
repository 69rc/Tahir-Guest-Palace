import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Table, Badge } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

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
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
  const toast = useToast();
  const { canAccess } = useAuth();

  const canBook = canAccess('appointments:manage');
  const canSettle = canAccess('appointments:fulfill') && canAccess('payments:record');
  const canCharge = canAccess('charge_amenity');

  const load = async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const [ap, am] = await Promise.all([
        api.get(`/amenities/service-appointments${q}`),
        api.get('/amenities'),
      ]);
      setAppointments(ap.data);
      setAmenities(am.data);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [statusFilter]);

  const openBook = async () => {
    setForm({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
    setCurrentServices([]);
    try { const g = await api.get('/guests'); setGuests(g.data?.length ? g.data : (g.data?.data || [])); } catch {}
    setBookOpen(true);
  };

  const selectAmenity = async (amenity_id) => {
    setForm({ ...form, amenity_id, service_id: '' });
    setCurrentServices([]);
    try { const d = await api.get(`/amenities/${amenity_id}`); setCurrentServices(d.data.services || []); } catch {}
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/amenities/service-appointments', form);
      toast.success('Appointment booked');
      setBookOpen(false);
      setForm({ amenity_id: '', service_id: '', guest_id: '', customer_name: '', start_time: '', end_time: '', price: 0 });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const settle = async (charge) => {
    setSaving(true);
    try {
      await api.post(`/amenities/service-appointments/${settleTarget.id}/settle`, { charge_to_room: charge, amount: settleTarget.price });
      toast.success(charge ? 'Charged to guest folio' : 'Payment recorded');
      setSettleOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  const cols = [
    { key: 'appointment_no', label: 'Ref' },
    { key: 'amenity_name', label: 'Amenity', render: (r) => <span className="font-medium text-ink-800">{r.amenity_name || '—'}</span> },
    { key: 'service_name', label: 'Service', render: (r) => r.service_name || '—' },
    { key: 'customer', label: 'Customer', render: (r) => r.guest_name || r.customer_name || '—' },
    { key: 'start_time', label: 'Start', render: (r) => fmtDateTime(r.start_time) },
    { key: 'staff_name', label: 'Staff', render: (r) => r.staff_name || '—' },
    { key: 'price', label: 'Price', align: 'right', render: (r) => naira(r.price) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      key: '_a', label: '', align: 'right',
      render: (r) => (['PENDING', 'BOOKED', 'CONFIRMED'].includes(r.status) && canSettle ? (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSettleTarget(r); setSettleOpen(true); }}>Settle</Button>
      ) : null),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/amenities" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Amenities</Link>
          <h1 className="text-2xl font-bold text-ink-900">Service Appointments</h1>
          <p className="text-sm text-ink-500 mt-0.5">Spa, barbershop, pool &amp; fitness bookings</p>
        </div>
        <div className="flex gap-2">
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['PENDING','BOOKED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {canBook && <Button onClick={openBook}><Plus size={16} /> New Appointment</Button>}
        </div>
      </div>

      <Table columns={cols} rows={appointments} empty={{ title: 'No appointments', message: 'Book a service slot.' }} />

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="New Appointment" wide>
        <form onSubmit={createAppointment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amenity *</label>
              <select className="input" required value={form.amenity_id} onChange={(e) => selectAmenity(e.target.value)}>
                <option value="">— Select —</option>
                {amenities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service</label>
              <select className="input" value={form.service_id} onChange={(e) => {
                const s = currentServices.find((x) => String(x.id) === e.target.value);
                setForm({ ...form, service_id: e.target.value, price: s ? s.price : form.price });
              }}>
                <option value="">— Select —</option>
                {currentServices.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.price)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Guest</label>
              <select className="input" value={form.guest_id} onChange={(e) => setForm({ ...form, guest_id: e.target.value })}>
                <option value="">— Walk-in / none —</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Customer Name (walk-in)</label>
              <input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start *</label>
              <input type="datetime-local" className="input" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End *</label>
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

      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title="Settle Appointment">
        <p className="text-sm text-ink-600 mb-4">
          Charge <b>{naira(settleTarget?.price)}</b> for {settleTarget?.service_name || 'this appointment'}.
        </p>
        <div className="flex flex-col gap-2">
          {canCharge && <Button onClick={() => settle(true)} loading={saving}>Charge to Room Folio</Button>}
          <Button variant="secondary" onClick={() => settle(false)} loading={saving}>Record as Direct Payment</Button>
        </div>
      </Modal>
    </div>
  );
}
