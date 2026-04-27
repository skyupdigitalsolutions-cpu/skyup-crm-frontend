import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  // baseURL: "http://localhost:5000/api",
   
  validateStatus: (status) => status >= 200 && status <= 207,
});

// Automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — only log out on genuine JWT failures, not role-mismatch 403s
// Handle 403 SUBSCRIPTION_EXPIRED — redirect to upgrade page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url || "";
    const message = error.response?.data?.message || "";
    const code    = error.response?.data?.code || "";

    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/admin/login") ||
      url.includes("/superadmin/login");

    const isInvalidToken =
      message.toLowerCase().includes("invalid token") ||
      message.toLowerCase().includes("jwt") ||
      message.toLowerCase().includes("no token");

    if (status === 401 && (isAuthEndpoint || isInvalidToken)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    // ── Subscription expired — send admin to upgrade screen ────────────────
    if (status === 403 && code === "SUBSCRIPTION_EXPIRED") {
      window.location.href = "/upgrade";
    }

    return Promise.reject(error);
  }
);

export default api;