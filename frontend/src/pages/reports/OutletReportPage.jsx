import { useEffect, useState } from 'react';
import { UtensilsCrossed, TrendingUp } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function OutletReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const [rptRes, restRes] = await Promise.all([
          api.get(`/reports/restaurant${restaurantId ? `?restaurant_id=${restaurantId}` : ''}`),
          api.get('/restaurants'),
        ]);
        setData(rptRes.data);
        setRestaurants(restRes.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [restaurantId]);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState title="No data" />;

  const totalSales = data.byRestaurant.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Outlet Report</h1>
          <p className="text-sm text-ink-500 mt-0.5">Revenue breakdown by restaurant/outlet</p>
        </div>
        <select
          className="input max-w-xs"
          value={restaurantId}
          onChange={(e) => { setRestaurantId(e.target.value); setLoading(true); }}
        >
          <option value="">All Restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="Total Sales" value={naira(totalSales)} icon={TrendingUp} color="green" />
        <Stat label="Active Outlets" value={data.byRestaurant.length} icon={UtensilsCrossed} color="brand" />
        <Stat label="Top Items" value={data.byItem.length} icon={UtensilsCrossed} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Sales by Outlet" subtitle="Completed order revenue" />
          <div className="p-4">
            {data.byRestaurant.length === 0 ? (
              <EmptyState title="No sales data" />
            ) : (
              <div className="space-y-3">
                {data.byRestaurant.map((r, i) => {
                  const pct = totalSales ? ((Number(r.total) / totalSales) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} className="p-3 rounded-lg bg-ink-50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-ink-800">{r.name}</p>
                        <p className="text-sm font-bold text-ink-900">{naira(r.total)}</p>
                      </div>
                      <div className="w-full bg-ink-200 rounded-full h-1.5">
                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-ink-500 mt-1">{r.orders} orders · {pct}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Selling Items" subtitle="Best performing menu items" />
          <div className="p-4">
            {data.byItem.length === 0 ? (
              <EmptyState title="No item data" />
            ) : (
              <div className="space-y-2">
                {data.byItem.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-ink-50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-ink-800">{item.item_name}</p>
                        <p className="text-xs text-ink-500">{item.qty} sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-ink-700">{naira(item.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {data.byCategory.length > 0 && (
        <Card>
          <CardHeader title="Sales by Category" subtitle="Menu category breakdown" />
          <div className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.byCategory.map((c, i) => (
                <div key={i} className="p-3 rounded-lg bg-ink-50">
                  <p className="text-xs text-ink-500">{c.category}</p>
                  <p className="text-lg font-bold text-ink-900">{naira(c.total)}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
