import { useEffect, useState } from 'react';
import { TrendingUp, Wallet, Calculator } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

const CATEGORY_LABELS = {
  ROOM: 'Hotel Rooms',
  RESTAURANT: 'Restaurants',
  SPA: 'Spa',
  BARBERSHOP: 'Barbershop',
  AMENITY: 'Amenities & Pool',
  EVENT: 'Conference & Events',
  OTHER: 'Other',
};

export default function CombinedReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reports/combined');
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

  const { byCategory, totalRevenue, totalExpenses, netRevenue, byMonth } = data;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Reports</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">All together</h1>
        <p className="text-sm text-ink-500 mt-1">Rooms, restaurants, spa, events — one picture.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="All money in" value={naira(totalRevenue)} icon={TrendingUp} color="green" />
        <Stat label="Money out" value={naira(totalExpenses)} icon={Wallet} color="red" />
        <Stat label="Left over" value={naira(netRevenue)} icon={Calculator} color={netRevenue >= 0 ? 'blue' : 'red'} />
        <Stat label="Revenue Streams" value={byCategory.length} icon={TrendingUp} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Revenue by Category" subtitle="All revenue streams" />
          <div className="p-4">
            {byCategory.length === 0 ? (
              <EmptyState title="No revenue data" />
            ) : (
              <div className="space-y-3">
                {byCategory.map((c) => {
                  const pct = totalRevenue ? ((Number(c.revenue) / totalRevenue) * 100).toFixed(1) : 0;
                  return (
                    <div key={c.category} className="p-3 rounded-lg bg-ink-50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-ink-800">{CATEGORY_LABELS[c.category] || c.category}</p>
                        <p className="text-sm font-bold text-ink-900">{naira(c.revenue)}</p>
                      </div>
                      <div className="w-full bg-ink-200 rounded-full h-1.5">
                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-ink-500 mt-1">{c.transactions} transactions · {pct}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly Breakdown" subtitle="Revenue by month and category" />
          <div className="p-4">
            {byMonth.length === 0 ? (
              <EmptyState title="No monthly data" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-500 uppercase">
                      <th className="pb-2 pr-3">Month</th>
                      <th className="pb-2 pr-3 text-right">Hotel</th>
                      <th className="pb-2 pr-3 text-right">Restaurant</th>
                      <th className="pb-2 pr-3 text-right">Spa</th>
                      <th className="pb-2 pr-3 text-right">Events</th>
                      <th className="pb-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMonth.map((m) => (
                      <tr key={m.month} className="border-t border-ink-100">
                        <td className="py-2 pr-3 font-medium text-ink-800">{m.month}</td>
                        <td className="py-2 pr-3 text-right text-ink-600">{naira(m.hotel)}</td>
                        <td className="py-2 pr-3 text-right text-ink-600">{naira(m.restaurant)}</td>
                        <td className="py-2 pr-3 text-right text-ink-600">{naira(Number(m.spa) + Number(m.barbershop) + Number(m.amenity))}</td>
                        <td className="py-2 pr-3 text-right text-ink-600">{naira(m.events)}</td>
                        <td className="py-2 text-right font-semibold text-ink-900">{naira(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Summary Grid */}
      <Card>
        <CardHeader title="Revenue Summary" subtitle="Quick comparison across all departments" />
        <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {byCategory.map((c) => (
              <div key={c.category} className="p-3 rounded-lg bg-ink-50 text-center">
                <p className="text-xs text-ink-500 mb-1">{CATEGORY_LABELS[c.category] || c.category}</p>
                <p className="text-lg font-bold text-ink-900">{naira(c.revenue)}</p>
                <p className="text-[10px] text-ink-400">{c.transactions} txns</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
