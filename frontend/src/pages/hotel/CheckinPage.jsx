import { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, UserCheck, AlarmClock } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, FolioBill } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { dueKind, arrivalKind, nightsBetween } from '../../utils/stay.js';

function matchesGuest(r, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [r.guest_name, r.guest_phone, r.room_number, r.reservation_no].some(
    (v) => String(v || '').toLowerCase().includes(s)
  );
}

export default function CheckinPage() {
  const [pending, setPending] = useState([]);
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('in');
  const [search, setSearch] = useState('');
  const [checkingIn, setCheckingIn] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([api.get('/checkin/pending'), api.get('/checkin/stays')]);
      setPending(p.data);
      setStays(s.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCheckIn = async (payment_method, amount_paid) => {
    if (!checkingIn) return;
    setProcessing(true);
    try {
      await api.post('/checkin/checkin', {
        reservation_id: checkingIn.id,
        payment_method,
        amount_paid,
      });
      const extra = Number(amount_paid) > 0 ? ` Collected ${naira(amount_paid)}.` : '';
      toast.success(`${checkingIn.guest_name} checked in to room ${checkingIn.room_number}.${extra}`);
      setCheckingIn(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const openCheckout = async (r) => {
    setCheckout(r);
    setPreviewData(null);
    try {
      const res = await api.get(`/checkin/preview/${r.id}`);
      setPreviewData(res.data);
    } catch (err) {
      toast.error(err.message);
      setCheckout(null);
    }
  };

  const handleCheckOut = async (payment_method, amount_paid) => {
    setProcessing(true);
    try {
      await api.post('/checkin/checkout', { reservation_id: checkout.id, payment_method, amount_paid });
      toast.success('Guest checked out. Room sent to housekeeping.');
      setCheckout(null);
      setPreviewData(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const dueOut = useMemo(() => stays.filter((r) => dueKind(r.check_out_date) === 'due'), [stays]);
  const overdue = useMemo(() => stays.filter((r) => dueKind(r.check_out_date) === 'overdue'), [stays]);

  const arrivals = useMemo(() => pending.filter((r) => matchesGuest(r, search)), [pending, search]);
  const departures = useMemo(() => {
    const list = search.trim()
      ? stays.filter((r) => matchesGuest(r, search))
      : [...overdue, ...dueOut];
    return list.map((r) => ({
      ...r,
      _tone: dueKind(r.check_out_date) === 'overdue' ? 'overdue' : dueKind(r.check_out_date) === 'due' ? 'due' : null,
    }));
  }, [stays, overdue, dueOut, search]);

  const lateArrivals = pending.filter((r) => arrivalKind(r.check_in_date) === 'late');

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Front desk</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Check-in / Check-out</h1>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card space-y-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, phone or room…"
          className="max-w-2xl"
        />
        <div className="flex gap-2">
          <TabChip active={tab === 'in'} onClick={() => setTab('in')} label="Check in" count={pending.length} />
          <TabChip active={tab === 'out'} onClick={() => setTab('out')} label="Check out" count={dueOut.length + overdue.length} warn={overdue.length > 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Arriving" value={pending.length} hint={lateArrivals.length ? `${lateArrivals.length} late today` : null} onClick={() => setTab('in')} />
        <StatTile label="Due out" value={dueOut.length} onClick={() => setTab('out')} />
        <StatTile label="Overdue" value={overdue.length} warn={overdue.length > 0} onClick={() => setTab('out')} />
        <StatTile label="In house" value={stays.length} onClick={() => { setTab('out'); }} />
      </div>

      {tab === 'in' ? (
        <Card>
          <div className="divide-y divide-ink-100">
            {arrivals.length === 0 ? (
              <EmptyState
                title={search ? 'No matching arrival' : 'Nobody to check in'}
                message={search ? 'Try another name, phone or room.' : 'Confirmed stays that still have nights left will show here. Type to search.'}
              />
            ) : arrivals.map((r) => {
              const kind = arrivalKind(r.check_in_date);
              const due = Number(r.stay_balance || 0);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-800 truncate">{r.guest_name}</p>
                      {kind === 'late' && <Badge status="CANCELLED">Late</Badge>}
                      {kind === 'today' && <Badge status="CONFIRMED">Today</Badge>}
                    </div>
                    <p className="text-xs text-ink-500">
                      Room {r.room_number || '—'}
                      {r.guest_phone ? ` · ${r.guest_phone}` : ''}
                      {' · '}{fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}
                    </p>
                    <p className={`text-xs mt-0.5 ${due > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}`}>
                      {due > 0 ? `${naira(due)} still to pay` : 'Stay already paid'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setCheckingIn(r)}>
                    <LogIn size={15} /> Check-in
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          {!search.trim() && (
            <p className="px-4 pt-3 text-xs text-ink-400">Due and overdue only. Search a name, phone or room to check someone out early.</p>
          )}
          <div className="divide-y divide-ink-100">
            {departures.length === 0 ? (
              <EmptyState
                title={search ? 'No matching guest' : 'Nobody due out'}
                message={search ? 'Try another name, phone or room.' : 'Due and overdue stays show here. Search to check someone out early.'}
              />
            ) : departures.map((r) => (
              <StayRow key={r.id} r={r} tone={r._tone} onCheckout={() => openCheckout(r)} />
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={!!checkingIn}
        onClose={() => setCheckingIn(null)}
        title={checkingIn ? `Check-in — Room ${checkingIn.room_number}` : 'Check-in'}
      >
        {checkingIn && (
          <CheckInPay
            reservation={checkingIn}
            processing={processing}
            onConfirm={handleCheckIn}
            onCancel={() => setCheckingIn(null)}
          />
        )}
      </Modal>

      <Modal open={!!checkout} onClose={() => { setCheckout(null); setPreviewData(null); }} title={`Check-out — ${checkout?.room_number ? 'Room ' + checkout.room_number : ''}`} wide>
        {!previewData ? (
          <PageLoader />
        ) : (
          <CheckoutPreview data={previewData} processing={processing} onConfirm={handleCheckOut} onCancel={() => setCheckout(null)} />
        )}
      </Modal>
    </div>
  );
}

function TabChip({ active, onClick, label, count, warn }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border ${
        active ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-50 text-ink-600 border-ink-100'
      }`}
    >
      {label}
      <span className={warn && !active ? 'text-red-600' : active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
    </button>
  );
}

function StatTile({ label, value, hint, warn, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 bg-white text-left ${warn ? 'border-red-200 bg-red-50/40' : 'border-ink-100'}`}
    >
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`text-xl font-bold ${warn ? 'text-red-700' : 'text-ink-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-ink-400 mt-0.5">{hint}</p>}
    </button>
  );
}

function StayRow({ r, tone, onCheckout }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        tone === 'overdue' ? 'bg-red-50 text-red-600' : tone === 'due' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
      }`}>
        {tone === 'overdue' ? <AlarmClock size={18} /> : <LogOut size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink-800 truncate">{r.guest_name} · Room {r.room_number}</p>
          {tone === 'overdue' && <Badge status="CANCELLED">Overdue</Badge>}
          {tone === 'due' && <Badge status="CONFIRMED">Due today</Badge>}
        </div>
        <p className="text-xs text-ink-500">
          {r.guest_phone ? `${r.guest_phone} · ` : ''}
          {fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}
        </p>
      </div>
      <Button size="sm" variant={tone === 'overdue' ? 'danger' : 'secondary'} onClick={onCheckout}>
        Check-out
      </Button>
    </div>
  );
}

function CheckInPay({ reservation: r, processing, onConfirm, onCancel }) {
  const nights = nightsBetween(r.check_in_date, r.check_out_date) || 1;
  const stayTotal = Number(r.stay_total || 0);
  const stayPaid = Number(r.stay_paid || r.deposit || 0);
  const due = Number(r.stay_balance != null ? r.stay_balance : Math.max(0, stayTotal - stayPaid));
  const [method, setMethod] = useState(r.payment_method || 'CASH');
  const [amount, setAmount] = useState(due);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-ink-800">{r.guest_name}</p>
        <p className="text-xs text-ink-500">
          Room {r.room_number} · {fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)} · {nights} night{nights === 1 ? '' : 's'}
        </p>
      </div>
      <div className="rounded-xl border border-ink-100 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">Stay total</span><span className="font-semibold">{naira(stayTotal)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">Already paid</span><span className="font-semibold text-green-600">{naira(stayPaid)}</span></div>
        <div className="flex justify-between border-t border-ink-100 pt-2">
          <span className="font-semibold">To collect now</span>
          <span className={`font-bold ${due > 0 ? 'text-amber-600' : 'text-green-600'}`}>{due > 0 ? naira(due) : 'Settled'}</span>
        </div>
      </div>
      <p className="text-xs text-ink-500 -mt-2">Guest normally pays for the room before going in. Anything they buy later (restaurant and so on) is added at check-out.</p>
      {due > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount collected (₦)</label>
            <input type="number" className="input" value={amount} min="0" onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={processing} onClick={() => onConfirm(method, due > 0 ? Number(amount) || 0 : 0)}>
          <LogIn size={16} /> {due > 0 ? 'Take payment and check in' : 'Check in'}
        </Button>
      </div>
    </div>
  );
}

function CheckoutPreview({ data, processing, onConfirm, onCancel }) {
  const f = data.folio;
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(f?.balance || 0);
  const due = Number(f?.balance || 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-600">
        Room plus anything charged to the room — restaurant, spa and other services.
      </p>
      <FolioBill folio={f} title="Stay bill" />

      {due > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount collected (₦)</label>
            <input type="number" className="input" value={amount} min="0" onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-green-700 font-medium">Nothing left to collect.</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={processing} onClick={() => onConfirm(method, due > 0 ? Number(amount) || 0 : 0)}>
          <LogOut size={16} /> Confirm check-out
        </Button>
      </div>
    </div>
  );
}
