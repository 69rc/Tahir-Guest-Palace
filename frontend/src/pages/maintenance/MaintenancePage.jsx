import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, Badge, SearchInput } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const EMPTY = {
  location: '',
  room_id: '',
  problem_category: 'Plumbing',
  description: '',
  priority: 'MEDIUM',
};

const KINDS = ['Plumbing', 'AC', 'Electrical', 'Leak', 'Furniture', 'Other'];

const STATUS_LABEL = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'Working',
  WAITING_PARTS: 'Waiting parts',
  RESOLVED: 'Fixed',
  CLOSED: 'Closed',
};

const PRIORITY_LABEL = {
  LOW: 'Low',
  MEDIUM: 'Normal',
  HIGH: 'Soon',
  CRITICAL: 'Urgent',
};

function shortName(n) {
  const parts = String(n || '').trim().split(/\s+/);
  return parts[parts.length - 1] || n;
}

function nextFix(status) {
  if (status === 'OPEN' || status === 'ASSIGNED' || status === 'WAITING_PARTS') {
    return { status: 'IN_PROGRESS', label: 'Start' };
  }
  if (status === 'IN_PROGRESS') return { status: 'RESOLVED', label: 'Fixed' };
  return null;
}

function canGiveTicket(status) {
  return status === 'OPEN' || status === 'ASSIGNED';
}

function inFilter(t, filter) {
  if (filter === 'now') return !['RESOLVED', 'CLOSED'].includes(t.status);
  if (filter === 'work') return t.status === 'IN_PROGRESS';
  if (filter === 'parts') return t.status === 'WAITING_PARTS';
  if (filter === 'done') return ['RESOLVED', 'CLOSED'].includes(t.status);
  return true;
}

