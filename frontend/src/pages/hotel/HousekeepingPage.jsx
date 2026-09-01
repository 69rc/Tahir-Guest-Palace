import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const STEP = {
  PENDING: 'Waiting',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'Cleaning',
  COMPLETED: 'Done',
  INSPECTED: 'Ready',
};

function shortName(n) {
  const parts = String(n || '').trim().split(/\s+/);
  return parts[parts.length - 1] || n;
}

function nextStep(status) {
  if (status === 'PENDING' || status === 'ASSIGNED') return { status: 'IN_PROGRESS', label: 'Start' };
  if (status === 'IN_PROGRESS') return { status: 'COMPLETED', label: 'Done' };
  if (status === 'COMPLETED') return { status: 'INSPECTED', label: 'Ready' };
  return null;
}

function canGiveTask(status) {
  return status === 'PENDING' || status === 'ASSIGNED';
}

function roomLook(r) {
  const hk = r.hk_status;
  const rs = r.room_status;
  if (rs === 'MAINTENANCE' || rs === 'OUT_OF_ORDER') {
    return { key: 'broken', label: 'Broken', box: 'border-red-200 bg-red-50', text: 'text-red-700' };
  }
  if (rs === 'OCCUPIED' || rs === 'RESERVED') {
    return { key: 'occupied', label: rs === 'RESERVED' ? 'Reserved' : 'Occupied', box: 'border-blue-200 bg-blue-50', text: 'text-blue-700' };
  }
  if (hk === 'IN_PROGRESS') {
    return { key: 'cleaning', label: 'Cleaning', box: 'border-violet-200 bg-violet-50', text: 'text-violet-700' };
  }
  if (hk === 'PENDING' || hk === 'ASSIGNED') {
    return { key: 'waiting', label: 'Waiting', box: 'border-amber-200 bg-amber-50', text: 'text-amber-700' };
  }
  if (hk === 'COMPLETED') {
    return { key: 'done', label: 'Done', box: 'border-amber-200 bg-amber-50', text: 'text-amber-700' };
  }
  if (rs === 'CLEANING' || rs === 'DIRTY') {
    return { key: 'waiting', label: 'Waiting', box: 'border-amber-200 bg-amber-50', text: 'text-amber-700' };
  }
  return { key: 'ready', label: 'Ready', box: 'border-ink-100 bg-white', text: 'text-emerald-700' };
}

