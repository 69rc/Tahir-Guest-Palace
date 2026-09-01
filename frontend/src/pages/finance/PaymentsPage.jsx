import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Plus, Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, Table, FilterChip, GuestPicker } from '../../components/ui/index.jsx';
import { naira, fmtDateTime, payLabel } from '../../utils/format.js';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ guest_id: '', amount: '', method: 'CASH', category: 'ROOM', note: '' });
  const [methodFilter, setMethodFilter] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([api.get('/finance/payments'), api.get('/guests')]);
      setPayments(p.data);
      setGuests(g.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = payments.filter((p) => {
    if (methodFilter !== 'all' && p.method !== methodFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.payment_no || '').toLowerCase().includes(q) || (p.guest_name || '').toLowerCase().includes(q) || payLabel(p.method).toLowerCase().includes(q);
  });
  const CAT = { ROOM: 'Room', RESTAURANT: 'Restaurant', OTHER: 'Other', SPA: 'Spa', AMENITY: 'Amenity', EVENT: 'Event' };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/payments', form);
      toast.success('Payment recorded');
      setOpen(false);
      setForm({ guest_id: '', amount: '', method: 'CASH', category: 'ROOM', note: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'payment_no', label: 'Ref #', render: (p) => <span className="font-semibold">{p.payment_no}</span> },
    { key: 'guest_name', label: 'Guest', render: (p) => <span className="flex items-center gap-1.5"><Wallet size={14} className="text-ink-400" /> {p.guest_name || 'Walk-in'}</span> },
    { key: 'amount', label: 'Amount', align: 'right', render: (p) => <span className="font-bold">{naira(p.amount)}</span> },
    { key: 'method', label: 'How', render: (p) => <Badge status={p.method}>{payLabel(p.method)}</Badge> },
    { key: 'category', label: 'For', render: (p) => <Badge status={p.category === 'RESTAURANT' ? 'OPEN' : 'PAID'}>{CAT[p.category] || p.category}</Badge> },
    { key: 'received_by_name', label: 'Taken by', render: (p) => p.received_by_name || '—' },
    { key: 'created_at', label: 'Date', render: (p) => fmtDateTime(p.created_at) },
    { key: 'receipt', label: '', align: 'right', render: (p) => (
      <Link to={`/finance/payments/${p.id}/receipt`} className="btn-ghost !p-2" title="Print receipt"><Printer size={15} /></Link>
    ) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Finance</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Payments</h1>
          <p className="text-sm text-ink-500 mt-1">Money that came in — cash, POS, transfer, card.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Record payment</Button>
      </div>

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search guest or ref…" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={methodFilter === 'all'} onClick={() => setMethodFilter('all')} label="All" count={payments.length} />
          {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => (
            <FilterChip key={m} active={methodFilter === m} onClick={() => setMethodFilter(m)} label={payLabel(m)} count={payments.filter((p) => p.method === m).length} />
          ))}
        </div>
      </div>

      <Card>
        <Table columns={columns} rows={filtered} empty={{ title: 'No payments yet', message: 'Record cash taken at the desk.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Payment">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Guest (optional)</label>
            <GuestPicker
              guests={guests}
              value={form.guest_id}
              showAllOnEmpty
              placeholder="Search name or phone…"
              onSelect={(g) => setForm({ ...form, guest_id: g ? g.id : '' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₦) *</label>
              <input type="number" className="input" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Method *</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{payLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="ROOM">Room</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
