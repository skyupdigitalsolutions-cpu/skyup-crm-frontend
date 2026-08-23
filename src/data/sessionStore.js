// src/data/sessionStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Hybrid session store — survives page refresh AND keeps data off localStorage
// as much as possible.
//
// STRATEGY:
//   • token  → stored ONLY in sessionStorage (tab-scoped, NOT localStorage).
//              sessionStorage survives F5 (same tab) but dies when the tab is
//              closed. It is NOT visible under localStorage in DevTools.
//              It IS still visible under sessionStorage — but it is tab-isolated
//              and cannot be read by other tabs or extensions in other tabs.
//
//   • user   → stored in sessionStorage (same reasoning as token).
//
//   • All other sensitive keys (plan_entitlements, crm_encryption_key,
//     company_brand, vf_api_key, mkt_token, mkt_user) → in-memory only.
//     These do NOT need to survive a refresh — they are re-fetched from the
//     API on mount once the token is available.
//
// WHY NOT localStorage FOR token?
//   localStorage is permanent and shared across tabs. Any extension, injected
//   script, or XSS payload on ANY tab can read it. sessionStorage is scoped
//   to the current tab and survives F5, giving us the refresh fix the users
//   need without the full localStorage exposure.
//
// MIGRATION from old localStorage keys:
//   On first load after deploy, this module reads token/user from the OLD
//   localStorage keys, migrates them to sessionStorage, and deletes them from
//   localStorage so they stop showing in DevTools.
// ─────────────────────────────────────────────────────────────────────────────

// ── In-memory store for non-persistent sensitive data ─────────────────────────
const _mem = {
  entitlements: null,
  brand:        null,
};

// ── sessionStorage keys ───────────────────────────────────────────────────────
const SS_TOKEN = "ss_token";
const SS_USER  = "ss_user";

// ── One-time migration: move old localStorage values into sessionStorage ───────
// Runs once on module load. After migration, old localStorage keys are deleted.
(function _migrate() {
  try {
    const oldToken = localStorage.getItem("token");
    const oldUser  = localStorage.getItem("user");
    if (oldToken && !sessionStorage.getItem(SS_TOKEN)) {
      sessionStorage.setItem(SS_TOKEN, oldToken);
    }
    if (oldUser && !sessionStorage.getItem(SS_USER)) {
      sessionStorage.setItem(SS_USER, oldUser);
    }
    // Always remove from localStorage regardless — even if migration already done
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Also purge other sensitive keys that may still be in localStorage
    [
      "company_brand", "company_branding",
      "plan_entitlements", "plan_features",
      "crm_encryption_key", "vf_api_key",
      "mkt_token", "mkt_user",
    ].forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
})();

// ── Writers ───────────────────────────────────────────────────────────────────

/** Called on login. Writes token+user to sessionStorage. */
export function setSession(token, user) {
  try {
    sessionStorage.setItem(SS_TOKEN, token);
    sessionStorage.setItem(SS_USER, JSON.stringify(user));
  } catch (_) {}
  // Remove any stale localStorage values
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function setEntitlements(data) {
  _mem.entitlements = data;
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
}

export function setBrand(data) {
  _mem.brand = data;
  try { localStorage.removeItem("company_brand"); } catch (_) {}
  try { localStorage.removeItem("company_branding"); } catch (_) {}
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getToken() {
  try { return sessionStorage.getItem(SS_TOKEN) || null; } catch (_) { return null; }
}

export function getUser() {
  try {
    const raw = sessionStorage.getItem(SS_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function getEntitlements() { return _mem.entitlements; }
export function getBrand()        { return _mem.brand; }

/** Returns { token, user } — matches the old getStoredAuth() shape */
export function getStoredAuth() {
  return { token: getToken(), user: getUser() };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Called on logout and 401 auto-logout. Wipes everything. */
export function clearSession() {
  try { sessionStorage.removeItem(SS_TOKEN); } catch (_) {}
  try { sessionStorage.removeItem(SS_USER);  } catch (_) {}
  _mem.entitlements = null;
  _mem.brand        = null;
  // Purge any lingering localStorage values
  [
    "token", "user",
    "company_brand", "company_branding",
    "plan_entitlements", "plan_features",
    "crm_encryption_key", "vf_api_key",
    "mkt_token", "mkt_user",
  ].forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
}
