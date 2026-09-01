import { useEffect, useState } from 'react';
import { Plus, UtensilsCrossed, Coffee, IceCream, Waves } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, Badge } from '../../components/ui/index.jsx';
import { PERM } from '../../utils/permissions.js';
import { isFlagOn } from '../../utils/format.js';

const KINDS = [
  { id: 'RESTAURANT', label: 'Restaurant', Icon: UtensilsCrossed },
  { id: 'CAFE', label: 'Café', Icon: Coffee },
  { id: 'POOLSIDE', label: 'Poolside', Icon: Waves },
  { id: 'GELATERIA', label: 'Gelato', Icon: IceCream },
];

function kindOf(type) {
  return KINDS.find((k) => k.id === type) || KINDS[0];
}

const emptyForm = { name: '', description: '', tax_rate: 7.5, service_charge: 10, outlet_type: 'RESTAURANT' };

export default function RestaurantsPage() {
  const { canAccess } = useAuth();
  const { reload: reloadOutlets } = useRestaurant();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();
  const canManage = canAccess(PERM.RESTAURANTS_MANAGE);

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

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (r) => {
    setEditing(r);
    setForm({
      name: r.name || '',
      description: r.description || '',
      tax_rate: r.tax_rate ?? 0,
      service_charge: r.service_charge ?? 0,
      outlet_type: r.outlet_type || 'RESTAURANT',
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/restaurants/${editing.id}`, form);
        toast.success('Outlet updated');
      } else {
        await api.post('/restaurants', form);
        toast.success('Outlet added');
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      load();
      reloadOutlets({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async (r) => {
    const next = !isFlagOn(r.is_active);
    try {
      const res = await api.put(`/restaurants/${r.id}`, { is_active: next });
      setRestaurants((list) => list.map((x) => (x.id === r.id ? { ...x, ...res.data, is_active: next } : x)));
      reloadOutlets({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Restaurants</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Outlets</h1>
          <p className="text-sm text-ink-500 mt-1">Dining places in the palace — open or close them here.</p>
        </div>
        {canManage && (
          <Button onClick={startAdd}><Plus size={16} /> Add outlet</Button>
        )}
      </div>

      {restaurants.length === 0 ? (
        <Card><EmptyState title="No outlets yet" message="Add a restaurant or café." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurants.map((r) => {
            const kind = kindOf(r.outlet_type);
            const Icon = kind.Icon;
            const openNow = isFlagOn(r.is_active);
            return (
              <Card key={r.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Icon size={22} />
                  </div>
                  <Badge status={openNow ? 'PAID' : 'CANCELLED'}>{openNow ? 'Open' : 'Closed'}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-bold text-ink-900 leading-snug">{r.name}</h3>
                <p className="text-xs font-medium text-ink-400 mt-1">{kind.label}</p>
                {r.description && <p className="text-sm text-ink-500 mt-2 line-clamp-3">{r.description}</p>}
                <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{Number(r.tables_count) || 0}</p>
                    <p className="text-[11px] text-ink-400">Tables</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{Number(r.tax_rate || 0)}%</p>
                    <p className="text-[11px] text-ink-400">Tax</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{Number(r.service_charge || 0)}%</p>
                    <p className="text-[11px] text-ink-400">Service</p>
                  </div>
                </div>
                {canManage && (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="sm" variant={openNow ? 'ghost' : 'primary'} className="flex-1" onClick={() => toggleOpen(r)}>
                      {openNow ? 'Close today' : 'Open'}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit outlet' : 'Add outlet'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Palace Grill" />
          </div>
          <div>
            <label className="label">Kind</label>
            <select className="input" value={form.outlet_type} onChange={(e) => setForm({ ...form, outlet_type: e.target.value })}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">About this place</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tax %</label>
              <input type="number" className="input" step="0.1" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
            </div>
            <div>
              <label className="label">Service %</label>
              <input type="number" className="input" step="0.1" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
