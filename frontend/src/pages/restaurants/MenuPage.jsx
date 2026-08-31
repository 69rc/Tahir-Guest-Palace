import { useEffect, useState } from 'react';
import { BookOpen, Plus, Tag } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function MenuPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catForm, setCatForm] = useState({ restaurant_id: '', name: '', sort_order: 0 });
  const [itemForm, setItemForm] = useState({ restaurant_id: '', category_id: '', name: '', description: '', price: '', cost: '', is_available: true });
  const toast = useToast();

  const loadRestaurants = async () => {
    try {
      const res = await api.get('/restaurants');
      setRestaurants(res.data);
      if (!selected && res.data.length) setSelected(res.data[0].id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadMenu = async (rid) => {
    if (!rid) { setMenu({ categories: [], items: [] }); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/restaurants/${rid}/menu`);
      setMenu(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRestaurants(); }, []);
  useEffect(() => { if (selected) loadMenu(selected); }, [selected]);

  const submitCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurants/menu-categories', { ...catForm, restaurant_id: selected });
      toast.success('Category created');
      setCatOpen(false);
      setCatForm({ restaurant_id: '', name: '', sort_order: 0 });
      loadMenu(selected);
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
      await api.post('/restaurants/menu-items', { ...itemForm, restaurant_id: selected });
      toast.success('Menu item created');
      setItemOpen(false);
      setItemForm({ restaurant_id: '', category_id: '', name: '', description: '', price: '', cost: '', is_available: true });
      loadMenu(selected);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const grouped = menu.categories.map((c) => ({
    ...c,
    items: menu.items.filter((i) => i.category_id === c.id),
  }));

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Menu</h1>
          <p className="text-sm text-ink-500 mt-0.5">Food & beverage catalogue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCatOpen(true)}><Tag size={16} /> Category</Button>
          <Button onClick={() => setItemOpen(true)}><Plus size={16} /> Menu Item</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {restaurants.map((r) => (
          <button key={r.id} onClick={() => setSelected(r.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              String(r.id) === String(selected) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
            }`}>
            {r.name}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <Card><EmptyState title="No menu categories yet" message="Add a category to organize your menu items." /></Card>
      ) : (
        grouped.map((c) => (
          <div key={c.id}>
            <h3 className="text-sm font-bold text-ink-700 mb-2">{c.name}</h3>
            {c.items.length === 0 ? (
              <Card className="p-4 mb-4 text-sm text-ink-500">No items in this category.</Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {c.items.map((i) => (
                  <Card key={i.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <BookOpen size={15} className="text-ink-400 shrink-0" />
                          <p className="font-semibold text-ink-800 truncate">{i.name}</p>
                        </div>
                        {i.description && <p className="text-xs text-ink-500 mt-1">{i.description}</p>}
                      </div>
                      <span className="shrink-0">{i.is_available ? <Badge status="PAID">Available</Badge> : <Badge status="CANCELLED">Sold out</Badge>}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="font-bold text-brand-600">{naira(i.price)}</p>
                      {i.cost > 0 && <p className="text-xs text-ink-400">Cost {naira(i.cost)}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* Category modal */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="New Menu Category">
        <form onSubmit={submitCategory} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Main Dishes" />
          </div>
          <div>
            <label className="label">Sort Order</label>
            <input type="number" className="input" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Category</Button>
          </div>
        </form>
      </Modal>

      {/* Item modal */}
      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title="New Menu Item">
        <form onSubmit={submitItem} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
              <option value="">Uncategorized</option>
              {menu.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost (₦)</label>
              <input type="number" className="input" value={itemForm.cost} onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setItemOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Item</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
