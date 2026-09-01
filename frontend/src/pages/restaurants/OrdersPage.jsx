import { useEffect, useState } from 'react';
import { Receipt, BedDouble } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import RestaurantSelector from '../../components/restaurant/RestaurantSelector.jsx';
import { Badge, Card, CardHeader, Button, Modal, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';

export default function OrdersPage() {
  const { activeRestaurantId, loading: restLoading } = useRestaurant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const toast = useToast();

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

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.order_no || '').toLowerCase().includes(q) || (o.restaurant_name || '').toLowerCase().includes(q) || String(o.table_number || '').includes(q);
  });

  const openDetail = async (o) => {
    try {
      const res = await api.get(`/restaurants/orders/${o.id}`);
      setDetail(res.data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const actions = (o) => (
    <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      {o.status === 'OPEN' && (
        <>
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); toast.info('Use POS to charge/pay this order'); }}>
            <BedDouble size={14} /> Charge
          </Button>
        </>
      )}
    </div>
  );

  if ((loading && !orders.length) || (restLoading && !activeRestaurantId)) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Restaurant Orders</h1>
          <p className="text-sm text-ink-500 mt-0.5">Orders across selected outlet</p>
        </div>
        <RestaurantSelector />
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search orders…" className="max-w-sm" />
        </div>
        <div className="divide-y divide-ink-100">
          {filtered.length === 0 ? (
            <EmptyState title="No orders found" />
          ) : filtered.map((o) => (
            <button key={o.id} onClick={() => openDetail(o)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-ink-50 transition-colors text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${o.status === 'PAID' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                <Receipt size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800">{o.order_no} · {o.restaurant_name}</p>
                <p className="text-xs text-ink-500">Table {o.table_number || '—'} · {o.guest_name || 'Walk-in'} · {fmtDateTime(o.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-ink-900">{naira(o.total)}</p>
                <Badge status={o.status}>{o.status}</Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.order_no} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">{detail.restaurant_name} · Table {detail.table_number || '—'}</p>
                <p className="text-xs text-ink-400">{fmtDateTime(detail.created_at)}</p>
              </div>
              <Badge status={detail.status}>{detail.status}</Badge>
            </div>
            <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
              {(detail.items || []).map((i) => (
                <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{i.item_name} × {i.quantity}</span>
                  <span className="font-semibold">{naira(i.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{naira(detail.subtotal)}</span></div>
              <div className="flex justify-between text-ink-500"><span>Tax</span><span>{naira(detail.tax)}</span></div>
              <div className="flex justify-between text-ink-500"><span>Service</span><span>{naira(detail.service_charge)}</span></div>
              <div className="flex justify-between border-t border-ink-100 pt-2 font-bold text-ink-900"><span>Total</span><span>{naira(detail.total)}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
