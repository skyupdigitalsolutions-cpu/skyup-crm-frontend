import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, getStoredUser, login as apiLogin, setAuthLostHandler } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => { setAuthLostHandler(() => setUser(null)); }, []);

  const login = useCallback(async (email, password) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => { clearSession(); setUser(null); }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
