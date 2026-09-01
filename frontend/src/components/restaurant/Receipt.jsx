import { naira, fmtDateTime } from '../../utils/format.js';

const HOTEL = {
  name: 'TAHIR GUEST PALACE',
  address: 'Plot 12, Tahir Road, Ikeja, Lagos, Nigeria',
  phone: '+234 800 000 0000',
};

function lineName(item) {
  return item.item_name || item.name || 'Item';
}

function lineQty(item) {
  return Number(item.quantity) || 0;
}

function lineTotal(item) {
  if (item.line_total != null) return Number(item.line_total);
  return (Number(item.price) || Number(item.unit_price) || 0) * lineQty(item);
}

export function ReceiptLines({ items = [], onChangeQty }) {
  return (
    <div className="text-sm">
      <div className="flex gap-2 pb-1.5 border-b border-dashed border-ink-300 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        <span className="flex-1">Item</span>
        <span className={onChangeQty ? 'w-20 text-center' : 'w-10 text-center'}>Qty</span>
        <span className="w-20 text-right">Amount</span>
      </div>
      {(items || []).map((i, idx) => (
        <div key={i.id || i.menu_item_id || idx} className="flex gap-2 items-center py-1.5 border-b border-dashed border-ink-100">
          <span className="flex-1 min-w-0 truncate text-ink-800">{lineName(i)}</span>
          {onChangeQty ? (
            <span className="w-20 inline-flex items-center justify-center gap-0.5">
              <button type="button" onClick={() => onChangeQty(i, -1)} className="w-6 h-6 rounded-md text-ink-500 hover:bg-ink-50">−</button>
              <span className="w-5 text-center tabular-nums text-ink-800">{lineQty(i)}</span>
              <button type="button" onClick={() => onChangeQty(i, 1)} className="w-6 h-6 rounded-md text-ink-500 hover:bg-ink-50">+</button>
            </span>
          ) : (
            <span className="w-10 text-center tabular-nums text-ink-600">{lineQty(i)}</span>
          )}
          <span className="w-20 text-right tabular-nums font-medium text-ink-900">{naira(lineTotal(i))}</span>
        </div>
      ))}
    </div>
  );
}

export default function Receipt({
  orderNo,
  outlet,
  customer,
  table,
  items = [],
  subtotal,
  tax,
  service,
  discount,
  total,
  method,
  status,
  date,
}) {
  return (
    <div className="kitchen-receipt mx-auto max-w-sm bg-white text-ink-900">
      <div className="text-center border-b border-dashed border-ink-300 pb-3">
        <p className="text-sm font-black tracking-tight">{HOTEL.name}</p>
        <p className="text-[11px] text-ink-500 mt-0.5">{HOTEL.address}</p>
        <p className="text-[11px] text-ink-500">{HOTEL.phone}</p>
        {outlet && <p className="text-xs font-semibold mt-2">{outlet}</p>}
      </div>

      <div className="py-3 space-y-1 text-xs">
        {orderNo && (
          <div className="flex justify-between">
            <span className="text-ink-500">Ticket</span>
            <span className="font-semibold">{orderNo}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-ink-500">Date</span>
          <span>{fmtDateTime(date || new Date())}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-500">Customer</span>
          <span className="font-semibold text-right max-w-[12rem]">{customer || 'Walk-in'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-500">Table</span>
          <span>{table ? `Table ${table}` : 'Takeaway'}</span>
        </div>
        {status && (
          <div className="flex justify-between">
            <span className="text-ink-500">Status</span>
            <span className="font-semibold">{status}</span>
          </div>
        )}
      </div>

      <ReceiptLines items={items} />

      <div className="pt-3 space-y-1 text-sm">
        <div className="flex justify-between text-ink-500">
          <span>Food</span>
          <span className="tabular-nums">{naira(subtotal)}</span>
        </div>
        {Number(discount) > 0 && (
          <div className="flex justify-between text-ink-500">
            <span>Discount</span>
            <span className="tabular-nums">−{naira(discount)}</span>
          </div>
        )}
        {Number(tax) > 0 && (
          <div className="flex justify-between text-ink-500">
            <span>Tax</span>
            <span className="tabular-nums">{naira(tax)}</span>
          </div>
        )}
        {Number(service) > 0 && (
          <div className="flex justify-between text-ink-500">
            <span>Service</span>
            <span className="tabular-nums">{naira(service)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-ink-200 font-bold text-base">
          <span>Total</span>
          <span className="tabular-nums">{naira(total)}</span>
        </div>
        {method && (
          <div className="flex justify-between text-xs text-ink-500 pt-1">
            <span>Paid by</span>
            <span className="font-semibold text-ink-800">{method}</span>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-ink-400 mt-4">Thank you. Please come again.</p>
    </div>
  );
}
