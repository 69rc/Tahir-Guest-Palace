import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Plus, ArrowLeft, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Card, Badge, EmptyState, FilterChip } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ConferenceHallsPage() {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', capacity: 120, location: '', description: '', rate: 150000, rate_type: 'DAILY', status: 'AVAILABLE' });
  const toast = useToast();
  const { canAccess } = useAuth();
  const canManage = canAccess('halls:manage');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/events/halls'); setHalls(r.data); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/events/halls', form);
      toast.success('Hall added');
      setOpen(false);
      setForm({ name: '', capacity: 120, location: '', description: '', rate: 150000, rate_type: 'DAILY', status: 'AVAILABLE' });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const toggle = async (h) => {
    const next = h.status === 'AVAILABLE' ? 'RESERVED' : 'AVAILABLE';
    try {
      await api.put(`/events/halls/${h.id}`, { status: next });
      setHalls((list) => list.map((x) => (x.id === h.id ? { ...x, status: next } : x)));
    } catch (e) { toast.error(e.message); }
  };

  const counts = useMemo(() => ({
    all: halls.length,
    free: halls.filter((h) => h.status === 'AVAILABLE').length,
    booked: halls.filter((h) => h.status !== 'AVAILABLE').length,
  }), [halls]);

  const shown = halls.filter((h) => {
    if (filter === 'free') return h.status === 'AVAILABLE';
    if (filter === 'booked') return h.status !== 'AVAILABLE';
    return true;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/events" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Events</Link>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Conference</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Halls</h1>
          <p className="text-sm text-ink-500 mt-1">Venues for meetings and events — not restaurant tables.</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add hall</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={counts.all} />
        <FilterChip active={filter === 'free'} onClick={() => setFilter('free')} label="Free" count={counts.free} />
        <FilterChip active={filter === 'booked'} onClick={() => setFilter('booked')} label="Booked" count={counts.booked} />
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState title="No halls here" message="Add a conference venue." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((h) => {
            const free = h.status === 'AVAILABLE';
            return (
              <Card key={h.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <DoorOpen size={22} />
                  </div>
                  <Badge status={free ? 'PAID' : 'RESERVED'}>{free ? 'Free' : 'Booked'}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-bold text-ink-900 leading-snug">{h.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                  <Users size={14} /> {h.capacity || 0} seats{h.location ? ` · ${h.location}` : ''}
                </p>
                {h.description && <p className="text-sm text-ink-500 mt-2 line-clamp-2">{h.description}</p>}
                <div className="mt-4 pt-4 border-t border-ink-100 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-ink-900">{naira(h.rate)}</p>
                    <p className="text-[11px] text-ink-400">per {h.rate_type === 'HOURLY' ? 'hour' : 'day'}</p>
                  </div>
                  {canManage && (
                    <Button size="sm" variant={free ? 'ghost' : 'secondary'} onClick={() => toggle(h)}>
                      {free ? 'Mark booked' : 'Mark free'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add hall">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Seats</label>
              <input type="number" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div>
              <label className="label">Rate (₦/day)</label>
              <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Where</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">About this hall</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
