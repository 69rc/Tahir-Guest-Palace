import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, User } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Card, CardHeader, PageLoader, EmptyState } from '../../components/ui/index.jsx';
import { PERMISSION_GROUPS } from '../../utils/permissions.js';
import { initials, fmtDateTime } from '../../utils/format.js';

const STATUS_BADGE = {
  ACTIVE: <Badge status="ACTIVE">Active</Badge>,
  INACTIVE: <Badge status="INACTIVE">Inactive</Badge>,
  SUSPENDED: <Badge status="SUSPENDED">Suspended</Badge>,
};

export default function UserDetailPage() {
  const { id } = useParams();
  const { user: authUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
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
    load();
  }, [id]);

  if (loading) return <PageLoader />;

  const user = staff.find((s) => String(s.id) === String(id));
  if (!user) return <EmptyState title="User not found" message="No staff member matches this ID." />;

  const role = roles.find((r) => String(r.id) === String(user.role_id));
  const permissionCodes = role?.permissions || [];
  const grouped = PERMISSION_GROUPS.map((g) => ({
    ...g,
    granted: g.perms.filter((p) => permissionCodes.includes(p)),
  })).filter((g) => g.granted.length > 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <Link to="/admin/staff" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft size={16} /> Back to Staff
      </Link>

      <Card>
        <div className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold">{initials(user.full_name)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-ink-900">{user.full_name}</h1>
              {STATUS_BADGE[user.status || (user.is_active ? 'ACTIVE' : 'INACTIVE')]}
              {authUser?.id === user.id && <Badge status="CONFIRMED">You</Badge>}
            </div>
            <p className="text-sm text-ink-500">@{user.username} {user.email ? `· ${user.email}` : ''} {user.phone ? `· ${user.phone}` : ''}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-ink-100 px-5 py-4">
          <div><dt className="text-xs text-ink-500">Role</dt><dd className="font-semibold text-ink-800">{user.role_name || 'Unassigned'}</dd></div>
          <div><dt className="text-xs text-ink-500">Department</dt><dd className="font-semibold text-ink-800">{user.department || '—'}</dd></div>
          <div><dt className="text-xs text-ink-500">Last Login</dt><dd className="font-semibold text-ink-800">{user.last_login ? fmtDateTime(user.last_login) : 'Never'}</dd></div>
          <div><dt className="text-xs text-ink-500">Joined</dt><dd className="font-semibold text-ink-800">{user.created_at ? fmtDateTime(user.created_at) : '—'}</dd></div>
          <div><dt className="text-xs text-ink-500">Assigned Restaurants</dt><dd>
            {(user.assigned_restaurants || []).length === 0
              ? <span className="text-ink-400">All (unrestricted)</span>
              : <div className="flex flex-wrap gap-1">{user.assigned_restaurants.map((a) => <Badge key={a.restaurant_id}>{a.name}</Badge>)}</div>}
          </dd></div>
        </dl>
      </Card>

      <Card>
        <CardHeader title={`Granted Permissions (${permissionCodes.length})`} subtitle={role?.is_custom ? 'Custom role — permissions editable via Roles & Permissions' : 'Derived from role'} />
        {grouped.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-400">No granular permissions assigned to this role.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-4">
            {grouped.map((g) => (
              <div key={g.label}>
                <p className="text-xs font-bold text-ink-700 mb-1">{g.label}</p>
                <div className="flex flex-wrap gap-1">
                  {g.granted.map((p) => <Badge key={p} status="CONFIRMED"><code className="text-[10px]">{p}</code></Badge>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
