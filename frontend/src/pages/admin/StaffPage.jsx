import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, KeyRound, Pencil } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, Button, Modal, PageLoader, SearchInput, Table } from '../../components/ui/index.jsx';
import { fmtDateTime, initials } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

const DEPARTMENTS = ['HOTEL', 'RESTAURANT', 'SPA', 'BARBERSHOP', 'HOUSEKEEPING', 'STORE', 'EVENTS', 'ADMIN'];

const emptyForm = { full_name: '', username: '', email: '', phone: '', password: '', role_id: '', department: '', restaurant_ids: [] };

const RESTAURANT_MANAGER_ROLE = 'RESTAURANT_MANAGER';
const RESTAURANT_STAFF_ROLE = 'RESTAURANT_STAFF';

function RestaurantAssignment({ roleName, restaurants, value = [], onChange }) {
  const isStaff = roleName === RESTAURANT_STAFF_ROLE;
  const toggle = (id) => {
    if (isStaff) {
      onChange([Number(id)]);
    } else {
      const cur = value.map(Number);
      onChange(cur.includes(Number(id)) ? cur.filter((x) => x !== Number(id)) : [...cur, Number(id)]);
    }
  };
  return (
    <div>
      <label className="label">
        {isStaff ? 'Assigned Restaurant (required)' : 'Assigned Restaurants (at least one)'}
      </label>
      {isStaff ? (
        <select
          className="input"
          required
          value={value[0] ?? ''}
          onChange={(e) => onChange([Number(e.target.value)])}
        >
          <option value="">Select restaurant…</option>
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      ) : (
        <div className="space-y-2 rounded-lg border border-ink-100 p-3">
          {restaurants.length === 0 && <p className="text-xs text-ink-400">No restaurants available.</p>}
          {restaurants.map((r) => {
            const checked = value.map(Number).includes(Number(r.id));
            return (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} />
                {r.name}
              </label>
            );
          })}
        </div>
      )}
      <p className="text-xs text-ink-500 mt-1">
        {isStaff
          ? 'Restaurant staff are restricted to exactly this single outlet.'
          : 'Restaurant managers can oversee the selected outlets.'}
      </p>
    </div>
  );
}

export default function StaffPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();
  const isAdmin = can('ADMIN');

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, restaurantsRes] = await Promise.all([api.get('/staff/users'), api.get('/staff/roles'), api.get('/restaurants')]);
      setStaff(u.data);
      setRoles(r.data);
      setRestaurants(restaurantsRes.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const selectedRoleName = (roleId) => {
    const r = roles.find((x) => String(x.id) === String(roleId));
    return r ? r.name : '';
  };

  const isRestaurantRole = (roleId) => {
    const name = selectedRoleName(roleId);
    return name === RESTAURANT_MANAGER_ROLE || name === RESTAURANT_STAFF_ROLE;
  };

  const filtered = staff.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.username || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.role_name || '').toLowerCase().includes(q) || (s.department || '').toLowerCase().includes(q);
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff/users', {
        ...form,
        department: form.department || null,
        restaurant_ids: isRestaurantRole(form.role_id) ? form.restaurant_ids : [],
      });
      toast.success('Staff member created');
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s, status) => {
    try {
      await api.put(`/staff/users/${s.id}`, { status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (s) => {
    setEditForm({
      id: s.id,
      full_name: s.full_name,
      email: s.email || '',
      phone: s.phone || '',
      role_id: s.role_id || '',
      department: s.department || '',
      status: s.status || (s.is_active ? 'ACTIVE' : 'INACTIVE'),
      restaurant_ids: (s.assigned_restaurants || []).map((a) => a.restaurant_id),
    });
    setEditOpen(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await api.put(`/staff/users/${editForm.id}`, {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        role_id: editForm.role_id || null,
        department: editForm.department || null,
        status: editForm.status,
        restaurant_ids: isRestaurantRole(editForm.role_id) ? editForm.restaurant_ids : [],
      });
      toast.success('Staff updated');
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const openReset = (s) => {
    setResetUser(s);
    setNewPassword('');
    setResetOpen(true);
  };

  const doReset = async (e) => {
    e.preventDefault();
    setResetSaving(true);
    try {
      await api.post(`/staff/users/${resetUser.id}/reset-password`, { newPassword });
      toast.success('Password reset');
      setResetOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetSaving(false);
    }
  };

  const columns = [
    { key: 'full_name', label: 'Name', render: (s) => (
      <button type="button" onClick={() => navigate(`/admin/staff/${s.id}`)} className="flex items-center gap-3 text-left hover:opacity-80">
        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{initials(s.full_name)}</div>
        <div><p className="font-semibold">{s.full_name}</p><p className="text-xs text-ink-500">@{s.username}</p></div>
      </button>
    ) },
    { key: 'email', label: 'Email', render: (s) => s.email || '—' },
    { key: 'role_name', label: 'Role', render: (s) => <Badge>{s.role_name || 'Unassigned'}</Badge> },
    { key: 'department', label: 'Department', render: (s) => s.department ? <Badge status="CONFIRMED">{s.department}</Badge> : <span className="text-ink-400">—</span> },
    { key: 'restaurants', label: 'Assigned Restaurant', render: (s) => {
      const assigned = s.assigned_restaurants || [];
      if (assigned.length === 0) return <span className="text-ink-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {assigned.map((a) => <Badge key={a.restaurant_id} status={a.is_primary ? 'PAID' : 'CONFIRMED'}>{a.name}</Badge>)}
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (s) => {
      const st = s.status || (s.is_active ? 'ACTIVE' : 'INACTIVE');
      if (st === 'ACTIVE') return <Badge status="PAID">Active</Badge>;
      if (st === 'SUSPENDED') return <Badge status="SUSPENDED">Suspended</Badge>;
      return <Badge status="CANCELLED">Inactive</Badge>;
    } },
    { key: 'last_login', label: 'Last Login', render: (s) => (s.last_login ? fmtDateTime(s.last_login) : <span className="text-ink-400">Never</span>) },
    { key: 'actions', label: '', render: (s) => isAdmin ? (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil size={14} /> Edit</Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openReset(s); }}><KeyRound size={14} /> Reset PW</Button>
        <select
          className="input !py-1 !text-xs max-w-[110px]"
          value={s.status || (s.is_active ? 'ACTIVE' : 'INACTIVE')}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => toggleActive(s, e.target.value)}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>
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
        {isAdmin && (
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
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {isRestaurantRole(form.role_id) && (
            <RestaurantAssignment
              roleName={selectedRoleName(form.role_id)}
              restaurants={restaurants}
              value={form.restaurant_ids}
              onChange={(ids) => setForm({ ...form, restaurant_ids: ids })}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Staff</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit — ${editForm.full_name || ''}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={editForm.role_id} onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}>
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {isRestaurantRole(editForm.role_id) && (
            <RestaurantAssignment
              roleName={selectedRoleName(editForm.role_id)}
              restaurants={restaurants}
              value={editForm.restaurant_ids}
              onChange={(ids) => setEditForm({ ...editForm, restaurant_ids: ids })}
            />
          )}
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="ACTIVE">Active — can sign in</option>
              <option value="INACTIVE">Inactive — disabled account</option>
              <option value="SUSPENDED">Suspended — locked (contact admin)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={editSaving}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Reset Password — ${resetUser?.full_name || ''}`}>
        <form onSubmit={doReset} className="space-y-4">
          <div>
            <label className="label">New Temporary Password *</label>
            <input className="input" required minLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="text-xs text-ink-500 mt-1">Use a development-only password for demo accounts.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button type="submit" loading={resetSaving}>Reset Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
