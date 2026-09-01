import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, Table } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/invoices');
      setInvoices(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = invoices.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.invoice_no || '').toLowerCase().includes(q) || (i.guest_name || '').toLowerCase().includes(q) || String(i.room_number || '').includes(q);
  });

  const openDetail = async (inv) => {
    try {
      const res = await api.get(`/finance/invoices/${inv.id}`);
      setDetail(res.data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'invoice_no', label: 'Invoice #', render: (i) => <span className="font-semibold">{i.invoice_no}</span> },
    { key: 'guest_name', label: 'Guest', render: (i) => i.guest_name || 'Walk-in' },
    { key: 'room_number', label: 'Room', render: (i) => i.room_number || '—' },
    { key: 'invoice_type', label: 'Type', render: (i) => <Badge status={i.invoice_type === 'RESTAURANT' ? 'OPEN' : 'PAID'}>{i.invoice_type}</Badge> },
    { key: 'total', label: 'Total', align: 'right', render: (i) => naira(i.total) },
    { key: 'paid', label: 'Paid', align: 'right', render: (i) => <span className="text-green-600">{naira(i.paid)}</span> },
    { key: 'balance', label: 'Balance', align: 'right', render: (i) => <span className="font-bold">{naira(i.balance)}</span> },
    { key: 'status', label: 'Status', render: (i) => <Badge status={i.status}>{i.status}</Badge> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex justify-end gap-1">
        <Link to={`/finance/invoices/${i.id}/print`} className="btn-ghost !p-2" title="Print invoice"><Printer size={15} /></Link>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(i); }}><Eye size={15} /></Button>
      </div>
    ) },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Invoices</h1>
        <p className="text-sm text-ink-500 mt-0.5">Guest folio and restaurant invoices</p>
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices…" className="max-w-sm" />
        </div>
        <Table columns={columns} rows={filtered} onRowClick={openDetail} empty={{ title: 'No invoices yet', message: 'Invoices are created automatically during checkout and POS sales.' }} />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.invoice_no} wide>
        {detail && <InvoiceDetail d={detail} />}
      </Modal>
    </div>
  );
}

function InvoiceDetail({ d }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink-900">{d.guest_name || 'Walk-in Guest'}</h3>
          <p className="text-xs text-ink-500">{d.guest_phone || ''} {d.guest_email ? '· ' + d.guest_email : ''}</p>
          <p className="text-xs text-ink-500 mt-0.5">Room {d.room_number || '—'} · {d.room_type_name || ''}</p>
        </div>
        <Badge status={d.status}>{d.status}</Badge>
      </div>

      <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
        {(d.items || []).map((i) => (
          <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <div className="flex-1 pr-4">
              <p className="font-medium text-ink-800">{i.description}</p>
              <p className="text-xs text-ink-500">Qty {i.quantity} × {naira(i.unit_price)}</p>
            </div>
            <span className="font-semibold">{naira(i.line_total)}</span>
          </div>
        ))}
        {(!d.items || d.items.length === 0) && <p className="p-4 text-sm text-ink-500">No line items.</p>}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{naira(d.subtotal)}</span></div>
        {Number(d.discount) > 0 && <div className="flex justify-between text-ink-500"><span>Discount</span><span>-{naira(d.discount)}</span></div>}
        {Number(d.tax) > 0 && <div className="flex justify-between text-ink-500"><span>Tax</span><span>{naira(d.tax)}</span></div>}
        <div className="flex justify-between border-t border-ink-100 pt-2 font-bold text-ink-900"><span>Total</span><span>{naira(d.total)}</span></div>
      </div>

      {(d.payments || []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Payments on this invoice</p>
          <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
            {(d.payments || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{p.payment_no} · {p.method}</span>
                <span className="font-semibold text-green-600">{naira(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
