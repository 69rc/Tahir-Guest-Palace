import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';
import { fmtDateTime } from '../../utils/format.js';

const ACTION_COLORS = {
  LOGIN: 'blue',
  CHANGE_PASSWORD: 'amber',
  CREATE_ROOM_TYPE: 'green',
  CREATE_ROOM: 'green',
  UPDATE_ROOM: 'blue',
  CREATE_GUEST: 'green',
  UPDATE_GUEST: 'blue',
  CREATE_RESERVATION: 'green',
  UPDATE_RESERVATION_STATUS: 'amber',
  CHECK_IN: 'blue',
  CHECK_OUT: 'violet',
  CREATE_ORDER: 'blue',
  CHARGE_TO_ROOM: 'violet',
  PAY_ORDER: 'green',
  CREATE_PURCHASE: 'green',
  CREATE_PAYMENT: 'green',
  CREATE_EXPENSE: 'red',
  HOUSEKEEPING: 'amber',
  CREATE_USER: 'green',
  UPDATE_USER: 'blue',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/staff/audit-logs');
        setLogs(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.action || '').toLowerCase().includes(q) || (l.table_name || '').toLowerCase().includes(q) || (l.user_name || '').toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Audit Logs</h1>
        <p className="text-sm text-ink-500 mt-0.5">Every meaningful action is recorded for accountability</p>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100 flex flex-wrap gap-3 items-center justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by action, table or user…" className="max-w-sm" />
          <span className="text-xs text-ink-500">{filtered.length} entries</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No audit entries" message="Actions will be logged here automatically." icon={ScrollText} />
        ) : (
          <div className="divide-y divide-ink-100">
            {filtered.map((l) => (
              <div key={l.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-lg bg-ink-50 text-ink-500 flex items-center justify-center shrink-0"><ScrollText size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge status={ACTION_COLORS[l.action] || 'gray'}>{l.action}</Badge>
                    <span className="font-semibold text-ink-800 text-sm">{l.user_name || 'System'}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    Table: <b>{l.table_name}</b> · Record: <b>{l.record_id}</b> · {fmtDateTime(l.created_at)}
                  </p>
                  {l.details && (
                    <pre className="mt-2 text-[11px] text-ink-400 bg-ink-50 rounded-lg p-2 overflow-x-auto">
                      {typeof l.details === 'string' ? l.details : JSON.stringify(l.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
