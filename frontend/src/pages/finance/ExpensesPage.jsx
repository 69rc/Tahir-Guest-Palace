import { useEffect, useState } from 'react';
import { ReceiptText, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, Table } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';

const EXPENSE_CATEGORIES = ['Utilities', 'Salaries', 'Maintenance', 'Food', 'Beverages', 'Cleaning', 'Marketing', 'Transport', 'Other'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'Utilities', description: '', amount: '', paid_to: '', method: 'CASH' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/expenses');
      setExpenses(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = expenses.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.description || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q) || (e.paid_to || '').toLowerCase().includes(q);
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/expenses', form);
      toast.success('Expense recorded');
      setOpen(false);
      setForm({ category: 'Utilities', description: '', amount: '', paid_to: '', method: 'CASH' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const columns = [
    { key: 'category', label: 'Category', render: (e) => <Badge status="PAID">{e.category}</Badge> },
    { key: 'description', label: 'Description', render: (e) => <span className="font-medium">{e.description || '—'}</span> },
    { key: 'amount', label: 'Amount', align: 'right', render: (e) => <span className="font-bold">{naira(e.amount)}</span> },
    { key: 'paid_to', label: 'Paid To', render: (e) => e.paid_to || '—' },
    { key: 'method', label: 'Method', render: (e) => <Badge status={e.method}>{e.method}</Badge> },
    { key: 'incurred_by_name', label: 'By', render: (e) => e.incurred_by_name || '—' },
    { key: 'incurred_at', label: 'Date', render: (e) => fmtDate(e.incurred_at) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Expenses</h1>
          <p className="text-sm text-ink-500 mt-0.5">Total recorded: <b>{naira(total)}</b></p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Record Expense</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search expenses…" className="max-w-sm" />
        </div>
        <Table columns={columns} rows={filtered} empty={{ title: 'No expenses', message: 'Record your operating expenses.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Expense">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₦) *</label>
              <input type="number" className="input" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Paid To</label>
              <input className="input" value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Expense</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
