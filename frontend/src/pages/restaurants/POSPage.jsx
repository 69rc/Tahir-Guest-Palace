import { useEffect, useState } from 'react';
import { CreditCard, BedDouble, Check, Trash2, Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import Receipt, { ReceiptLines } from '../../components/restaurant/Receipt.jsx';
import { Card, Button, Modal, PageLoader, EmptyState, FilterChip, GuestPicker } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

const PAY = [
  { id: 'CASH', label: 'Cash' },
  { id: 'POS', label: 'POS' },
  { id: 'TRANSFER', label: 'Transfer' },
  { id: 'CARD', label: 'Card' },
];

export default function POSPage() {
  const { canAccess } = useAuth();
  const { activeRestaurantId, activeRestaurant, loading: restLoading } = useRestaurant();
  const [menu, setMenu] = useState(null);
  const [tables, setTables] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mode, setMode] = useState('pay');
  const [roomId, setRoomId] = useState('');
  const [method, setMethod] = useState('CASH');
  const [processing, setProcessing] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const toast = useToast();

  const loadData = async (rid) => {
    if (!rid) return;
    setLoading(true);
    try {
      const [m, t] = await Promise.all([
        api.get(`/restaurants/${rid}/menu`),
        api.get(`/restaurants/${rid}/tables`),
      ]);
      setMenu(m.data);
      setTables(t.data);
      setActiveCat((prev) => prev && m.data.categories.some((c) => c.id === prev) ? prev : null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    if (canAccess(PERM.CHARGE_ROOM)) {
      try {
        const r = await api.get('/restaurants/in-house');
        setOccupiedRooms(r.data || []);
      } catch { /* optional */ }
    }
  };

  useEffect(() => { if (activeRestaurantId) loadData(activeRestaurantId); }, [activeRestaurantId]);

  const addToCart = (item) => {
    setFlashId(item.id);
    window.setTimeout(() => setFlashId((id) => (id === item.id ? null : id)), 220);
    setCart((c) => {
      const found = c.find((x) => x.menu_item_id === item.id);
      if (found) return c.map((x) => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { menu_item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((c) => c
      .map((x) => x.menu_item_id === id ? { ...x, quantity: x.quantity + delta } : x)
      .filter((x) => x.quantity > 0));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxRate = Number(activeRestaurant?.tax_rate || 0);
  const svcRate = Number(activeRestaurant?.service_charge || 0);
  const tax = subtotal * taxRate / 100;
  const service = subtotal * svcRate / 100;
  const total = subtotal + tax + service;
  const activeItems = menu?.items.filter((i) => !activeCat || i.category_id === activeCat) || [];
  const canCharge = canAccess(PERM.CHARGE_ROOM) && occupiedRooms.length > 0;
  const roomGuests = occupiedRooms.map((r) => ({
    id: r.id,
    full_name: r.current_guest,
    phone: `Room ${r.room_number}`,
  }));
  const roomGuest = occupiedRooms.find((r) => String(r.id) === String(roomId));
  const tableLabel = tables.find((t) => String(t.id) === String(tableId))?.table_number;

  const snapshotReceipt = (orderNo, paidHow, name) => ({
    no: orderNo,
    outlet: activeRestaurant?.name,
    customer: name,
    table: tableLabel,
    items: cart.map((i) => ({ ...i, line_total: i.price * i.quantity })),
    subtotal,
    tax,
    service,
    total,
    method: paidHow,
    date: new Date().toISOString(),
  });

  const createOrderAndPay = async (action) => {
    const walkIn = customerName.trim();
    if (action !== 'room' && !walkIn) {
      toast.error('Put the customer name on the ticket first.');
      return;
    }
    if (action === 'room' && !roomId) return;
    setProcessing(true);
    try {
      const nameForTicket = action === 'room' ? (roomGuest?.current_guest || walkIn) : walkIn;
      const created = await api.post('/restaurants/orders', {
        restaurant_id: activeRestaurantId,
        table_id: tableId || null,
        customer_name: nameForTicket || null,
        items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
      });
      const orderId = created.data.id;
      if (action === 'room') {
        await api.post(`/restaurants/orders/${orderId}/charge-to-room`, {
          order_id: orderId, room_id: roomId,
        });
        toast.success('Added to the guest room bill');
      } else {
        await api.post(`/restaurants/orders/${orderId}/pay`, { order_id: orderId, method });
        toast.success('Paid');
      }
      setSuccessOrder(snapshotReceipt(
        created.data.order_no,
        action === 'room' ? `Room ${roomGuest?.room_number || ''}` : PAY.find((p) => p.id === method)?.label || method,
        nameForTicket,
      ));
      setCart([]);
      setTableId('');
      setRoomId('');
      setCustomerName('');
      setCheckoutOpen(false);
      loadData(activeRestaurantId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if ((loading && !menu) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Restaurants</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Sell</h1>
        <p className="text-sm text-ink-500 mt-1">Pick the outlet, tap dishes, name the customer, then collect.</p>
      </div>

      <RestaurantSelector />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={activeCat === null} onClick={() => setActiveCat(null)} label="All" />
            {menu?.categories.map((c) => (
              <FilterChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.name} />
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activeItems.map((i) => {
              const qty = cart.find((x) => x.menu_item_id === i.id)?.quantity || 0;
              const on = qty > 0;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => i.is_available && addToCart(i)}
                  disabled={!i.is_available}
                  className={`relative text-left rounded-2xl border p-4 transition-all ${
                    !i.is_available
                      ? 'bg-ink-50 border-ink-100 opacity-50 cursor-not-allowed'
                      : on
                        ? `bg-brand-50 border-brand-500 ring-2 ring-brand-200 ${flashId === i.id ? 'dish-tap' : ''}`
                        : `bg-white border-ink-100 hover:border-brand-300 hover:shadow-card ${flashId === i.id ? 'dish-tap' : ''}`
                  }`}
                >
                  {on && (
                    <span className="absolute top-2 right-2 min-w-[1.5rem] h-6 px-1.5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                      {qty}
                    </span>
                  )}
                  <p className="font-semibold text-ink-900 leading-snug pr-7">{i.name}</p>
                  {i.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{i.description}</p>}
                  <p className="font-bold text-brand-600 mt-3">{naira(i.price)}</p>
                  {!i.is_available && <p className="text-xs text-red-600 mt-1">Sold out</p>}
                  {on && <p className="text-[11px] font-semibold text-brand-700 mt-1">On this ticket</p>}
                </button>
              );
            })}
            {activeItems.length === 0 && (
              <div className="col-span-full"><Card><EmptyState title="No items" message="Add food on the Menu page." /></Card></div>
            )}
          </div>
        </div>

        <Card className="lg:sticky lg:top-24 overflow-hidden">
          <div className="px-5 py-4 border-b border-dashed border-ink-200 text-center">
            <p className="text-[11px] font-black tracking-tight">TAHIR GUEST PALACE</p>
            <p className="text-xs font-semibold text-ink-700 mt-0.5">{activeRestaurant?.name || 'Ticket'}</p>
          </div>

          {cart.length === 0 ? (
            <EmptyState title="Empty ticket" message="Tap a dish to start." />
          ) : (
            <>
              <div className="px-5 py-3 border-b border-ink-100 space-y-2">
                <div>
                  <label className="label">Customer name</label>
                  <input
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in name"
                  />
                </div>
                {canCharge && (
                  <div>
                    <label className="label">Or hotel guest</label>
                    <GuestPicker
                      guests={roomGuests}
                      value={roomId}
                      showAllOnEmpty
                      placeholder="Search name or room…"
                      onSelect={(g) => {
                        if (!g) {
                          setRoomId('');
                          return;
                        }
                        setRoomId(String(g.id));
                        setCustomerName(g.full_name || '');
                      }}
                    />
                  </div>
                )}
                <div>
                  <p className="label">Table</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTableId('')}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${
                        !tableId ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-100 text-ink-600'
                      }`}
                    >
                      Takeaway
                    </button>
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTableId(String(t.id))}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${
                          String(tableId) === String(t.id)
                            ? 'bg-ink-900 text-white border-ink-900'
                            : t.status === 'OCCUPIED'
                              ? 'bg-blue-50 border-blue-200 text-blue-800'
                              : t.status === 'RESERVED'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-white border-ink-100 text-ink-600'
                        }`}
                      >
                        {t.table_number}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 max-h-64 overflow-y-auto">
                <ReceiptLines
                  items={cart.map((i) => ({ ...i, line_total: i.price * i.quantity }))}
                  onChangeQty={(i, delta) => changeQty(i.menu_item_id, delta)}
                />
              </div>

              <div className="px-5 py-4 border-t border-dashed border-ink-200 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-ink-500">Food</span><span>{naira(subtotal)}</span></div>
                {tax > 0 && <div className="flex justify-between text-sm"><span className="text-ink-500">Tax {taxRate}%</span><span>{naira(tax)}</span></div>}
                {service > 0 && <div className="flex justify-between text-sm"><span className="text-ink-500">Service {svcRate}%</span><span>{naira(service)}</span></div>}
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{naira(total)}</span></div>

                {canCharge ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => { setMode('pay'); setCheckoutOpen(true); }}>
                      <CreditCard size={15} /> Collect
                    </Button>
                    <Button variant="secondary" onClick={() => { setMode('room'); setCheckoutOpen(true); }}>
                      <BedDouble size={15} /> Room bill
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => { setMode('pay'); setCheckoutOpen(true); }}>
                    <CreditCard size={15} /> Collect
                  </Button>
                )}
                <button type="button" onClick={() => { setCart([]); setTableId(''); setCustomerName(''); setRoomId(''); }} className="w-full text-xs text-ink-400 hover:text-ink-600 flex items-center justify-center gap-1">
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={mode === 'room' ? 'Put on room bill' : 'Collect money'}>
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-4 flex justify-between items-center">
            <span className="text-sm text-ink-500">To collect</span>
            <span className="text-xl font-bold">{naira(total)}</span>
          </div>
          {customerName.trim() && (
            <p className="text-sm text-ink-600">Customer: <b>{customerName.trim()}</b></p>
          )}

          {mode === 'room' ? (
            <>
              <div>
                <label className="label">Guest in house</label>
                <GuestPicker
                  guests={roomGuests}
                  value={roomId}
                  showAllOnEmpty
                  placeholder="Search name or room…"
                  onSelect={(g) => {
                    if (!g) {
                      setRoomId('');
                      return;
                    }
                    setRoomId(String(g.id));
                    setCustomerName(g.full_name || '');
                  }}
                />
              </div>
              <Button className="w-full" disabled={!roomId} loading={processing} onClick={() => createOrderAndPay('room')}>
                Add to room bill
              </Button>
            </>
          ) : (
            <>
              {!customerName.trim() && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Add the customer name on the ticket so it prints on the receipt.</p>
              )}
              <div>
                <label className="label">How they paid</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAY.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <Button className="w-full" disabled={!customerName.trim()} loading={processing} onClick={() => createOrderAndPay('pay')}>
                <Check size={15} /> Collect {naira(total)}
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!successOrder} onClose={() => setSuccessOrder(null)} title="Receipt">
        {successOrder && (
          <div className="space-y-4">
            <Receipt
              orderNo={successOrder.no}
              outlet={successOrder.outlet}
              customer={successOrder.customer}
              table={successOrder.table}
              items={successOrder.items}
              subtotal={successOrder.subtotal}
              tax={successOrder.tax}
              service={successOrder.service}
              total={successOrder.total}
              method={successOrder.method}
              status="Paid"
              date={successOrder.date}
            />
            <div className="flex gap-2 print-hide">
              <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
                <Printer size={15} /> Print
              </Button>
              <Button className="flex-1" onClick={() => setSuccessOrder(null)}>Next order</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
