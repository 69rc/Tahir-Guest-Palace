import { useEffect, useMemo, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, FilterChip } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

export default function MenuPage() {
  const { canAccess } = useAuth();
  const { activeRestaurantId, activeRestaurant, loading: restLoading } = useRestaurant();
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', sort_order: 0 });
  const [itemForm, setItemForm] = useState({ category_id: '', name: '', description: '', price: '', cost: '', is_available: true });
  const toast = useToast();
  const canManage = canAccess(PERM.MENU_MANAGE);

  const loadMenu = async (rid) => {
    if (!rid) { setMenu({ categories: [], items: [] }); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/restaurants/${rid}/menu`);
      setMenu(res.data);
      setActiveCat('all');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (activeRestaurantId) loadMenu(activeRestaurantId); }, [activeRestaurantId]);

  const submitCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants/menu-categories', { ...catForm, restaurant_id: activeRestaurantId });
      toast.success('Category added');
      setCatOpen(false);
      setCatForm({ name: '', sort_order: 0 });
      loadMenu(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants/menu-items', { ...itemForm, restaurant_id: activeRestaurantId });
      toast.success('Item added');
      setItemOpen(false);
      setItemForm({ category_id: '', name: '', description: '', price: '', cost: '', is_available: true });
      loadMenu(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailable = async (item) => {
    try {
      await api.put(`/restaurants/menu-items/${item.id}`, { is_available: !item.is_available });
      loadMenu(activeRestaurantId);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const q = search.trim().toLowerCase();
  const searched = useMemo(
    () => (menu.items || []).filter((i) => !q || String(i.name).toLowerCase().includes(q) || String(i.description || '').toLowerCase().includes(q)),
    [menu.items, q]
  );

  const counts = useMemo(() => {
    const map = { all: searched.length, none: 0 };
    (menu.categories || []).forEach((c) => { map[c.id] = 0; });
    searched.forEach((i) => {
      if (i.category_id && map[i.category_id] != null) map[i.category_id] += 1;
      else map.none += 1;
    });
    return map;
  }, [menu.categories, searched]);

  const shown = searched.filter((i) => {
    if (activeCat === 'all') return true;
    if (activeCat === 'none') return !i.category_id;
    return String(i.category_id) === String(activeCat);
  });

  if ((loading && !menu.categories.length && !menu.items.length) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Restaurants</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Menu</h1>
          <p className="text-sm text-ink-500 mt-1">
            {activeRestaurant?.name ? `Dishes at ${activeRestaurant.name}` : 'Pick an outlet, then a category.'}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}><Tag size={16} /> Category</Button>
            <Button onClick={() => setItemOpen(true)}><Plus size={16} /> Add item</Button>
          </div>
        )}
      </div>

      <RestaurantSelector />

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search food…" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="All" count={counts.all} />
          {(menu.categories || []).map((c) => (
            <FilterChip
              key={c.id}
              active={String(activeCat) === String(c.id)}
              onClick={() => setActiveCat(c.id)}
              label={c.name}
              count={counts[c.id] || 0}
            />
          ))}
          {counts.none > 0 && (
            <FilterChip active={activeCat === 'none'} onClick={() => setActiveCat('none')} label="Other" count={counts.none} />
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title={search ? 'Nothing matches' : 'No dishes here'} message="Add a category, then add dishes for this outlet." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {shown.map((i) => (
            <MenuCard key={i.id} item={i} canManage={canManage} onToggle={() => toggleAvailable(i)} />
          ))}
        </div>
      )}

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="New category">
        <form onSubmit={submitCategory} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Main dishes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title="New item">
        <form onSubmit={submitItem} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
              <option value="">None</option>
              {menu.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <textarea className="input" rows={2} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" required value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost (₦)</label>
              <input type="number" className="input" value={itemForm.cost} onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setItemOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function MenuCard({ item, canManage, onToggle }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-stretch">
        <div className={`w-1.5 shrink-0 ${item.is_available ? 'bg-emerald-500' : 'bg-ink-200'}`} />
        <div className="flex-1 p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-ink-900 leading-snug">{item.name}</p>
            {item.category_name && <p className="text-[11px] font-medium text-ink-400 mt-0.5">{item.category_name}</p>}
            {item.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{item.description}</p>}
            {canManage && (
              <button
                type="button"
                onClick={onToggle}
                className="mt-2 text-xs font-semibold text-ink-500 hover:text-ink-800"
              >
                {item.is_available ? 'Mark sold out' : 'Put on sale'}
              </button>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-ink-900 tabular-nums">{naira(item.price)}</p>
            {item.is_available
              ? <Badge status="PAID">On sale</Badge>
              : <Badge status="CANCELLED">Sold out</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
}
