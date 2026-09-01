import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, Plus, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Modal, PageLoader, Table, Card } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

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
      toast.success('Event service created');
      setOpen(false);
      setForm({ name: '', description: '', price: 0, unit: 'pkg' });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/events" className="btn-secondary !py-1.5 !text-xs mb-2 inline-flex items-center gap-1"><ArrowLeft size={14} /> Events</Link>
          <h1 className="text-2xl font-bold text-ink-900">Event Services</h1>
          <p className="text-sm text-ink-500 mt-0.5">Catering, AV &amp; equipment add-ons for events</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Service</Button>}
      </div>

      <Card>
        <Table
          columns={[
            { key: 'name', label: 'Service', render: (r) => (<span className="flex items-center gap-2"><ChefHat size={16} className="text-brand-600" />{r.name}</span>) },
            { key: 'description', label: 'Description' },
            { key: 'unit', label: 'Unit' },
            { key: 'price', label: 'Price', align: 'right', render: (r) => naira(r.price) },
          ]}
          rows={services}
          empty={{ title: 'No event services', message: 'Add catering, AV and equipment services.' }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Event Service">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (₦)</label>
              <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="pkg">Package</option>
                <option value="head">Per head</option>
                <option value="session">Session</option>
                <option value="event">Event</option>
                <option value="table">Table</option>
              </select>
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
