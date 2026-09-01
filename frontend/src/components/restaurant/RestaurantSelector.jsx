import { useRestaurant } from '../../context/RestaurantContext.jsx';

// Role-aware restaurant switcher.
// - RESTAURANT_STAFF: read-only label of their single assigned outlet (cannot change).
// - RESTAURANT_MANAGER: dropdown limited to assigned outlets.
// - Admin / GM / Manager: selectable buttons across all outlets.
export default function RestaurantSelector({ variant = 'buttons' }) {
  const { restaurants, activeRestaurantId, setActiveRestaurantId, isStaff, isManager, loading } = useRestaurant();

  if (loading) return null;

  // Restaurant staff: always a read-only indicator.
  if (isStaff) {
    const active = restaurants.find((r) => String(r.id) === String(activeRestaurantId));
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Restaurant</span>
        <span className="text-sm font-bold text-ink-800">{active?.name || '—'}</span>
      </div>
    );
  }

  // Manager: dropdown restricted to assigned outlets.
  if (isManager) {
    return (
      <select
        className="input !py-1.5 text-sm font-semibold"
        value={activeRestaurantId ?? ''}
        onChange={(e) => setActiveRestaurantId(e.target.value)}
      >
        {restaurants.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    );
  }

  // Admin/GM/Manager: buttons across all outlets.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {restaurants.map((r) => (
        <button
          key={r.id}
          onClick={() => setActiveRestaurantId(r.id)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
            String(r.id) === String(activeRestaurantId) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}
