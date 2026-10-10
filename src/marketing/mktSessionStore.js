// src/marketing/mktSessionStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Session store for the Marketing Panel.
//
// The token + user live in sessionStorage — exactly like the main CRM session
// (src/data/sessionStore.js):
//   • survives a page refresh (F5) so you are NOT signed out every reload
//   • is scoped to the browser TAB and is cleared when the tab is closed
//   • is never written to localStorage (permanent / shared across tabs)
//
// It uses its own keys, so the Marketing session stays completely independent
// of the CRM and Finance sessions. An in-memory copy is kept as a fallback for
// browsers where sessionStorage is unavailable (e.g. blocked in private mode).
// ─────────────────────────────────────────────────────────────────────────────

const K_TOKEN = "ss_mkt_token";
const K_USER  = "ss_mkt_user";

const _mem = { token: null, user: null };

const ss = {
  get(k)    { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* fall back to memory */ } },
  del(k)    { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

// Old releases stored these in localStorage — remove any leftovers.
try { localStorage.removeItem("mkt_token"); localStorage.removeItem("mkt_user"); } catch { /* ignore */ }

// ── Writers ───────────────────────────────────────────────────────────────────

/** Called on marketing panel login. */
export function setMktSession(token, user) {
  _mem.token = token;
  _mem.user  = user;
  ss.set(K_TOKEN, token);
  ss.set(K_USER, JSON.stringify(user || {}));
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getMktToken() { return ss.get(K_TOKEN) || _mem.token; }
export function getMktUser() {
  const raw = ss.get(K_USER);
  if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
  return _mem.user;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Called on marketing panel logout or 401. */
export function clearMktSession() {
  _mem.token = null;
  _mem.user  = null;
  ss.del(K_TOKEN);
  ss.del(K_USER);
}
