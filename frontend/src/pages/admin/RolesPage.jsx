import { useEffect, useState } from 'react';
import { ShieldCheck, UserCog } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState } from '../../components/ui/index.jsx';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Roles & Permissions</h1>
        <p className="text-sm text-ink-500 mt-0.5">Access control for system users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Roles" subtitle="Defined system roles" />
          <div className="divide-y divide-ink-100">
            {roles.map((r) => {
              const count = users.filter((u) => u.role_id === r.id).length;
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><ShieldCheck size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-800">{r.name}</p>
                    {r.description && <p className="text-xs text-ink-500 truncate">{r.description}</p>}
                  </div>
                  <Badge>{count} staff</Badge>
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
                    <span className="ml-auto">{u.is_active ? <Badge status="PAID">Active</Badge> : <Badge status="CANCELLED">Inactive</Badge>}</span>
                  </div>
                ))}
              </div>
            ))}
            {roles.length === 0 && <EmptyState title="No roles" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
