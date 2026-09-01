import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, LogIn, LogOut, KeyRound, CalendarPlus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, Button, Modal, SearchInput, PageLoader, EmptyState, GuestPicker, StayBill, FolioBill } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { isoDate, nightsBetween, dueKind, arrivalKind } from '../../utils/stay.js';
import { PERM } from '../../utils/permissions.js';

const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'];

const STATUS_EDGE = {
  AVAILABLE: 'border-l-emerald-500',
  OCCUPIED: 'border-l-blue-500',
  RESERVED: 'border-l-amber-400',
  CLEANING: 'border-l-violet-400',
  MAINTENANCE: 'border-l-red-400',
};

const STATUS_WASH = {
  AVAILABLE: 'bg-emerald-50/40',
  OCCUPIED: 'bg-blue-50/50',
  RESERVED: 'bg-amber-50/50',
  CLEANING: 'bg-violet-50/40',
  MAINTENANCE: 'bg-red-50/40',
};

const emptyAssign = (roomId = '', checkInNow = true, rate = '') => ({
  room_id: roomId,
  guest_id: '',
  full_name: '',
  phone: '',
  email: '',
  check_in_date: isoDate(0),
  check_out_date: isoDate(1),
  adults: 1,
  children: 0,
  rate,
  discount: 0,
  deposit: 0,
  payment_method: 'CASH',
  check_in_now: checkInNow,
});

