import { useEffect, useState } from 'react';
import { LogIn, LogOut, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, Button, Modal, PageLoader, Badge, Stat, Table, EmptyState } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ShiftsPage() {
  const [current, setCurrent] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [report, setReport] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staff_user_id: '', opening_cash: 0 });
  const [closing, setClosing] = useState('');
  const toast = useToast();
  const { user, canAccess } = useAuth();

  const canClose = canAccess('shifts:close');
  const canManage = canAccess('shifts:manage');

  const load = async () => {
    setLoading(true);
    try {
      const [cur, sh, rep, staff] = await Promise.all([
        api.get('/shifts/current'),
        api.get('/shifts'),
        canClose ? api.get('/shifts/reports') : Promise.resolve({ data: null }),
        api.get('/staff'),
      ]);
      setCurrent(cur.data);
      setShifts(sh.data);
      setReport(rep.data);
      setUsers(staff.data.filter((u) => ['ACCOUNTANT','RECEPTIONIST','ADMIN','SUPER_ADMIN','GENERAL_MANAGER'].includes(u.role_name)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCurrent = async () => {
    setSaving(true);
    try {
      await api.post('/shifts', {
        staff_user_id: form.staff_user_id || user.id,
        opening_cash: Number(form.opening_cash) || 0,
      });
      toast.success('Shift opened');
      setOpen(false);
      setForm({ staff_user_id: '', opening_cash: 0 });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doClose = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await api.post(`/shifts/${current.shift.id}/close`, { closing_cash: Number(closing) });
      toast.success(`Shift closed. Difference: ${naira(res.reconciliation.difference)}`);
      setCloseOpen(false);
      setClosing('');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  const columns = [
    { key: 'shift_no', label: 'Shift' },
    { key: 'cashier_name', label: 'Cashier' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { key: 'opening_cash', label: 'Opening', render: (r) => naira(r.opening_cash) },
    { key: 'gross_sales', label: 'Sales', render: (r) => naira(r.cash_total + r.pos_total + r.transfer_total + r.card_total) },
    { key: 'expected_cash', label: 'Expected', render: (r) => naira(r.expected_cash) },
    { key: 'closing_cash', label: 'Actual', render: (r) => r.closing_cash != null ? naira(r.closing_cash) : '—' },
    {
      key: 'difference', label: 'Difference', render: (r) => {
        if (r.difference == null) return '—';
        const v = Number(r.difference);
        return <span className={v === 0 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>{naira(v)}</span>;
      }
    },
    { key: 'opened_at', label: 'Opened', render: (r) => fmtDateTime(r.opened_at) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Cashier &amp; Shifts</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage cashier shifts, payments and reconciliation</p>
        </div>
        <Button onClick={() => setOpen(true)}><LogIn size={16} /> Open Shift</Button>
      </div>

      {current ? (
        <Card className="border-green-200 bg-green-50/30">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-green-700 uppercase">Open Shift · {current.shift.shift_no}</p>
                <p className="text-sm text-ink-600 mt-0.5">{current.shift.cashier_user_name || ''} · Opened {fmtDateTime(current.shift.opened_at)}</p>
              </div>
              {canClose && <Button variant="danger" onClick={() => setCloseOpen(true)}><LogOut size={16} /> Close Shift</Button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Opening Cash" value={naira(current.shift.opening_cash)} icon={DollarSign} color="blue" />
              <Stat label="Cash Sales" value={naira(current.totals.cash_total)} icon={TrendingUp} color="green" />
              <Stat label="POS" value={naira(current.totals.pos_total)} icon={TrendingUp} color="blue" />
              <Stat label="Refunds" value={naira(current.totals.refund_total)} icon={TrendingUp} color="red" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <Stat label="Transfer" value={naira(current.totals.transfer_total)} icon={TrendingUp} color="violet" />
              <Stat label="Card" value={naira(current.totals.card_total)} icon={TrendingUp} color="amber" />
              <Stat label="Expected Cash" value={naira(current.expectedCash)} icon={DollarSign} color="brand" />
              <Stat label="Transactions" value={current.totals.total_transactions} icon={RefreshCw} color="brand" />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-ink-500">
          <p className="text-sm">No open shift. <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><LogIn size={14} /> Open one now</Button></p>
        </Card>
      )}

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Cash" value={naira(report.methodTotals.cash)} icon={DollarSign} color="green" />
          <Stat label="Total POS" value={naira(report.methodTotals.pos)} icon={DollarSign} color="blue" />
          <Stat label="Total Transfer" value={naira(report.methodTotals.transfer)} icon={DollarSign} color="violet" />
          <Stat label="Total Card" value={naira(report.methodTotals.card)} icon={DollarSign} color="amber" />
        </div>
      )}

      {report?.differences?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader title="Reconciliation Differences" subtitle="Shifts with cash differences requiring review" />
          <div className="divide-y divide-ink-100">
            {report.differences.slice(0, 5).map((d) => (
              <div key={d.shift_no} className="flex items-center justify-between p-3 text-sm">
                <span><b>{d.shift_no}</b> · {d.full_name || 'cashier'}</span>
                <span className="text-amber-600 font-semibold">{naira(d.difference)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="All Shifts" subtitle={`${shifts.length} shifts recorded`} />
        <Table columns={columns} rows={shifts} keyField="id" empty={{ title: 'No shifts yet', message: 'Open a shift to begin recording.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Open Shift">
        <div className="space-y-4">
          <div>
            <label className="label">Cashier</label>
            <select className="input" value={form.staff_user_id || user.id} onChange={(e) => setForm({ ...form, staff_user_id: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Opening Cash Balance (₦)</label>
            <input type="number" min="0" className="input" value={form.opening_cash} onChange={(e) => setForm({ ...form, opening_cash: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={openCurrent} loading={saving}><LogIn size={14} /> Open Shift</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title={`Close Shift ${current?.shift?.shift_no || ''}`}>
        {current && (
          <div className="space-y-4">
            <div className="rounded-lg bg-ink-50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Opening Cash</span><span>{naira(current.shift.opening_cash)}</span></div>
              <div className="flex justify-between"><span>Cash Sales</span><span>{naira(current.totals.cash_total)}</span></div>
              <div className="flex justify-between"><span>Refunds</span><span>−{naira(current.totals.refund_total)}</span></div>
              <div className="flex justify-between font-bold border-t border-ink-200 pt-1"><span>Expected Cash</span><span>{naira(current.expectedCash)}</span></div>
            </div>
            <div>
              <label className="label">Actual Cash Counted (₦)</label>
              <input type="number" min="0" className="input" value={closing} onChange={(e) => setClosing(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCloseOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={doClose} loading={saving}><LogOut size={14} /> Close &amp; Reconcile</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
