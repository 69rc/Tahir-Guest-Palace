import { useEffect, useState } from 'react';
import { Sparkles, Check, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState, Button } from '../../components/ui/index.jsx';
import { fmtDateTime } from '../../utils/format.js';

const STATUS_STYLES = {
  CLEAN: 'text-green-700 bg-green-50 border-green-200',
  DIRTY: 'text-ink-600 bg-ink-50 border-ink-200',
  CLEANING: 'text-violet-700 bg-violet-50 border-violet-200',
  INSPECTED: 'text-green-700 bg-green-50 border-green-200',
  MAINTENANCE: 'text-red-700 bg-red-50 border-red-200',
};

export default function HousekeepingPage() {
  const [status, setStatus] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.get('/housekeeping/status'), api.get('/housekeeping')]);
      setStatus(s.data);
      setTasks(t.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const update = async (room, next) => {
    try {
      await api.post('/housekeeping', { room_id: room.room_id, status: next });
      toast.success(`Room ${room.room_number} marked ${next}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <PageLoader />;

  const counts = status.reduce((a, r) => ({ ...a, [r.hk_status]: (a[r.hk_status] || 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Housekeeping</h1>
          <p className="text-sm text-ink-500 mt-0.5">Room cleanliness and maintenance status</p>
        </div>
        <Button variant="secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[['CLEAN', 'green-500'], ['DIRTY', 'gray-400'], ['CLEANING', 'violet-500'], ['INSPECTED', 'green-500'], ['MAINTENANCE', 'red-500']].map(([s, c]) => (
          <div key={s} className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-2xl font-bold text-ink-900">{counts[s] || 0}</p>
            <p className="text-xs font-medium text-ink-500 capitalize">{s.toLowerCase()}</p>
            <span className={`inline-block mt-1.5 w-2.5 h-2.5 rounded-full bg-${c}`} />
          </div>
        ))}
      </div>

      {/* Room grid */}
      <Card>
        <CardHeader title="Room Status" subtitle="Click a status to advance" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4">
          {status.map((r) => (
            <div key={r.room_id} className="rounded-xl border border-ink-100 p-3 text-center">
              <p className="font-bold text-ink-900">Room {r.room_number}</p>
              <div className="mt-2">
                <Badge status={r.hk_status === 'INSPECTED' ? 'CLEAN' : r.hk_status}>{r.hk_status}</Badge>
              </div>
              <div className="mt-3 flex justify-center gap-1.5">
                <button title="Mark Cleaning" onClick={() => update(r, 'CLEANING')}
                  className="p-1.5 rounded-lg text-ink-500 hover:bg-violet-50 hover:text-violet-600">
                  <RefreshCw size={14} />
                </button>
                <button title="Mark Clean" onClick={() => update(r, 'CLEAN')}
                  className="p-1.5 rounded-lg text-ink-500 hover:bg-green-50 hover:text-green-600">
                  <Check size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader title="Housekeeping Activity" subtitle="Recent task updates" />
        {tasks.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="divide-y divide-ink-100">
            {tasks.slice(0, 12).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">Room {t.room_number} → {t.status}</p>
                  <p className="text-xs text-ink-500">{t.assigned_name || 'Unassigned'} · {fmtDateTime(t.created_at)}</p>
                </div>
                {t.note && <p className="text-xs text-ink-500 truncate max-w-[200px]">{t.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
