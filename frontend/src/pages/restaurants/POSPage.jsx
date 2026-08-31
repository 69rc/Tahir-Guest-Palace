import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, BedDouble, Receipt, Check } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function POSPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [menu, setMenu] = useState(null);
  const [tables, setTables] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [allGuests, setAllGuests] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mode, setMode] = useState('pay'); // 'pay' | 'room'
  const [roomId, setRoomId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [method, setMethod] = useState('CASH');
  const [processing, setProcessing] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const toast = useToast();

  const loadRestaurants = async () => {
    try {
      const res = await api.get('/restaurants');
      setRestaurants(res.data);
      if (!selected && res.data.length) setSelected(res.data[0].id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadData = async (rid) => {
    if (!rid) return;
    setLoading(true);
    try {
      const [m, t, rooms, guests] = await Promise.all([
        api.get(`/restaurants/${rid}/menu`),
        api.get(`/restaurants/${rid}/tables`),
        api.get('/rooms'),
        api.get('/guests'),
      ]);
      setMenu(m.data);
      setTables(t.data);
      setAllRooms(rooms.data);
      setAllGuests(guests.data);
      if (!activeCat && m.data.categories.length) setActiveCat(m.data.categories[0].id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRestaurants(); }, []);
  useEffect(() => { if (selected) loadData(selected); }, [selected]);

  const addToCart = (item) => {
    setCart((c) => {
      const found = c.find((x) => x.menu_item_id === item.id);
      if (found) return c.map((x) => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { menu_item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((c) => {
      const updated = c.map((x) => x.menu_item_id === id ? { ...x, quantity: x.quantity + delta } : x).filter((x) => x.quantity > 0);
      if (updated.length === 0) return c;
      return updated;
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const activeItems = menu?.items.filter((i) => !activeCat || i.category_id === activeCat) || [];

  const createOrderAndPay = async (action) => {
    setProcessing(true);
    try {
      const created = await api.post('/restaurants/orders', {
        restaurant_id: selected,
        table_id: tableId || null,
        items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
      });
      const orderId = created.data.id;
      if (action === 'room') {
        const res = await api.post(`/restaurants/orders/${orderId}/charge-to-room`, {
          order_id: orderId, room_id: roomId || null, guest_id: guestId || null,
        });
        toast.success('Order charged to room folio. Stock deducted.');
      } else {
        await api.post(`/restaurants/orders/${orderId}/pay`, { order_id: orderId, method });
        toast.success('Order paid. Stock deducted.');
      }
      setSuccessOrder({ id: orderId, total: created.data.total });
      setCart([]);
      setTableId('');
      setCheckoutOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !menu) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Point of Sale</h1>
          <p className="text-sm text-ink-500 mt-0.5">Create orders, charge to guest rooms or collect payment</p>
        </div>
        {restaurants.map((r) => (
          <button key={r.id} onClick={() => setSelected(r.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              String(r.id) === String(selected) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-ink-200 hover:bg-ink-50'
            }`}>
            {r.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Menu */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setActiveCat(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${activeCat === null ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-200 hover:bg-ink-50'}`}>
              All
            </button>
            {menu?.categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${activeCat === c.id ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-200 hover:bg-ink-50'}`}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activeItems.map((i) => (
              <button key={i.id} onClick={() => i.is_available && addToCart(i)} disabled={!i.is_available}
                className={`text-left rounded-xl border p-4 transition-colors ${i.is_available ? 'bg-white border-ink-100 hover:border-brand-300 hover:shadow-card' : 'bg-ink-50 border-ink-100 opacity-60 cursor-not-allowed'}`}>
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-ink-800">{i.name}</p>
                  <Plus size={16} className="text-brand-600 shrink-0" />
                </div>
                {i.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{i.description}</p>}
                <p className="font-bold text-brand-600 mt-2">{naira(i.price)}</p>
                {!i.is_available && <p className="text-xs text-red-500 mt-1">Sold out</p>}
              </button>
            ))}
            {activeItems.length === 0 && <div className="col-span-full"><EmptyState title="No items" message="Add menu items to get started." /></div>}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-brand-600" />
                <h3 className="text-sm font-bold text-ink-800">Current Order</h3>
              </div>
              <span className="text-xs text-ink-500">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
            </div>

            {cart.length === 0 ? (
              <EmptyState title="Cart is empty" message="Tap menu items to add them here." />
            ) : (
              <div className="divide-y divide-ink-100 max-h-80 overflow-y-auto">
                {cart.map((i) => (
                  <div key={i.menu_item_id} className="flex items-center gap-2 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-800 truncate">{i.name}</p>
                      <p className="text-xs text-ink-500">{naira(i.price)} × {i.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(i.menu_item_id, -1)} className="p-1 rounded bg-ink-100 hover:bg-ink-200 text-ink-600"><Minus size={14} /></button>
                      <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                      <button onClick={() => addToCart({ id: i.menu_item_id, name: i.name, price: i.price })} className="p-1 rounded bg-ink-100 hover:bg-ink-200 text-ink-600"><Plus size={14} /></button>
                    </div>
                    <span className="text-sm font-semibold w-16 text-right">{naira(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-ink-100 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-ink-500">Subtotal</span><span className="font-semibold">{naira(subtotal)}</span></div>
                <div>
                  <label className="label">Table</label>
                  <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                    <option value="">No table (takeaway)</option>
                    {tables.filter((t) => t.status === 'AVAILABLE').map((t) => <option key={t.id} value={t.id}>Table {t.table_number}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => { setMode('pay'); setCheckoutOpen(true); }}>
                    <CreditCard size={15} /> Collect
                  </Button>
                  <Button variant="secondary" onClick={() => { setMode('room'); setCheckoutOpen(true); }}>
                    <BedDouble size={15} /> Charge Room
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={mode === 'room' ? 'Charge to Guest Room' : 'Collect Payment'}>
        <div className="space-y-4">
          <div className="rounded-lg bg-ink-50 p-4 flex justify-between items-center">
            <span className="text-sm text-ink-500">Total due</span>
            <span className="text-xl font-bold">{naira(subtotal)}</span>
          </div>

          {mode === 'room' ? (
            <>
              <div>
                <label className="label">Charge to Room</label>
                <select className="input" value={roomId} onChange={(e) => { setRoomId(e.target.value); setGuestId(''); }}>
                  <option value="">Select occupied room…</option>
                  {allRooms.filter((r) => r.status === 'OCCUPIED' && r.current_guest).map((r) => (
                    <option key={r.id} value={r.id}>Room {r.room_number} — {r.current_guest}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Or charge to Guest directly</label>
                <select className="input" value={guestId} onChange={(e) => setGuestId(e.target.value)}>
                  <option value="">Select guest…</option>
                  {allGuests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                </select>
              </div>
              <Button className="w-full" disabled={!roomId && !guestId} loading={processing} onClick={() => createOrderAndPay('room')}>
                <Receipt size={15} /> Create & Charge to Room
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['CASH', 'POS', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <Button className="w-full" loading={processing} onClick={() => createOrderAndPay('pay')}>
                <Check size={15} /> Collect {naira(subtotal)}
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Success */}
      <Modal open={!!successOrder} onClose={() => setSuccessOrder(null)} title="Order Complete">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <p className="font-bold text-ink-900">Order {successOrder?.id} completed</p>
          <p className="text-sm text-ink-500 mt-1">Total {naira(successOrder?.total)} · Inventory stock deducted automatically.</p>
          <Button className="mt-5" onClick={() => setSuccessOrder(null)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}