export default function HousekeepingPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('clean');
  const [roomFilter, setRoomFilter] = useState('all');
  const toast = useToast();

  const staff = dash?.staffWorkload || [];
  const isHkStaffOnly = user?.role_name === 'HOUSEKEEPING_STAFF';
  const myId = user?.id;

  const load = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        api.get('/housekeeping/status'),
        api.get('/housekeeping/dashboard'),
      ]);
      setRooms(s.data);
      setDash(d.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateTask = async (task, body, ok) => {
    try {
      await api.put(`/housekeeping/${task.id}`, body);
      toast.success(ok);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const assignTask = async (task, staffId) => {
    if (!staffId) return;
    const name = staff.find((s) => String(s.id) === String(staffId))?.full_name || 'staff';
    await updateTask(task, { assigned_to: Number(staffId), task_status: 'ASSIGNED' }, `Room ${task.room_number} → ${name}`);
  };

  const markDirty = async (room) => {
    try {
      await api.post('/housekeeping', { room_id: room.room_id, status: 'DIRTY' });
      toast.success(`Room ${room.room_number} needs cleaning`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const q = search.trim().toLowerCase();
  const queue = useMemo(() => {
    const list = dash?.needsCleaning || [];
    return list.filter((t) => {
      if (isHkStaffOnly && t.assigned_to && Number(t.assigned_to) !== Number(myId)) return false;
      if (!q) return true;
      return [t.room_number, t.assigned_name, t.note].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [dash, q, isHkStaffOnly, myId]);

  const inspect = useMemo(() => {
    const list = dash?.readyToInspect || [];
    if (!q) return list;
    return list.filter((t) => String(t.room_number || '').toLowerCase().includes(q));
  }, [dash, q]);

  const roomList = useMemo(() => {
    if (!q) return rooms;
    return rooms.filter((r) => String(r.room_number || '').toLowerCase().includes(q));
  }, [rooms, q]);

  const roomsWithLook = useMemo(() => roomList.map((r) => ({ ...r, look: roomLook(r) })), [roomList]);
  const roomsShown = useMemo(() => {
    if (roomFilter === 'all') return roomsWithLook;
    return roomsWithLook.filter((r) => r.look.key === roomFilter);
  }, [roomsWithLook, roomFilter]);

  const roomCounts = useMemo(() => ({
    all: roomsWithLook.length,
    waiting: roomsWithLook.filter((r) => r.look.key === 'waiting').length,
    cleaning: roomsWithLook.filter((r) => r.look.key === 'cleaning').length,
    done: roomsWithLook.filter((r) => r.look.key === 'done').length,
    ready: roomsWithLook.filter((r) => r.look.key === 'ready').length,
    occupied: roomsWithLook.filter((r) => r.look.key === 'occupied').length,
    broken: roomsWithLook.filter((r) => r.look.key === 'broken').length,
  }), [roomsWithLook]);

  const floors = [...new Set(roomsShown.map((r) => r.floor))].sort((a, b) => Number(a) - Number(b));
  const waiting = queue.filter((t) => t.task_status === 'PENDING' || t.task_status === 'ASSIGNED').length;
  const cleaning = queue.filter((t) => t.task_status === 'IN_PROGRESS').length;
  const late = Number(dash?.stats?.overdue || 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Hotel</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Housekeeping</h1>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Count label="Waiting" value={waiting} onClick={() => setTab('clean')} active={tab === 'clean'} />
        <Count label="Cleaning" value={cleaning} onClick={() => setTab('clean')} />
        <Count label="Ready" value={inspect.length} onClick={() => setTab('ready')} active={tab === 'ready'} />
        <Count label="Late" value={late} warn={late > 0} />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-3 sm:p-4 shadow-card space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search room…" />
        <div className="flex gap-2">
          <TabChip active={tab === 'clean'} onClick={() => setTab('clean')} label="To clean" count={queue.length} />
          <TabChip active={tab === 'ready'} onClick={() => setTab('ready')} label="Ready" count={inspect.length} />
          <TabChip active={tab === 'rooms'} onClick={() => setTab('rooms')} label="Rooms" count={roomCounts.all} />
        </div>
      </div>

      {staff.length > 0 && tab === 'clean' && (
        <p className="text-xs text-ink-500 px-1">
          {staff.map((s) => `${shortName(s.full_name)} ${Number(s.active) || 0}`).join(' · ')}
        </p>
      )}

      {tab === 'clean' && (
        <Card>
          {queue.length === 0 ? (
            <EmptyState title={search ? 'No matching room' : 'Nothing to clean'} message="Dirty rooms after check-out show here." />
          ) : (
            <div className="divide-y divide-ink-100">
              {queue.map((t) => {
                const step = nextStep(t.task_status);
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-800">Room {t.room_number}</p>
                        <Badge status={t.task_status}>{STEP[t.task_status]}</Badge>
                      </div>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {t.assigned_name ? shortName(t.assigned_name) : 'Nobody yet'}
                        {t.note ? ` · ${t.note}` : ''}
                      </p>
                    </div>
                    {!isHkStaffOnly && canGiveTask(t.task_status) && (
                      <select
                        className="input !w-36 !py-1.5 !text-sm"
                        value={String(t.assigned_to || '')}
                        onChange={(e) => assignTask(t, e.target.value)}
                      >
                        <option value="">Give to…</option>
                        {staff.map((s) => (
                          <option key={s.id} value={String(s.id)}>{shortName(s.full_name)}</option>
                        ))}
                      </select>
                    )}
                    {isHkStaffOnly && !t.assigned_to && (
                      <Button size="sm" variant="secondary" onClick={() => assignTask(t, myId)}>Take</Button>
                    )}
                    {step && (
                      <Button
                        size="sm"
                        onClick={() => updateTask(
                          t,
                          {
                            task_status: step.status,
                            ...(step.status === 'INSPECTED' ? { status: 'INSPECTED' } : {}),
                            ...(step.status === 'COMPLETED' ? { status: 'CLEAN' } : {}),
                          },
                          `Room ${t.room_number} — ${step.label.toLowerCase()}`
                        )}
                      >
                        {step.label}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'ready' && (
        <Card>
          {inspect.length === 0 ? (
            <EmptyState title="None waiting" message="When a room is cleaned it shows here. Tap Ready so front desk can give it out." />
          ) : (
            <div className="divide-y divide-ink-100">
              {inspect.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">Room {t.room_number}</p>
                    <p className="text-xs text-ink-500">{t.assigned_name || 'Unassigned'}</p>
                  </div>
                  {!isHkStaffOnly && (
                    <Button size="sm" onClick={() => updateTask(t, { task_status: 'INSPECTED', status: 'INSPECTED' }, `Room ${t.room_number} is ready`)}>
                      Ready
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'rooms' && (
        <Card>
          <div className="px-4 pt-3 pb-2 space-y-2">
            <p className="text-xs text-ink-500">Waiting and cleaning rooms stay marked until they are done. Tap a ready room if it needs cleaning.</p>
            <div className="flex flex-wrap gap-2">
              <TabChip active={roomFilter === 'all'} onClick={() => setRoomFilter('all')} label="All" count={roomCounts.all} />
              <TabChip active={roomFilter === 'waiting'} onClick={() => setRoomFilter('waiting')} label="Waiting" count={roomCounts.waiting} />
              <TabChip active={roomFilter === 'cleaning'} onClick={() => setRoomFilter('cleaning')} label="Cleaning" count={roomCounts.cleaning} />
              <TabChip active={roomFilter === 'done'} onClick={() => setRoomFilter('done')} label="Done" count={roomCounts.done} />
              <TabChip active={roomFilter === 'ready'} onClick={() => setRoomFilter('ready')} label="Ready" count={roomCounts.ready} />
            </div>
          </div>
          {floors.map((floor) => (
            <div key={floor} className="px-4 pb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Floor {floor}</h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {roomsShown.filter((r) => r.floor === floor).map((r) => {
                  const ready = r.look.key === 'ready';
                  return (
                    <button
                      key={r.room_id}
                      type="button"
                      disabled={!ready}
                      onClick={() => ready && markDirty(r)}
                      className={`rounded-lg border px-2 py-2 text-center ${r.look.box} ${ready ? '' : 'cursor-default'}`}
                    >
                      <p className="text-sm font-bold text-ink-900">{r.room_number}</p>
                      <p className={`text-[10px] font-semibold ${r.look.text}`}>{r.look.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {roomsShown.length === 0 && (
            <EmptyState title="No rooms here" message="Try another status." />
          )}
        </Card>
      )}
    </div>
  );
}

function Count({ label, value, hint, warn, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 bg-white text-left ${
        warn ? 'border-red-200 bg-red-50/40' : active ? 'border-ink-900' : 'border-ink-100'
      }`}
    >
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`text-xl font-bold ${warn ? 'text-red-700' : 'text-ink-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-ink-400 mt-0.5">{hint}</p>}
    </button>
  );
}

function TabChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border ${
        active ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-50 text-ink-600 border-ink-100'
      }`}
    >
      {label}
      <span className={active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
    </button>
  );
}
