import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Eye } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, Table, FilterChip } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', restaurant_id: '', payment_status: 'UNPAID', note: '', lines: [{ item_id: '', quantity: 1, unit_price: '' }] });
  const [payFilter, setPayFilter] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [p, s, i] = await Promise.all([api.get('/inventory/purchases'), api.get('/inventory/suppliers'), api.get('/inventory')]);
      setPurchases(p.data);
      setSuppliers(s.data);
      setItems(i.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateLine = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => {
        const nl = { ...l, [field]: value };
        if (field === 'item_id') {
          const item = items.find((x) => String(x.id) === String(value));
          if (item) nl.unit_price = item.cost_price || '';
        }
        return i === idx ? nl : l;
      }),
    }));
  };

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { item_id: '', quantity: 1, unit_price: '' }] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const lineTotal = (l) => Number(l.quantity || 0) * Number(l.unit_price || 0);
  const total = form.lines.reduce((s, l) => s + lineTotal(l), 0);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/purchases', form);
      toast.success('Purchase created. Stock increased.');
      setOpen(false);
      setForm({ supplier_id: '', restaurant_id: '', payment_status: 'UNPAID', note: '', lines: [{ item_id: '', quantity: 1, unit_price: '' }] });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/inventory/purchases/${id}/status`, { payment_status: status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDetail = async (p) => {
    try {
      const res = await api.get(`/inventory/purchases/${p.id}`);
      setDetail(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'purchase_no', label: 'Purchase #', render: (p) => <span className="font-semibold">{p.purchase_no}</span> },
    { key: 'supplier_name', label: 'Supplier', render: (p) => p.supplier_name },
    { key: 'total', label: 'Total', align: 'right', render: (p) => <span className="font-semibold">{naira(p.total)}</span> },
    { key: 'payment_status', label: 'Payment', render: (p) => <Badge status={p.payment_status === 'PAID' ? 'PAID' : 'UNPAID'}>{p.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge> },
    { key: 'created_at', label: 'Date', render: (p) => fmtDateTime(p.created_at) },
    { key: 'created_by_name', label: 'By', render: (p) => p.created_by_name || '—' },
    {
      key: 'actions', label: '', render: (p) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(p); }}><Eye size={14} /></Button>
          {p.payment_status !== 'PAID' && (
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setStatus(p.id, 'PAID'); }}>Mark Paid</Button>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Purchases</h1>
          <p className="text-sm text-ink-500 mt-1">Buy from a supplier — stock goes up.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New purchase</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={payFilter === 'all'} onClick={() => setPayFilter('all')} label="All" count={purchases.length} />
        <FilterChip active={payFilter === 'PAID'} onClick={() => setPayFilter('PAID')} label="Paid" count={purchases.filter((p) => p.payment_status === 'PAID').length} />
        <FilterChip active={payFilter === 'UNPAID'} onClick={() => setPayFilter('UNPAID')} label="Unpaid" count={purchases.filter((p) => p.payment_status !== 'PAID').length} />
      </div>

      <Card>
        <Table
          columns={columns}
          rows={payFilter === 'all' ? purchases : purchases.filter((p) => (payFilter === 'PAID' ? p.payment_status === 'PAID' : p.payment_status !== 'PAID'))}
          empty={{ title: 'No purchases yet', message: 'Buy from a supplier to add stock.' }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase" wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier *</label>
              <select className="input" required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select className="input" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label !mb-0">Items</p>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
            </div>
            <div className="space-y-2">
              {form.lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-center">
                  <select className="input" value={l.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}>
                    <option value="">Select item…</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.quantity} {it.unit})</option>)}
                  </select>
                  <input type="number" className="input" min="1" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
                  <input type="number" className="input" placeholder="Unit ₦" value={l.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold whitespace-nowrap">{naira(lineTotal(l))}</span>
                    {form.lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Note</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          <div className="flex justify-between items-center border-t border-ink-100 pt-3">
            <span className="font-semibold text-ink-800">Total Purchase: {naira(total)}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Create Purchase</Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.purchase_no} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">{detail.supplier_name}</p>
                <p className="text-xs text-ink-400">{fmtDateTime(detail.created_at)}</p>
              </div>
              <Badge status={detail.payment_status === 'PAID' ? 'PAID' : 'UNPAID'}>{detail.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge>
            </div>
            <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
              {(detail.items || []).map((it) => (
                <div key={it.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{it.item_name} × {it.quantity}</span>
                  <span className="font-semibold">{naira(it.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="text-right border-t border-ink-100 pt-3">
              <span className="font-bold text-lg">Total {naira(detail.total)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
