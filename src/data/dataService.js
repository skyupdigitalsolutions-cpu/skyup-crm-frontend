import api from "./axiosConfig";
import CRMEncryption from "../utils/CRMEncryption";

const crm = new CRMEncryption();

// ── Get logged in user info from localStorage ──────────────────────────────
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

export function getRole() {
  const user = getStoredUser();
  return user?.role || "user";
}

// ── FIX 4B: Paginated lead fetcher ────────────────────────────────────────────
// Use this wherever you need leads with pagination support.
// Returns: { leads, total, page, pages }
export const getLeads = async (page = 1, limit = 50, filters = {}) => {
  const params = new URLSearchParams({ page, limit, ...filters });
  const { data } = await api.get(`/lead?${params}`);
  return data; // { leads, total, page, pages }
};

// Admin version — hits the admin leads endpoint
export const getAdminLeads = async (page = 1, limit = 50, filters = {}) => {
  const params = new URLSearchParams({ page, limit, ...filters });
  const { data } = await api.get(`/admin/company/leads?${params}`);
  return data; // { leads, total, page, pages }
};

// ── Fetch all data based on role ───────────────────────────────────────────
export async function fetchAll() {
  const role = getRole();

  if (role === "superadmin") return fetchSuperAdminData();
  if (role === "admin")      return fetchAdminData();

  // "user" role — fetch their own leads
  return fetchUserData();
}

// ── User: fetch own leads (paginated) ─────────────────────────────────────
async function fetchUserData() {
  const user = getStoredUser();

  // FIX 4B: Use my-leads with pagination; fetch first page on load.
  // Components that need more pages should call getLeads() directly.
  const leadsRes = await api.get("/lead/my-leads?page=1&limit=50");

  // Support both old array response and new paginated response
  const rawLeads = Array.isArray(leadsRes.data)
    ? leadsRes.data
    : (leadsRes.data.leads || []);

  const leads = await Promise.all(rawLeads.map(formatLead));
  const agents = user
    ? [formatAgent({ _id: user._id || user.id, name: user.name, email: user.email, company: user.company })]
    : [];

  return {
    leads,
    agents,
    total:  leadsRes.data.total || leads.length,
    page:   leadsRes.data.page  || 1,
    pages:  leadsRes.data.pages || 1,
  };
}

// ── Admin: fetch company leads + users (paginated) ─────────────────────────
async function fetchAdminData() {
  const [leadsRes, usersRes] = await Promise.all([
    // FIX: limit=50 was silently truncating — bumped to 500.
    // Also fixed response parsing: backend returns { leads[], total } not a plain array.
    api.get("/admin/company/leads?page=1&limit=500"),
    api.get("/admin/company/users"),
  ]);

  // FIX: parse paginated shape { leads[], total, page, pages }
  const rawLeads = leadsRes.data?.leads || (Array.isArray(leadsRes.data) ? leadsRes.data : []);

  const leads  = await Promise.all(rawLeads.map(formatLead));
  const agents = usersRes.data.map(formatAgent);

  return {
    leads,
    agents,
    total:  leadsRes.data.total || leads.length,
    page:   leadsRes.data.page  || 1,
    pages:  leadsRes.data.pages || 1,
  };
}

// ── SuperAdmin: fetch all companies + their leads ──────────────────────────
async function fetchSuperAdminData() {
  const [companiesRes, dashboardRes] = await Promise.all([
    api.get("/superadmin/companies"),
    api.get("/superadmin/dashboard"),
  ]);

  const companies = companiesRes.data;
  const allLeadsRes = await Promise.all(
    companies.map((c) => api.get(`/superadmin/companies/${c._id}`))
  );

  const leads = await Promise.all(
    allLeadsRes.flatMap((res) =>
      (res.data.leads || []).map(formatLead)
    )
  );

  const agents = allLeadsRes.flatMap((res, i) =>
    (res.data.users || []).map(u => formatAgent(u, companies[i]._id))
  );

  return { leads, agents, stats: dashboardRes.data, companies };
}

