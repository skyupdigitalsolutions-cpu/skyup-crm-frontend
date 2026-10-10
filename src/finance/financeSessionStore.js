// src/finance/financeSessionStore.js — NEW FILE
// Session store for the standalone Finance Panel.
//
// Token + user live in sessionStorage — the same approach as the main CRM
// session (src/data/sessionStore.js) and the Marketing panel:
//   • survives a page refresh (F5), so you stay signed in
//   • is scoped to the browser TAB and cleared when the tab is closed
//   • never touches localStorage
// Its own keys keep it independent of the CRM and Marketing sessions. An
// in-memory copy is a fallback when sessionStorage is unavailable.

const K_TOKEN = "ss_fin_token";
const K_USER  = "ss_fin_user";

const _mem = { token: null, user: null };

const ss = {
  get(k)    { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* fall back to memory */ } },
  del(k)    { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export function setFinanceSession(token, user) {
  _mem.token = token;
  _mem.user  = user;
  ss.set(K_TOKEN, token);
  ss.set(K_USER, JSON.stringify(user || {}));
}

export function getFinanceToken() { return ss.get(K_TOKEN) || _mem.token; }
export function getFinanceUser() {
  const raw = ss.get(K_USER);
  if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
  return _mem.user;
}

export function clearFinanceSession() {
  _mem.token = null;
  _mem.user  = null;
  ss.del(K_TOKEN);
  ss.del(K_USER);
}
