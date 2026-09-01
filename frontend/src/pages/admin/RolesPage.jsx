import { useEffect, useState } from 'react';
import { ShieldCheck, UserCog, Plus, Pencil, Save } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState, Button, Modal } from '../../components/ui/index.jsx';
import { PERMISSION_GROUPS } from '../../utils/permissions.js';

const STATUS_BADGE = {
  ACTIVE: <Badge status="PAID">Active</Badge>,
  INACTIVE: <Badge status="CANCELLED">Inactive</Badge>,
  SUSPENDED: <Badge status="SUSPENDED">Suspended</Badge>,
};

function PermissionChecklist({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
      {PERMISSION_GROUPS.map((g) => {
        const groupAll = g.perms.every((p) => value.includes(p));
        const some = g.perms.some((p) => value.includes(p));
        const toggleGroup = () => {
          if (groupAll) onChange(value.filter((p) => !g.perms.includes(p)));
          else onChange([...new Set([...value, ...g.perms])]);
        };
        return (
          <div key={g.label} className="rounded-lg border border-ink-100 p-3">
            <label className="flex items-center gap-2 text-sm font-bold text-ink-800 mb-2 cursor-pointer">
              <input type="checkbox" checked={groupAll} ref={(el) => { if (el) el.indeterminate = !groupAll && some; }} onChange={toggleGroup} />
              {g.label}
            </label>
            <div className="space-y-1">
              {g.perms.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                  <input type="checkbox" checked={value.includes(p)} onChange={() =>
                    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])
                  } />
                  <code className="text-[11px]">{p}</code>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const { can } = useAuth();
  const isAdmin = can('ADMIN');
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', permission_codes: [] });
  const [editRole, setEditRole] = useState(null);
  const [editCodes, setEditCodes] = useState([]);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [r, u] = await Promise.all([api.get('/staff/roles'), api.get('/staff/users')]);
      setRoles(r.data);
      setUsers(u.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const createRole = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff/roles', {
        name: createForm.name,
        description: createForm.description,
        permission_codes: createForm.permission_codes,
      });
      toast.success('Custom role created');
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', permission_codes: [] });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r) => {
    setEditRole(r);
    setEditCodes(r.permissions || []);
    setEditOpen(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/staff/roles/${editRole.id}/permissions`, { permission_codes: editCodes });
      toast.success('Role permissions updated');
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Roles & Permissions</h1>
          <p className="text-sm text-ink-500 mt-0.5">Database-backed access control for system users</p>
        </div>
        {isAdmin && <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> New Custom Role</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Roles" subtitle="Defined roles with their permission sets" />
          <div className="divide-y divide-ink-100">
            {roles.map((r) => {
              const count = users.filter((u) => u.role_id === r.id).length;
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><ShieldCheck size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink-800">{r.name}</p>
                      {r.is_custom && <Badge status="CONFIRMED">Custom</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-ink-500 truncate">{r.description}</p>}
                    <p className="text-[11px] text-ink-400 mt-0.5">{(r.permissions || []).length} permissions</p>
                  </div>
                  <Badge>{count} staff</Badge>
                  {isAdmin && r.is_custom && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil size={14} /> Permissions</Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Members by Role" subtitle="Staff assigned to each role" />
          <div className="divide-y divide-ink-100">
            {roles.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <p className="text-sm font-bold text-ink-800 mb-2">{r.name}</p>
                {users.filter((u) => u.role_id === r.id).length === 0 ? (
                  <p className="text-xs text-ink-400">No members assigned</p>
                ) : users.filter((u) => u.role_id === r.id).map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1 text-sm">
                    <UserCog size={14} className="text-ink-400 shrink-0" />
                    <span className="font-medium text-ink-700">{u.full_name}</span>
                    <span className="text-xs text-ink-400">@{u.username}</span>
                    <span className="ml-auto">{STATUS_BADGE[u.status || (u.is_active ? 'ACTIVE' : 'INACTIVE')]}</span>
                  </div>
                ))}
              </div>
            ))}
            {roles.length === 0 && <EmptyState title="No roles" />}
          </div>
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Custom Role">
        <form onSubmit={createRole} className="space-y-4">
          <div>
            <label className="label">Role Name *</label>
            <input className="input" required value={createForm.name} placeholder="e.g. Concierge" onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Permissions</label>
            <PermissionChecklist
              value={createForm.permission_codes}
              onChange={(codes) => setCreateForm({ ...createForm, permission_codes: codes })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}><Save size={16} /> Create Role</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Permissions — ${editRole?.name || ''}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <p className="text-sm text-ink-500">Select the permissions granted to this custom role.</p>
          <PermissionChecklist value={editCodes} onChange={setEditCodes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}><Save size={16} /> Save Permissions</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

