import { useEffect, useState } from 'react';
import { Bell, RefreshCw, CheckCheck, Trash2, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Button, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';import { fmtDateTime } from '../../utils/format.js';

const CATEGORY_STYLES = {
  hotel: 'text-brand-700 bg-brand-50 border-brand-100',
  inventory: 'text-amber-700 bg-amber-50 border-amber-100',
  maintenance: 'text-red-700 bg-red-50 border-red-100',
  events: 'text-violet-700 bg-violet-50 border-violet-100',
  finance: 'text-green-700 bg-green-50 border-green-100',
  system: 'text-ink-700 bg-ink-50 border-ink-100',
};

export default function NotificationCenter() {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifs(res.data);
      setUnread(res.unread || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    load();
  };
  const markAll = async () => {
    await api.post('/notifications/read-all');
    toast.success('All notifications marked as read');
    load();
  };
  const generate = async () => {
    try {
      await api.post('/notifications/generate');
      toast.success('System notifications generated');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const clear = async () => {
    await api.delete('/notifications/clear');
    toast.success('Notifications cleared');
    load();
  };

  const filtered = notifs.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="text-sm text-ink-500 mt-0.5">{unread} unread notification{unread !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={generate}><Sparkles size={15} /> Generate</Button>
          <Button variant="secondary" size="sm" onClick={markAll}><CheckCheck size={15} /> Mark all read</Button>
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw size={15} /> Refresh</Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100 flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search notifications…" className="max-w-sm" />
          {notifs.length > 0 && (
            <button onClick={clear} className="btn-ghost !p-2 text-red-500 hover:bg-red-50" title="Clear all">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" message="System alerts and updates will appear here. Use Generate to refresh alerts." />
        ) : (
          <div className="divide-y divide-ink-100">
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-ink-50 transition-colors ${!n.is_read ? 'bg-brand-50/40' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-ink-200' : 'bg-brand-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm ${n.is_read ? 'font-medium text-ink-700' : 'font-bold text-ink-900'}`}>{n.title}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${CATEGORY_STYLES[n.category] || CATEGORY_STYLES.system}`}>{n.category || 'system'}</span>
                  </div>
                  <p className="text-sm text-ink-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-ink-400 mt-1">{fmtDateTime(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
