import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, PageLoader, Badge } from '../../components/ui/index.jsx';
import { fmtDate } from '../../utils/format.js';

const STATUS_COLOR = {
  PENDING: 'bg-gray-200 border-gray-300 text-ink-700',
  CONFIRMED: 'bg-blue-100 border-blue-300 text-blue-800',
  CHECKED_IN: 'bg-green-100 border-green-300 text-green-800',
  CHECKED_OUT: 'bg-ink-100 border-ink-300 text-ink-500',
  CANCELLED: 'bg-red-100 border-red-300 text-red-700',
  NO_SHOW: 'bg-red-100 border-red-300 text-red-700',
};

function monthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
    days: end.getDate(),
    firstDay: start.getDay(),
  };
}

export default function ReservationCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [outOfOrder, setOutOfOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const { startISO, endISO, days, firstDay } = monthRange(year, month);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reservations/calendar?start=${startISO}&end=${endISO}`);
      setRooms(res.data.rooms);
      setReservations(res.data.reservations);
      setOutOfOrder(res.data.outOfOrder);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [startISO, endISO]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  if (loading) return <PageLoader />;

  const oooMap = {};
  outOfOrder.forEach((o) => { oooMap[o.room_id] = o; });

  const dateCells = [];
  for (let d = 1; d <= days; d++) dateCells.push(new Date(year, month, d).toISOString().slice(0, 10));

  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">Reservation Calendar</h1>
          <div className="flex items-center gap-1">
            <button className="btn-secondary !p-2" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
            <span className="text-sm font-bold text-ink-700 min-w-[130px] text-center">
              {new Date(year, month).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
            </span>
            <button className="btn-secondary !p-2" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-ink-500">
          <span className="flex items-center gap-1"><CalendarDays size={13} /> {rooms.length} rooms</span>
          {['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED'].map((s) => (
            <span key={s} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${STATUS_COLOR[s]?.split(' ')[0]}`} /> {s.replace('_',' ')}</span>
          ))}
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Out of order</span>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header row: weekday labels */}
          <div className="grid" style={{ gridTemplateColumns: `100px repeat(${days}, minmax(40px, 1fr))` }}>
            <div className="bg-ink-50 p-2 text-xs font-bold text-ink-500 border-b border-r border-ink-100 sticky left-0">Room</div>
            {dateCells.map((d, i) => (
              <div key={d} className={`bg-ink-50 p-1 text-center border-b border-ink-100 text-[10px] font-bold ${i % 7 === 6 ? 'text-red-500' : 'text-ink-600'}`}>
                <div>{weekdayLabels[(firstDay + i) % 7]}</div>
                <div className={`text-sm ${new Date(d) > new Date() && new Date(d) < new Date(new Date().setDate(new Date().getDate() + 1)) ? 'text-brand-600' : ''}`}>{i + 1}</div>
              </div>
            ))}
          </div>

          {/* Room rows */}
          {rooms.map((room) => {
            const isOOO = oooMap[room.id];
            return (
              <div key={room.id} className="grid" style={{ gridTemplateColumns: `100px repeat(${days}, minmax(40px, 1fr))` }}>
                <div className="p-2 border-b border-r border-ink-100 sticky left-0 bg-white text-sm font-semibold text-ink-800">
                  {room.room_number}
                  {room.status === 'OUT_OF_ORDER' && <span className="block text-[9px] text-red-500 font-normal">OOO</span>}
                </div>
                {dateCells.map((d, i) => {
                  if (isOOO) {
                    return <div key={d} className="border-b border-ink-50 bg-red-200/60 p-0.5" />;
                  }
                  const resv = reservations.find((r) =>
                    r.room_id === room.id && r.check_in_date <= d && r.check_out_date > d
                  );
                  if (!resv) return <div key={d} className="border-b border-ink-50" />;
                  return (
                    <div
                      key={d}
                      title={`${resv.guest_name} · ${fmtDate(resv.check_in_date)} → ${fmtDate(resv.check_out_date)} · ${resv.status}`}
                      className={`border-b border-ink-50 px-0.5 py-0.5 text-[9px] truncate rounded ${STATUS_COLOR[resv.status] || 'bg-gray-100'}`}
                    >
                      {resv.guest_name?.split(' ')[0] || ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
