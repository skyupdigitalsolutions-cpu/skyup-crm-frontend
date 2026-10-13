// src/agent/alerts.jsx — in-app alert banner + phone notifications.
// Banner: always, while the app is open. Phone notification: when the user has
// allowed notifications and the app is in the background (switched away, screen
// off for a short while). Notifications are shown through the /agent service
// worker so they work in the installed app on Android and iPhone (iOS 16.4+).
// Note: they can't arrive once the phone has fully closed/suspended the app —
// that needs server push (see README).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PREF_KEY = 'agent_phone_alerts'; // '1' = user turned phone notifications on
const Ctx = createContext({ notify: () => {} });

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');
export const phoneAlertsOn = () => {
  try { return localStorage.getItem(PREF_KEY) === '1' && notificationPermission() === 'granted'; } catch { return false; }
};

/** Ask the browser for permission. Must be called from a tap. */
export async function enablePhoneAlerts() {
  if (!notificationsSupported()) return 'unsupported';
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try { localStorage.setItem(PREF_KEY, result === 'granted' ? '1' : '0'); } catch { /* ignore */ }
  return result;
}
export function disablePhoneAlerts() {
  try { localStorage.setItem(PREF_KEY, '0'); } catch { /* ignore */ }
}

async function showPhoneNotification({ title, body, to, tag }) {
  if (!phoneAlertsOn()) return;
  const options = { body, tag, icon: '/agent-icons/icon-192.png', badge: '/agent-icons/icon-192.png', data: { url: to || '/agent' } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/agent') : null;
    if (reg) { await reg.showNotification(title, options); return; }
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); if (to) window.location.assign(to); };
  } catch { /* not allowed here — the banner still shows */ }
}

export function AlertsProvider({ children }) {
  const nav = useNavigate();
  const [queue, setQueue] = useState([]);
  const timer = useRef(null);
  const current = queue[0] || null;

  const notify = useCallback((alert) => {
    const a = { id: `${Date.now()}-${Math.random()}`, ...alert };
    setQueue((q) => [...q.filter((x) => !a.tag || x.tag !== a.tag), a].slice(-5));
    try { navigator.vibrate?.(150); } catch { /* ignore */ }
    if (document.visibilityState === 'hidden') showPhoneNotification(a);
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    if (!current) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, 7000);
    return () => clearTimeout(timer.current);
  }, [current, dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {current ? (
        <div className="alert-banner" role="alert">
          <button
            className="alert-banner-main"
            onClick={() => { dismiss(); if (current.to) nav(current.to); }}
          >
            <span className={`alert-banner-dot tone-${current.tone || 'blue'}`} aria-hidden="true" />
            <span>
              <b>{current.title}</b>
              {current.body ? <span>{current.body}</span> : null}
            </span>
          </button>
          <button className="alert-banner-close" onClick={dismiss} aria-label="Dismiss">×</button>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export const useAlerts = () => useContext(Ctx);
