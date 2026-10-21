import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredUser, login as apiLogin, logoutEverywhere, refreshSession, setAuthLostHandler } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => { setAuthLostHandler(() => setUser(null)); }, []);

  const login = useCallback(async (email, password) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => { logoutEverywhere(); setUser(null); }, []);

  // Stay signed in: renew the token (when it is old) each time the app is opened or comes back to the foreground.
  useEffect(() => {
    if (!user) return undefined;
    const renew = () => { if (document.visibilityState === 'visible') refreshSession(); };
    renew();
    document.addEventListener('visibilitychange', renew);
    window.addEventListener('online', renew);
    return () => { document.removeEventListener('visibilitychange', renew); window.removeEventListener('online', renew); };
  }, [user]);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
