import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Plus, Grid2x2, Wallet } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', tax_rate: 7.5, service_charge: 10 });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/restaurants');
      setRestaurants(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants', form);
      toast.success('Restaurant created');
      setOpen(false);
      setForm({ name: '', description: '', tax_rate: 7.5, service_charge: 10 });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Restaurants</h1>
          <p className="text-sm text-ink-500 mt-0.5">{restaurants.length} dining outlets</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Restaurant</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {restaurants.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <UtensilsCrossed size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink-900">{r.name}</h3>
                  {r.description && <p className="text-sm text-ink-500">{r.description}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-500">Tax {r.tax_rate}% · Svc {r.service_charge}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="flex items-center justify-center gap-1 text-sm font-bold text-ink-800"><Grid2x2 size={14} /> {r.tables_count}</p>
                <p className="text-xs text-ink-500">Tables</p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="flex items-center justify-center gap-1 text-sm font-bold text-ink-800"><Wallet size={14} /> {r.active_orders}</p>
                <p className="text-xs text-ink-500">Active</p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-sm font-bold text-ink-800">{naira(r.tax_rate, true)}</p>
                <p className="text-xs text-ink-500">Tax</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/restaurants/pos" className="btn-primary !py-1.5 !text-xs">Open POS</Link>
              <Link to="/restaurants/menu" className="btn-secondary !py-1.5 !text-xs">Menu</Link>
              <Link to="/restaurants/tables" className="btn-secondary !py-1.5 !text-xs">Tables</Link>
              <Link to="/restaurants/orders" className="btn-secondary !py-1.5 !text-xs">Orders</Link>
            </div>
          </Card>
        ))}
        {restaurants.length === 0 && <Card><EmptyState title="No restaurants" message="Create your first restaurant." /></Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Restaurant">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tax Rate (%)</label>
              <input type="number" className="input" step="0.1" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
            </div>
            <div>
              <label className="label">Service Charge (%)</label>
              <input type="number" className="input" step="0.1" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
