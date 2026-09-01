import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, LogIn } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState, GuestPicker, StayBill, Table } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { isoDate, nightsBetween, stayTotals, partyLabel } from '../../utils/stay.js';
import { PERM } from '../../utils/permissions.js';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'CHECKED_IN', label: 'In house' },
  { id: 'CHECKED_OUT', label: 'Checked out' },
  { id: 'NO_SHOW', label: 'No show' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

function emptyForm() {
  return {
    guest_id: '',
    full_name: '',
    phone: '',
    email: '',
    room_type_id: '',
    room_id: '',
    check_in_date: isoDate(0),
    check_out_date: isoDate(1),
    adults: 1,
    children: 0,
    rate: '',
    discount: 0,
    deposit: 0,
    payment_method: 'CASH',
    special_requests: '',
  };
}

function reservationBill(r) {
  return stayTotals({
    nights: nightsBetween(r.check_in_date, r.check_out_date),
    rate: r.rate,
    discount: r.discount,
    paid: r.deposit,
  });
}

export default function ReservationsPage() {
  const { canAccess } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [types, setTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const toast = useToast();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [r, g] = await Promise.all([api.get('/reservations'), api.get('/guests')]);
      setReservations(r.data);
      setGuests(g.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    try {
      const t = await api.get('/rooms/types');
      setTypes(t.data);
    } catch { /* optional */ }
    try {
      const rm = await api.get('/rooms');
      setRooms(rm.data);
    } catch { /* optional */ }
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    return reservations.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  }, [reservations]);

  const filtered = useMemo(() => {
    const rank = { CONFIRMED: 0, CHECKED_IN: 1, PENDING: 2, CHECKED_OUT: 3, NO_SHOW: 4, CANCELLED: 5 };
    return reservations
      .filter((r) => {
        if (filter && r.status !== filter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (r.guest_name || '').toLowerCase().includes(q)
          || (r.reservation_no || '').toLowerCase().includes(q)
          || String(r.room_number || '').includes(q)
          || (r.guest_phone || '').includes(q);
      })
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  }, [reservations, filter, search]);

  const availableRooms = rooms.filter((r) => {
    if (r.status !== 'AVAILABLE') return false;
    if (form.room_type_id && String(r.room_type_id) !== String(form.room_type_id)) return false;
    return true;
  });

  const nights = nightsBetween(form.check_in_date, form.check_out_date);

  const pickGuest = (g) => {
    if (!g) setForm({ ...form, guest_id: '', full_name: '', phone: '', email: '' });
    else setForm({ ...form, guest_id: g.id, full_name: g.full_name, phone: g.phone || '', email: g.email || '' });
  };

  const pickRoom = (roomId) => {
    const room = rooms.find((r) => String(r.id) === String(roomId));
    setForm({
      ...form,
      room_id: roomId,
      room_type_id: room?.room_type_id || form.room_type_id,
      rate: room ? room.price_per_night : form.rate,
    });
  };

  const pickType = (typeId) => {
    const t = types.find((x) => String(x.id) === String(typeId));
    setForm({
      ...form,
      room_type_id: typeId,
      room_id: '',
      rate: t ? t.base_price : form.rate,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_id && !form.room_type_id) {
      toast.error('Pick a room or a room type.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/reservations', {
        guest_id: form.guest_id || undefined,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        room_id: form.room_id || undefined,
        room_type_id: form.room_type_id || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        rate: form.rate === '' || form.rate === null ? undefined : Number(form.rate),
        discount: Number(form.discount) || 0,
        deposit: Number(form.deposit) || 0,
        payment_method: form.payment_method,
        special_requests: form.special_requests,
      });
      toast.success('Reservation created');
      setOpen(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    const row = reservations.find((r) => r.id === id);
    const dep = Number(row?.deposit) || 0;
    const ok = dep > 0
      ? confirm(`Cancel this reservation? The ${naira(dep)} already paid is kept by the hotel.`)
      : confirm('Cancel this reservation?');
    if (!ok) return;
    try {
      const res = await api.post(`/reservations/${id}/cancel`);
      toast.success(res.message || 'Reservation cancelled');
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const checkIn = async (payment_method, amount_paid) => {
    if (!checkingIn) return;
    setSaving(true);
    try {
      await api.post('/checkin/checkin', {
        reservation_id: checkingIn.id,
        payment_method,
        amount_paid,
      });
      toast.success(`Checked in ${checkingIn.guest_name} to room ${checkingIn.room_number}`);
      setCheckingIn(null);
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const todayStr = isoDate(0);
  const arrivalsToday = reservations.filter((r) => toDay(r.check_in_date) === todayStr && ['CONFIRMED', 'CHECKED_IN', 'PENDING'].includes(r.status)).length;
  const departuresToday = reservations.filter((r) => toDay(r.check_out_date) === todayStr && r.status === 'CHECKED_IN').length;
  const inHouse = reservations.filter((r) => r.status === 'CHECKED_IN').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Front desk</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Reservations</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/reservations/calendar')}>
            <CalendarDays size={16} /> Calendar
          </Button>
          {canAccess(PERM.RESERVATIONS_MANAGE) && (
            <Button onClick={() => { setForm(emptyForm()); setOpen(true); }}>
              <Plus size={16} /> New reservation
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button type="button" onClick={() => setFilter('CONFIRMED')} className="rounded-xl border border-ink-100 p-4 bg-white text-left hover:border-ink-300">
          <p className="text-xs text-ink-500">Arriving today</p>
          <p className="text-2xl font-bold text-ink-900">{arrivalsToday}</p>
        </button>
        <button type="button" onClick={() => setFilter('CHECKED_IN')} className="rounded-xl border border-ink-100 p-4 bg-white text-left hover:border-ink-300">
          <p className="text-xs text-ink-500">Departing today</p>
          <p className="text-2xl font-bold text-ink-900">{departuresToday}</p>
        </button>
        <button type="button" onClick={() => setFilter('CHECKED_IN')} className="rounded-xl border border-ink-100 p-4 bg-white text-left hover:border-ink-300">
          <p className="text-xs text-ink-500">In house</p>
          <p className="text-2xl font-bold text-ink-900">{inHouse}</p>
        </button>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <SearchInput value={search} onChange={setSearch} placeholder="Search guest, phone or room…" className="max-w-2xl" />
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                filter === f.id ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-50 text-ink-600 border-ink-100 hover:border-ink-300'
              }`}
            >
              {f.label}
              <span className={filter === f.id ? 'text-white/70' : 'text-ink-400'}>
                {f.id ? (counts[f.id] || 0) : reservations.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="No reservations" message="Create a new reservation or adjust the search." /></Card>
      ) : (
        <Card>
          <Table
            columns={[
              {
                key: 'guest_name',
                label: 'Guest',
                render: (r) => (
                  <div>
                    <p className="font-semibold text-ink-800">{r.guest_name}</p>
                    {r.guest_phone && <p className="text-xs text-ink-400">{r.guest_phone}</p>}
                  </div>
                ),
              },
              { key: 'room_number', label: 'Room', render: (r) => r.room_number || '—' },
              { key: 'dates', label: 'Dates', render: (r) => <span className="whitespace-nowrap">{fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}</span> },
              {
                key: 'paid',
                label: 'Paid',
                align: 'right',
                render: (r) => <span className="font-semibold text-green-700">{naira(reservationBill(r).paid)}</span>,
              },
              {
                key: 'balance',
                label: 'Balance',
                align: 'right',
                render: (r) => {
                  const bill = reservationBill(r);
                  return (
                    <span className={bill.balance > 0 ? 'font-semibold text-amber-600' : 'font-semibold text-green-600'}>
                      {bill.balance > 0 ? naira(bill.balance) : 'Settled'}
                    </span>
                  );
                },
              },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status.replace('_', ' ')}</Badge> },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {r.status === 'CONFIRMED' && canAccess(PERM.CHECKIN_PERFORM) && (
                      <Button size="sm" onClick={() => setCheckingIn(r)}>
                        <LogIn size={14} /> Check in
                      </Button>
                    )}
                    {['PENDING', 'CONFIRMED'].includes(r.status) && canAccess(PERM.RESERVATIONS_MANAGE) && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Cancel</Button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={filtered}
            onRowClick={(r) => setDetail(r)}
            empty={{ title: 'No reservations', message: 'Create a new reservation or adjust the search.' }}
          />
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New reservation" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-ink-500 -mt-1">Find the guest, pick dates and a room, then collect what they pay now. The rest stays on the bill.</p>
          <div>
            <label className="label">Find an existing guest</label>
            <GuestPicker guests={guests} value={form.guest_id} onSelect={pickGuest} />
            <p className="text-[11px] text-ink-400 mt-1">Type a name or phone. Leave empty to add a new guest.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Guest name {!form.guest_id && <span className="text-red-500">*</span>}</label>
              <input
                className="input"
                required={!form.guest_id}
                disabled={!!form.guest_id}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" disabled={!!form.guest_id} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" disabled={!!form.guest_id} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Check-in</label>
              <input type="date" className="input" required value={form.check_in_date} onChange={(e) => setForm({ ...form, check_in_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Check-out</label>
              <input type="date" className="input" required value={form.check_out_date} onChange={(e) => setForm({ ...form, check_out_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Adults</label>
              <input type="number" min="1" className="input" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
            </div>
            <div>
              <label className="label">Children</label>
              <input type="number" min="0" className="input" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
            </div>
            <div>
              <label className="label">Room type</label>
              <select className="input" value={form.room_type_id} onChange={(e) => pickType(e.target.value)}>
                <option value="">Any / auto-assign…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {naira(t.base_price)}/night</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Room</label>
              <select className="input" value={form.room_id} onChange={(e) => pickRoom(e.target.value)}>
                <option value="">Auto-assign from type…</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} · {r.room_type} · {naira(r.price_per_night)}/night
                  </option>
                ))}
              </select>
            </div>
          </div>

          <StayBill
            nights={nights}
            rate={form.rate}
            discount={form.discount}
            paid={form.deposit}
            paymentMethod={form.payment_method}
            paidLabel="Amount paid now (deposit)"
            onRate={(v) => setForm({ ...form, rate: v })}
            onDiscount={(v) => setForm({ ...form, discount: v })}
            onPaid={(v) => setForm({ ...form, deposit: v })}
            onMethod={(v) => setForm({ ...form, payment_method: v })}
          />

          <div>
            <label className="label">Special requests</label>
            <textarea className="input" rows={2} value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create reservation</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.guest_name || 'Reservation'} wide>
        {detail && (
          <ReservationDetail
            r={detail}
            saving={saving}
            canCheckIn={canAccess(PERM.CHECKIN_PERFORM)}
            canCancel={canAccess(PERM.RESERVATIONS_MANAGE)}
            onCheckIn={(r) => { setCheckingIn(r); setDetail(null); }}
            onCancel={cancel}
          />
        )}
      </Modal>

      <Modal
        open={!!checkingIn}
        onClose={() => setCheckingIn(null)}
        title={checkingIn ? `Check-in — Room ${checkingIn.room_number}` : 'Check-in'}
      >
        {checkingIn && (
          <ResCheckInPay
            reservation={checkingIn}
            processing={saving}
            onConfirm={checkIn}
            onCancel={() => setCheckingIn(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function toDay(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function ReservationDetail({ r, saving, canCheckIn, canCancel, onCheckIn, onCancel }) {
  const bill = reservationBill(r);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-ink-400">{r.reservation_no}</p>
          <p className="text-sm text-ink-600">Room {r.room_number || '—'}{r.room_type_name ? ` · ${r.room_type_name}` : ''}</p>
        </div>
        <Badge status={r.status}>{r.status.replace('_', ' ')}</Badge>
      </div>
      <p className="text-sm text-ink-700">{fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)} · {partyLabel(r.adults, r.children)}</p>
      {r.guest_phone && <p className="text-sm text-ink-500">{r.guest_phone}</p>}
      {r.special_requests && (
        <p className="text-sm text-ink-600 rounded-lg bg-ink-50 p-3">{r.special_requests}</p>
      )}
      <div className="rounded-xl border border-ink-100 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-ink-600"><span>{bill.nights} night{bill.nights === 1 ? '' : 's'} × {naira(bill.rate)}</span><span>{naira(bill.subtotal)}</span></div>
        {bill.discount > 0 && <div className="flex justify-between text-ink-600"><span>Discount</span><span>−{naira(bill.discount)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Total</span><span>{naira(bill.total)}</span></div>
        <div className="flex justify-between text-green-700"><span>Paid</span><span>{naira(bill.paid)}</span></div>
        <div className="flex justify-between font-bold border-t border-ink-100 pt-1.5">
          <span>Balance</span>
          <span className={bill.balance > 0 ? 'text-amber-600' : 'text-green-600'}>{bill.balance > 0 ? naira(bill.balance) : 'Settled'}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {r.status === 'CONFIRMED' && canCheckIn && (
          <Button onClick={() => onCheckIn(r)}><LogIn size={16} /> Check in</Button>
        )}
        {['PENDING', 'CONFIRMED'].includes(r.status) && canCancel && (
          <Button variant="ghost" onClick={() => onCancel(r.id)}>Cancel booking</Button>
        )}
      </div>
    </div>
  );
}

function ResCheckInPay({ reservation: r, processing, onConfirm, onCancel }) {
  const bill = reservationBill(r);
  const due = Number(r.stay_balance != null ? r.stay_balance : bill.balance);
  const [method, setMethod] = useState(r.payment_method || 'CASH');
  const [amount, setAmount] = useState(due);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-ink-800">{r.guest_name}</p>
        <p className="text-xs text-ink-500">
          Room {r.room_number} · {fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}
        </p>
      </div>
      <div className="rounded-xl border border-ink-100 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">Stay total</span><span className="font-semibold">{naira(bill.total)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">Already paid</span><span className="font-semibold text-green-600">{naira(bill.paid)}</span></div>
        <div className="flex justify-between border-t border-ink-100 pt-2">
          <span className="font-semibold">To collect now</span>
          <span className={`font-bold ${due > 0 ? 'text-amber-600' : 'text-green-600'}`}>{due > 0 ? naira(due) : 'Settled'}</span>
        </div>
      </div>
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
