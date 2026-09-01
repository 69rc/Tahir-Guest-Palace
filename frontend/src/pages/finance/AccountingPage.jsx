import { useEffect, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from 'recharts';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { naira } from '../../utils/format.js';

const COLORS = ['#0e9f6e', '#1c64f2', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b'];

export default function AccountingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/finance/accounting');
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

  const incomeChart = data.incomeByCategory.map((c) => ({ name: c.category, Income: Number(c.total) }));
  const expenseChart = data.expenseByCategory.map((c) => ({ name: c.category, Expense: Number(c.total) }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Finance</p>
        <h1 className="text-2xl font-bold text-ink-900 mt-0.5">Books</h1>
        <p className="text-sm text-ink-500 mt-1">Money in minus money out. What guests still owe.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5"><p className="text-xs text-ink-500">Money in</p><p className="text-xl font-bold text-green-600">{naira(data.income)}</p></Card>
        <Card className="p-5"><p className="text-xs text-ink-500">Money out</p><p className="text-xl font-bold text-red-600">{naira(data.expenses)}</p></Card>
        <Card className="p-5">
          <p className="text-xs text-ink-500">Left over</p>
          <p className={`text-xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{naira(data.netIncome)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-500">Still owed</p>
          <p className="text-xl font-bold text-amber-600">{naira(data.outstanding)}</p>
          <p className="text-xs text-ink-500">{data.outstandingCount} open bills</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Money in by kind" />
          <div className="p-4 h-64">
            {incomeChart.length === 0 ? <EmptyState title="No income" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => naira(v)} />
                  <Bar dataKey="Income" fill="#0e9f6e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Money out by kind" />
          <div className="p-4 h-64">
            {expenseChart.length === 0 ? <EmptyState title="No expenses" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => naira(v)} />
                  <Bar dataKey="Expense" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Money in detail" />
          <div className="divide-y divide-ink-100">
            {data.incomeByCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{c.category} <span className="text-ink-400">({c.count} payments)</span></span>
                <span className="font-bold text-green-600">{naira(c.total)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Money out detail" />
          <div className="divide-y divide-ink-100">
            {data.expenseByCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{c.category} <span className="text-ink-400">({c.count} entries)</span></span>
                <span className="font-bold text-red-600">{naira(c.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Calculator size={22} /></div>
            <div>
              <p className="text-sm text-ink-500">Profit & Loss Position</p>
              <p className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{naira(data.netIncome)}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-ink-500">Outstanding balance: <b className="text-amber-600">{naira(data.outstanding)}</b></p>
            <p className="text-ink-400 text-xs mt-1">Still owed by guests who have not fully paid</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
