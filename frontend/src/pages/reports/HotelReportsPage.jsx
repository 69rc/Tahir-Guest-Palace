import { useEffect, useState } from 'react';
import { BarChart3, LogIn, LogOut, CalendarCheck2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime } from '../../utils/format.js';

export default function HotelReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reports/hotel');
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

  const totalRes = data.reservations.length;
  const checkedIn = data.counts.CHECKED_IN || 0;
  const cancelled = data.counts.CANCELLED || 0;
  const totalRooms = data.roomCounts.reduce((s, r) => s + Number(r.count), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Hotel Reports</h1>
        <p className="text-sm text-ink-500 mt-0.5">Reservation, check-in and check-out activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Reservations" value={totalRes} icon={CalendarCheck2} color="brand" />
        <Stat label="Checked In" value={checkedIn} icon={LogIn} color="blue" />
        <Stat label="Checked Out" value={data.checkouts.length} icon={LogOut} color="green" />
        <Stat label="Cancelled / No-show" value={(data.counts.CANCELLED || 0) + (data.counts.NO_SHOW || 0)} icon={BarChart3} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Reservations by Status" />
          <div className="p-4 space-y-3">
            {Object.entries(data.counts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <Badge status={status}>{status}</Badge>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Rooms by Status" />
          <div className="p-4 space-y-3">
            {data.roomCounts.map((r) => (
              <div key={r.status} className="flex items-center justify-between">
                <Badge status={r.status}>{r.status}</Badge>
                <span className="font-bold">{r.count}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-ink-100 pt-2">
              <span className="text-sm font-semibold text-ink-500">Total rooms</span>
              <span className="font-bold text-ink-900">{totalRooms}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Check-ins" />
          <div className="divide-y divide-ink-100">
            {data.checkins.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><LogIn size={15} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name} · {c.room_number}</p>
                  <p className="text-xs text-ink-500">{fmtDateTime(c.checkin_time)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="All Reservations" subtitle={`${data.reservations.length} total`} />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr className="bg-ink-50">
                <th className="th">Guest</th>
                <th className="th">Room</th>
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{r.guest_name}</td>
                    <td className="td">{r.room_number || '—'}</td>
                    <td className="td whitespace-nowrap">{fmtDate(r.check_in_date)}</td>
                    <td className="td whitespace-nowrap">{fmtDate(r.check_out_date)}</td>
                    <td className="td"><Badge status={r.status}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Check-outs" />
          <div className="divide-y divide-ink-100">
            {data.checkouts.length === 0 ? <EmptyState title="No check-outs yet" /> : data.checkouts.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0"><LogOut size={15} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name} · {c.room_number}</p>
                  <p className="text-xs text-ink-500">{fmtDateTime(c.checkout_time)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