export default function RoomsPage() {
  const { canAccess } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [mode, setMode] = useState('give');
  const [form, setForm] = useState(emptyAssign());
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [preview, setPreview] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const toast = useToast();

  const [newRoom, setNewRoom] = useState({
    room_number: '', room_type_id: '', floor: 1, price_per_night: '', status: 'AVAILABLE', description: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    if (canAccess(PERM.ROOM_TYPES_VIEW)) {
      try { const t = await api.get('/rooms/types'); setTypes(t.data); } catch { /* optional */ }
    }
    if (canAccess(PERM.GUESTS_VIEW)) {
      try { const g = await api.get('/guests'); setGuests(g.data); } catch { /* optional */ }
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      const match = !q || [
        r.room_number, r.room_type, r.current_guest, r.guest_phone, String(r.floor),
      ].some((v) => String(v || '').toLowerCase().includes(q));
      if (!match) return false;
      if (!filter) return true;
      if (filter === 'OVERDUE') return r.status === 'OCCUPIED' && dueKind(r.check_out_date) === 'overdue';
      if (filter === 'DUE_OUT') return r.status === 'OCCUPIED' && dueKind(r.check_out_date) === 'due';
      return r.status === filter;
    });
  }, [rooms, search, filter]);

  const counts = rooms.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  const dueOutCount = rooms.filter((r) => r.status === 'OCCUPIED' && dueKind(r.check_out_date) === 'due').length;
  const overdueCount = rooms.filter((r) => r.status === 'OCCUPIED' && dueKind(r.check_out_date) === 'overdue').length;
  const available = rooms.filter((r) => r.status === 'AVAILABLE');
  const floors = [...new Set(filtered.map((r) => r.floor))].sort((a, b) => a - b);

  const openAssign = (room, nextMode) => {
    setMode(nextMode);
    setForm(emptyAssign(room?.id ? String(room.id) : '', nextMode === 'give', room?.price_per_night ?? ''));
    setAssignOpen(true);
  };

  const pickGuest = (g) => {
    if (!g) {
      setForm({ ...form, guest_id: '', full_name: '', phone: '', email: '' });
      return;
    }
    setForm({ ...form, guest_id: g.id, full_name: g.full_name, phone: g.phone || '', email: g.email || '' });
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.room_id) {
      toast.error('Pick a room.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/reservations', {
        room_id: form.room_id,
        guest_id: form.guest_id || undefined,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        rate: form.rate === '' || form.rate === null ? undefined : Number(form.rate),
        discount: Number(form.discount) || 0,
        deposit: Number(form.deposit) || 0,
        payment_method: form.payment_method,
      });
      if (form.check_in_now && canAccess(PERM.CHECKIN_PERFORM) && created.data?.id) {
        await api.post('/checkin/checkin', { reservation_id: created.data.id });
        toast.success('Guest checked in.');
      } else {
        toast.success('Room reserved.');
      }
      setAssignOpen(false);
      setForm(emptyAssign());
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/rooms', newRoom);
      toast.success('Room created');
      setAddOpen(false);
      setNewRoom({ room_number: '', room_type_id: '', floor: 1, price_per_night: '', status: 'AVAILABLE', description: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (room) => {
    setSelected(room);
    setDetail(null);
    try {
      const res = await api.get(`/rooms/${room.id}`);
      setDetail(res.data);
    } catch (err) {
      toast.error(err.message);
      setSelected(null);
    }
  };

  const openCheckIn = async (r) => {
    try {
      const res = await api.get(`/reservations/${r.current_reservation_id}`);
      setCheckingIn({
        ...res.data,
        id: r.current_reservation_id,
        room_number: r.room_number,
        guest_name: res.data.full_name || res.data.guest_name || r.current_guest,
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCheckIn = async (payment_method, amount_paid) => {
    if (!checkingIn) return;
    setSaving(true);
    try {
      await api.post('/checkin/checkin', {
        reservation_id: checkingIn.id,
        payment_method,
        amount_paid,
      });
      toast.success(`Checked in to room ${checkingIn.room_number}`);
      setCheckingIn(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openCheckout = async (reservationId) => {
    setCheckout(reservationId);
    setPreview(null);
    try {
      const res = await api.get(`/checkin/preview/${reservationId}`);
      setPreview(res.data);
    } catch (err) {
      toast.error(err.message);
      setCheckout(null);
    }
  };

  const handleCheckOut = async (payment_method, amount_paid) => {
    setSaving(true);
    try {
      await api.post('/checkin/checkout', { reservation_id: checkout, payment_method, amount_paid });
      toast.success('Guest checked out.');
      setCheckout(null);
      setPreview(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Front desk</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Rooms</h1>
          <p className="text-sm text-ink-500 mt-1">Search a room, then reserve it, give it, or check a guest in.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAccess(PERM.RESERVATIONS_MANAGE) && (
            <>
              <Button variant="secondary" onClick={() => openAssign(null, 'reserve')} disabled={available.length === 0}>
                <CalendarPlus size={16} /> Reserve
              </Button>
              <Button onClick={() => openAssign(null, 'give')} disabled={available.length === 0}>
                <KeyRound size={16} /> Give a room
              </Button>
            </>
          )}
          {canAccess(PERM.ROOMS_MANAGE) && (
            <Button variant="ghost" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Add room
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search room, type, floor or guest…"
          className="max-w-2xl"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={!filter} onClick={() => setFilter('')} label="All" count={rooms.length} />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              onClick={() => setFilter(filter === s ? '' : s)}
              label={s.charAt(0) + s.slice(1).toLowerCase()}
              count={counts[s] || 0}
            />
          ))}
          <FilterChip
            active={filter === 'DUE_OUT'}
            onClick={() => setFilter(filter === 'DUE_OUT' ? '' : 'DUE_OUT')}
            label="Due out"
            count={dueOutCount}
          />
          <FilterChip
            active={filter === 'OVERDUE'}
            onClick={() => setFilter(filter === 'OVERDUE' ? '' : 'OVERDUE')}
            label="Overdue"
            count={overdueCount}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="No rooms found" message="Try another search or status." /></Card>
      ) : (
        <div className="space-y-8">
          {floors.map((floor) => (
            <section key={floor}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Floor {floor}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filtered.filter((r) => r.floor === floor).map((r) => (
                  <article
                    key={r.id}
                    className={`rounded-2xl border border-ink-100 border-l-4 ${STATUS_EDGE[r.status]} ${STATUS_WASH[r.status]} bg-white shadow-card flex flex-col overflow-hidden`}
                  >
                    <button type="button" onClick={() => openDetail(r)} className="text-left p-4 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{r.room_type}</p>
                          <p className="text-2xl font-bold text-ink-900 leading-tight mt-0.5">{r.room_number}</p>
                        </div>
                        <Badge status={r.status}>{r.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-ink-500"><Users size={14} /> {r.capacity}</span>
                        <span className="font-semibold text-ink-900">{naira(r.price_per_night)}<span className="font-normal text-ink-400 text-xs"> /night</span></span>
                      </div>
                      {r.current_guest && (
                        <div className="mt-3 rounded-lg bg-white/80 border border-ink-100 px-3 py-2">
                          <p className="text-[11px] text-ink-400">Guest</p>
                          <p className="text-sm font-semibold text-ink-800 truncate">{r.current_guest}</p>
                          {r.check_out_date && (
                            <p className={`text-xs mt-0.5 ${
                              dueKind(r.check_out_date) === 'overdue'
                                ? 'font-semibold text-red-600'
                                : dueKind(r.check_out_date) === 'due'
                                  ? 'font-semibold text-amber-600'
                                  : 'text-ink-500'
                            }`}>
                              {dueKind(r.check_out_date) === 'overdue'
                                ? `Overdue · was due ${fmtDate(r.check_out_date)}`
                                : dueKind(r.check_out_date) === 'due'
                                  ? 'Due out today'
                                  : `Until ${fmtDate(r.check_out_date)}`}
                            </p>
                          )}
                          {r.status === 'RESERVED' && arrivalKind(r.check_in_date) === 'late' && (
                            <p className="text-xs font-semibold text-amber-600 mt-0.5">Late arrival</p>
                          )}
                        </div>
                      )}
                    </button>
                    <div className="px-4 pb-4 flex gap-2">
                      {r.status === 'AVAILABLE' && canAccess(PERM.RESERVATIONS_MANAGE) && (
                        <>
                          <Button size="sm" variant="secondary" className="flex-1" onClick={() => openAssign(r, 'reserve')}>
                            <CalendarPlus size={14} /> Reserve
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => openAssign(r, 'give')}>
                            <KeyRound size={14} /> Give
                          </Button>
                        </>
                      )}
                      {r.status === 'RESERVED' && r.current_reservation_id && canAccess(PERM.CHECKIN_PERFORM) && (
                        <Button size="sm" className="w-full" onClick={() => openCheckIn(r)}>
                          <LogIn size={14} /> Check in
                        </Button>
                      )}
                      {r.status === 'OCCUPIED' && r.current_reservation_id && canAccess(PERM.CHECKOUT_PERFORM) && (
                        <Button
                          size="sm"
                          variant={dueKind(r.check_out_date) === 'overdue' ? 'danger' : 'secondary'}
                          className="w-full"
                          onClick={() => openCheckout(r.current_reservation_id)}
                        >
                          <LogOut size={14} /> {dueKind(r.check_out_date) === 'overdue' ? 'Overdue check-out' : dueKind(r.check_out_date) === 'due' ? 'Check out today' : 'Check out'}
                        </Button>
                      )}
                      {['CLEANING', 'MAINTENANCE'].includes(r.status) && (
                        <p className="w-full text-center text-xs text-ink-400 py-1.5">Not ready</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={mode === 'give' ? 'Give a room' : 'Reserve a room'}
        wide
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <p className="text-sm text-ink-500 -mt-1">
            {mode === 'give'
              ? 'Walk-in: assign this room and check the guest in now.'
              : 'Hold this room for a future arrival. Check-in happens later.'}
          </p>
          <div>
            <label className="label">Room</label>
            <select
              className="input"
              required
              value={form.room_id}
              onChange={(e) => {
                const room = available.find((r) => String(r.id) === e.target.value);
                setForm({
                  ...form,
                  room_id: e.target.value,
                  rate: room ? room.price_per_night : form.rate,
                });
              }}
            >
              <option value="">Select an available room…</option>
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_number} · {r.room_type} · {naira(r.price_per_night)}/night
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Find an existing guest</label>
            <GuestPicker guests={guests} value={form.guest_id} onSelect={pickGuest} />
            <p className="text-[11px] text-ink-400 mt-1">Type to search. Leave empty to add a new guest.</p>
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
          </div>

          <StayBill
            nights={nightsBetween(form.check_in_date, form.check_out_date)}
            rate={form.rate}
            discount={form.discount}
            paid={form.deposit}
            paymentMethod={form.payment_method}
            paidLabel={mode === 'give' ? 'Amount paid now' : 'Amount paid now (deposit)'}
            onRate={(v) => setForm({ ...form, rate: v })}
            onDiscount={(v) => setForm({ ...form, discount: v })}
            onPaid={(v) => setForm({ ...form, deposit: v })}
            onMethod={(v) => setForm({ ...form, payment_method: v })}
          />

          {canAccess(PERM.CHECKIN_PERFORM) && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={form.check_in_now}
                onChange={(e) => setForm({ ...form, check_in_now: e.target.checked })}
              />
              Check the guest in now
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{mode === 'give' ? 'Give room' : 'Reserve room'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Room ${selected.room_number}` : 'Room'} wide>
        {!detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-500">{detail.room.room_type} · Floor {detail.room.floor} · {naira(detail.room.price_per_night)}/night</p>
              <Badge status={detail.room.status}>{detail.room.status}</Badge>
            </div>
            {detail.current ? (
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">Current guest</p>
                <p className="font-bold text-ink-900">{detail.current.guest_name}</p>
                <p className="text-sm text-ink-600">{fmtDate(detail.current.check_in_date)} → {fmtDate(detail.current.check_out_date)}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-500">No guest in this room right now.</p>
            )}
            {detail.history?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-500 mb-2">Recent stays</p>
                <div className="divide-y divide-ink-100 border border-ink-100 rounded-xl">
                  {detail.history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{h.guest_name}</span>
                      <span className="text-ink-500">{fmtDate(h.check_in_date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!checkingIn}
        onClose={() => setCheckingIn(null)}
        title={checkingIn ? `Check-in — Room ${checkingIn.room_number}` : 'Check-in'}
      >
        {checkingIn && (
          <RoomCheckInPay
            reservation={checkingIn}
            processing={saving}
            onConfirm={handleCheckIn}
            onCancel={() => setCheckingIn(null)}
          />
        )}
      </Modal>

      <Modal open={!!checkout} onClose={() => { setCheckout(null); setPreview(null); }} title="Check-out" wide>
        {!preview ? (
          <PageLoader />
        ) : (
          <CheckoutPreview data={preview} processing={saving} onConfirm={handleCheckOut} onCancel={() => { setCheckout(null); setPreview(null); }} />
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Room">
        <form onSubmit={handleAddRoom} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Room Number</label>
              <input className="input" required value={newRoom.room_number} onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })} placeholder="205" />
            </div>
            <div>
              <label className="label">Floor</label>
              <input type="number" className="input" value={newRoom.floor} onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Room Type</label>
            <select className="input" value={newRoom.room_type_id} onChange={(e) => setNewRoom({ ...newRoom, room_type_id: e.target.value })}>
              <option value="">Select type…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price / Night (₦)</label>
              <input type="number" className="input" value={newRoom.price_per_night} onChange={(e) => setNewRoom({ ...newRoom, price_per_night: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={newRoom.status} onChange={(e) => setNewRoom({ ...newRoom, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Room</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
        active ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-50 text-ink-600 border-ink-100 hover:border-ink-300'
      }`}
    >
      {label}
      <span className={active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
    </button>
  );
}

function RoomCheckInPay({ reservation: r, processing, onConfirm, onCancel }) {
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
      <p className="text-sm text-ink-600">Room plus restaurant and other charges on this guest.</p>
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
