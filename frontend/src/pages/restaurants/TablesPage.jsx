import { useEffect, useState } from 'react';
import { Grid2x2, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { PERM } from '../../utils/permissions.js';

const TABLE_COLORS = {
  AVAILABLE: 'border-green-300 bg-green-50 text-green-700',
  OCCUPIED: 'border-blue-300 bg-blue-50 text-blue-700',
  RESERVED: 'border-amber-300 bg-amber-50 text-amber-700',
};

export default function TablesPage() {
  const { canAccess } = useAuth();
  const { activeRestaurantId, restaurants, loading: restLoading } = useRestaurant();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ restaurant_id: '', table_number: '', capacity: 4, status: 'AVAILABLE' });
  const toast = useToast();

  const loadTables = async (rid) => {
    if (!rid) { setTables([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/restaurants/${rid}/tables`);
      setTables(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (activeRestaurantId) loadTables(activeRestaurantId); }, [activeRestaurantId]);

  useEffect(() => {
    if (form.restaurant_id) {
      const t = restaurants.find((r) => String(r.id) === String(form.restaurant_id));
      if (t && !form.table_number) setForm((f) => ({ ...f, table_number: String((t.tables_count || 0) + 1) }));
    }
  }, [form.restaurant_id]);

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/restaurants/tables/${id}/status`, { status });
      toast.success('Table status updated');
      loadTables(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants/tables', form);
      toast.success('Table created');
      setOpen(false);
      setForm({ restaurant_id: activeRestaurantId || '', table_number: '', capacity: 4, status: 'AVAILABLE' });
      loadTables(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if ((loading && tables.length === 0) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Restaurant Tables</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage seating across outlets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RestaurantSelector />
          {canAccess(PERM.TABLES_MANAGE) && (
            <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Table</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map((t) => (
          <div key={t.id} className={`rounded-xl border-2 p-4 ${TABLE_COLORS[t.status] || 'border-ink-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">Table {t.table_number}</p>
              <Grid2x2 size={18} />
            </div>
            <p className="text-sm mt-1">Seats {t.capacity}</p>
            <div className="mt-3">
              <Badge status={t.status === 'AVAILABLE' ? 'PAID' : t.status === 'OCCUPIED' ? 'OPEN' : 'RESERVED'}>{t.status}</Badge>
            </div>
            <div className="mt-3 flex gap-1.5">
              {canAccess(PERM.TABLES_MANAGE) ? (
                <>
                  <button onClick={() => changeStatus(t.id, 'AVAILABLE')} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">Free</button>
                  <button onClick={() => changeStatus(t.id, 'OCCUPIED')} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">Occupy</button>
                </>
              ) : (
                <Badge status={t.status === 'OCCUPIED' ? 'OPEN' : t.status === 'RESERVED' ? 'RESERVED' : 'PAID'}>{t.status}</Badge>
              )}
            </div>
          </div>
        ))}
        {tables.length === 0 && <div className="col-span-full"><Card><EmptyState title="No tables here" message="Add a table to this restaurant." /></Card></div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Table">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Restaurant</label>
            <select className="input" value={form.restaurant_id || activeRestaurantId || ''} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Table Number</label>
              <input className="input" required value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input type="number" className="input" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
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
