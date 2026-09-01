import { useEffect, useState } from 'react';
import { Truck, Plus, Phone, Mail, MapPin } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/suppliers');
      setSuppliers(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/suppliers', form);
      toast.success('Supplier created');
      setOpen(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [s.name, s.contact_person, s.phone].some((v) => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Suppliers</h1>
          <p className="text-sm text-ink-500 mt-1">Who you buy rice, oil, drinks, and cleaning from.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add supplier</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers…" className="max-w-sm" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No suppliers" message="Add suppliers for your purchases." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filtered.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-ink-100 hover:shadow-card transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Truck size={20} /></div>
                  <div>
                    <p className="font-bold text-ink-800">{s.name}</p>
                    {s.contact_person && <p className="text-xs text-ink-500">{s.contact_person}</p>}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-ink-600">
                  {s.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-ink-400" /> {s.phone}</p>}
                  {s.email && <p className="flex items-center gap-2 truncate"><Mail size={14} className="text-ink-400" /> {s.email}</p>}
                  {s.address && <p className="flex items-center gap-2 truncate"><MapPin size={14} className="text-ink-400" /> {s.address}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Supplier" wide>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Supplier</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
