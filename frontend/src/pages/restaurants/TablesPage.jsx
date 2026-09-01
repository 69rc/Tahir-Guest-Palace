import { useEffect, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, FilterChip } from '../../components/ui/index.jsx';
import { PERM } from '../../utils/permissions.js';

const LOOK = {
  AVAILABLE: {
    label: 'Free',
    tile: 'bg-white border-ink-100',
    pill: 'bg-emerald-50 text-emerald-700',
  },
  OCCUPIED: {
    label: 'Seated',
    tile: 'bg-blue-50/70 border-blue-200',
    pill: 'bg-blue-100 text-blue-800',
  },
  RESERVED: {
    label: 'Reserved',
    tile: 'bg-amber-50/80 border-amber-200',
    pill: 'bg-amber-100 text-amber-800',
  },
};

export default function TablesPage() {
  const { canAccess } = useAuth();
  const { activeRestaurantId, restaurants, loading: restLoading, activeRestaurant } = useRestaurant();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ restaurant_id: '', table_number: '', capacity: 4 });
  const toast = useToast();
  const canManage = canAccess(PERM.TABLES_MANAGE);

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

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/restaurants/tables/${id}/status`, { status });
      loadTables(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants/tables', { ...form, restaurant_id: form.restaurant_id || activeRestaurantId });
      toast.success('Table added');
      setOpen(false);
      setForm({ restaurant_id: activeRestaurantId || '', table_number: '', capacity: 4 });
      loadTables(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => ({
    all: tables.length,
    free: tables.filter((t) => t.status === 'AVAILABLE').length,
    reserved: tables.filter((t) => t.status === 'RESERVED').length,
    seated: tables.filter((t) => t.status === 'OCCUPIED').length,
  }), [tables]);

  const shown = tables.filter((t) => {
    if (filter === 'free') return t.status === 'AVAILABLE';
    if (filter === 'reserved') return t.status === 'RESERVED';
    if (filter === 'seated') return t.status === 'OCCUPIED';
    return true;
  });

  if ((loading && tables.length === 0) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Restaurants</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Tables</h1>
          <p className="text-sm text-ink-500 mt-1">
            {activeRestaurant?.name ? `Floor for ${activeRestaurant.name}` : 'Seat guests, hold a table, or free it.'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setForm({ restaurant_id: activeRestaurantId || '', table_number: '', capacity: 4 }); setOpen(true); }}>
            <Plus size={16} /> Add table
          </Button>
        )}
      </div>

      <RestaurantSelector />

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={counts.all} />
        <FilterChip active={filter === 'free'} onClick={() => setFilter('free')} label="Free" count={counts.free} />
        <FilterChip active={filter === 'reserved'} onClick={() => setFilter('reserved')} label="Reserved" count={counts.reserved} />
        <FilterChip active={filter === 'seated'} onClick={() => setFilter('seated')} label="Seated" count={counts.seated} />
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title="No tables here" message="Add a table for this outlet." /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {shown.map((t) => {
            const look = LOOK[t.status] || LOOK.AVAILABLE;
            return (
              <div key={t.id} className={`rounded-2xl border p-4 flex flex-col ${look.tile}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xl font-bold text-ink-900 tracking-tight">{t.table_number}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${look.pill}`}>
                    {look.label}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
                  <Users size={14} /> {t.capacity} seats
                </p>
                {canManage && (
                  <div className="mt-4 pt-3 border-t border-black/5 flex flex-wrap gap-1.5">
                    {t.status !== 'OCCUPIED' && (
                      <button type="button" onClick={() => changeStatus(t.id, 'OCCUPIED')} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                        Seat
                      </button>
                    )}
                    {t.status !== 'RESERVED' && t.status !== 'OCCUPIED' && (
                      <button type="button" onClick={() => changeStatus(t.id, 'RESERVED')} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200">
                        Reserve
                      </button>
                    )}
                    {t.status !== 'AVAILABLE' && (
                      <button type="button" onClick={() => changeStatus(t.id, 'AVAILABLE')} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-200">
                        Free
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add table">
        <form onSubmit={handleSubmit} className="space-y-4">
          {restaurants.length > 1 && (
            <div>
              <label className="label">Outlet</label>
              <select className="input" value={form.restaurant_id || activeRestaurantId || ''} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Number</label>
              <input className="input" required value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} placeholder="T1" />
            </div>
            <div>
              <label className="label">Seats</label>
              <input type="number" className="input" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

