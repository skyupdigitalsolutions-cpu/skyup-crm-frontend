// src/data/sessionStore.js
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY FIX — Centralised in-memory session store
//
// WHY THIS EXISTS:
//   The original code stored token, user, plan_entitlements, and company_brand
//   in localStorage, making every key permanently visible in DevTools →
//   Application → Storage and readable by any JavaScript on the page
//   (extensions, XSS payloads, injected scripts).
//
// WHAT THIS DOES:
//   Replaces localStorage for all auth/session data with a plain JS module
//   variable. Module-level variables in a Vite/React SPA:
//     ✅ Survive React re-renders and component unmounts
//     ✅ Survive client-side navigation (SPA — no full reload)
//     ✅ Are NOT visible in DevTools Storage
//     ✅ Cannot be read by extensions or XSS payloads
//     ❌ Do NOT survive a full page reload (F5 / Ctrl+R)
//
// REFRESH HANDLING:
//   On a hard reload the store is empty and the user sees the login page.
//   This is the correct behaviour for a zero-storage security posture.
//   If you want to survive reloads without localStorage, use HttpOnly cookies
//   on the backend (the recommended long-term fix — see audit report F-01).
//
// MIGRATION:
//   All callers that previously did localStorage.getItem("token") should
//   call getToken() instead. All setters call setSession(). On logout,
//   call clearSession(). The API is drop-in compatible.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {{ token: string|null, user: object|null, entitlements: object|null, brand: object|null }} */
const _store = {
  token:        null,
  user:         null,
  entitlements: null,
  brand:        null,
};

// ── Writers ───────────────────────────────────────────────────────────────────

/**
 * Called on login. Sets token + user in memory only.
 * Also clears any stale localStorage remnants from the old implementation.
 */
export function setSession(token, user) {
  _store.token = token;
  _store.user  = user;
  // Clean up old localStorage values left by the previous implementation
  _purgeLocalStorage();
}

export function setEntitlements(data) {
  _store.entitlements = data;
  // Ensure old cached value is gone
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
}

export function setBrand(data) {
  _store.brand = data;
  try { localStorage.removeItem("company_brand"); } catch (_) {}
  try { localStorage.removeItem("company_branding"); } catch (_) {}
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getToken()        { return _store.token; }
export function getUser()         { return _store.user; }
export function getEntitlements() { return _store.entitlements; }
export function getBrand()        { return _store.brand; }

/** Returns { token, user } — matches the old getStoredAuth() shape */
export function getStoredAuth() {
  return { token: _store.token, user: _store.user };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Called on logout (Sidebar.jsx) and on 401 auto-logout (axiosConfig.js).
 * Wipes all session state from memory AND removes any localStorage remnants.
 */
export function clearSession() {
  _store.token        = null;
  _store.user         = null;
  _store.entitlements = null;
  _store.brand        = null;
  _purgeLocalStorage();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Remove every key this app ever wrote to localStorage */
function _purgeLocalStorage() {
  const KEYS = [
    "token", "user",
    "company_brand", "company_branding",
    "plan_entitlements", "plan_features",
    "crm_encryption_key",
    "vf_api_key",
    "mkt_token", "mkt_user",
  ];
  KEYS.forEach((k) => {
    try { localStorage.removeItem(k); } catch (_) {}
  });
}
