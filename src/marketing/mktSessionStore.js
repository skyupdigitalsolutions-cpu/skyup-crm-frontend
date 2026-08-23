// src/marketing/mktSessionStore.js
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY FIX — In-memory session store for the Marketing Panel
//
// Previously mkt_token and mkt_user were written to localStorage, making
// them permanently visible in DevTools → Application → Storage and readable
// by any JavaScript on the page.
//
// This module mirrors the same pattern as src/data/sessionStore.js but is
// scoped specifically to the marketing panel so the two sessions are
// completely independent and don't interfere with each other.
// ─────────────────────────────────────────────────────────────────────────────

const _mkt = {
  token: null,
  user:  null,
};

// ── Writers ───────────────────────────────────────────────────────────────────

/** Called on marketing panel login. */
export function setMktSession(token, user) {
  _mkt.token = token;
  _mkt.user  = user;
  // Purge any old localStorage remnants from the previous implementation
  try { localStorage.removeItem("mkt_token"); } catch (_) {}
  try { localStorage.removeItem("mkt_user");  } catch (_) {}
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getMktToken() { return _mkt.token; }
export function getMktUser()  { return _mkt.user;  }

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Called on marketing panel logout or 401. */
export function clearMktSession() {
  _mkt.token = null;
  _mkt.user  = null;
  try { localStorage.removeItem("mkt_token"); } catch (_) {}
  try { localStorage.removeItem("mkt_user");  } catch (_) {}
}
