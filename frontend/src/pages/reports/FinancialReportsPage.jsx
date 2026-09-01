import { useEffect, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, CardHeader, PageLoader, EmptyState, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { PERM } from '../../utils/permissions.js';

export default function FinancialReportsPage() {
  const { canAccess } = useAuth();
  const hasRestaurant = canAccess(PERM.RESTAURANT_REPORTS_VIEW);
  const [accounting, setAccounting] = useState(null);
  const [restReport, setRestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const [a] = await Promise.all([api.get('/finance/accounting')]);
        setAccounting(a.data);
      } catch (e) {
        toast.error(e.message);
      }
      if (hasRestaurant) {
        try { const r = await api.get('/reports/restaurant'); setRestReport(r.data); } catch { /* optional */ }
      }
      setLoading(false);
    };
    load();
  }, [hasRestaurant]);

  if (loading) return <PageLoader />;
  if (!accounting) return <EmptyState title="No data" />;

  const restaurantRevenue = restReport?.byRestaurant?.reduce((s, r) => s + Number(r.total), 0) || 0;
  const hotelRevenue = accounting.income - restaurantRevenue;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Reports</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Money</h1>
        <p className="text-sm text-ink-500 mt-1">What came in, what went out, what is left.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Money in" value={naira(accounting.income)} icon={TrendingUp} color="green" />
        <Stat label="Money out" value={naira(accounting.expenses)} icon={TrendingDown} color="red" />
        <Stat label="Left over" value={naira(accounting.netIncome)} icon={Calculator} color={accounting.netIncome >= 0 ? 'green' : 'red'} />
        <Stat label="Still owed" value={naira(accounting.outstanding)} icon={AlertTriangle} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Income Breakdown (Hotel vs Restaurant)" />
          <div className="p-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Hotel Revenue</span>
                <span className="font-bold">{naira(hotelRevenue)}</span>
              </div>
              <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: accounting.income ? `${(hotelRevenue / accounting.income) * 100}%` : '0%' }} />
              </div>
              <p className="text-xs text-ink-400 mt-1">{accounting.income ? Math.round((hotelRevenue / accounting.income) * 100) : 0}% of total income</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Restaurant Revenue</span>
                <span className="font-bold">{naira(restaurantRevenue)}</span>
              </div>
              <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: accounting.income ? `${(restaurantRevenue / accounting.income) * 100}%` : '0%' }} />
              </div>
              <p className="text-xs text-ink-400 mt-1">{accounting.income ? Math.round((restaurantRevenue / accounting.income) * 100) : 0}% of total income</p>
            </div>
          </div>
        </Card>

        {hasRestaurant && (
          <Card>
            <CardHeader title="Restaurant Sales by Outlet" />
            <div className="divide-y divide-ink-100">
              {restReport.byRestaurant.map((r) => (
                <div key={r.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-ink-500">{r.orders} completed orders</p>
                  </div>
                  <span className="font-bold">{naira(r.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Expense Categories" />
          <div className="divide-y divide-ink-100">
            {accounting.expenseByCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium">{c.category} <span className="text-ink-400">({c.count})</span></span>
                <span className="font-bold text-red-600">{naira(c.total)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Income by Category" />
          <div className="divide-y divide-ink-100">
            {accounting.incomeByCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium">{c.category} <span className="text-ink-400">({c.count} payments)</span></span>
                <span className="font-bold text-green-600">{naira(c.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><FileText size={22} /></div>
            <div>
              <p className="text-sm text-ink-500">Net Profit</p>
              <p className={`text-2xl font-bold ${accounting.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{naira(accounting.netIncome)}</p>
            </div>
          </div>
          <p className="text-sm text-ink-500 max-w-xs text-right">
            Income {naira(accounting.income)} minus expenses {naira(accounting.expenses)}. {accounting.outstandingCount} guest folios carry {naira(accounting.outstanding)} outstanding.
          </p>
        </div>
      </Card>
    </div>
  );
}
