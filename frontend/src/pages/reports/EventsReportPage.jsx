import { useEffect, useState } from 'react';
import { CalendarDays, DoorOpen, TrendingUp } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';

export default function EventsReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/events/events/reports');
        setData(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState title="No data" />;

  const { summary, byHall, upcoming, byEventType, services } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Conference & Events Report</h1>
        <p className="text-sm text-ink-500 mt-0.5">Hall utilization, event revenue and outstanding balances</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Events" value={summary.total_events} icon={CalendarDays} color="brand" />
        <Stat label="Event Revenue" value={naira(summary.revenue)} icon={TrendingUp} color="green" />
        <Stat label="Paid" value={naira(summary.paid)} icon={TrendingUp} color="blue" />
        <Stat label="Outstanding" value={naira(summary.outstanding)} icon={DoorOpen} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Hall Utilization" subtitle="Events per conference hall" />
          <div className="p-4">
            {byHall.length === 0 ? (
              <EmptyState title="No hall data" />
            ) : (
              <div className="space-y-2">
                {byHall.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-ink-50">
                    <div className="flex items-center gap-2">
                      <DoorOpen size={16} className="text-ink-400" />
                      <p className="text-sm font-medium text-ink-800">{h.name}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink-700">{h.events} events</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue by Event Type" subtitle="Conference, wedding, training..." />
          <div className="p-4">
            {byEventType.length === 0 ? (
              <EmptyState title="No event type data" />
            ) : (
              <div className="space-y-2">
                {byEventType.map((e) => (
                  <div key={e.event_type} className="flex items-center justify-between p-2.5 rounded-lg bg-ink-50">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{e.event_type}</p>
                      <p className="text-xs text-ink-500">{e.count} events</p>
                    </div>
                    <p className="text-sm font-semibold text-ink-700">{naira(e.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Upcoming Events" subtitle="Next scheduled events" />
          <div className="divide-y divide-ink-100">
            {upcoming.length === 0 ? (
              <EmptyState title="No upcoming events" />
            ) : (
              upcoming.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <CalendarDays size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{ev.customer_name}</p>
                    <p className="text-xs text-ink-500">{ev.hall_name} · {fmtDate(ev.event_date)} · {ev.start_time?.slice(0, 5)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Event Services Usage" subtitle="Most requested event services" />
          <div className="p-4">
            {services.length === 0 ? (
              <EmptyState title="No service data" />
            ) : (
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-ink-50">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{s.name}</p>
                      <p className="text-xs text-ink-500">{s.used_count} times used</p>
                    </div>
                    <p className="text-sm font-semibold text-ink-700">{naira(s.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
