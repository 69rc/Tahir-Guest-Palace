import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageLoader, Badge } from '../../components/ui/index.jsx';
import { naira, fmtDateTime } from '../../utils/format.js';

const HOTEL = {
  name: 'TAHIR GUEST PALACE',
  address: 'Plot 12, Tahir Road, Ikeja, Lagos, Nigeria',
  phone: '+234 800 000 0000',
  email: 'reservations@tahirguestpalace.com',
};

export default function ReceiptPrintPage() {
  const { id } = useParams();
  const [pay, setPay] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/finance/payments/${id}`);
        setPay(res.data);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!pay) return <p className="text-ink-500">Receipt not found.</p>;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/finance/payments" className="btn-ghost !p-2"><ArrowLeft size={18} /></Link>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Download PDF</button>
      </div>

      <div className="bg-white rounded-xl shadow-card p-8 border border-ink-100">
        <div className="text-center border-b-2 border-brand-600 pb-6">
          <h1 className="text-xl font-black text-brand-700 tracking-tight">{HOTEL.name}</h1>
          <p className="text-xs text-ink-500">{HOTEL.address}</p>
          <p className="text-xs text-ink-500">{HOTEL.phone} · {HOTEL.email}</p>
        </div>

        <div className="flex items-start justify-between py-5">
          <p className="text-lg font-bold text-ink-900">PAYMENT RECEIPT</p>
          <div className="text-right text-xs text-ink-500">
            <p>Receipt: <b className="text-ink-800">{pay.payment_no}</b></p>
            {pay.invoice_no && <p>Invoice: <b className="text-ink-800">{pay.invoice_no}</b></p>}
            <p>Date: {fmtDateTime(pay.created_at)}</p>
          </div>
        </div>

        <div className="rounded-lg bg-ink-50 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-500">Received from</span>
            <span className="font-medium text-ink-800">{pay.guest_name || 'Walk-in customer'}</span>
          </div>
          {pay.guest_phone && (
            <div className="flex justify-between text-sm"><span className="text-ink-500">Contact</span><span className="text-ink-700">{pay.guest_phone}</span></div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-ink-500">Payment method</span>
            <span><Badge status={pay.method}>{pay.method}</Badge></span>
          </div>
          {pay.order_no && (
            <div className="flex justify-between text-sm"><span className="text-ink-500">Reference order</span><span className="text-ink-700">{pay.order_no}</span></div>
          )}
          {pay.category && (
            <div className="flex justify-between text-sm"><span className="text-ink-500">Category</span><span className="text-ink-700">{pay.category}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-ink-200 pt-3">
            <span>Amount</span>
            <span className="text-green-600">{naira(pay.amount)}</span>
          </div>
          <div className="flex justify-between text-sm bg-white rounded px-3 py-2 border border-ink-100">
            <span className="text-ink-500">Cashier</span>
            <span className="text-ink-700">{pay.cashier_name || '—'}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-ink-100 text-center text-xs text-ink-400">
          <p>Thank you for your payment. This receipt is computer-generated and valid without a signature.</p>
        </div>
      </div>
    </div>
  );
}