// ── Format lead from DB to dashboard format ────────────────────────────────
// BUG FIX: The original version returned a plain object with only ~9 fields,
// silently dropping callHistory, scheduledCalls, previousAgents, reassignCount,
// voiceBot*, temperature, email, createdAt, updatedAt.
// This caused LeadJourneyDrawer to always show "No calls recorded yet" even
// though the data existed in MongoDB and was returned by the API.
//
// FIX: Spread the entire raw lead document first (...lead), then apply the
// normalised / derived UI fields on top. Nothing is ever lost.
async function formatLead(lead) {
  let name   = lead.name;
  let mobile = lead.mobile;
  let email  = lead.email || "";
  let remark = lead.remark;

  // ── Zero-knowledge decryption ──────────────────────────────────────────
  const keyString = crm.getLocalKey();
  if (keyString && lead.encryptedData) {
    try {
      const decrypted = await crm.decrypt(lead.encryptedData, keyString);
      name   = decrypted.name   ?? name;
      mobile = decrypted.mobile ?? mobile;
      email  = decrypted.email  ?? email;
      remark = decrypted.remark ?? remark;
    } catch {
      // Key mismatch or data not encrypted yet — silently use plain values
    }
  }

  return {
    // ── Spread the ENTIRE raw document first so nothing is lost ───────────
    // This is the critical fix: callHistory, scheduledCalls, previousAgents,
    // reassignCount, voiceBot*, temperature, createdAt, updatedAt all survive.
    ...lead,

    // ── Normalised / derived UI fields (override raw where needed) ────────
    id:       String(lead._id),   // stringify so === comparisons work reliably
    name,
    mobile,
    phone:    mobile,             // table reads lead.phone — keep both in sync
    email,
    source:   lead.source   || "Web Form",
    campaign: lead.campaign || "—",
    status:   lead.status,
    date:     formatDate(lead.date),
    remark,
    agent:    lead.user?.name || "Unknown",
    company:  lead.company,

    // ── Rich history arrays (explicit for clarity — already in ...lead) ───
    callHistory:    Array.isArray(lead.callHistory)    ? lead.callHistory    : [],
    scheduledCalls: Array.isArray(lead.scheduledCalls) ? lead.scheduledCalls : [],
    previousAgents: Array.isArray(lead.previousAgents) ? lead.previousAgents : [],
    reassignCount:  lead.reassignCount ?? 0,

    // ── VoiceBot fields (explicit for clarity — already in ...lead) ───────
    voiceBotSummary:    lead.voiceBotSummary    ?? "",
    voiceBotScore:      lead.voiceBotScore      ?? null,
    voiceBotReason:     lead.voiceBotReason     ?? "",
    voiceBotNextAction: lead.voiceBotNextAction ?? "",
    voiceBotService:    lead.voiceBotService    ?? "",
    voiceBotCallSid:    lead.voiceBotCallSid    ?? "",
    voiceBotDuration:   lead.voiceBotDuration   ?? null,
    voiceBotTranscript: lead.voiceBotTranscript ?? "",
    lastCalledByBot:    lead.lastCalledByBot     ?? null,

    // ── Aliases used by LeadJourneyDrawer ─────────────────────────────────
    _raw_date:   lead.date,         // original ISO date before formatting
    Quality:     lead.temperature,  // LeadJourneyDrawer reads lead.Quality
    temperature: lead.temperature ?? null,
  };
}

// ── Format user/agent from DB ──────────────────────────────────────────────
function formatAgent(user, companyId = null) {
  const colors = ["#2563EB","#7C3AED","#0891B2","#059669","#D97706","#DC2626"];
  const colorIndex = Math.abs(hashStr(user._id || user.name)) % colors.length;
  return {
    id:      user._id,
    name:    user.name,
    email:   user.email,
    company: companyId || user.company || null,
    color:   colors[colorIndex],
    avatar:  (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
  };
}

// ── Format date from ISO to "25 Mar 2026" ──────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Simple hash for consistent colors ──────────────────────────────────────
function hashStr(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}
