// Remembers which lead was just called, so the remark sheet can open when
// the user comes back to the app from the phone dialer.
// (Replaces the app's call-state detection, which browsers can't do.)
const KEY = 'skyup_pending_call';

export function savePendingCall(lead) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ leadId: lead.id, name: lead.name, at: Date.now() }));
  } catch { /* ignore */ }
}

export function takePendingCall() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    // Ignore calls older than 3 hours.
    if (!p?.leadId || Date.now() - p.at > 3 * 3600 * 1000) { sessionStorage.removeItem(KEY); return null; }
    return p;
  } catch { return null; }
}

export function clearPendingCall() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
