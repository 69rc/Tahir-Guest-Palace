import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Card, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const UNIT = {
  pkg: 'Package',
  head: 'Per person',
  session: 'Session',
  event: 'Per event',
  table: 'Per table',
};

export default function EventServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0, unit: 'pkg' });
  const toast = useToast();
  const { canAccess } = useAuth();
  const canManage = canAccess('event_services:manage');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/events/services'); setServices(r.data); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/events/services', form);
      toast.success('Add-on created');
      setOpen(false);
      setForm({ name: '', description: '', price: 0, unit: 'pkg' });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/events" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Events</Link>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Conference</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Add-ons</h1>
          <p className="text-sm text-ink-500 mt-1">Catering, sound and extras for hall bookings.</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add service</Button>}
      </div>

      {services.length === 0 ? (
        <Card><EmptyState title="No add-ons yet" message="Add catering, AV or decoration packages." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <Card key={s.id} className="p-5 flex flex-col">
              <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <ChefHat size={22} />
              </div>
              <h3 className="mt-3 text-lg font-bold text-ink-900 leading-snug">{s.name}</h3>
              {s.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{s.description}</p>}
              <div className="mt-4 pt-4 border-t border-ink-100 flex items-end justify-between">
                <p className="text-xs text-ink-400">{UNIT[s.unit] || s.unit}</p>
                <p className="text-lg font-bold text-ink-900">{naira(s.price)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add service">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">About it</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Sold as</label>
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {Object.entries(UNIT).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
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