export default function MaintenancePage() {
  const { user, canAccess } = useAuth();
  const toast = useToast();
  const canManage = canAccess('maintenance:manage');
  const canAssign = canAccess('maintenance:assign');

  const [tickets, setTickets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('now');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [t, people] = await Promise.all([
        api.get('/maintenance'),
        api.get('/maintenance/staff'),
      ]);
      setTickets(t.data);
      setTechnicians(people.data?.technicians || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/rooms').then((r) => setRooms(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const room = rooms.find((r) => String(r.id) === String(form.room_id));
      await api.post('/maintenance', {
        location: form.location || (room ? `Room ${room.room_number}` : ''),
        room_id: form.room_id || null,
        facility: form.room_id ? 'ROOM' : 'GENERAL',
        problem_category: form.problem_category,
        description: form.description,
        priority: form.priority,
      });
      toast.success('Ticket opened');
      setOpen(false);
      setForm(EMPTY);
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
    } catch (e) {
      toast.error(e.message);
    }
  };

  const patch = async (id, body, ok) => {
    try {
      await api.put(`/maintenance/${id}`, body);
      if (ok) toast.success(ok);
      load();
      if (detail?.id === id) {
        const res = await api.get(`/maintenance/${id}`);
        setDetail(res.data);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => tickets.filter((t) => {
    if (!inFilter(t, filter)) return false;
    if (!q) return true;
    return [t.location, t.ticket_no, t.problem_category, t.description, t.reporter_name, t.assigned_name, t.room_number]
      .some((v) => String(v || '').toLowerCase().includes(q));
  }), [tickets, filter, q]);

  const counts = {
    now: tickets.filter((t) => inFilter(t, 'now')).length,
    work: tickets.filter((t) => inFilter(t, 'work')).length,
    parts: tickets.filter((t) => inFilter(t, 'parts')).length,
    done: tickets.filter((t) => inFilter(t, 'done')).length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Hotel</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Maintenance</h1>
        </div>
        {canManage && (
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>
            <Plus size={16} /> Report a problem
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Count label="To do" value={counts.now} onClick={() => setFilter('now')} active={filter === 'now'} />
        <Count label="Working" value={counts.work} onClick={() => setFilter('work')} active={filter === 'work'} />
        <Count label="Parts" value={counts.parts} onClick={() => setFilter('parts')} active={filter === 'parts'} />
        <Count label="Fixed" value={counts.done} onClick={() => setFilter('done')} active={filter === 'done'} />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-3 sm:p-4 shadow-card">
        <SearchInput value={search} onChange={setSearch} placeholder="Search room, reporter or problem…" />
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState title={search ? 'Nothing matches' : 'No tickets here'} message="Report a leak, broken AC or anything that needs a technician." />
        ) : (
          <div className="divide-y divide-ink-100">
            {visible.map((t) => {
              const step = nextFix(t.status);
              return (
                <div key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => openDetail(t)} className="flex-1 min-w-[12rem] text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-800">{t.location}</p>
                      <Badge status={t.priority}>{PRIORITY_LABEL[t.priority] || t.priority}</Badge>
                      <Badge status={t.status}>{STATUS_LABEL[t.status] || t.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Reported by <span className="font-medium text-ink-700">{t.reporter_name || 'Unknown'}</span>
                      {t.assigned_name ? ` · ${shortName(t.assigned_name)}` : ' · Nobody assigned'}
                    </p>
                  </button>
                  {canAssign && canGiveTicket(t.status) && (
                    <select
                      className="input !w-36 !py-1.5 !text-sm"
                      value={String(t.assigned_to || '')}
                      onChange={(e) => patch(t.id, { assigned_to: e.target.value || null, status: e.target.value ? 'ASSIGNED' : t.status }, e.target.value ? 'Assigned' : 'Unassigned')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Give to…</option>
                      {technicians.map((s) => (
                        <option key={s.id} value={String(s.id)}>{shortName(s.full_name)}</option>
                      ))}
                    </select>
                  )}
                  {canManage && step && (
                    <Button size="sm" onClick={() => patch(t.id, { status: step.status }, step.label)}>
                      {step.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Report a problem">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">What is wrong</label>
            <textarea
              className="input"
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. AC not cooling, toilet leaking"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kind</label>
              <select className="input" value={form.problem_category} onChange={(e) => setForm({ ...form, problem_category: e.target.value })}>
                {KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">How urgent</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">Can wait</option>
                <option value="MEDIUM">Normal</option>
                <option value="HIGH">Soon</option>
                <option value="CRITICAL">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Room (if it is a room)</label>
            <select
              className="input"
              value={form.room_id}
              onChange={(e) => {
                const id = e.target.value;
                const room = rooms.find((r) => String(r.id) === String(id));
                setForm({ ...form, room_id: id, location: room ? `Room ${room.room_number}` : form.location });
              }}
            >
              <option value="">Not a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>Room {r.room_number}</option>
              ))}
            </select>
          </div>
          {!form.room_id && (
            <div>
              <label className="label">Where</label>
              <input
                className="input"
                required={!form.room_id}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Pool, kitchen, hall"
              />
            </div>
          )}
          <p className="text-xs text-ink-500">Reporting as {user?.full_name || 'you'}.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Open ticket</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.location || 'Ticket'}>
        {detail && (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">{detail.description}</p>
            <div className="rounded-xl border border-ink-100 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Reported by</span>
                <span className="font-semibold text-ink-900">{detail.reporter_name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Technician</span>
                <span className="font-semibold text-ink-900">{detail.assigned_name || 'Nobody yet'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Kind</span>
                <span>{detail.problem_category}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge status={detail.priority}>{PRIORITY_LABEL[detail.priority] || detail.priority}</Badge>
              <Badge status={detail.status}>{STATUS_LABEL[detail.status] || detail.status}</Badge>
            </div>
            {canAssign && canGiveTicket(detail.status) && (
              <div>
                <label className="label">Give to</label>
                <select
                  className="input"
                  value={String(detail.assigned_to || '')}
                  onChange={(e) => patch(detail.id, { assigned_to: e.target.value || null, status: e.target.value ? 'ASSIGNED' : detail.status }, 'Assigned')}
                >
                  <option value="">Nobody yet</option>
                  {technicians.map((s) => (
                    <option key={s.id} value={String(s.id)}>{shortName(s.full_name)}</option>
                  ))}
                </select>
              </div>
            )}
            {canManage && (
              <div className="flex justify-end gap-2">
                {nextFix(detail.status) && (
                  <Button onClick={() => patch(detail.id, { status: nextFix(detail.status).status }, nextFix(detail.status).label)}>
                    <Wrench size={16} /> {nextFix(detail.status).label}
                  </Button>
                )}
                {detail.status === 'RESOLVED' && (
                  <Button variant="secondary" onClick={() => patch(detail.id, { status: 'CLOSED' }, 'Closed')}>Close</Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Count({ label, value, onClick, active, warn }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 bg-white text-left ${
        warn ? 'border-red-200 bg-red-50/40' : active ? 'border-ink-900' : 'border-ink-100'
      }`}
    >
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-xl font-bold text-ink-900">{value}</p>
    </button>
  );
}
