import axios from "axios";
import { getToken, getUser, clearSession } from "./sessionStore";
import { redirectTo } from "./navigationService";

// ── Base URL resolution ───────────────────────────────────────────────────────
const baseURL =
  import.meta.env.VITE_API_URL ||
  "/api";

const api = axios.create({
  baseURL,
  validateStatus: (status) => status >= 200 && status <= 207,
});

// ── In-memory GET cache (30 second TTL) ──────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 30_000;

const NO_CACHE = [
  "/auth/", "/login", "/logout",
  "/razorpay/", "/subscription",
  "/socket", "/chat",
  "unread-counts",
  "/whatsapp/conversations",
];

function isCacheable(url = "") {
  return !NO_CACHE.some((p) => url.includes(p));
}

export function clearCache(fragment) {
  for (const key of _cache.keys()) {
    if (!fragment || key.includes(fragment)) _cache.delete(key);
  }
}

export function clearAllCache() {
  _cache.clear();
}

// ── Request interceptor — inject token + serve from cache ────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  try {
    const u = getUser();
    if (u) {
      const role = String(u?.role || "").toLowerCase();
      if (role === "super_admin" || role === "superadmin") {
        const companyId = u.companyId || u.company?._id || u.company;
        if (companyId) config.headers["x-company-id"] = String(companyId);
      }
    }
  } catch (_) { /* fall through without the header */ }

  if (config.method === "get" && isCacheable(config.url)) {
    const tenant = config.headers["x-company-id"] || "";
    const key   = (token || "anon") + "|" + tenant + "|" + (config.url || "") + JSON.stringify(config.params || {});
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
        ((getToken() || "anon") + "|" + (response.config.url || "") + JSON.stringify(response.config.params || {}));
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
      clearSession();
      clearAllCache();
      window.dispatchEvent(new Event("user_changed"));
      redirectTo("/login", { replace: true });
    }

    if (status === 403 && code === "SUBSCRIPTION_EXPIRED") {
      redirectTo("/upgrade-plan");
    }

    return Promise.reject(error);
  }
);

export default api;
