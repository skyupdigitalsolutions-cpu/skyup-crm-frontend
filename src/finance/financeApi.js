// src/finance/financeApi.js — NEW FILE
// Axios client for the Finance Panel (/api/finance-panel). Own session; never
// touches the CRM session. A 401 sends you back to the Finance sign-in page.
import axios from "axios";
import { getFinanceToken, clearFinanceSession } from "./financeSessionStore";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const financeApi = axios.create({ baseURL: `${API_BASE}/finance-panel` });

financeApi.interceptors.request.use((cfg) => {
  const token = getFinanceToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

financeApi.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      clearFinanceSession();
      window.location.href = "/finance/login";
    }
    return Promise.reject(e);
  }
);

// Sign-in client — a failed login (401) must show an error, not redirect.
export const financeAuthApi = axios.create({ baseURL: `${API_BASE}/finance-panel` });

export default financeApi;
