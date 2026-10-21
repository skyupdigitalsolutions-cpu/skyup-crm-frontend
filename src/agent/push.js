// src/agent/push.js
// ────────────────────────────────────────────
// Closed-app notifications for the /agent web app (Web Push).
//
// Socket alerts only arrive while the app is open, and iPhone closes a background web app within minutes. With
// this, the server pushes new-lead, follow-up, call-back and remote clock-in alerts straight to the phone even
// when the app is closed (iPhone: installed to the Home Screen, iOS 16.4+; Android: Chrome or installed app).
//
//   turn on   → Profile → Alerts → Phone notifications (asks permission, then subscribes this phone)
//   each open → the subscription is re-sent, so a new sign-in or a renewed subscription is picked up
//   turn off / Sign out → this phone is unsubscribed, here and on the server
// Server side: routes/agentPushRoutes.js, services/agentPushService.js. The /agent service worker
// (public/agent-sw.js) shows the pushed notification.
// ────────────────────────────────────────────
import { getToken } from '../data/sessionStore';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const ACTIVE_KEY = 'agent_push_active';            // '1' while this phone has a server subscription

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** True when the server is pushing to this phone (the app then skips its own copy of those alerts). */
export const pushActive = () => { try { return localStorage.getItem(ACTIVE_KEY) === '1'; } catch { return false; } };
const setActive = (on) => { try { if (on) localStorage.setItem(ACTIVE_KEY, '1'); else localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ } };

export function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(buf, b64) {
  if (!buf) return false;
  const a = new Uint8Array(buf);
  const b = urlBase64ToUint8Array(b64);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function call(method, path, body, token = getToken()) {
  if (!token) throw new Error('signed out');
  const res = await fetch(BASE + path, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method !== 'GET',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || `HTTP ${res.status}`);
  return data;
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration('/agent');
  if (reg) return reg;
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
}

/**
 * Make sure this phone is subscribed and the server knows it. Safe to call often.
 * Returns 'on' | 'unsupported' | 'no-permission' | 'server-off' | 'error'.
 */
export async function syncPushSubscription() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission !== 'granted') { setActive(false); return 'no-permission'; }
  try {
    const reg = await registration();
    if (!reg || !reg.pushManager) return 'unsupported';
    const cfg = await call('GET', '/agent-push/public-key');
    if (!cfg || !cfg.enabled || !cfg.publicKey) { setActive(false); return 'server-off'; }
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options && sub.options.applicationServerKey, cfg.publicKey)) {   // server keys changed
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) });
    const j = sub.toJSON();
    await call('POST', '/agent-push/subscribe', { endpoint: j.endpoint, keys: j.keys });
    setActive(true);
    return 'on';
  } catch {
    return 'error';                                  // alerts still work while the app is open
  }
}

/** Unsubscribe this phone (turning alerts off, or signing out). Pass the token when the session is being cleared. */
export async function removePushSubscription(token = getToken()) {
  setActive(false);
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/agent');
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    const endpoint = sub.endpoint;
    if (token) await call('POST', '/agent-push/unsubscribe', { endpoint }, token).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch { /* ignore */ }
}
