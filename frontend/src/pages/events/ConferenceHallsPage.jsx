import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Card, Badge, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ConferenceHallsPage() {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
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
      toast.success('Conference hall created');
      setOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/events" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Events</Link>
          <h1 className="text-2xl font-bold text-ink-900">Conference Halls</h1>
          <p className="text-sm text-ink-500 mt-0.5">{halls.length} venues</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Hall</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {halls.map((h) => (
          <Card key={h.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><DoorOpen size={24} /></div>
                <div>
                  <h3 className="text-lg font-bold text-ink-900">{h.name}</h3>
                  <p className="text-sm text-ink-500">Capacity {h.capacity} · {h.location || '—'}</p>
                </div>
              </div>
              <Badge status={h.status}>{h.status}</Badge>
            </div>
            {h.description && <p className="text-sm text-ink-500 mt-3">{h.description}</p>}
            <div className="mt-4 rounded-lg bg-ink-50 p-3 text-center">
              <p className="text-sm font-bold text-ink-800">{naira(h.rate)}</p>
              <p className="text-xs text-ink-500">per {h.rate_type}</p>
            </div>
          </Card>
        ))}
        {halls.length === 0 && <Card><EmptyState title="No halls" message="Add your conference venues." /></Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Conference Hall">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Capacity</label>
              <input type="number" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div>
              <label className="label">Rate (₦/day)</label>
              <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
