import { useEffect, useState } from 'react';
import { Wallet, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, Table } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ guest_id: '', amount: '', method: 'CASH', category: 'ROOM', note: '' });
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
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.payment_no || '').toLowerCase().includes(q) || (p.guest_name || '').toLowerCase().includes(q) || (p.method || '').toLowerCase().includes(q);
  });

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
    { key: 'method', label: 'Method', render: (p) => <Badge status={p.method}>{p.method}</Badge> },
    { key: 'category', label: 'Category', render: (p) => <Badge status={p.category === 'RESTAURANT' ? 'OPEN' : 'PAID'}>{p.category}</Badge> },
    { key: 'received_by_name', label: 'Received By', render: (p) => p.received_by_name || '—' },
    { key: 'created_at', label: 'Date', render: (p) => fmtDateTime(p.created_at) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Payments</h1>
          <p className="text-sm text-ink-500 mt-0.5">All incoming payments recorded on folios</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Record Payment</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search payments…" className="max-w-sm" />
        </div>
        <Table columns={columns} rows={filtered} empty={{ title: 'No payments yet', message: 'Record the first payment.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Payment">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Guest</label>
            <select className="input" value={form.guest_id} onChange={(e) => setForm({ ...form, guest_id: e.target.value })}>
              <option value="">Select guest (optional)…</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₦) *</label>
              <input type="number" className="input" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Method *</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
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
