// src/agent/api.js — Agent app (/agent) API client.
// ─────────────────────────────────────────────────────────────────────────────
// Same endpoints and payloads as the SkyUp CRM mobile app.
//
// Session: shares the CRM session (src/data/sessionStore.js — sessionStorage).
// Signing in here also signs you in to the CRM in this tab, and an employee
// already signed in to the CRM opens /agent without signing in again.
// Employees also stay signed in after the app is closed: a copy of the session
// is kept in localStorage until Sign out (see persist.js).
//
// Uses its own fetch client instead of axiosConfig.js on purpose: that client
// caches GETs for 30s, and attendance/leads here must always be live.
// ─────────────────────────────────────────────────────────────────────────────
import { clearSession as clearCrmSession, getToken, getUser, setSession } from '../data/sessionStore';
import { clearAllCache } from '../data/axiosConfig';
import { clearSaved, needsRefresh, restoreSession, saveSession } from './persist.js';
import { removePushSubscription } from './push.js';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const AGENT_ROLES = ['user', 'employee'];
export { getToken };
export const getStoredUser = () => (getToken() ? getUser() : null);

// ── Stay signed in (see persist.js) ──────────────────────────────────────────
// The tab's own session (sessionStorage) is gone when the installed app was closed. Put the saved employee session
// back BEFORE anything reads it. When the tab does have a session, keep the saved copy in step with it.
restoreSession({ getToken, setSession, roles: AGENT_ROLES });
(function syncSavedSession() {
  const token = getToken();
  const user = token ? getUser() : null;
  if (user && AGENT_ROLES.includes(String(user.role || '').toLowerCase())) saveSession(token, user);
})();

export function clearSession() {
  clearCrmSession();
  clearSaved();                       // also forget the copy kept for "stay signed in"
  clearAllCache();
  window.dispatchEvent(new Event('user_changed'));
}

let onAuthLost = () => {};
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
    this.code = data?.code;
  }
}

export async function request(method, path, body, { timeout = 15000, retries } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  // Same retry policy as the app: GETs retry twice on network/5xx errors.
  const maxRetries = retries ?? (method === 'GET' ? 2 : 0);

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (attempt < maxRetries) { await sleep(1500 * (attempt + 1)); continue; }
      throw new ApiError(
        e.name === 'AbortError'
          ? 'The server took too long to respond. Check your connection and try again.'
          : 'Could not reach the server. Check your internet connection.',
        0,
      );
    }
    clearTimeout(timer);

    if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }

    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }

    if (!res.ok) {
      const msg = data?.message || data?.error || `Request failed (HTTP ${res.status})`;
      if (res.status === 401 && !path.startsWith('/auth/login')) {
        const m = msg.toLowerCase();
        if (['invalid', 'expired', 'jwt', 'no token', 'unauthorized'].some((k) => m.includes(k))) {
          clearSession();
          onAuthLost();
        }
      }
      throw new ApiError(msg, res.status, data);
    }
    return data;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b ?? {}, o),
  patch: (p, b, o) => request('PATCH', p, b ?? {}, o),
};

// ── Auth ─────────────────────────────────────────────────────────────────────
// Same request and session shape as the CRM's UserLogin.jsx.
export async function login(email, password) {
  // client:'agent-pwa' asks the server for the long-lived (30-day) employee token — see loginUnified in authController.js.
  const data = await api.post('/auth/login', { email, password, client: 'agent-pwa' });
  const token = data?.token;
  if (!token) throw new ApiError('Sign-in response was incomplete. Contact your admin.', 0);
  const role = data.role || 'employee';
  const user = {
    _id: data._id, name: data.name, email: data.email,
    companyId: data.companyId, company: data.companyId, createdBy: data.createdBy, role,
  };
  clearAllCache();
  setSession(token, user);
  if (AGENT_ROLES.includes(String(role).toLowerCase())) saveSession(token, user);   // stay signed in until Sign out
  window.dispatchEvent(new Event('user_changed'));
  return user;
}

let lastRefreshTry = 0;
/**
 * Asks the server for a fresh 30-day token while the app is in use, so the sign-in never reaches its expiry.
 * Does nothing unless the current token is older than 12 hours (and at most one try every 10 minutes).
 * Never throws: when offline or the server has a problem the current token simply stays. A real rejection
 * (cancelled / expired token) is handled by request(), which signs the employee out.
 */
export async function refreshSession({ force = false } = {}) {
  const token = getToken();
  if (!token) return false;
  const now = Date.now();
  if (!force && (!needsRefresh(token, now) || now - lastRefreshTry < 10 * 60 * 1000)) return false;
  lastRefreshTry = now;
  try {
    const data = await request('POST', '/auth/refresh', {}, { timeout: 15000, retries: 0 });
    if (!data?.token || getToken() !== token) return false;     // signed out (or switched account) while waiting
    const user = getUser();
    setSession(data.token, user);
    if (user && AGENT_ROLES.includes(String(user.role || '').toLowerCase())) saveSession(data.token, user);
    return true;
  } catch { return false; }
}

