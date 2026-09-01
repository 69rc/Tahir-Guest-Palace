import { useEffect, useState } from 'react';
import { Wrench, Plus, AlertTriangle, ClipboardList, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, Badge, Stat, Table, SearchInput } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const EMPTY_FORM = {
  location: '', room_id: '', facility: 'GENERAL', problem_category: '', description: '',
  priority: 'MEDIUM', estimated_cost: 0,
};

export default function MaintenancePage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [dOpen, setDOpen] = useState(false);
  const toast = useToast();
  const { canAccess } = useAuth();

  const canManage = canAccess('maintenance:manage');
  const canAssign = canAccess('maintenance:assign');

  const load = async () => {
    setLoading(true);
    try {
      const [t, s, dash] = await Promise.all([
        api.get('/maintenance'),
        api.get('/staff'),
        api.get('/maintenance/dashboard'),
      ]);
      setTickets(t.data);
      setStats(dash.data);
      setStaff(s.data.filter((u) => u.department === 'MAINTENANCE' || u.role_name === 'MAINTENANCE_STAFF'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  const loadRooms = async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { load(); loadRooms(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/maintenance', {
        ...form,
        room_id: form.room_id || null,
        estimated_cost: Number(form.estimated_cost) || 0,
      });
      toast.success('Maintenance ticket created');
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (t) => {
    try {
      const res = await api.get(`/maintenance/${t.id}`);
      setDetail(res.data);
      setDOpen(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/maintenance/${id}`, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const changePriority = async (id, priority) => {
    try {
      await api.put(`/maintenance/${id}`, { priority });
      toast.success(`Priority set to ${priority}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const assignTicket = async (id, assignedTo) => {
    try {
      await api.put(`/maintenance/${id}`, { assigned_to: assignedTo || null, status: assignedTo ? 'ASSIGNED' : undefined });
      toast.success(assignedTo ? 'Assigned' : 'Unassigned');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const issuePart = async (ticketId, partId) => {
    try {
      await api.put(`/maintenance/${ticketId}/parts/${partId}/issue`);
      toast.success('Part issued — inventory updated');
      openDetail(detail);
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <PageLoader />;

  const filtered = tickets.filter((t) =>
    !search || t.ticket_no.toLowerCase().includes(search.toLowerCase()) ||
    t.location.toLowerCase().includes(search.toLowerCase()) ||
    (t.problem_category || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'ticket_no', label: 'Ticket' },
    { key: 'location', label: 'Location', render: (r) => <span className="font-medium">{r.location}</span> },
    { key: 'facility', label: 'Facility', render: (r) => r.facility },
    { key: 'problem_category', label: 'Category' },
    { key: 'priority', label: 'Priority', render: (r) => <Badge status={r.priority}>{r.priority}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { key: 'assigned_name', label: 'Technician' },
    { key: 'created_at', label: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Maintenance</h1>
          <p className="text-sm text-ink-500 mt-0.5">Track facility, room &amp; equipment maintenance</p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Report Issue</Button>}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Stat label="Open" value={stats.stats.open} icon={ClipboardList} color="amber" />
          <Stat label="In Progress" value={stats.stats.in_progress} icon={Wrench} color="blue" />
          <Stat label="Waiting Parts" value={stats.stats.waiting_parts} icon={AlertTriangle} color="violet" />
          <Stat label="Critical" value={stats.stats.critical} icon={AlertTriangle} color="red" />
          <Stat label="Resolved" value={stats.stats.resolved} icon={CheckCircle2} color="green" />
          <Stat label="Out of Order" value={(stats.byFacility.find(f=>f.facility==='ROOM')?.open_count||0)} icon={AlertTriangle} color="red" />
        </div>
      )}

      {stats?.outOfOrderRooms?.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50/50">
          <h3 className="text-sm font-bold text-red-700 mb-2">Rooms Out of Order</h3>
          <div className="flex flex-wrap gap-2">
            {stats.outOfOrderRooms.map((r) => (
              <span key={r.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {r.room_number} — {r.problem_category} ({r.priority})
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4 flex items-center justify-between border-b border-ink-100">
          <h3 className="text-sm font-bold text-ink-800">Tickets</h3>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tickets…" className="w-64" />
        </div>
        <Table
          columns={columns}
          rows={filtered}
          keyField="id"
          onRowClick={openDetail}
          empty={{ title: 'No maintenance tickets' }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Report Maintenance Issue" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 208, Pool area, Main kitchen" required />
            </div>
            <div>
              <label className="label">Facility</label>
              <select className="input" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })}>
                {['GENERAL','ROOM','RESTAURANT','CONFERENCE_HALL','POOL','FITNESS_CENTER','SPA','BARBERSHOP','KITCHEN'].map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Room (optional)</label>
              <select className="input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                <option value="">— None —</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Problem Category</label>
              <input className="input" value={form.problem_category} onChange={(e) => setForm({ ...form, problem_category: e.target.value })} placeholder="e.g. AC_REPAIR, PLUMBING" required />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="label">Estimated Cost (₦)</label>
              <input type="number" min="0" className="input" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Ticket</Button>
          </div>
        </form>
      </Modal>

      <Modal open={dOpen} onClose={() => setDOpen(false)} title={detail?.ticket_no || 'Ticket'} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink-900">{detail.location}</p>
                <p className="text-xs text-ink-500">{detail.facility} · {detail.problem_category} · {detail.description}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge status={detail.priority}>{detail.priority}</Badge>
                <Badge status={detail.status}>{detail.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><p className="text-ink-500">Reported by</p><p className="font-medium">{detail.reporter_name || '—'}</p></div>
              <div><p className="text-ink-500">Assigned to</p><p className="font-medium">{detail.assigned_name || 'Unassigned'}</p></div>
              <div><p className="text-ink-500">Est. cost</p><p className="font-medium">{naira(detail.estimated_cost)}</p></div>
              <div><p className="text-ink-500">Actual cost</p><p className="font-medium">{naira(detail.actual_cost)}</p></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['ASSIGNED','IN_PROGRESS','WAITING_PARTS','RESOLVED','CLOSED'].map((s) => (
                <Button key={s} size="sm" variant={detail.status === s ? 'primary' : 'secondary'} onClick={() => changeStatus(detail.id, s)}>{s}</Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-ink-500">Priority:</span>
              {['LOW','MEDIUM','HIGH','CRITICAL'].map((p) => (
                <Button key={p} size="sm" variant={detail.priority === p ? 'primary' : 'ghost'} onClick={() => changePriority(detail.id, p)}>{p}</Button>
              ))}
            </div>

            {canAssign && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-500">Assign:</span>
                <select className="input !w-auto" value={detail.assigned_to || ''} onChange={(e) => assignTicket(detail.id, e.target.value)}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
            )}

            {detail.parts?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-ink-800 mb-2">Required Parts</h4>
                <div className="space-y-1">
                  {detail.parts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-ink-50 px-3 py-2 rounded">
                      <span className="text-sm">{p.item_name} × {p.quantity}</span>
                      {p.issued ? <Badge status="CLOSED">Issued</Badge> : (
                        <Button size="sm" variant="primary" onClick={() => issuePart(detail.id, p.id)}><CheckCircle2 size={14} /> Issue</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
