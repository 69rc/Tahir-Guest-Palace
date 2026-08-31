import { useEffect, useState } from 'react';
import { Package, AlertTriangle, ShoppingBag, Coins } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';

const COLORS = ['#0e9f6e', '#1c64f2', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function InventoryReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reports/inventory');
        setData(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState title="No data" />;

  const movementChart = data.movements.map((m) => ({ name: m.type, value: Number(m.qty) }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Inventory Reports</h1>
        <p className="text-sm text-ink-500 mt-0.5">Stock levels, purchases and movement analysis</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Active Items" value={data.summary?.items || 0} icon={Package} color="brand" />
        <Stat label="Stock Value" value={naira(data.summary?.stock_value)} icon={Coins} color="green" />
        <Stat label="Low Stock Items" value={data.lowStock.length} icon={AlertTriangle} color="red" />
        <Stat label="Purchases" value={data.purchases.length} icon={ShoppingBag} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Movement by Type" subtitle="Quantity moved per transaction type" />
          <div className="p-4 h-64 flex items-center justify-center">
            {movementChart.length === 0 ? <EmptyState title="No movement" /> : (
              <ResponsiveContainer><PieChart>
                <Pie data={movementChart} dataKey="value" nameKey="name" outerRadius={85} paddingAngle={2}>
                  {movementChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart></ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Low Stock Items" subtitle="Need restocking" />
          <div className="divide-y divide-ink-100">
            {data.lowStock.length === 0 ? <EmptyState title="All stocked" /> : data.lowStock.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{i.name}</p>
                  <p className="text-xs text-ink-500">{i.category_name || '—'}</p>
                </div>
                <Badge status="UNPAID">{i.quantity} {i.unit} / min {i.min_quantity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Purchases" subtitle="Supplier restocking history" />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr className="bg-ink-50">
              <th className="th">Ref #</th>
              <th className="th">Supplier</th>
              <th className="th text-right">Total</th>
              <th className="th">Payment</th>
              <th className="th">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.purchases.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <td className="td font-semibold">{p.purchase_no}</td>
                  <td className="td">{p.supplier_name}</td>
                  <td className="td text-right font-bold">{naira(p.total)}</td>
                  <td className="td"><Badge status={p.payment_status === 'PAID' ? 'PAID' : 'UNPAID'}>{p.payment_status}</Badge></td>
                  <td className="td whitespace-nowrap">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
