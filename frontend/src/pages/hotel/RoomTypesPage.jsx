import { useEffect, useState } from 'react';
import { DoorOpen, Plus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, Button, Modal, PageLoader, EmptyState, Badge } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';

export default function RoomTypesPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', base_price: '', capacity: 2, description: '' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rooms/types');
      setTypes(res.data);
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
      await api.post('/rooms/types', form);
      toast.success('Room type created');
      setOpen(false);
      setForm({ name: '', base_price: '', capacity: 2, description: '' });
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
          <h1 className="text-2xl font-bold text-ink-900">Room Types</h1>
          <p className="text-sm text-ink-500 mt-0.5">Categories of accommodation offered</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New Room Type</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <DoorOpen size={22} />
              </div>
              <Badge>{(t.base_price || 0) > 0 ? 'Active' : 'Unpriced'}</Badge>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink-900">{t.name}</h3>
            {t.description && <p className="text-sm text-ink-500 mt-1">{t.description}</p>}
            <div className="mt-4 pt-4 border-t border-ink-100 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm text-ink-600"><Users size={15} /> {t.capacity} guests</p>
              <p className="font-bold text-brand-600">{naira(t.base_price)}</p>
            </div>
          </Card>
        ))}
        {types.length === 0 && <Card><EmptyState title="No room types" message="Create your first room type." /></Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Room Type">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Deluxe Suite" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Base Price (₦)</label>
              <input type="number" className="input" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input type="number" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