/**
 * Sign out: clears this phone at once (works offline), then tells the server to cancel the token so a copy of it
 * cannot be used afterwards. The server call is best-effort and never blocks or fails the sign-out.
 */
export function logoutEverywhere() {
  const token = getToken();
  clearSession();
  if (!token) return;
  // stop closed-app notifications to this phone first (needs the token before logout cancels it), then cancel the token
  removePushSubscription(token).finally(() => {
    try {
      fetch(BASE + '/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  });
}

// ── iPhone call log (see appCallLog.js) ─────────────────────────────────────
export const logAppCall = (body) => api.post('/call-logs/app-call', body, { timeout: 15000 });

// ── Recordings ───────────────────────────────────────────────────────────────
// Manual upload for phones that cannot sync call logs (iPhone). The form comes from buildRecordingForm().
export const uploadRecording = (form) => api.post('/call-logs/recording', form, { timeout: 5 * 60 * 1000 });

// ── Leads ────────────────────────────────────────────────────────────────────
export async function getMyLeads() {
  const first = await api.get('/lead/my-leads?page=1&limit=200', { timeout: 60000 });
  let all = [...(first?.leads || [])];
  if (first?.hasMore) {
    if (first.pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: first.pages - 1 }, (_, i) =>
          api.get(`/lead/my-leads?page=${i + 2}&limit=200`, { timeout: 60000 }).then((r) => r?.leads || [])),
      );
      all = all.concat(rest.flat());
    } else {
      for (let page = 2, more = true; more && page <= 50; page++) {
        const r = await api.get(`/lead/my-leads?page=${page}&limit=200`, { timeout: 60000 });
        all = all.concat(r?.leads || []);
        more = !!r?.hasMore;
      }
    }
  }
  return all.map(formatLead);
}

export const getLead = async (id) => formatLead(await api.get(`/lead/${id}`));
export const updateLead = (id, data) => api.patch(`/lead/${id}`, data);
export const markNotInterested = (id, remark) => api.patch(`/lead/${id}/not-interested`, { remark });

// Repeat enquiry: a converted customer comes back for another service. Creates a NEW linked lead (the original is kept).
export const createRepeatEnquiry = (id, { service, services, remark, source } = {}) =>
  api.post(`/lead/${id}/repeat-enquiry`, { service, services, remark, source });
// All enquiries (original + repeats) for a customer, for the history view.
export async function getEnquiryHistory(id) {
  try { const r = await api.get(`/lead/${id}/enquiries`); return r && Array.isArray(r.enquiries) ? r.enquiries : []; } catch { return []; }
}

export function addCallRemark(id, { remark, outcome, followUpDate, status, industry, services }) {
  const payload = { remark, outcome };
  if (followUpDate) payload.followUpDate = followUpDate;
  if (status) payload.status = status;
  if (industry !== undefined) payload.industry = industry;
  if (Array.isArray(services)) { payload.services = services; payload.service = services[0] || ''; }   // same as the mobile app
  return api.patch(`/lead/${id}`, payload);
}

// ── Same server features as the mobile app ───────────────────────────────────
// Follow-ups report (the Daily Report's lists): an employee gets only their own.
export const getFollowUpsReport = () => api.get('/reports/follow-ups', { timeout: 30000 });
// Invalid number / lead. Two steps: the first employee sends it for verification; a verifier confirms (reject=false)
// or rejects it (reject=true, "it is not invalid").
export const markLeadInvalid = (id, { remark, reject = false } = {}) => api.patch(`/lead/${id}/invalid`, { remark, reject });
// AI summary + next action: { summary, nextAction, keyPoints[], sentiment, suggestedTemp, generatedAt, cached }
export const getLeadActionSummary = (id, { refresh = false } = {}) => api.get(`/lead/${id}/action-summary${refresh ? '?refresh=1' : ''}`, { timeout: 60000, retries: 0 });   // no automatic retry: each try costs an AI call, and a busy answer is better shown at once
// Client visit / meeting remark. A photo or document is sent as multipart (documents → "document", audio → "recording").
export function postMeetingRemark(leadId, payload, file) {
  if (!file) return api.post(`/lead/${leadId}/meeting-remark`, payload, { timeout: 30000 });
  const form = new FormData();
  Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) form.append(k, String(v)); });
  form.append(String(file.type || '').startsWith('audio') ? 'recording' : 'document', file, file.name);
  return api.post(`/lead/${leadId}/meeting-remark`, form, { timeout: 120000 });
}
export async function getMeetingRemarks(leadId) {
  try { const r = await api.get(`/lead/${leadId}/meeting-remarks`); return Array.isArray(r?.meetingRemarks) ? r.meetingRemarks : []; } catch { return []; }
}
export async function createLead(body) {
  const d = await api.post('/lead', body);
  return d?._id || d?.id || d?.lead?._id || null;
}
export const saveIdleRemark = (remark, breakIndex) => api.post('/attendance/idle-remark', breakIndex != null ? { remark, breakIndex } : { remark });

