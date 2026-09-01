import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, Bell, LogOut, Building2, Menu as MenuIcon, X } from 'lucide-react';
import { NAV } from './nav.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../utils/format.js';

function SidebarItem({ item, onNavigate }) {
  const [open, setOpen] = useState(false);
  if (item.type === 'group' && item.children?.some((c) => c.to && item.children.length)) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 ${
            item.children.some((c) => c.to && window.location.pathname.startsWith(c.to))
              ? 'text-white'
              : 'text-ink-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="opacity-70 shrink-0">{iconFor(item)}</span>
            {item.label}
          </span>
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''} opacity-60`} />
        </button>
        {open && (
          <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
            {item.children.map((child) => (
              <NavSideLink key={child.to} to={child.to} label={child.label} icon={child.icon} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function iconFor(item) {
  const Icon = item.icon;
  return Icon ? <Icon size={17} /> : null;
}

function NavSideLink({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-brand-600/90 text-white font-semibold' : 'text-ink-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      {Icon && <Icon size={17} className="opacity-80 shrink-0" />}
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout, canAccess } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const visibleNav = NAV
    .map((item) => {
      if (item.type === 'group' && item.children) {
        const children = item.children.filter((c) => canAccess(...c.perms));
        if (children.length === 0) return null;
        return { ...item, children };
      }
      if (item.type === 'link' && !canAccess(...(item.perms || []))) return null;
      return item;
    })
    .filter(Boolean);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-ink-900 text-white">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
          <Building2 size={20} />
        </div>
        <div>
          <p className="font-bold leading-tight">Tahir Guest Palace</p>
          <p className="text-[11px] text-ink-400">Comfort, Luxury &amp; Culture</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleNav.map((item, i) =>
          item.type === 'link' ? (
            <NavSideLink key={i} to={item.to} label={item.label} icon={item.icon} onNavigate={() => setMobileOpen(false)} />
          ) : (
            <SidebarItem key={item.label} item={item} onNavigate={() => setMobileOpen(false)} />
          )
        )}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-ink-500">
        © {new Date().getFullYear()} Tahir Guest Palace
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64">
            {sidebar}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 -right-10 text-white bg-ink-800 p-2 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-ink-100 flex items-center justify-between gap-4 px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-ink-600" onClick={() => setMobileOpen(true)}>
              <MenuIcon size={22} />
            </button>
            <div className="relative w-64 max-w-[50vw] hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input placeholder="Search (⌘K)…" className="input pl-9 !py-1.5" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative text-ink-500 hover:text-ink-800 p-1.5 rounded-lg hover:bg-ink-50">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <div className="relative">
              <button
                onClick={() => setUserOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-lg hover:bg-ink-50 px-2 py-1.5"
              >
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials(user?.full_name)}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold leading-tight text-ink-800">{user?.full_name}</p>
                  <p className="text-[11px] text-ink-500">{user?.role_name?.replace('_', ' ')}</p>
                </div>
              </button>
              {userOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-pop border border-ink-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-ink-100">
                      <p className="text-sm font-bold text-ink-800">{user?.full_name}</p>
                      <p className="text-xs text-ink-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1500px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}