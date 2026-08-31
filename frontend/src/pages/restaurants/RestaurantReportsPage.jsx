import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

const PIE_COLORS = ['#1c64f2', '#0e9f6e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b', '#dc2626'];

export default function RestaurantReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reports/restaurant');
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

  const daily = data.dailySales.map((d) => ({ day: d.day, [d.restaurant_name]: Number(d.total) }));
  const byItem = data.byItem.map((i) => ({ name: i.item_name, value: Number(i.total) }));
  const byCat = data.byCategory.map((c) => ({ name: c.category, value: Number(c.total) }));

  const totalRest = data.byRestaurant.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Restaurant Reports</h1>
        <p className="text-sm text-ink-500 mt-0.5">Sales performance across outlets</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5"><p className="text-xs text-ink-500">Total Sales</p><p className="text-xl font-bold">{naira(totalRest)}</p></Card>
        <Card className="p-5"><p className="text-xs text-ink-500">Orders Completed</p><p className="text-xl font-bold">{data.dailySales.reduce((s, d) => s + Number(d.orders), 0)}</p></Card>
        <Card className="p-5"><p className="text-xs text-ink-500">Top Item</p><p className="text-xl font-bold truncate">{data.byItem[0]?.item_name || '—'}</p></Card>
        <Card className="p-5"><p className="text-xs text-ink-500">Top Outlet</p><p className="text-xl font-bold truncate">{data.byRestaurant[0]?.name || '—'}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Sales by Outlet" />
          <div className="p-4 grid gap-3">
            {data.byRestaurant.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="font-semibold">{naira(r.total)}</span>
                  </div>
                  <div className="mt-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: totalRest ? `${(Number(r.total) / totalRest) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sales by Category" />
          <div className="p-4 h-64 flex items-center justify-center">
            {byCat.length === 0 ? <EmptyState title="No category data" /> : (
              <ResponsiveContainer><PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={85} paddingAngle={2}>
                  {byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => naira(v)} />
                <Legend />
              </PieChart></ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Daily Sales (Paid Orders)" />
        <div className="p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => naira(v)} />
              <Legend />
              <Bar dataKey="Palace Grill House" fill="#1c64f2" />
              <Bar dataKey="Tahir Garden Café" fill="#0e9f6e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Best Selling Items" subtitle="By revenue from completed orders" />
        <div className="divide-y divide-ink-100">
          {data.byItem.slice(0, 10).map((i, idx) => (
            <div key={i.item_name} className="flex items-center gap-4 px-5 py-3">
              <span className="w-6 h-6 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
              <span className="flex-1 font-semibold text-ink-800">{i.item_name}</span>
              <span className="text-sm text-ink-500">{i.qty} sold</span>
              <span className="font-bold">{naira(i.total)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
