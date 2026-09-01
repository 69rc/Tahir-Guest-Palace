import { useEffect, useState } from 'react';
import { Percent, BedDouble, TrendingUp, CalendarRange, XCircle, UserX, DollarSign } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, Button, PageLoader, Stat } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

export default function KPIsPage() {
  const [kpis, setKpis] = useState(null);
  const [dept, setDept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [k, d] = await Promise.all([
        api.get('/reports/kpis'),
        api.get(`/reports/department-revenue?period=${period}`),
      ]);
      setKpis(k.data);
      setDept(d.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [period]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Reports</p>
          <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Hotel numbers</h1>
          <p className="text-sm text-ink-500 mt-1">How full the house is, average room price, and money by department.</p>
        </div>
        <div className="flex gap-1">
          {['today','week','month'].map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Rooms filled" value={`${Number(kpis.occupancyPercent).toFixed(1)}%`} icon={Percent} color="brand" />
        <Stat label="Avg room price" value={naira(kpis.averageDailyRate)} icon={BedDouble} color="blue" />
        <Stat label="Per available room" value={naira(kpis.revpar)} icon={TrendingUp} color="violet" />
        <Stat label="Avg nights stayed" value={`${Number(kpis.averageLengthOfStay).toFixed(1)} nights`} icon={CalendarRange} color="green" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Room money" value={naira(kpis.roomRevenue)} icon={DollarSign} color="green" />
        <Stat label="Cancelled" value={`${Number(kpis.cancellationRate).toFixed(1)}%`} icon={XCircle} color="amber" />
        <Stat label="No-show" value={`${Number(kpis.noShowRate).toFixed(1)}%`} icon={UserX} color="red" />
        <Stat label="Nights sold" value={kpis.soldNights} icon={BedDouble} color="blue" />
      </div>
      <p className="text-xs text-ink-400">
        Avg room price is what occupied rooms sold for. Per available room is that price times how full the house is.
      </p>

      <Card>
        <CardHeader title="Money by department" subtitle={`${dept.period.from} → ${dept.period.to}`} />
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Rooms</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.rooms)}</p>
            </div>
            <div className="rounded-lg border border-ink-100 p-4 md:col-span-2">
              <p className="text-xs text-ink-500">Restaurants</p>
              <div className="mt-1 space-y-1">
                {dept.restaurants.map((r) => (
                  <div key={r.name} className="flex justify-between text-sm">
                    <span className="text-ink-700">{r.name}</span>
                    <span className="font-medium">{naira(r.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Spa</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.spa)}</p>
            </div>
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Barbershop</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.barbershop)}</p>
            </div>
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Pool / Services</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.poolServices)}</p>
            </div>
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Events</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.events)}</p>
            </div>
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs text-ink-500">Other services</p>
              <p className="text-lg font-bold text-ink-900">{naira(dept.other)}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
