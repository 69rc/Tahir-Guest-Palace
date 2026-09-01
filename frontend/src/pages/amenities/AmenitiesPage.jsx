import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Waves, Dumbbell, Flower2, Scissors, Plus, CalendarClock } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, Badge } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CATEGORY_ICON = {
  POOL: Waves,
  FITNESS: Dumbbell,
  SPA: Flower2,
  BARBERSHOP: Scissors,
};

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'POOL', description: '', location: '', operating_hours: '', price: 0, pricing_type: 'PAID', capacity: 0, status: 'ACTIVE' });
  const toast = useToast();
  const { canAccess } = useAuth();

  const canManage = canAccess('amenities:manage');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/amenities');
      setAmenities(res.data);
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
      await api.post('/amenities', form);
      toast.success('Amenity created');
      setOpen(false);
      setForm({ name: '', category: 'POOL', description: '', location: '', operating_hours: '', price: 0, pricing_type: 'PAID', capacity: 0, status: 'ACTIVE' });
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
          <h1 className="text-2xl font-bold text-ink-900">Amenities &amp; Services</h1>
          <p className="text-sm text-ink-500 mt-0.5">{amenities.length} hotel facilities — pool, fitness, spa &amp; barbershop</p>
        </div>
        <div className="flex gap-2">
          <Link to="/amenities/appointments" className="btn-secondary"><CalendarClock size={16} /> Appointments</Link>
          {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Amenity</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {amenities.map((a) => {
          const Icon = CATEGORY_ICON[a.category] || Waves;
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-ink-900">{a.name}</h3>
                      <Badge status={a.status}>{a.status}</Badge>
                    </div>
                    {a.location && <p className="text-sm text-ink-500">{a.location} · {a.operating_hours || '—'}</p>}
                  </div>
                </div>
              </div>
              {a.description && <p className="text-sm text-ink-500 mt-3">{a.description}</p>}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-sm font-bold text-ink-800">{naira(a.price)}</p>
                  <p className="text-xs text-ink-500">{a.pricing_type}</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-sm font-bold text-ink-800">{a.capacity || 0}</p>
                  <p className="text-xs text-ink-500">Capacity</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-sm font-bold text-ink-800">{a.services_count}</p>
                  <p className="text-xs text-ink-500">Services</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(a.services || []).length === 0 ? (
                  <Link to={`/amenities/${a.id}`} className="btn-secondary !py-1.5 !text-xs">Manage services &amp; bookings</Link>
                ) : (
                  <Link to={`/amenities/${a.id}`} className="btn-secondary !py-1.5 !text-xs">Services &amp; bookings</Link>
                )}
                <Link to="/amenities/appointments" className="btn-secondary !py-1.5 !text-xs">
                  <CalendarClock size={13} className="inline -mt-0.5" /> {a.bookings_count} bookings
                </Link>
              </div>
            </Card>
          );
        })}
        {amenities.length === 0 && <Card><EmptyState title="No amenities" message="Add your first hotel facility." /></Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Amenity">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="POOL">Pool</option>
                <option value="FITNESS">Fitness Center</option>
                <option value="SPA">Spa</option>
                <option value="BARBERSHOP">Barbershop</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Operating Hours</label>
              <input className="input" value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input type="number" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
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
