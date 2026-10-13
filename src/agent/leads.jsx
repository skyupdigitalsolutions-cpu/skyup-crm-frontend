import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMyLeads } from './api.js';

const LeadsCtx = createContext(null);

// In-memory only (lead names/phones are never written to browser storage).
// Survives moving between pages, cleared on reload or sign-out.
let memCache = null; // { userId, at, leads }
const readCache = (userId) => (memCache && memCache.userId === userId ? memCache : null);

export function LeadsProvider({ userId, children }) {
  const [leads, setLeads] = useState(() => readCache(userId)?.leads || []);
  const [loadedAt, setLoadedAt] = useState(() => readCache(userId)?.at || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inflight = useRef(null);
  const loadedAtRef = useRef(loadedAt);
  useEffect(() => { loadedAtRef.current = loadedAt; }, [loadedAt]);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    setLoading(true);
    setError('');
    inflight.current = getMyLeads()
      .then((list) => {
        list.sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0));
        setLeads(list);
        const at = Date.now();
        setLoadedAt(at);
        memCache = { userId, at, leads: list };
      })
      .catch((e) => setError(e.message))
      .finally(() => { setLoading(false); inflight.current = null; });
    return inflight.current;
  }, [userId]);

  // Load on start, and again whenever the app comes back to the foreground
  // after more than 2 minutes.
  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - (loadedAtRef.current || 0) > 120000) refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);
  const patchLocal = useCallback((id, changes) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  }, []);

  const value = useMemo(
    () => ({ leads, loading, error, loadedAt, refresh, patchLocal }),
    [leads, loading, error, loadedAt, refresh, patchLocal],
  );
  return <LeadsCtx.Provider value={value}>{children}</LeadsCtx.Provider>;
}

export const useLeads = () => useContext(LeadsCtx);
