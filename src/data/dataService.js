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

// ── Fetch all data based on role ───────────────────────────────────────────
export async function fetchAll() {
  const role = getRole();

  if (role === "superadmin") return fetchSuperAdminData();
  if (role === "admin")      return fetchAdminData();

  // "user" role — fetch their own leads
  return fetchUserData();
}

// ── User: fetch own leads ───────────────────────────────────────────────────
async function fetchUserData() {
  const user = getStoredUser();
  const leadsRes = await api.get("/lead/my-leads");
  const leads = await Promise.all(leadsRes.data.map(formatLead));
  // Build a single "agent" entry for the logged-in user so filters work
  const agents = user
    ? [formatAgent({ _id: user._id || user.id, name: user.name, email: user.email, company: user.company })]
    : [];
  return { leads, agents };
}

// ── Admin: fetch company leads + users ─────────────────────────────────────
async function fetchAdminData() {
  const [leadsRes, usersRes] = await Promise.all([
    api.get("/admin/company/leads"),
    api.get("/admin/company/users"),
  ]);

  const leads  = await Promise.all(leadsRes.data.map(formatLead));
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

  const leads = (
    await Promise.all(
      allLeadsRes.flatMap((res) =>
        (res.data.leads || []).map(formatLead)
      )
    )
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
// Async: decrypts encryptedData if the client has a local encryption key
async function formatLead(lead) {
  let name   = lead.name;
  let mobile = lead.mobile;
  let email  = lead.email || "";
  let remark = lead.remark;

  // ── Zero-knowledge decryption ──────────────────────────────────────────
  // If the server returned an `encryptedData` blob AND the client has a
  // locally-stored encryption key, decrypt it. If anything fails (wrong
  // key, no key, data not encrypted yet) we fall back to the plain values.
  const keyString = crm.getLocalKey();
  if (keyString && lead.encryptedData) {
    try {
      const decrypted = await crm.decrypt(lead.encryptedData, keyString);
      name   = decrypted.name   ?? name;
      mobile = decrypted.mobile ?? mobile;
      email  = decrypted.email  ?? email;
      remark = decrypted.remark ?? remark;
    } catch {
      // Key mismatch or data not encrypted — silently use raw values
    }
  }

  return {
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