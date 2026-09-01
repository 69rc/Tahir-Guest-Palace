import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageLoader, Badge } from '../../components/ui/index.jsx';
import { naira, fmtDate, fmtDateTime } from '../../utils/format.js';

const HOTEL = {
  name: 'TAHIR GUEST PALACE',
  tagline: 'Luxury Hospitality & Events',
  address: 'Plot 12, Tahir Road, Ikeja, Lagos, Nigeria',
  phone: '+234 800 000 0000',
  email: 'reservations@tahirguestpalace.com',
};

export default function InvoicePrintPage() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/finance/invoices/${id}`);
        setInv(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!inv) return <p className="text-ink-500">Invoice not found.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/finance/invoices" className="btn-ghost !p-2"><ArrowLeft size={18} /></Link>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Download PDF</button>
      </div>

      {/* Professional Invoice */}
      <div className="bg-white rounded-xl shadow-card p-8 border border-ink-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-600 pb-6">
          <div>
            <h1 className="text-2xl font-black text-brand-700 tracking-tight">{HOTEL.name}</h1>
            <p className="text-xs text-ink-500">{HOTEL.tagline}</p>
            <p className="text-xs text-ink-500 mt-2">{HOTEL.address}</p>
            <p className="text-xs text-ink-500">{HOTEL.phone} · {HOTEL.email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-ink-800">INVOICE</p>
            <p className="text-xs text-ink-500 mt-1">No. <b className="text-ink-800">{inv.invoice_no}</b></p>
            <p className="text-xs text-ink-500">Date: {fmtDateTime(inv.created_at)}</p>
          </div>
        </div>

        {/* Bill to */}
        <div className="flex items-start justify-between py-6">
          <div>
            <p className="text-xs font-bold text-ink-400 uppercase">Billed To</p>
            <p className="text-lg font-bold text-ink-900 mt-1">{inv.guest_name || 'Walk-in Guest'}</p>
            <p className="text-xs text-ink-500">{inv.guest_phone || ''} {inv.guest_email ? '· ' + inv.guest_email : ''}</p>
            {inv.address && <p className="text-xs text-ink-500">{inv.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-ink-400 uppercase">Room &amp; Stay</p>
            <p className="text-sm font-bold text-ink-800 mt-1">Room {inv.room_number || '—'}</p>
            <p className="text-xs text-ink-500">{inv.room_type_name || ''}</p>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink-100 text-left">
              <th className="py-2 pr-2 text-ink-400 font-semibold">Description</th>
              <th className="py-2 px-2 text-ink-400 font-semibold text-center">Qty</th>
              <th className="py-2 px-2 text-ink-400 font-semibold text-right">Unit</th>
              <th className="py-2 pl-2 text-ink-400 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((i) => (
              <tr key={i.id} className="border-b border-ink-50">
                <td className="py-2.5 pr-2 font-medium text-ink-800">{i.description}</td>
                <td className="py-2.5 px-2 text-center text-ink-600">{i.quantity}</td>
                <td className="py-2.5 px-2 text-right text-ink-600">{naira(i.unit_price)}</td>
                <td className="py-2.5 pl-2 text-right font-semibold text-ink-900">{naira(i.line_total)}</td>
              </tr>
            ))}
            {(!inv.items || inv.items.length === 0) && (
              <tr><td colSpan={4} className="py-3 text-ink-500">No line items.</td></tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-6">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{naira(inv.subtotal)}</span></div>
            {Number(inv.discount) > 0 && <div className="flex justify-between text-ink-500"><span>Discount</span><span>-{naira(inv.discount)}</span></div>}
            {Number(inv.tax) > 0 && <div className="flex justify-between text-ink-500"><span>Tax / Service Charge</span><span>{naira(inv.tax)}</span></div>}
            <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-bold text-ink-900"><span>Total</span><span>{naira(inv.total)}</span></div>
            <div className="flex justify-between text-green-600"><span>Amount Paid</span><span>{naira(inv.paid)}</span></div>
            <div className={`flex justify-between font-bold ${inv.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}><span>Balance</span><span>{naira(inv.balance)}</span></div>
          </div>
        </div>

        {/* Payments */}
        {(inv.payments || []).length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold text-ink-400 uppercase mb-2">Payment History</p>
            <div className="border border-ink-100 rounded divide-y divide-ink-100">
              {(inv.payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-ink-600">{p.payment_no} · <Badge status={p.method}>{p.method}</Badge></span>
                  <span className="font-semibold text-green-600">{naira(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-ink-100 text-center text-xs text-ink-400">
          <p>Thank you for choosing {HOTEL.name}. This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </div>
  );
}
