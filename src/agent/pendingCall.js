// Remembers which lead was just called, so the remark sheet can open when the user comes back to the app from the
// phone dialer. (Replaces the app's call-state detection, which browsers can't do.)
//
// Two records:
//   PENDING  — set when Call is tapped; turned into RETURNED when the employee comes back to the app.
//              Kept in localStorage because iOS often closes an installed web app during a long call; the app then
//              starts fresh and still knows a call was in progress (sessionStorage would be gone).
//   RETURNED — the call they just came back from: lead, number, dial time, return time. Kept until the after-call
//              remark is saved, so the remark can complete the call-log record on iPhone (see appCallLog.js).
// Both keys are removed by sessionStore.clearSession() on sign-out.

export const PENDING_KEY = 'skyup_pending_call';
export const RETURNED_KEY = 'skyup_returned_call';
const MAX_AGE_MS = 3 * 3600 * 1000;           // ignore calls older than 3 hours

const store = () => {
  try { return window.localStorage; } catch { /* blocked */ }
  try { return window.sessionStorage; } catch { return null; }
};
const read = (key) => {
  try { const raw = store()?.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const write = (key, v) => { try { store()?.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
const remove = (key) => { try { store()?.removeItem(key); } catch { /* ignore */ } };

export function savePendingCall(lead) {
  write(PENDING_KEY, { leadId: lead.id, name: lead.name, phone: lead.phone || '', at: Date.now() });
}

export function takePendingCall(now = Date.now()) {
  const p = read(PENDING_KEY);
  if (!p) return null;
  if (!p.leadId || !(p.at > 0) || now - p.at > MAX_AGE_MS) { remove(PENDING_KEY); return null; }
  return p;
}

export function clearPendingCall() { remove(PENDING_KEY); }

/** returnedAt: when the employee came back, or null when unknown (the app was closed during the call). */
export function saveReturnedCall(p, returnedAt) {
  const call = { leadId: String(p.leadId), phone: p.phone || '', dialedAt: p.at, returnedAt: returnedAt || null };
  write(RETURNED_KEY, call);
  return call;
}

/** The call this lead's remark belongs to, if the employee just came back from calling this lead. */
export function peekReturnedCall(leadId, now = Date.now()) {
  const c = read(RETURNED_KEY);
  if (!c || String(c.leadId) !== String(leadId)) return null;
  if (!(c.dialedAt > 0) || now - c.dialedAt > MAX_AGE_MS) { remove(RETURNED_KEY); return null; }
  return c;
}

export function clearReturnedCall() { remove(RETURNED_KEY); }
