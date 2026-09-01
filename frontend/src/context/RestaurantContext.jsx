import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const RestaurantContext = createContext(null);

export function RestaurantProvider({ children }) {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  const isStaff = user?.role_name === 'RESTAURANT_STAFF';
  const isManager = user?.role_name === 'RESTAURANT_MANAGER';
  const isUnrestricted = !isStaff && !isManager; // admin, GM, manager, etc.

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/restaurants');
      const list = res.data || [];
      setRestaurants(list);
      if (isStaff) {
        const assigned = list[0];
        setActiveRestaurantId(assigned ? assigned.id : null);
      } else {
        setActiveRestaurantId((prev) => (prev && list.some((r) => String(r.id) === String(prev)) ? prev : (list[0]?.id ?? null)));
      }
    } catch {
      setRestaurants([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const switchRestaurant = useCallback((id) => {
    // Managers/admins may switch; staff are locked.
    if (isStaff) return;
    setActiveRestaurantId(id);
  }, [isStaff]);

  const activeRestaurant = restaurants.find((r) => String(r.id) === String(activeRestaurantId)) || null;

  const value = {
    restaurants,
    activeRestaurantId,
    activeRestaurant,
    setActiveRestaurantId: switchRestaurant,
    loading,
    isStaff,
    isManager,
    isUnrestricted,
    reload: load,
  };

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export const useRestaurant = () => useContext(RestaurantContext);
