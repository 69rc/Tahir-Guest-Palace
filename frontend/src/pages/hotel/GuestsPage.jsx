import { useEffect, useState } from 'react';
import { Users, Plus, Phone, Mail, MapPin } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState, Table } from '../../components/ui/index.jsx';
import { naira, fmtDate, initials } from '../../utils/format.js';

export default function GuestsPage() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const toast = useToast();

  const [form, setForm] = useState({ full_name: '', phone: '', email: '', address: '', id_type: '', id_number: '', nationality: 'Nigerian', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/guests');
      setGuests(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = guests.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [g.full_name, g.phone, g.email, g.nationality].some((v) => (v || '').toLowerCase().includes(q));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/guests', form);
      toast.success('Guest created');
      setOpen(false);
      setForm({ full_name: '', phone: '', email: '', address: '', id_type: '', id_number: '', nationality: 'Nigerian', notes: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (g) => {
    try {
      const res = await api.get(`/guests/${g.id}`);
      setDetail(g);
      setDetailData(res.data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: 'full_name', label: 'Guest', render: (g) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{initials(g.full_name)}</div>
          <div>
            <p className="font-semibold text-ink-800">{g.full_name}</p>
            <p className="text-xs text-ink-500">{g.nationality}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (g) => <span className="flex items-center gap-1.5"><Phone size={13} className="text-ink-400" /> {g.phone || '—'}</span> },
    { key: 'email', label: 'Email', render: (g) => <span className="flex items-center gap-1.5"><Mail size={13} className="text-ink-400" /> {g.email || '—'}</span> },
    { key: 'id_type', label: 'ID', render: (g) => (g.id_type ? `${g.id_type}${g.id_number ? ' · ' + g.id_number : ''}` : '—') },
    { key: 'created_at', label: 'Added', render: (g) => fmtDate(g.created_at) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Guests</h1>
          <p className="text-sm text-ink-500 mt-0.5">{guests.length} guest profiles</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New Guest</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or email…" className="max-w-sm" />
        </div>
        <Table columns={columns} rows={filtered} onRowClick={openDetail}
          empty={{ title: 'No guests found', message: 'Add a guest or adjust your search.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Guest" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234…" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ID Type</label>
              <select className="input" value={form.id_type} onChange={(e) => setForm({ ...form, id_type: e.target.value })}>
                <option value="">Select…</option>
                <option>National ID</option>
                <option>Passport</option>
                <option>Driver's Licence</option>
                <option>Voter's Card</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">ID Number</label>
              <input className="input" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Nationality</label>
              <input className="input" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Guest</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => { setDetail(null); setDetailData(null); }} title={detail?.full_name} wide>
        {detailData && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold">{initials(detail.full_name)}</div>
                <div>
                  <p className="text-lg font-bold text-ink-900">{detailData.guest.full_name}</p>
                  <p className="text-sm text-ink-500">{detailData.guest.nationality}</p>
                </div>
              </div>
              <Badge>{detailData.outstanding > 0 ? `Owes ${naira(detailData.outstanding)}` : 'Settled'}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2 text-ink-600"><Phone size={14} /> {detailData.guest.phone || '—'}</div>
              <div className="flex items-center gap-2 text-ink-600"><Mail size={14} /> {detailData.guest.email || '—'}</div>
              <div className="flex items-center gap-2 text-ink-600"><MapPin size={14} /> {detailData.guest.address || '—'}</div>
            </div>

            {detailData.currentReservation && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase">Current Stay · Room {detailData.currentReservation.room_number}</p>
                <p className="text-sm text-blue-800 mt-1">{fmtDate(detailData.currentReservation.check_in_date)} → {fmtDate(detailData.currentReservation.check_out_date)} · <Badge status={detailData.currentReservation.status}>{detailData.currentReservation.status}</Badge></p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Ledger</p>
              <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
                {detailData.ledger.length === 0 ? (
                  <p className="p-3 text-sm text-ink-500">No invoices yet.</p>
                ) : detailData.ledger.map((l) => (
                  <div key={l.invoice_id} className="flex items-center justify-between p-3 text-sm">
                    <span className="font-medium">{l.invoice_no}</span>
                    <span>{naira(l.total)} · paid {naira(l.paid)}</span>
                    <span className="font-semibold">{naira(l.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
