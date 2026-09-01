import { useEffect, useState } from 'react';
import { PackagePlus, Plus, CheckCircle2, XCircle, ChevronsRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, CardHeader, Button, Modal, PageLoader, Badge, EmptyState, Table } from '../../components/ui/index.jsx';
import { naira, fmtDate } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ department: '', reason: '', items: [{ inventory_item_id: '', item_name: '', quantity: 1, unit_price: 0 }] });
  const toast = useToast();
  const { canAccess } = useAuth();

  const canApprove = canAccess('purchase_requests:approve');
  const canCreate = canAccess('purchase_requests:create');
  const canReceive = canAccess('goods_received:manage');

  const load = async () => {
    setLoading(true);
    try {
      const [r, inv, sup] = await Promise.all([
        api.get('/purchase-requests'),
        api.get('/inventory'),
        api.get('/inventory/suppliers'),
      ]);
      setRequests(r.data);
      setInventory(inv.data);
      setSuppliers(sup.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setForm({ ...form, items: [...form.items, { inventory_item_id: '', item_name: '', quantity: 1, unit_price: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const setItem = (i, key, val) => {
    const items = form.items.map((it, idx) => {
      if (idx !== i) return it;
      const upd = { ...it, [key]: val };
      if (key === 'inventory_item_id') {
        const found = inventory.find((x) => String(x.id) === String(val));
        if (found) { upd.item_name = found.name; upd.unit_price = found.cost_price; }
      }
      return upd;
    });
    setForm({ ...form, items });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/purchase-requests', {
        department: form.department,
        reason: form.reason,
        items: form.items,
      });
      toast.success('Purchase request submitted');
      setOpen(false);
      setForm({ department: '', reason: '', items: [{ inventory_item_id: '', item_name: '', quantity: 1, unit_price: 0 }] });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const approve = async (id, ok) => {
    try {
      await api.post(`/purchase-requests/${id}/approve`, { approved: ok });
      toast.success(ok ? 'Approved' : 'Rejected');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const openDetail = async (r) => {
    try {
      const res = await api.get(`/purchase-requests/${r.id}`);
      setDetail(res.data);
    } catch (e) { toast.error(e.message); }
  };

  const convert = async (id) => {
    if (!suppliers.length) return toast.error('Create a supplier first');
    try {
      await api.post(`/purchase-requests/${id}/convert`, { supplier_id: suppliers[0].id });
      toast.success('Converted to purchase order');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const columns = [
    { key: 'request_no', label: 'Request' },
    { key: 'requested_by_name', label: 'Requested by' },
    { key: 'department', label: 'Department', render: (r) => r.department || '—' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { key: 'created_at', label: 'Date', render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Procurement</h1>
          <p className="text-sm text-ink-500 mt-0.5">Purchase requests → approval → purchase order → goods received</p>
        </div>
        {canCreate && <Button onClick={() => setOpen(true)}><PackagePlus size={16} /> New Purchase Request</Button>}
      </div>

      <Card>
        <CardHeader title="Purchase Requests" />
        <Table
          columns={columns}
          rows={requests}
          keyField="id"
          onRowClick={openDetail}
          empty={{ title: 'No purchase requests', message: 'Create a purchase request to start the procurement workflow.' }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Request" wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Kitchen, Housekeeping" />
            </div>
            <div>
              <label className="label">Reason</label>
              <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-700">Items</span>
              <Button type="button" size="sm" variant="secondary" onClick={addItem}><Plus size={14} /> Add Item</Button>
            </div>
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border border-ink-100 p-2 rounded">
                <div className="col-span-6">
                  <label className="label">Item</label>
                  <select className="input" value={it.inventory_item_id} onChange={(e) => setItem(i, 'inventory_item_id', e.target.value)}>
                    <option value="">Select inventory item…</option>
                    {inventory.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Qty</label>
                  <input type="number" min="1" className="input" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Est. Price</label>
                  <input type="number" min="0" className="input" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)}><XCircle size={16} /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Request</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.request_no || 'Request'} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{detail.department || 'General'}</p>
                <p className="text-xs text-ink-500">{detail.reason || 'No reason'}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge status={detail.status}>{detail.status}</Badge>
                {canApprove && detail.status === 'PENDING' && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => approve(detail.id, true)}><CheckCircle2 size={14} /> Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => approve(detail.id, false)}><XCircle size={14} /> Reject</Button>
                  </>
                )}
                {canApprove && detail.status === 'APPROVED' && (
                  <Button size="sm" variant="secondary" onClick={() => convert(detail.id)}><ChevronsRight size={14} /> Convert to PO</Button>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-ink-100 divide-y divide-ink-100">
              {detail.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium">{it.item_name || it.inventory_item_name}</span>
                  <span>{it.quantity} × {naira(it.unit_price)} = <b>{naira(it.quantity * it.unit_price)}</b></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
