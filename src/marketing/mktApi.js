// src/marketing/mktApi.js
// Axios client for the marketing panel — uses its own localStorage key (mkt_token)
// so it never conflicts with the CRM admin session.
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "https://skyup-crm-backend.onrender.com";

const mktApi = axios.create({ baseURL: `${BASE}/api/marketing-panel` });

mktApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("mkt_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

mktApi.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      localStorage.removeItem("mkt_token");
      localStorage.removeItem("mkt_user");
      window.location.href = "/marketing/login";
    }
    return Promise.reject(e);
  }
);

// Use the dedicated marketing panel login endpoint (not main CRM /auth/login)
// so marketing-only users are never blocked by the main CRM auth guard.
export const mktAuthApi = axios.create({ baseURL: `${BASE}/api/marketing-panel` });

export default mktApi;
