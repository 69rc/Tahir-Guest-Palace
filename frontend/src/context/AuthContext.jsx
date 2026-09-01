import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api.js';
import { setToken, getToken } from '../services/api.js';
import { canAccess, SUPER_ROLES } from '../utils/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      setUser(res.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    is(role) {
      return SUPER_ROLES.includes(user?.role_name) || user?.role_name === role;
    },
    can(...roles) {
      if (!user) return false;
      if (SUPER_ROLES.includes(user.role_name)) return true;
      return roles.includes(user.role_name);
    },
    canAccess(...codes) {
      if (!user) return false;
      if (SUPER_ROLES.includes(user.role_name)) return true;
      if (Array.isArray(user.permissions) && user.permissions.length > 0) {
        return codes.some((c) => user.permissions.includes(c));
      }
      return canAccess(user.role_name, ...codes);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);