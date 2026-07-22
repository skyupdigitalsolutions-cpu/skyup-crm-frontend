import axios from "axios";

// ── Base URL resolution ───────────────────────────────────────────────────────
// • Local dev  → Vite proxy handles /api → localhost:5000.
// • Production → VITE_API_URL is set in Cloudflare/Render environment variables.
const baseURL =
  import.meta.env.VITE_API_URL ||
  "/api";

const api = axios.create({
  baseURL,
  validateStatus: (status) => status >= 200 && status <= 207,
});

// ── In-memory GET cache (30 second TTL) ──────────────────────────────────────
// Prevents the same endpoint being hit multiple times in quick succession
// (Dashboard fires 5+ useEffect hooks on mount — this collapses duplicates).
const _cache = new Map();
const CACHE_TTL = 30_000; // 30 seconds

const NO_CACHE = [
  "/auth/", "/login", "/logout",
  "/razorpay/", "/subscription",
  "/socket", "/chat",
];

function isCacheable(url = "") {
  return !NO_CACHE.some((p) => url.includes(p));
}

// ── Cache invalidation helper ─────────────────────────────────────────────────
// Call after any mutation so the next GET fetches fresh data.
// Usage: import { clearCache } from "./axiosConfig";
//        clearCache("/admin/company/leads");
export function clearCache(fragment) {
  for (const key of _cache.keys()) {
    if (!fragment || key.includes(fragment)) _cache.delete(key);
  }
}

// Wipe the entire cache outright. MUST be called on every login/logout —
// otherwise responses cached under one admin's session can be served to the
// next admin who logs in on the same tab (SPA navigation never reloads this
// module, so the Map survives the swap).
export function clearAllCache() {
  _cache.clear();
}

// ── Request interceptor — inject token + serve from cache ────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (config.method === "get" && isCacheable(config.url)) {
    // IMPORTANT: the cache key includes the current token. Two different
    // admins/companies hitting the exact same URL+params must never share a
    // cache entry — keying on the token guarantees that even if a
    // clearCache()/clearAllCache() call is ever missed somewhere, one
    // session's data cannot leak into another session's dashboard.
    const key   = (token || "anon") + "|" + (config.url || "") + JSON.stringify(config.params || {});
    const entry = _cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      config.adapter = () => Promise.resolve(entry.response);
    }
    config.__cacheKey = key;
  }

  return config;
});

// ── Response interceptor — cache GETs + handle auth errors ───────────────────
api.interceptors.response.use(
  (response) => {
    if (response.config.method === "get" && isCacheable(response.config.url)) {
      const key = response.config.__cacheKey ||
        ((localStorage.getItem("token") || "anon") + "|" + (response.config.url || "") + JSON.stringify(response.config.params || {}));
      _cache.set(key, { ts: Date.now(), response });
    }
    return response;
  },
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url || "";
    const message = error.response?.data?.message || "";
    const code    = error.response?.data?.code    || "";

    const isAuthEndpoint =
      url.includes("/auth/login")   ||
      url.includes("/admin/login")  ||
      url.includes("/superadmin/login");

    const isInvalidToken =
      message.toLowerCase().includes("invalid token") ||
      message.toLowerCase().includes("jwt")           ||
      message.toLowerCase().includes("no token");

    if (status === 401 && (isAuthEndpoint || isInvalidToken)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("company_brand");
      clearAllCache();
      window.dispatchEvent(new Event("user_changed"));
      window.location.href = "/login";
    }

    if (status === 403 && code === "SUBSCRIPTION_EXPIRED") {
      window.location.href = "/upgrade-plan";
    }

    return Promise.reject(error);
  }
);

export default api;
