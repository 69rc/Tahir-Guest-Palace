import { useEffect, useState } from 'react';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, PageLoader, EmptyState, SearchInput } from '../../components/ui/index.jsx';
import { fmtDateTime } from '../../utils/format.js';

const TYPE_META = {
  PURCHASE: { badge: 'PAID', label: 'Bought' },
  SALE: { badge: 'OPEN', label: 'Sold' },
  ADJUSTMENT: { badge: 'CANCELLED', label: 'Adjusted' },
  WASTAGE: { badge: 'MAINTENANCE', label: 'Waste' },
  ADDITION: { badge: 'PAID', label: 'Added' },
  OPENING: { badge: 'CHECKED_IN', label: 'Opening stock' },
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/movements');
      setMovements(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = movements.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.item_name || '').toLowerCase().includes(q) || (m.type || '').toLowerCase().includes(q) || (m.note || '').toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inventory</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Stock in and out</h1>
          <p className="text-sm text-ink-500 mt-1">Bought, sold, added, or thrown away.</p>
        </div>
        <Button variant="secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search item or note…" className="max-w-sm" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No movement recorded" message="Purchases and sales will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr className="bg-ink-50">
                <th className="th">Item</th>
                <th className="th">Type</th>
                <th className="th text-right">Qty</th>
                <th className="th">Note</th>
                <th className="th">By</th>
                <th className="th">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((m) => {
                  const s = TYPE_META[m.type] || TYPE_META.ADJUSTMENT;
                  const isIn = ['PURCHASE', 'ADDITION', 'OPENING'].includes(m.type);
                  return (
                    <tr key={m.id} className="hover:bg-ink-50 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2 font-semibold"><ArrowLeftRight size={14} className="text-ink-400" /> {m.item_name}</div>
                      </td>
                      <td className="td"><Badge status={s.badge}>{s.label}</Badge></td>
                      <td className={`td text-right font-bold ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                        {isIn ? '+' : '−'}{Number(m.quantity)} {m.unit}
                      </td>
                      <td className="td text-ink-500">{m.note || '—'}</td>
                      <td className="td">{m.user_name || '—'}</td>
                      <td className="td whitespace-nowrap text-ink-500">{fmtDateTime(m.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
