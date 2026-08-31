import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, EmptyState, SearchInput, Table } from '../../components/ui/index.jsx';
import { fmtDate, initials } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function StaffPage() {
  const { can } = useAuth();
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '', password: '', role_id: '' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.get('/staff/users'), api.get('/staff/roles')]);
      setStaff(u.data);
      setRoles(r.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = staff.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.username || '').toLowerCase().includes(q) || (s.role_name || '').toLowerCase().includes(q);
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff/users', form);
      toast.success('Staff member created');
      setOpen(false);
      setForm({ full_name: '', username: '', email: '', phone: '', password: '', role_id: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    try {
      await api.put(`/staff/users/${s.id}`, { is_active: !s.is_active });
      toast.success('Updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'full_name', label: 'Name', render: (s) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{initials(s.full_name)}</div>
        <div><p className="font-semibold">{s.full_name}</p><p className="text-xs text-ink-500">@{s.username}</p></div>
      </div>
    ) },
    { key: 'email', label: 'Email', render: (s) => s.email || '—' },
    { key: 'phone', label: 'Phone', render: (s) => s.phone || '—' },
    { key: 'role_name', label: 'Role', render: (s) => <Badge>{s.role_name || 'Unassigned'}</Badge> },
    { key: 'is_active', label: 'Status', render: (s) => s.is_active ? <Badge status="PAID">Active</Badge> : <Badge status="CANCELLED">Inactive</Badge> },
    { key: 'created_at', label: 'Added', render: (s) => fmtDate(s.created_at) },
    { key: 'actions', label: '', render: (s) => can('ADMIN') ? (
      <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleActive(s); }}>{s.is_active ? 'Deactivate' : 'Activate'}</Button></div>
    ) : null },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Staff</h1>
          <p className="text-sm text-ink-500 mt-0.5">{staff.length} employees with system access</p>
        </div>
        {can('ADMIN', 'GENERAL_MANAGER', 'MANAGER') && (
          <Button onClick={() => setOpen(true)}><UserPlus size={16} /> Add Staff</Button>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-ink-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search staff…" className="max-w-sm" />
        </div>
        <Table columns={columns} rows={filtered} empty={{ title: 'No staff found', message: 'Add staff members to grant system access.' }} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Staff Member">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Username *</label>
              <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="label">Temporary Password *</label>
              <input className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Staff</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
