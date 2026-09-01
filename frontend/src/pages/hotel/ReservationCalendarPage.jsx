import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Card, PageLoader } from '../../components/ui/index.jsx';
import { fmtDate } from '../../utils/format.js';
import { toYmd } from '../../utils/stay.js';

const STATUS_BAR = {
  PENDING: 'bg-ink-200 text-ink-700',
  CONFIRMED: 'bg-amber-400/90 text-amber-950',
  CHECKED_IN: 'bg-blue-500 text-white',
  CHECKED_OUT: 'bg-ink-200 text-ink-500',
  CANCELLED: 'bg-red-200 text-red-800',
  NO_SHOW: 'bg-red-300 text-red-900',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function monthRange(year, month) {
  const end = new Date(year, month + 1, 0);
  return {
    startISO: ymd(year, month, 1),
    endISO: ymd(year, month, end.getDate()),
    days: end.getDate(),
    firstDay: new Date(year, month, 1).getDay(),
  };
}

export default function ReservationCalendarPage() {
  const now = new Date();
  const today = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [outOfOrder, setOutOfOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

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

  const dateCells = useMemo(
    () => Array.from({ length: days }, (_, i) => ymd(year, month, i + 1)),
    [year, month, days]
  );

  const floors = useMemo(() => {
    const map = new Map();
    rooms.forEach((room) => {
      const f = room.floor ?? 0;
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(room);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms]);

  const oooSet = useMemo(() => new Set(outOfOrder.map((o) => o.room_id)), [outOfOrder]);
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cols = `112px repeat(${days}, minmax(28px, 1fr))`;

  const stayOnDay = (roomId, d) => {
    return reservations.find((r) => {
      if (r.room_id !== roomId) return false;
      if (['CANCELLED', 'NO_SHOW'].includes(r.status)) return false;
      const cin = toYmd(r.check_in_date);
      const cout = toYmd(r.check_out_date);
      return cin <= d && cout > d;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/reservations')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Front desk</p>
            <h1 className="text-2xl font-bold text-ink-900">Reservation calendar</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-ink-100 bg-white p-1">
          <button type="button" className="p-2 rounded-full hover:bg-ink-50" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-ink-800 min-w-[140px] text-center">
            {new Date(year, month).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" className="p-2 rounded-full hover:bg-ink-50" onClick={() => changeMonth(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-500">
        {[['CONFIRMED', 'Confirmed'], ['CHECKED_IN', 'In house'], ['CHECKED_OUT', 'Checked out']].map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BAR[k].split(' ')[0]}`} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Out of order</span>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid sticky top-0 z-20" style={{ gridTemplateColumns: cols }}>
                <div className="sticky left-0 z-30 bg-ink-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400 border-b border-r border-ink-100">
                  Room
                </div>
                {dateCells.map((d, i) => {
                  const isToday = d === today;
                  return (
                    <div
                      key={d}
                      className={`py-2 text-center border-b border-ink-100 text-[10px] font-bold ${
                        isToday ? 'bg-brand-50 text-brand-700' : i % 7 === 0 || i % 7 === 6 ? 'bg-ink-50/80 text-ink-400' : 'bg-ink-50 text-ink-500'
                      }`}
                    >
                      <div>{weekdayLabels[(firstDay + i) % 7]}</div>
                      <div className={`text-sm leading-none mt-0.5 ${isToday ? 'text-brand-700' : 'text-ink-800'}`}>{i + 1}</div>
                    </div>
                  );
                })}
              </div>

              {floors.map(([floor, floorRooms]) => (
                <div key={floor}>
                  <div className="sticky left-0 bg-ink-50/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400 border-b border-ink-100">
                    Floor {floor}
                  </div>
                  {floorRooms.map((room) => (
                    <div key={room.id} className="grid" style={{ gridTemplateColumns: cols }}>
                      <div className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-r border-ink-100">
                        <p className="text-sm font-semibold text-ink-800">{room.room_number}</p>
                        <p className="text-[10px] text-ink-400 truncate">{room.room_type_name}</p>
                      </div>
                      {dateCells.map((d, i) => {
                        const isToday = d === today;
                        if (oooSet.has(room.id)) {
                          return <div key={d} className={`h-11 border-b border-ink-50 ${isToday ? 'bg-red-100' : 'bg-red-50'}`} />;
                        }
                        const resv = stayOnDay(room.id, d);
                        const cin = resv ? toYmd(resv.check_in_date) : '';
                        const cout = resv ? toYmd(resv.check_out_date) : '';
                        const isStart = Boolean(resv && cin === d);
                        const next = dateCells[i + 1];
                        const isLast = Boolean(resv && (!next || next >= cout));
                        return (
                          <div
                            key={d}
                            className={`h-11 border-b border-ink-50 px-px py-1 ${isToday ? 'bg-brand-50/40' : i % 7 === 0 || i % 7 === 6 ? 'bg-ink-50/40' : ''}`}
                          >
                            {resv && (
                              <div
                                title={`${resv.guest_name} · ${fmtDate(resv.check_in_date)} → ${fmtDate(resv.check_out_date)} · ${resv.status}`}
                                className={`h-full flex items-center px-1 text-[10px] font-semibold truncate ${STATUS_BAR[resv.status] || 'bg-ink-200'} ${
                                  isStart && isLast ? 'rounded-md mx-0.5' : isStart ? 'rounded-l-md ml-0.5' : isLast ? 'rounded-r-md mr-0.5' : ''
                                }`}
                              >
                                {isStart ? (resv.guest_name?.split(' ')[0] || '') : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
