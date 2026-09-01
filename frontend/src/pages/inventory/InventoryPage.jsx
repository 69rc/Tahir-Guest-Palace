import { useEffect, useState } from 'react';
import { Package, Plus, ArrowLeftRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState, Table, FilterChip } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', unit: 'kg', cost_price: '', selling_price: '', quantity: 0, min_quantity: 0, supplier_id: '' });
  const [adjForm, setAdjForm] = useState({ item_id: '', type: 'ADDITION', quantity: '', note: '' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [i, c, s] = await Promise.all([api.get('/inventory'), api.get('/inventory/categories'), api.get('/inventory/suppliers')]);
      setItems(i.data);
      setCategories(c.data);
      setSuppliers(s.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const isLow = (i) => Number(i.quantity) <= Number(i.min_quantity);
  const filtered = items.filter((i) => {
    if (stockFilter === 'low' && !isLow(i)) return false;
    if (stockFilter === 'ok' && isLow(i)) return false;
    if (catFilter !== 'all' && String(i.category_id) !== String(catFilter) && i.category_name !== catFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name || '').toLowerCase().includes(q) || (i.category_name || '').toLowerCase().includes(q);
  });
  const lowCount = items.filter(isLow).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory', form);
      toast.success('Item created');
      setOpen(false);
      setForm({ name: '', category_id: '', unit: 'kg', cost_price: '', selling_price: '', quantity: 0, min_quantity: 0, supplier_id: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startAdjust = (item) => {
    setAdjustItem(item);
    setAdjForm({ item_id: item.id, type: 'ADDITION', quantity: '', note: '' });
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/adjust', adjForm);
      toast.success('Stock adjusted');
      setAdjustItem(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Item', render: (i) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Package size={16} /></div>
        <div><p className="font-semibold">{i.name}</p><p className="text-xs text-ink-500">{i.category_name || '—'}</p></div>
      </div>
    ) },
    { key: 'unit', label: 'Unit' },
    { key: 'quantity', label: 'In Stock', render: (i) => (
      <span className={`font-bold ${isLow(i) ? 'text-red-600' : 'text-ink-800'}`}>{Number(i.quantity)} <span className="font-normal text-ink-400">/ min {Number(i.min_quantity)}</span></span>
    ) },
    { key: 'stock_status', label: 'Status', render: (i) => isLow(i) ? <Badge status="UNPAID">Needs restock</Badge> : <Badge status="PAID">Enough</Badge> },
    { key: 'cost_price', label: 'Cost', align: 'right', render: (i) => naira(i.cost_price) },
    { key: 'selling_price', label: 'Selling', align: 'right', render: (i) => naira(i.selling_price) },
    { key: 'value', label: 'Stock Value', align: 'right', render: (i) => <span className="font-semibold">{naira(i.cost_price * i.quantity)}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); startAdjust(i); }}><ArrowLeftRight size={14} /> Adjust</Button></div>
    ) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Products</h1>
          <p className="text-sm text-ink-500 mt-1">What the kitchen and store have. Stock drops when you sell.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add item</Button>
      </div>

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={stockFilter === 'all'} onClick={() => setStockFilter('all')} label="All" count={items.length} />
          <FilterChip active={stockFilter === 'ok'} onClick={() => setStockFilter('ok')} label="Enough" count={items.length - lowCount} />
          <FilterChip active={stockFilter === 'low'} onClick={() => setStockFilter('low')} label="Needs restock" count={lowCount} />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={catFilter === 'all'} onClick={() => setCatFilter('all')} label="Every kind" />
            {categories.map((c) => (
              <FilterChip key={c.id} active={String(catFilter) === String(c.id)} onClick={() => setCatFilter(c.id)} label={c.name} />
            ))}
          </div>
        )}
      </div>

      <Card>
        <Table columns={columns} rows={filtered} empty={{ title: 'No items here', message: 'Add rice, oil, drinks — anything you count.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add item" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier</label>
              <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {['kg', 'g', 'litre', 'pcs', 'dozen', 'pack', 'carton'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Opening Qty</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost Price (₦)</label>
              <input type="number" className="input" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Selling Price (₦)</label>
              <input type="number" className="input" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Min Quantity</label>
              <input type="number" className="input" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Item</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!adjustItem} onClose={() => setAdjustItem(null)} title={`Change stock — ${adjustItem?.name}`}>
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="rounded-lg bg-ink-50 p-3 text-sm">Current quantity: <b>{adjustItem?.quantity} {adjustItem?.unit}</b></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}>
              <option value="ADDITION">Add (found extra / received)</option>
              <option value="ADJUSTMENT">Take off (count was high)</option>
              <option value="WASTAGE">Waste (spoiled / thrown)</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity ({adjustItem?.unit})</label>
            <input type="number" className="input" required min="0" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" value={adjForm.note} onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustItem(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Apply</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
