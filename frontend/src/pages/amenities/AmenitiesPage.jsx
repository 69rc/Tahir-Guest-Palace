import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Waves, Dumbbell, Flower2, Scissors, Plus, CalendarClock, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, Badge, FilterChip } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CATEGORIES = [
  { id: 'POOL', label: 'Pool', Icon: Waves },
  { id: 'FITNESS', label: 'Fitness', Icon: Dumbbell },
  { id: 'SPA', label: 'Spa', Icon: Flower2 },
  { id: 'BARBERSHOP', label: 'Barbershop', Icon: Scissors },
  { id: 'OTHER', label: 'Other', Icon: Sparkles },
];

function kindOf(cat) {
  return CATEGORIES.find((k) => k.id === cat) || CATEGORIES[CATEGORIES.length - 1];
}

const emptyForm = {
  name: '', category: 'POOL', description: '', location: '', operating_hours: '',
  price: 0, pricing_type: 'PAID', capacity: 0, status: 'ACTIVE',
};

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
      toast.success('Amenity added');
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async (a) => {
    const next = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/amenities/${a.id}`, { status: next });
      setAmenities((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const counts = useMemo(() => {
    const map = { all: amenities.length };
    CATEGORIES.forEach((c) => { map[c.id] = amenities.filter((a) => a.category === c.id).length; });
    return map;
  }, [amenities]);

  const shown = filter === 'all' ? amenities : amenities.filter((a) => a.category === filter);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Amenities</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Pool, spa &amp; fitness</h1>
          <p className="text-sm text-ink-500 mt-1">Separate from restaurants — these are hotel facilities guests book.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/amenities/appointments" className="btn-secondary"><CalendarClock size={16} /> Bookings</Link>
          {canManage && <Button onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus size={16} /> Add amenity</Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={counts.all} />
        {CATEGORIES.filter((c) => c.id !== 'OTHER' || counts.OTHER).map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} label={c.label} count={counts[c.id] || 0} />
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title="No amenities here" message="Add a pool, spa, gym or barbershop." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((a) => {
            const kind = kindOf(a.category);
            const Icon = kind.Icon;
            const openNow = a.status === 'ACTIVE';
            return (
              <Card key={a.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Icon size={22} />
                  </div>
                  <Badge status={openNow ? 'PAID' : 'CANCELLED'}>{openNow ? 'Open' : 'Closed'}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-bold text-ink-900 leading-snug">{a.name}</h3>
                <p className="text-xs font-medium text-ink-400 mt-1">{kind.label}</p>
                {a.location && <p className="text-sm text-ink-500 mt-2">{a.location}{a.operating_hours ? ` · ${a.operating_hours}` : ''}</p>}
                {a.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{a.description}</p>}
                <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{Number(a.price) > 0 ? naira(a.price) : 'Free'}</p>
                    <p className="text-[11px] text-ink-400">Price</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{a.capacity || 0}</p>
                    <p className="text-[11px] text-ink-400">Seats</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-900">{Number(a.services_count) || 0}</p>
                    <p className="text-[11px] text-ink-400">Services</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/amenities/${a.id}`} className="btn-secondary flex-1 !justify-center text-sm">View</Link>
                  {canManage && (
                    <Button size="sm" variant={openNow ? 'ghost' : 'primary'} className="flex-1" onClick={() => toggleOpen(a)}>
                      {openNow ? 'Close today' : 'Open'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add amenity">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Palace Spa" />
          </div>
          <div>
            <label className="label">Kind</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">About this place</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Where</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Hours</label>
              <input className="input" value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} placeholder="8am – 8pm" />
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
            <Button type="submit" loading={saving}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
