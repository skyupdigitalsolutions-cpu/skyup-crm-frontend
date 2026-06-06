import axios from "axios";

// ── Base URL resolution ───────────────────────────────────────────────────────
// • Local dev  → Vite proxy handles /api → localhost:5000.
//                No absolute URL needed, so browser never sees a cross-origin
//                request — CORS is completely bypassed in dev.
// • Production → VITE_API_URL is set in Render environment variables, e.g.
//                https://skyup-crm-backend.onrender.com/api
//
// If VITE_API_URL is not set (dev), we use "/api" (relative) which the
// Vite dev-server proxy forwards to localhost:5000 automatically.
const baseURL =
  import.meta.env.VITE_API_URL ||   // production: set in Render dashboard
  "/api";                            // development: proxied by vite.config.js

const api = axios.create({
  baseURL,
  validateStatus: (status) => status >= 200 && status <= 207,
});

// ── Auto-inject Bearer token on every request ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
// • 401 — only log out on genuine JWT failures, not role-mismatch 403s
// • 403 SUBSCRIPTION_EXPIRED — redirect admin to upgrade page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url || "";
    const message = error.response?.data?.message || "";
    const code    = error.response?.data?.code    || "";

    const isAuthEndpoint =
      url.includes("/auth/login")        ||
      url.includes("/admin/login")       ||
      url.includes("/superadmin/login");

    const isInvalidToken =
      message.toLowerCase().includes("invalid token") ||
      message.toLowerCase().includes("jwt")           ||
      message.toLowerCase().includes("no token");

    // Genuine auth failure → clear session and redirect to login
    if (status === 401 && (isAuthEndpoint || isInvalidToken)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("company_brand");
      // Notify same-tab NotificationProvider so socket disconnects immediately
      window.dispatchEvent(new Event("user_changed"));
      window.location.href = "/login";
    }

    // Subscription expired → send admin to upgrade screen
    if (status === 403 && code === "SUBSCRIPTION_EXPIRED") {
      window.location.href = "/upgrade-plan";
    }

    return Promise.reject(error);
  }
);

export default api;
