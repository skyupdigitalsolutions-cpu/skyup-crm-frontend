import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { attendance as A } from './api.js';
import { getPosition } from './location.js';
import { useSocketEvent } from './socket.jsx';

const Ctx = createContext(null);

export function computeWorkedSecs(rec, now = Date.now()) {
  if (!rec?.loginTime) return 0;
  const end = rec.logoutTime ? new Date(rec.logoutTime).getTime() : now;
  const activeBreakMs = !rec.logoutTime && rec.activeBreakIndex != null
    ? now - new Date(rec.breaks?.[rec.activeBreakIndex]?.startTime || now).getTime()
    : 0;
  const breakMins = (rec.totalBreakMinutes || 0) + Math.round(activeBreakMs / 60000);
  return Math.max(0, (end - new Date(rec.loginTime).getTime()) / 1000 - breakMins * 60);
}

export function AttendanceProvider({ children }) {
  const [record, setRecord] = useState(null);
  const [state, setState] = useState('loading'); // loading | in | out | error
  const known = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const rec = await A.today();
      setRecord(rec || null);
      const isIn = !!rec?.loginTime && !rec?.logoutTime;
      known.current = isIn;
      setState(isIn ? 'in' : 'out');
    } catch {
      // Same rule as the app: never let someone through on an unknown state.
      setState(known.current === true ? 'in' : known.current === false ? 'out' : 'error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Server pushed a change (break auto-started, admin edit, other device…).
  useSocketEvent('attendance:updated', (rec) => {
    if (!rec || typeof rec !== 'object') return;
    setRecord(rec);
    const isIn = !!rec.loginTime && !rec.logoutTime;
    known.current = isIn;
    setState(isIn ? 'in' : 'out');
  });

  // Activity ping every 60s while the app is open and clocked in — this is
  // what the backend uses to tell "active" from "idle", same as the app.
  useEffect(() => {
    if (state !== 'in') return undefined;
    let timer = null;
    const ping = async () => {
      try {
        const r = await A.ping();
        if (r?.status && r.status !== 'idle') {
          setRecord((p) => (p ? { ...p, status: r.status, activeBreakIndex: p.status === 'idle' ? null : p.activeBreakIndex } : p));
        }
      } catch { /* silent */ }
    };
    const start = () => { if (!timer) { ping(); timer = setInterval(ping, 60000); } };
    const stop = () => { clearInterval(timer); timer = null; };
    const onVis = () => {
      if (document.visibilityState === 'visible') { start(); refresh(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [state, refresh]);

  const clockIn = useCallback(async () => {
    const pos = await getPosition();
    const payload = pos.coords || {};
    await A.clockIn(payload);
    await refresh();
    return pos;
  }, [refresh]);

  const clockOut = useCallback(async () => {
    const r = await A.clockOut();
    if (r) setRecord(r);
    known.current = false;
    setState('out');
  }, []);

  const startBreak = useCallback(async () => { const r = await A.breakStart(); if (r) setRecord(r); }, []);

  const endBreak = useCallback(async () => {
    if (record?.status === 'idle') {
      const r = await A.ping();
      setRecord((p) => ({ ...p, status: 'active', activeBreakIndex: null, ...(r || {}) }));
    } else {
      const r = await A.breakEnd();
      if (r) setRecord(r);
    }
  }, [record?.status]);

  const value = useMemo(
    () => ({ record, state, refresh, clockIn, clockOut, startBreak, endBreak }),
    [record, state, refresh, clockIn, clockOut, startBreak, endBreak],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAttendance = () => useContext(Ctx);
