import api from "./axiosConfig";

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

// ── Fetch all data based on role ───────────────────────────────────────────
export async function fetchAll() {
  const role = getRole();

  if (role === "superadmin") return fetchSuperAdminData();
  if (role === "admin")      return fetchAdminData();

  // "user" role — no admin API calls
  return { leads: [], agents: [] };
}

// ── Admin: fetch company leads + users ─────────────────────────────────────
async function fetchAdminData() {
  const [leadsRes, usersRes] = await Promise.all([
    api.get("/admin/company/leads"),
    api.get("/admin/company/users"),
  ]);

  const leads  = leadsRes.data.map(formatLead);
  const agents = usersRes.data.map(formatAgent);

  return { leads, agents };
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

  const leads = allLeadsRes.flatMap((res) =>
    (res.data.leads || []).map(formatLead)
  );
  const agents = allLeadsRes.flatMap((res, i) =>
    (res.data.users || []).map(u => formatAgent(u, companies[i]._id))
  );

  return {
    leads,
    agents,
    stats: dashboardRes.data,
    companies,
  };
}

// ── Format lead from DB to dashboard format ────────────────────────────────
function formatLead(lead) {
  return {
    id:       lead._id,
    name:     lead.name,
    mobile:   lead.mobile,
    source:   lead.source   || "Web Form",
    campaign: lead.campaign || "—",
    status:   lead.status,
    date:     formatDate(lead.date),
    remark:   lead.remark,
    agent:    lead.user?.name || "Unknown",
    company:  lead.company,
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