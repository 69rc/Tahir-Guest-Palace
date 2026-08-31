import { useEffect, useState } from 'react';
import { TrendingUp, Wallet, UtensilsCrossed } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, Button, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

const PIE_COLORS = ['#1c64f2', '#0e9f6e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function RevenuePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/revenue?period=${period}`);
      setData(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [period]);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState title="No data" />;

  const series = data.timeSeries.map((r) => ({
    period: r.period,
    Hotel: Number(r.hotel),
    Restaurant: Number(r.restaurant),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Revenue</h1>
          <p className="text-sm text-ink-500 mt-0.5">Income from room stays and dining</p>
        </div>
        <div className="flex rounded-lg border border-ink-200 overflow-hidden">
          {[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)}
              className={`px-4 py-2 text-sm font-semibold ${period === v ? 'bg-brand-600 text-white' : 'bg-white text-ink-700 hover:bg-ink-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="Total Revenue" value={naira(data.totals.total)} icon={TrendingUp} color="green" />
        <Stat label="Hotel Revenue" value={naira(data.totals.hotel)} icon={Wallet} color="blue" />
        <Stat label="Restaurant Revenue" value={naira(data.totals.restaurant)} icon={UtensilsCrossed} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Revenue Over Time" />
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="hv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c64f2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1c64f2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e9f6e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0e9f6e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => naira(v)} />
                <Legend />
                <Area type="monotone" dataKey="Hotel" stroke="#1c64f2" fill="url(#hv)" />
                <Area type="monotone" dataKey="Restaurant" stroke="#0e9f6e" fill="url(#rv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue by Category" subtitle="Payment method breakdown" />
          <div className="p-4 h-72 flex items-center justify-center">
            {data.byCategory.length === 0 ? <EmptyState title="No revenue yet" /> : (
              <ResponsiveContainer><PieChart>
                <Pie data={data.byCategory} dataKey="total" nameKey="category" outerRadius={85} paddingAngle={2}>
                  {data.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => naira(v)} />
                <Legend />
              </PieChart></ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Revenue Breakdown" />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr className="bg-ink-50">
              <th className="th">Category</th>
              <th className="th text-right">Transactions</th>
              <th className="th text-right">Amount</th>
              <th className="th text-right">Share</th>
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.byCategory.map((c) => (
                <tr key={c.category} className="hover:bg-ink-50">
                  <td className="td font-semibold">{c.category}</td>
                  <td className="td text-right">{c.count}</td>
                  <td className="td text-right font-bold">{naira(c.total)}</td>
                  <td className="td text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-24 h-2 bg-ink-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full" style={{ width: `${data.totals.total ? (Number(c.total) / data.totals.total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-ink-500">{data.totals.total ? Math.round((Number(c.total) / data.totals.total) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
