import { useEffect, useState } from 'react';
import { BedDouble, Plus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({ room_number: '', room_type_id: '', floor: 1, price_per_night: '', status: 'AVAILABLE', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.get('/rooms'), api.get('/rooms/types')]);
      setRooms(r.data);
      setTypes(t.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rooms.filter((r) => {
    const m = search ? (r.room_number.includes(search) || (r.room_type || '').toLowerCase().includes(search.toLowerCase()) || (r.current_guest || '').toLowerCase().includes(search.toLowerCase())) : true;
    const f = filter ? r.status === filter : true;
    return m && f;
  });

  const counts = rooms.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/rooms', form);
      toast.success('Room created');
      setOpen(false);
      setForm({ room_number: '', room_type_id: '', floor: 1, price_per_night: '', status: 'AVAILABLE', description: '' });
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
          <h1 className="text-2xl font-bold text-ink-900">Rooms</h1>
          <p className="text-sm text-ink-500 mt-0.5">{rooms.length} rooms in the property</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Room</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'].map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? '' : s)}
            className={`text-left p-4 rounded-xl border transition-colors ${filter === s ? 'border-brand-400 bg-brand-50' : 'bg-white border-ink-100 hover:border-ink-200'}`}>
            <p className="text-2xl font-bold text-ink-900">{counts[s] || 0}</p>
            <p className="text-xs font-medium text-ink-500 capitalize">{s.toLowerCase()}</p>
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by room, type or guest…" className="max-w-sm" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No rooms found" message="Try adjusting your search or filters." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-ink-100 p-4 hover:shadow-card transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-ink-900">Room {r.room_number}</p>
                    <p className="text-xs text-ink-500">Floor {r.floor} · {r.room_type}</p>
                  </div>
                  <Badge status={r.status}>{r.status}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink-600">
                  <p className="flex items-center gap-2"><Users size={15} className="text-ink-400" /> Capacity {r.capacity}</p>
                  <p className="font-semibold text-ink-900">{naira(r.price_per_night)}<span className="font-normal text-ink-500">/night</span></p>
                  {r.current_guest && (
                    <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5">
                      <BedDouble size={14} /> {r.current_guest}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Room">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Room Number</label>
              <input className="input" required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} placeholder="205" />
            </div>
            <div>
              <label className="label">Floor</label>
              <input type="number" className="input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Room Type</label>
            <select className="input" value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
              <option value="">Select type…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price / Night (₦)</label>
              <input type="number" className="input" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Room</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
