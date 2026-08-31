import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState, Table } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime } from '../../utils/format.js';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    guest_id: '', full_name: '', phone: '', email: '', id_type: '', id_number: '',
    room_type_id: '', room_id: '', check_in_date: '', check_out_date: '',
    adults: 1, children: 0, rate: '', discount: 0, deposit: 0, payment_method: 'CASH', special_requests: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r, g, t] = await Promise.all([api.get('/reservations'), api.get('/guests'), api.get('/rooms/types')]);
      setReservations(r.data);
      setGuests(g.data);
      setTypes(t.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = reservations.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.guest_name || '').toLowerCase().includes(q) || (r.reservation_no || '').toLowerCase().includes(q) || String(r.room_number || '').includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/reservations', form);
      toast.success('Reservation created');
      setOpen(false);
      setForm({ ...form, guest_id: '', full_name: '', phone: '', email: '', id_type: '', id_number: '', upload: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/reservations/${id}/status`, { status });
      toast.success(`Status set to ${status}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await api.post(`/reservations/${id}/cancel`);
      toast.success('Reservation cancelled');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'reservation_no', label: 'Ref #', render: (r) => <span className="font-semibold">{r.reservation_no}</span> },
    { key: 'guest_name', label: 'Guest', render: (r) => <span className="font-medium">{r.guest_name}</span> },
    { key: 'room_number', label: 'Room', render: (r) => r.room_number || '—' },
    { key: 'dates', label: 'Dates', render: (r) => <span className="whitespace-nowrap">{fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}</span> },
    { key: 'adults', label: 'Guests', render: (r) => `${r.adults || 0}·${r.children || 0}` },
    { key: 'total', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{naira(r.rate)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === 'CONFIRMED' && (
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate('/checkin'); }}>Check-in</Button>
          )}
          {['PENDING', 'CONFIRMED'].includes(r.status) && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancel(r.id); }}>Cancel</Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Reservations</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage all upcoming and past bookings</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New Reservation</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by guest, ref or room…" className="max-w-sm" />
        </div>
        <Table
          columns={columns}
          rows={filtered}
          onRowClick={(r) => navigate(`/reservations/${r.id}`)}
          empty={{ title: 'No reservations', message: 'Create a new reservation to get started.' }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Reservation" wide>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Existing Guest</p>
            <select className="input" value={form.guest_id} onChange={(e) => {
              const g = guests.find((x) => String(x.id) === e.target.value);
              setForm({ ...form, guest_id: e.target.value, full_name: g?.full_name || '', phone: g?.phone || '', email: g?.email || '' });
            }}>
              <option value="">Select existing guest…</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name} — {g.phone || 'no phone'}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name {!form.guest_id && <span className="text-red-500">*</span>}</label>
              <input className="input" required={!form.guest_id} value={form.full_name} disabled={!!form.guest_id}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Guest full name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} disabled={!!form.guest_id} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} disabled={!!form.guest_id} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Check-in Date</label>
              <input type="date" className="input" required value={form.check_in_date} onChange={(e) => setForm({ ...form, check_in_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Check-out Date</label>
              <input type="date" className="input" required value={form.check_out_date} onChange={(e) => setForm({ ...form, check_out_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Room Type</label>
              <select className="input" value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value, room_id: '' })}>
                <option value="">Select type (auto-assign)…</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Adults · Children</label>
              <div className="flex gap-2">
                <input type="number" className="input" min="1" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
                <input type="number" className="input" min="0" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rate (₦/night)</label>
              <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Leave blank for room rate" />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
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
            <label className="label">Special Requests</label>
            <textarea className="input" rows={2} value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Reservation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
