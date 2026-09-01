import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, AlarmClock } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState, Button, Stat } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const TASK_FLOW = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED'];

const PRIORITY_COLOR = {
  URGENT: 'red',
  HIGH: 'amber',
  MEDIUM: 'blue',
  LOW: 'gray',
};
const TASK_COLOR = {
  PENDING: 'gray',
  ASSIGNED: 'blue',
  IN_PROGRESS: 'violet',
  COMPLETED: 'green',
  INSPECTED: 'green',
};

export default function HousekeepingPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [s, t, d] = await Promise.all([
        api.get('/housekeeping/status'),
        api.get('/housekeeping'),
        api.get('/housekeeping/dashboard'),
      ]);
      setStatus(s.data);
      setTasks(t.data);
      setDash(d.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const createTask = async (room, nextStatus) => {
    try {
      await api.post('/housekeeping', { room_id: room.room_id, status: nextStatus });
      toast.success(`Room ${room.room_number} → ${nextStatus}`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const advanceTask = async (task, nextStatus) => {
    try {
      await api.put(`/housekeeping/${task.id}`, { task_status: nextStatus });
      toast.success(`Task for Room ${task.room_number} → ${nextStatus}`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isHousekeepingStaff = user?.role_name === 'HOUSEKEEPING' || user?.role_name === 'MAINTENANCE_STAFF';

  if (loading) return <PageLoader />;

  const counts = status.reduce((a, r) => ({ ...a, [r.hk_status]: (a[r.hk_status] || 0) + 1 }), {});
  const stats = dash?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Housekeeping</h1>
          <p className="text-sm text-ink-500 mt-0.5">Task workflow, room cleanliness and staff workload</p>
        </div>
        <Button variant="secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {/* Task workflow stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Pending" value={stats.pending || 0} color="gray" icon={Sparkles} />
        <Stat label="Assigned" value={stats.assigned || 0} color="blue" icon={Sparkles} />
        <Stat label="In Progress" value={stats.in_progress || 0} color="violet" icon={Sparkles} />
        <Stat label="Completed" value={stats.completed || 0} color="green" icon={Sparkles} />
        <Stat label="Inspected" value={stats.inspected || 0} color="green" icon={Sparkles} />
        <Stat label="Overdue" value={stats.overdue || 0} color="red" icon={AlarmClock} />
      </div>

      {/* Staff workload */}
      {(dash?.staffWorkload || []).length > 0 && (
        <Card>
          <CardHeader title="Staff Workload" subtitle="Active vs completed tasks per housekeeper" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            {dash.staffWorkload.map((s) => (
              <div key={s.id} className="rounded-xl border border-ink-100 p-4">
                <p className="font-bold text-ink-900">{s.full_name}</p>
                <p className="text-xs text-ink-500 mt-0.5">Active: <b className="text-violet-600">{s.active}</b> · Completed today: <b className="text-green-600">{s.completed_today}</b></p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Priority queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming Cleaning" subtitle="Pending and assigned tasks by priority" />
          {(dash?.needsCleaning || []).length === 0 ? (
            <EmptyState title="All caught up" message="No rooms pending cleaning." />
          ) : (
            <div className="divide-y divide-ink-100">
              {dash.needsCleaning.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-800">Room {t.room_number}</p>
                      <Badge status={t.priority}><b>{t.priority}</b></Badge>
                      <Badge status={t.task_status}>{t.task_status}</Badge>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">{t.room_type} · {t.assigned_name || 'Unassigned'}{t.due_time ? ` · Due ${new Date(t.due_time).toLocaleString()}` : ''}</p>
                  </div>
                  {!isHousekeepingStaff && (
                    <button className="btn-secondary !px-2.5 !py-1.5 !text-xs" onClick={() => advanceTask(t, TASK_FLOW[TASK_FLOW.indexOf(t.task_status) + 1])}>
                      Advance
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Overdue Tasks" subtitle="Tasks past their due time" />
          {(dash?.overdueTasks || []).length === 0 ? (
            <EmptyState title="No overdue tasks" />
          ) : (
            <div className="divide-y divide-ink-100">
              {dash.overdueTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <AlarmClock size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">Room {t.room_number}</p>
                    <p className="text-xs text-ink-500">{t.assigned_name || 'Unassigned'} · due {new Date(t.due_time).toLocaleString()}</p>
                  </div>
                  <Badge status={t.priority}>{t.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Room status grid */}
      <Card>
        <CardHeader title="Room Status" subtitle="Click a badge to create a cleaning task" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4">
          {status.map((r) => (
            <div key={r.room_id} className="rounded-xl border border-ink-100 p-3 text-center">
              <p className="font-bold text-ink-900">Room {r.room_number}</p>
              <div className="mt-2">
                <Badge status={r.hk_status === 'INSPECTED' ? 'CLEAN' : (r.hk_status || 'DIRTY')}>{r.hk_status || 'DIRTY'}</Badge>
              </div>
              {r.assigned_name && <p className="text-[11px] text-ink-400 mt-1 truncate">{r.assigned_name}</p>}
              <div className="mt-3 flex justify-center gap-1.5">
                <button title="Mark Dirty" onClick={() => createTask(r, 'DIRTY')}
                  className="p-1.5 rounded-lg text-ink-500 hover:bg-amber-50 hover:text-amber-600 text-xs">Dirty</button>
                <button title="Mark Clean" onClick={() => createTask(r, 'CLEAN')}
                  className="p-1.5 rounded-lg text-ink-500 hover:bg-green-50 hover:text-green-600 text-xs">Clean</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader title="Task Activity" subtitle="All housekeeping tasks across the hotel" />
        {tasks.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          <div className="divide-y divide-ink-100">
            {tasks.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-800">Room {t.room_number}</p>
                    <Badge status={t.task_status}>{t.task_status}</Badge>
                    {t.priority && <Badge status={t.priority}>{t.priority}</Badge>}
                  </div>
                  <p className="text-xs text-ink-500">{t.assigned_name || 'Unassigned'} · {t.note || 'No note'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
