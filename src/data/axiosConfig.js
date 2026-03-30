import axios from "axios";

const api = axios.create({
  baseURL: "https://skyup-crm-backend.onrender.com/api",
});

// Automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — only log out if the token is truly invalid (JWT errors),
// NOT on role-mismatch 403s or secondary background API calls.
// We check: if the error is 401 AND the URL is NOT a role-specific
// data endpoint (i.e. it is the user's own auth endpoint or a pure
// "not authorized" JWT failure), then log out.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url    = error.config?.url || "";

    // Only auto-logout on 401 from auth/login endpoints or when
    // the token is outright invalid. Never auto-logout on 403
    // (role mismatch) or on background data-fetching 401s.
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/admin/login") ||
      url.includes("/superadmin/login");

    const message = error.response?.data?.message || "";
    const isInvalidToken =
      message.toLowerCase().includes("invalid token") ||
      message.toLowerCase().includes("jwt") ||
      message.toLowerCase().includes("no token");

    if (status === 401 && (isAuthEndpoint || isInvalidToken)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;