import { useEffect, useState } from 'react';
import { LogIn, LogOut, UserCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, Button, Modal, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime } from '../../utils/format.js';

export default function CheckinPage() {
  const [pending, setPending] = useState([]);
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleCheckIn = async (r) => {
    setCheckingIn(r);
    setProcessing(true);
    try {
      await api.post('/checkin/checkin', { reservation_id: r.id });
      toast.success(`${r.guest_name} checked in to room ${r.room_number}`);
      setCheckingIn(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setCheckingIn(null);
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
      toast.success('Guest checked out. Room moved to cleaning.');
      setCheckout(null);
      setPreviewData(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Check-in / Check-out</h1>
        <p className="text-sm text-ink-500 mt-0.5">Confirm arrivals and complete departures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending arrivals */}
        <Card>
          <CardHeader title="Arriving Today" subtitle={`${pending.length} confirmed reservations`} />
          <div className="divide-y divide-ink-100">
            {pending.length === 0 ? (
              <EmptyState title="No arrivals pending" message="Confirmed reservations will appear here." />
            ) : pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <UserCheck size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{r.guest_name}</p>
                  <p className="text-xs text-ink-500">Room {r.room_number || '—'} · {r.room_type_name || ''} · {fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)}</p>
                </div>
                <Button size="sm" loading={checkingIn?.id === r.id} onClick={() => handleCheckIn(r)}>
                  <LogIn size={15} /> Check-in
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Current stays */}
        <Card>
          <CardHeader title="Current Stays" subtitle={`${stays.length} guests in house`} />
          <div className="divide-y divide-ink-100">
            {stays.length === 0 ? (
              <EmptyState title="No guests in house" message="Checked-in guests will appear here." />
            ) : stays.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <LogOut size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{r.guest_name} · Room {r.room_number}</p>
                  <p className="text-xs text-ink-500">{r.room_type_name} · Checked in {fmtDateTime(r.checkin_time)}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openCheckout(r)}>
                  Check-out
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Checkout modal */}
      <Modal open={!!checkout} onClose={() => { setCheckout(null); setPreviewData(null); }} title={`Check-out Preview — ${checkout?.room_number ? 'Room ' + checkout.room_number : ''}`} wide>
        {!previewData ? (
          <PageLoader />
        ) : (
          <CheckoutPreview data={previewData} processing={processing} onConfirm={handleCheckOut} onCancel={() => setCheckout(null)} />
        )}
      </Modal>
    </div>
  );
}

function CheckoutPreview({ data, processing, onConfirm, onCancel }) {
  const f = data.folio;
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(f?.balance || 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-ink-50 p-3 text-center">
          <p className="text-xs text-ink-500">Nights</p>
          <p className="text-2xl font-bold">{data.nights}</p>
        </div>
        <div className="rounded-lg bg-ink-50 p-3 text-center">
          <p className="text-xs text-ink-500">Room Rate / night</p>
          <p className="text-2xl font-bold">{naira(data.roomRate)}</p>
        </div>
        <div className="rounded-lg bg-ink-50 p-3 text-center">
          <p className="text-xs text-ink-500">Room Charges</p>
          <p className="text-2xl font-bold">{naira(data.roomCharge)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-ink-100 p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">Total charges (folio)</span><span className="font-semibold">{naira(f?.totalCharges)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">Paid so far</span><span className="font-semibold text-green-600">{naira(f?.totalPaid)}</span></div>
        <div className="flex justify-between border-t border-ink-100 pt-2"><span className="font-semibold">Balance due</span><span className="font-bold text-lg">{naira(f?.balance)}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount Collected (₦)</label>
          <input type="number" className="input" value={amount} min="0" onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={processing} onClick={() => onConfirm(method, Number(amount))}>
          <LogOut size={16} /> Confirm Check-out & Settle
        </Button>
      </div>
    </div>
  );
}
