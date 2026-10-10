// src/finance/financeSessionStore.js — NEW FILE
// In-memory session for the standalone Finance Panel. Same approach as the
// Marketing panel (src/marketing/mktSessionStore.js): the token is never written
// to localStorage, and it is completely independent of the CRM session, so being
// signed in to one never affects the other. A page refresh signs you out.
const _fin = { token: null, user: null };

export function setFinanceSession(token, user) { _fin.token = token; _fin.user = user; }
export function getFinanceToken() { return _fin.token; }
export function getFinanceUser()  { return _fin.user; }
export function clearFinanceSession() { _fin.token = null; _fin.user = null; }
