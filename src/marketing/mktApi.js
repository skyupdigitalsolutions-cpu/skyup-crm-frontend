// src/marketing/mktApi.js
// Marketing panel axios client — own session key (mkt_token), never touches CRM session.
// Uses the same VITE_API_URL as axiosConfig (already includes /api),
// then appends /marketing-panel as a relative sub-path.
import axios from "axios";
import { getMktToken, clearMktSession } from "./mktSessionStore";

// e.g. https://skyup-crm-backend.onrender.com/api  (same as main axiosConfig)
const API_BASE = import.meta.env.VITE_API_URL || "/api";

const mktApi = axios.create({ baseURL: `${API_BASE}/marketing-panel` });

mktApi.interceptors.request.use((cfg) => {
  // SECURITY FIX: read token from in-memory store, not localStorage
  const token = getMktToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

mktApi.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      // SECURITY FIX: clearMktSession() wipes in-memory state + any localStorage remnants
      clearMktSession();
      window.location.href = "/marketing/login";
    }
    return Promise.reject(e);
  }
);

// Dedicated marketing login — same base, hits POST /api/marketing-panel/login
export const mktAuthApi = axios.create({ baseURL: `${API_BASE}/marketing-panel` });

export default mktApi;
