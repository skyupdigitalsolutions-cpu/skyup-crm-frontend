// src/agent/persist.js
// ────────────────────────────────────────────
// "Stay signed in" for the /agent web app (employees only).
//
// WHY: the CRM keeps its session in sessionStorage on purpose (src/data/sessionStore.js): it is wiped when the tab is
// closed, which suits admins on shared computers. An employee's phone is different: the phone is the personal device,
// and an installed web app is closed all the time (iOS also throws the app away when memory is low). With
// sessionStorage alone the employee would have to type their password again each time. So the /agent app ALSO keeps a
// copy of its session on the phone, and puts it back when the app is opened and the tab has no session of its own.
//
// HOW IT ENDS: only by signing out (this copy and the server's token are both cancelled), or when the server rejects
// the token (cancelled, employee removed, or not used for 30 days). The CRM admin session is NOT changed: this file
// is used only by the /agent app, and only for employee roles.
//
// The token is renewed while the app is in use (api.js refreshSession), so a person who uses the app never reaches
// the token's 30-day expiry. Plain logic, no React, so it can be tested on its own.
// ────────────────────────────────────────────

export const SAVED_KEY = 'agent_session_v1';      // sessionStore.clearSession() removes this key too
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;      // renew a token that is older than this
const EXPIRY_SKEW_MS = 60 * 1000;                   // treat a token as expired a minute early

/** The payload of a JWT (no signature check — the server does that). null if it cannot be read. */
export function decodeJwt(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return payload && typeof payload === 'object' ? payload : null;
  } catch { return null; }
}

/** { iat, exp } in milliseconds, or null. */
export function tokenTimes(token) {
  const p = decodeJwt(token);
  if (!p) return null;
  return { iat: (Number(p.iat) || 0) * 1000, exp: (Number(p.exp) || 0) * 1000 };
}

export function isExpired(token, now = Date.now()) {
  const t = tokenTimes(token);
  return !t || !t.exp || t.exp - EXPIRY_SKEW_MS <= now;
}

/** True when the token is old enough that the app should ask the server for a fresh one. */
export function needsRefresh(token, now = Date.now()) {
  const t = tokenTimes(token);
  if (!t || !t.iat) return true;
  return now - t.iat > REFRESH_AFTER_MS;
}

export function saveSession(token, user) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify({ token, user, savedAt: Date.now() })); } catch { /* storage full or blocked: the session just will not survive a restart */ }
}

export function clearSaved() {
  try { localStorage.removeItem(SAVED_KEY); } catch { /* ignore */ }
}

/** The saved session if it is still usable (readable, not expired, an allowed role); otherwise it is deleted and null is returned. */
export function loadSaved(roles, now = Date.now()) {
  let raw;
  try { raw = localStorage.getItem(SAVED_KEY); } catch { return null; }
  if (!raw) return null;
  let rec;
  try { rec = JSON.parse(raw); } catch { clearSaved(); return null; }
  const role = String((rec && rec.user && rec.user.role) || '').toLowerCase();
  if (!rec || !rec.token || !rec.user || isExpired(rec.token, now) || !roles.includes(role)) { clearSaved(); return null; }
  return { token: rec.token, user: rec.user };
}

/** Puts the saved session back when this tab has none. Returns true when it did. */
export function restoreSession({ getToken, setSession, roles, now = Date.now() }) {
  if (getToken()) return false;                    // this tab already has a session: never overwrite it
  const saved = loadSaved(roles, now);
  if (!saved) return false;
  setSession(saved.token, saved.user);
  return true;
}
