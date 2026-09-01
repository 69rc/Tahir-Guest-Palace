import { useRestaurant } from '../../context/RestaurantContext.jsx';
import { isFlagOn } from '../../utils/format.js';

export default function RestaurantSelector() {
  const { restaurants, activeRestaurantId, setActiveRestaurantId, isStaff, loading } = useRestaurant();

  if (loading || restaurants.length === 0) return null;

  if (isStaff || restaurants.length === 1) {
    const active = restaurants.find((r) => String(r.id) === String(activeRestaurantId)) || restaurants[0];
    const openNow = isFlagOn(active?.is_active);
    return (
      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">This outlet</p>
        <div className="flex items-center justify-between gap-3 mt-0.5">
          <p className="text-sm font-bold text-ink-900">{active?.name || '—'}</p>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${openNow ? 'text-emerald-600' : 'text-ink-400'}`}>
            {openNow ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-1.5 shadow-card">
      <div className="flex gap-1 overflow-x-auto">
        {restaurants.map((r) => {
          const on = String(r.id) === String(activeRestaurantId);
          const openNow = isFlagOn(r.is_active);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRestaurantId(r.id)}
              className={`flex-1 min-w-[10.5rem] rounded-xl px-4 py-2.5 text-left overflow-hidden transition-colors ${
                on ? 'bg-ink-900 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="block text-sm font-semibold truncate">{r.name}</span>
              <span className={`block text-[10px] font-medium ${on ? 'text-white/70' : openNow ? 'text-emerald-600' : 'text-ink-400'}`}>
                {openNow ? 'Open' : 'Closed'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