export function formatLead(lead) {
  const callHistory = Array.isArray(lead?.callHistory) ? lead.callHistory : [];
  const lastCall = callHistory[callHistory.length - 1] || null;
  const isLogEntry = (h) => !h || h.callType != null || h.duration != null || h.timestamp != null ||
    (typeof h.remark === 'string' && /call from mobile app/i.test(h.remark));
  let manual = '';
  let manualAt = 0;
  for (let i = callHistory.length - 1; i >= 0; i--) {
    const h = callHistory[i];
    if (h?.remark && String(h.remark).trim() && !isLogEntry(h)) {
      manual = String(h.remark).trim();
      manualAt = h.calledAt ? new Date(h.calledAt).getTime() || 0 : 0;
      break;
    }
  }
  const phone = lead?.primaryPhone || lead?.mobile || lead?.phone || '';
  const created = lead?.date ? new Date(lead.date).getTime() : 0;
  const lastAt = lastCall?.calledAt ? new Date(lastCall.calledAt).getTime() : 0;
  return {
    id: String(lead?._id ?? lead?.id),
    name: lead?.name || 'Unknown',
    phone,
    secondaryPhone: lead?.secondaryPhone || '',
    email: lead?.email || '',
    source: lead?.source || 'Web Form',
    campaign: lead?.campaign || '',
    industry: lead?.industry || '',
    services: Array.isArray(lead?.services) && lead.services.length ? lead.services : (lead?.service ? [lead.service] : []),
    status: lead?.status || 'New',
    date: lead?.date,
    sortAt: Math.max(created, lastAt) || created,
    remark: manual || (lead?.remark ? String(lead.remark).trim() : ''),
    lastManualRemarkAt: manualAt,
    initialRemark: lead?.initialRemark || '',
    followUpDate: lead?.followUpDate || (Array.isArray(lead?.scheduledCalls)
      ? lead.scheduledCalls.filter((s) => s && !s.done && s.scheduledAt).map((s) => s.scheduledAt)
        .sort((a, b) => new Date(a) - new Date(b))[0] || null
      : null),
    temperature: lead?.temperature || lead?.Quality || null,
    callHistory,
    lastOutcome: lastCall?.outcome || null,
    lastCalledAt: lastCall?.calledAt || null,
    isClosed: !!lead?.isClosed,
    invalidStage: lead?.invalidStage || null,
  };
}

// True for history entries written by the call-log sync rather than an agent.
export const isAutoCallEntry = (h) => !h || h.callType != null || h.duration != null || h.timestamp != null ||
  (typeof h.remark === 'string' && /call from mobile app/i.test(h.remark));

// ── Call logs (synced by the Android app) — same endpoints as its Calls screen
const LOG_PAGE = 500;
export async function getCallLogsForDay(dateStr, tzOffset) {
  const base = `/call-logs?date=${dateStr}&tzOffset=${tzOffset}&limit=${LOG_PAGE}`;
  const first = await api.get(`${base}&page=1`, { timeout: 30000 });
  let logs = first?.logs || [];
  const pages = Math.min(first?.totalPages || 1, 20);
  for (let p = 2; p <= pages; p++) {
    const r = await api.get(`${base}&page=${p}`, { timeout: 30000 });
    logs = logs.concat(r?.logs || []);
  }
  return logs;
}
// Every logged call for one lead (newest first) — same endpoint the CRM's lead page uses.
export async function getLeadCallLogs(leadId, limit = 30) {
  const r = await api.get(`/call-logs/lead/${leadId}?limit=${limit}`);
  return Array.isArray(r?.logs) ? r.logs : [];
}
export async function getUncalledLeads(dateStr, tzOffset, limit = 100) {
  const r = await api.get(`/call-logs/uncalled?date=${dateStr}&tzOffset=${tzOffset}&page=1&limit=${limit}`);
  return { leads: r?.leads || [], total: Number(r?.total) || (r?.leads || []).length };
}

// ── Attendance ───────────────────────────────────────────────────────────────
export const attendance = {
  today: () => api.get('/attendance/my-today'),
  clockIn: (loc) => api.post('/attendance/clock-in', loc || {}),
  clockOut: () => api.post('/attendance/clock-out'),
  breakStart: () => api.post('/attendance/break/start', { reason: 'Manual Break' }),
  breakEnd: () => api.post('/attendance/break/end'),
  ping: () => api.post('/attendance/ping', {}, { timeout: 10000 }),
  remoteStatus: () => api.get('/attendance/meeting-permission-status'),
  requestRemote: (reason, location) => api.post('/attendance/request-meeting-permission', { reason, location }),
};

// ── Misc ─────────────────────────────────────────────────────────────────────
export const getCustomization = () => api.get('/customization');
// Custom-field filters the company configured (developer panel → Use as filter). Each: { key, label, type, values[] }.
export async function getFilterOptions() {
  try { const r = await api.get('/lead/filter-options'); return r && Array.isArray(r.filters) ? r.filters : []; } catch { return []; }
}
export const getTerms = () => api.get('/terms/current');
export const acceptTerms = (version) => api.post('/terms/accept', { version });
