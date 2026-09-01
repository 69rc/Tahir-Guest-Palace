import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import Receipt from '../../components/restaurant/Receipt.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, FilterChip, GuestPicker } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

const PAY = [
  { id: 'CASH', label: 'Cash' },
  { id: 'POS', label: 'POS' },
  { id: 'TRANSFER', label: 'Transfer' },
  { id: 'CARD', label: 'Card' },
];

function orderLabel(o) {
  if (o.is_charged_to_room) return 'On room';
  if (o.status === 'PAID') return 'Paid';
  if (o.status === 'CANCELLED') return 'Cancelled';
  return 'Open';
}

function orderKind(o) {
  if (o.is_charged_to_room) return 'room';
  if (o.status === 'PAID') return 'paid';
  if (o.status === 'OPEN') return 'open';
  return 'other';
}

function paidHow(o) {
  if (o.is_charged_to_room) return 'Room bill';
  const m = PAY.find((p) => p.id === o.payment_method);
  return m?.label || o.payment_method || null;
}

export default function OrdersPage() {
  const { canAccess } = useAuth();
  const { activeRestaurantId, activeRestaurant, loading: restLoading } = useRestaurant();
  const [orders, setOrders] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open');
  const [detail, setDetail] = useState(null);
  const [method, setMethod] = useState('CASH');
  const [roomId, setRoomId] = useState('');
  const [working, setWorking] = useState(false);
  const toast = useToast();
  const canPay = canAccess(PERM.ORDERS_MANAGE);
  const canCharge = canAccess(PERM.CHARGE_ROOM);

  const load = async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/restaurants/${activeRestaurantId}/orders`);
      setOrders(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (activeRestaurantId) load(); }, [activeRestaurantId]);

  useEffect(() => {
    if (!canCharge) return;
    api.get('/restaurants/in-house').then((r) => {
      setOccupiedRooms(r.data || []);
    }).catch(() => {});
  }, [canCharge]);

  const openDetail = async (o) => {
    try {
      const res = await api.get(`/restaurants/orders/${o.id}`);
      setDetail(res.data);
      setRoomId('');
      setMethod('CASH');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const pay = async () => {
    if (!detail) return;
    setWorking(true);
    try {
      await api.post(`/restaurants/orders/${detail.id}/pay`, { order_id: detail.id, method });
      toast.success('Paid');
      const res = await api.get(`/restaurants/orders/${detail.id}`);
      setDetail(res.data);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const charge = async () => {
    if (!detail || !roomId) return;
    setWorking(true);
    try {
      await api.post(`/restaurants/orders/${detail.id}/charge-to-room`, { order_id: detail.id, room_id: roomId });
      toast.success('Added to room bill');
      const res = await api.get(`/restaurants/orders/${detail.id}`);
      setDetail(res.data);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => orders.filter((o) => {
    const kind = orderKind(o);
    if (filter !== 'all' && kind !== filter) return false;
    if (!q) return true;
    return [o.order_no, o.restaurant_name, o.table_number, o.guest_name, o.customer_name].some((v) => String(v || '').toLowerCase().includes(q));
  }), [orders, filter, q]);

  const counts = {
    open: orders.filter((o) => orderKind(o) === 'open').length,
    paid: orders.filter((o) => orderKind(o) === 'paid').length,
    room: orders.filter((o) => orderKind(o) === 'room').length,
    all: orders.length,
  };

  const stillOpen = detail && detail.status === 'OPEN' && !detail.is_charged_to_room;
  const roomGuests = occupiedRooms.map((r) => ({
    id: r.id,
    full_name: r.current_guest,
    phone: `Room ${r.room_number}`,
  }));

  if ((loading && !orders.length) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Restaurants</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Orders</h1>
          <p className="text-sm text-ink-500 mt-1">Open tickets, paid bills, and charges on a guest room.</p>
        </div>
      </div>

      <RestaurantSelector />

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search order, table, or name…" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'open'} onClick={() => setFilter('open')} label="Open" count={counts.open} />
          <FilterChip active={filter === 'paid'} onClick={() => setFilter('paid')} label="Paid" count={counts.paid} />
          <FilterChip active={filter === 'room'} onClick={() => setFilter('room')} label="On room" count={counts.room} />
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={counts.all} />
        </div>
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState title={search ? 'Nothing matches' : 'No orders here'} message="New sales from Sell show here." />
        ) : (
          <div className="divide-y divide-ink-100">
            {visible.map((o) => (
              <button key={o.id} type="button" onClick={() => openDetail(o)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{o.order_no}</p>
                  <p className="text-xs text-ink-500">
                    {o.guest_name || o.customer_name || 'Walk-in'}
                    {` · ${o.table_number ? `Table ${o.table_number}` : 'Takeaway'}`}
                    {` · ${fmtDateTime(o.created_at)}`}
                  </p>
                </div>
                <p className="font-bold text-ink-900">{naira(o.total)}</p>
                <Badge status={o.is_charged_to_room ? 'RESERVED' : o.status}>{orderLabel(o)}</Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.order_no || 'Order'}>
        {detail && (
          <div className="space-y-4">
            <Receipt
              orderNo={detail.order_no}
              outlet={detail.restaurant_name || activeRestaurant?.name}
              customer={detail.guest_name || detail.customer_name}
              table={detail.table_number}
              items={detail.items || []}
              subtotal={detail.subtotal}
              tax={detail.tax}
              service={detail.service_charge}
              discount={detail.discount}
              total={detail.total}
              method={paidHow(detail)}
              status={orderLabel(detail)}
              date={detail.created_at}
            />

            {stillOpen && (
              <div className="space-y-3 border-t border-ink-100 pt-3 print-hide">
                {canPay && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[8rem]">
                      <label className="label">How they paid</label>
                      <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                        {PAY.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                    <Button loading={working} onClick={pay}>Collect {naira(detail.total)}</Button>
                  </div>
                )}
                {canCharge && (
                  <div className="space-y-2">
                    <label className="label">Or put on room</label>
                    <GuestPicker
                      guests={roomGuests}
                      value={roomId}
                      showAllOnEmpty
                      placeholder="Search name or room…"
                      onSelect={(g) => setRoomId(g ? String(g.id) : '')}
                    />
                    <Button variant="secondary" disabled={!roomId} loading={working} onClick={charge}>Room bill</Button>
                  </div>
                )}
              </div>
            )}

            <Button variant="secondary" className="w-full print-hide" onClick={() => window.print()}>
              <Printer size={15} /> Print receipt
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
