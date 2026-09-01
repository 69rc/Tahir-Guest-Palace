import { useEffect, useState } from 'react';
import { Flower2, BarChart3, TrendingUp } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function AmenitiesReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/amenities/reports');
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

  const totalRevenue = data.amenities.reduce((s, a) => s + Number(a.revenue), 0);
  const totalBookings = data.amenities.reduce((s, a) => s + Number(a.bookings), 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Reports</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Amenities</h1>
        <p className="text-sm text-ink-500 mt-1">Spa, pool and other services — how much they made.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="Total Revenue" value={naira(totalRevenue)} icon={TrendingUp} color="green" />
        <Stat label="Total Bookings" value={totalBookings} icon={BarChart3} color="blue" />
        <Stat label="Active Amenities" value={data.amenities.length} icon={Flower2} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Revenue by Amenity" subtitle="Completed appointment revenue" />
          <div className="p-4">
            {data.amenities.length === 0 ? (
              <EmptyState title="No amenity data" message="Revenue will appear once services are used." />
            ) : (
              <div className="space-y-3">
                {data.amenities.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{a.amenity_name}</p>
                      <p className="text-xs text-ink-500">{a.category} · {a.bookings} bookings</p>
                    </div>
                    <p className="text-sm font-bold text-ink-900">{naira(a.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Most Used Services" subtitle="Top services by booking count" />
          <div className="p-4">
            {data.byService.length === 0 ? (
              <EmptyState title="No service data" />
            ) : (
              <div className="space-y-2">
                {data.byService.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-50">
                    <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-800 truncate">{s.name}</p>
                      <p className="text-xs text-ink-500">{s.bookings} bookings</p>
                    </div>
                    <p className="text-sm font-semibold text-ink-700">{naira(s.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
