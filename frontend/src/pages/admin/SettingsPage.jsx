import { useState } from 'react';
import { Settings as SettingsIcon, KeyRound, Lock, ShieldCheck, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi } from '../../services/api.js';
import { Card, CardHeader, Button } from '../../components/ui/index.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword });
      toast.success('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500 mt-0.5">Property and account settings</p>
      </div>

      <Card>
        <CardHeader title="Property Information" icon={<Building2 size={16} />} />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink-500">Hotel Name</p>
            <p className="font-semibold text-ink-800">Tahir Guest Palace</p>
            <p className="text-xs text-ink-400">Comfort, Luxury &amp; Culture</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Address</p>
            <p className="font-semibold text-ink-800">No. 4 Ibrahim Natsugune Road, Off Ahmadu Bello Way</p>
            <p className="text-xs text-ink-400">Nasarawa GRA, Kano, Nigeria</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Phone</p>
            <p className="font-semibold text-ink-800">+234 805 029 8536</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Email</p>
            <p className="font-semibold text-ink-800">contacts@tahirguestpalace.com</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Currency</p>
            <p className="font-semibold text-ink-800">Nigerian Naira (₦)</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Check-in / Check-out</p>
            <p className="font-semibold text-ink-800">1:00 PM / 12:00 PM</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Rooms &amp; Suites</p>
            <p className="font-semibold text-ink-800">300+ rooms &amp; suites</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Data Source</p>
            <p className="font-semibold text-ink-800">Live PostgreSQL database</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Amenities &amp; Facilities" icon={<Building2 size={16} />} />
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {[
              'Free High-Speed Wi-Fi',
              'Outdoor Pool',
              'Fitness Centre',
              'Spa &amp; Sauna',
              '24-Hour Room Service',
              'Rooftop Dining',
              'Conference Halls (up to 350)',
              'Airport &amp; City Transfers',
              'Business Lounge',
              'Concierge &amp; Reception',
              'Free Parking',
              'Free Toiletries',
            ].map((a) => (
              <span key={a} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-ink-700 border border-slate-200">{a}</span>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="My Account" icon={<ShieldCheck size={16} />} />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink-500">Full Name</p>
            <p className="font-semibold text-ink-800">{user?.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Username</p>
            <p className="font-semibold text-ink-800">@{user?.username}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Email</p>
            <p className="font-semibold text-ink-800">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Role</p>
            <p className="font-semibold text-ink-800">{user?.role_name}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Change Password" icon={<KeyRound size={16} />} />
        <form onSubmit={changePassword} className="p-5 space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-9 text-ink-400" />
            <label className="label">Current Password</label>
            <input type="password" className="input pl-9" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-9 text-ink-400" />
              <label className="label">New Password</label>
              <input type="password" className="input pl-9" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-9 text-ink-400" />
              <label className="label">Confirm New Password</label>
              <input type="password" className="input pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}><KeyRound size={16} /> Update Password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
