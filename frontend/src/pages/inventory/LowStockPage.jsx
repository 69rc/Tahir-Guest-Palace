import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, PackagePlus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, Button, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function LowStockPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/low-stock');
      setItems(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Needs restock</h1>
          <p className="text-sm text-ink-500 mt-1">Items at or below the minimum you set.</p>
        </div>
        <Link to="/inventory/purchases"><Button><PackagePlus size={16} /> Order More</Button></Link>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search low stock items…" className="max-w-sm" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="All stocked up!" message="No items are currently low in stock." icon={AlertTriangle} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map((i) => {
              const shortBy = Math.max(0, i.min_quantity - i.quantity);
              const pct = i.min_quantity > 0 ? Math.round((i.quantity / i.min_quantity) * 100) : 100;
              return (
                <div key={i.id} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-ink-900">{i.name}</p>
                      <p className="text-xs text-ink-500">{i.category_name || 'Uncategorized'}</p>
                    </div>
                    <Badge status="UNPAID">Needs restock</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span>In stock: <b className={i.quantity === 0 ? 'text-red-600' : ''}>{i.quantity} {i.unit}</b></span>
                    <span className="text-ink-500">Min: {i.min_quantity}</span>
                  </div>
                  <div className="mt-2 h-2 bg-white rounded-full overflow-hidden">
                    <div className={`h-full ${pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  {shortBy > 0 && (
                    <p className="mt-3 text-xs text-red-600">Short by {shortBy} {i.unit} · Restock value ≈ {naira(shortBy * i.cost_price)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
