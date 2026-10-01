// src/data/customizationStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Company customization (Customize CRM) — tiny module-level store so BOTH React
// components (via useCustomization) and plain utilities (statusConfig.js etc.)
// read the same live config.
//
//   loadCustomization(force)  → fetch GET /customization once per session
//   getCustomization()        → current resolved config (defaults until loaded)
//   subscribeCustomization(fn)→ re-render hook
//   applyCustomization(obj)   → replace after a save (editor)
//
// Until the server responds, the CRM's original defaults are used, so the
// UI looks exactly like before for companies that never customised anything.
// ─────────────────────────────────────────────────────────────────────────────

import api, { clearCache } from "./axiosConfig";
import { getToken, getUser } from "./sessionStore";
import { CUSTOMIZATION_DEFAULTS, CUSTOMIZATION_META } from "./customizationDefaults";

let _state = {
  customization: CUSTOMIZATION_DEFAULTS,
  canEdit: false,
  loaded: false,
  loading: false,
  error: null,
  companyKey: null,
};
const _subs = new Set();
let _inflight = null;

function emit() {
  for (const fn of _subs) {
    try { fn(); } catch { /* ignore subscriber errors */ }
  }
}

export function subscribeCustomization(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function getCustomizationState() {
  return _state;
}

export function getCustomization() {
  return _state.customization;
}

export function getCustomizationMeta() {
  return CUSTOMIZATION_META;
}

function setState(patch) {
  _state = { ..._state, ...patch };
  emit();
}

/** Replace the active customization (after a save in the editor). */
export function applyCustomization(customization, extra = {}) {
  if (!customization) return;
  setState({ customization, loaded: true, ...extra });
  try { window.dispatchEvent(new Event("customization_applied")); } catch { /* SSR */ }
}

/** Forget the loaded config (logout / company switch). */
export function resetCustomization() {
  _inflight = null;
  setState({ customization: CUSTOMIZATION_DEFAULTS, canEdit: false, loaded: false, loading: false, error: null, companyKey: null });
}

/**
 * Fetch the company's customization. De-duplicated; cheap to call often.
 * Developers have no company of their own → defaults.
 */
export async function loadCustomization(force = false) {
  const token = getToken();
  const user = getUser();
  if (!token || !user || user.role === "developer") return _state.customization;

  const companyKey = String(user.company?._id || user.company || user.companyId || user._id || "");
  if (!force && _state.loaded && _state.companyKey === companyKey) return _state.customization;
  if (_inflight && !force) return _inflight;

  if (force) clearCache("/customization");
  setState({ loading: true });
  _inflight = api.get("/customization")
    .then(({ data }) => {
      const cust = data?.customization || CUSTOMIZATION_DEFAULTS;
      setState({ customization: cust, canEdit: !!data?.canEdit, loaded: true, loading: false, error: null, companyKey });
      return cust;
    })
    .catch((err) => {
      // Keep defaults — never block the CRM on this request.
      setState({ loading: false, error: err?.response?.data?.message || err.message });
      return _state.customization;
    })
    .finally(() => { _inflight = null; });
  return _inflight;
}

// Live refresh: the server pushes `customization_updated` over the socket
// (NotificationProvider re-dispatches it as a window event).
if (typeof window !== "undefined") {
  window.addEventListener("customization_updated", () => { loadCustomization(true); });
  window.addEventListener("user_changed", () => { resetCustomization(); });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers over a customization object (default: the live one)
// ─────────────────────────────────────────────────────────────────────────────
const norm = (v) => String(v == null ? "" : v).trim().toLowerCase();

export function findStatus(value, c = getCustomization()) {
  if (value === undefined || value === null || value === "") return null;
  const v = norm(value);
  const list = c?.statuses || [];
  return list.find((s) => norm(s.key) === v)
    || list.find((s) => norm(s.label) === v)
    || list.find((s) => (s.aliases || []).some((a) => norm(a) === v))
    || null;
}

export function statusLabel(value, c = getCustomization()) {
  return findStatus(value, c)?.label || value || "";
}

export function statusKeysByCategory(cats, c = getCustomization(), { activeOnly = false } = {}) {
  const want = new Set(Array.isArray(cats) ? cats : [cats]);
  return (c?.statuses || []).filter((s) => want.has(s.category) && (!activeOnly || s.active)).map((s) => s.key);
}

export function statusCategory(value, c = getCustomization()) {
  return findStatus(value, c)?.category || null;
}

export function defaultStatusKey(c = getCustomization()) {
  const list = c?.statuses || [];
  return (list.find((s) => s.isDefault) || list.find((s) => s.category === "new") || list[0] || { key: "New" }).key;
}

/** Statuses an employee may pick in the update panel. */
export function employeeStatuses(c = getCustomization()) {
  return (c?.statuses || []).filter((s) => s.active && s.employeeSelectable);
}

export function activeStatuses(c = getCustomization()) {
  return (c?.statuses || []).filter((s) => s.active);
}

export function pipelineStatuses(c = getCustomization()) {
  return (c?.statuses || []).filter((s) => s.active && s.showInPipeline);
}

export function findOutcome(value, c = getCustomization()) {
  if (!value) return null;
  const v = norm(value);
  const list = c?.outcomes || [];
  return list.find((o) => norm(o.key) === v) || list.find((o) => norm(o.label) === v) || null;
}

export function outcomeLabel(value, c = getCustomization()) {
  return findOutcome(value, c)?.label || value || "";
}

export function activeOutcomes(c = getCustomization()) {
  return (c?.outcomes || []).filter((o) => o.active);
}

export function findTemperature(value, c = getCustomization()) {
  if (!value) return null;
  const v = norm(value);
  const list = c?.temperatures || [];
  return list.find((t) => norm(t.key) === v) || list.find((t) => norm(t.label) === v) || null;
}

export function activeTemperatures(c = getCustomization()) {
  return (c?.temperatures || []).filter((t) => t.active);
}

export function coldTemperatureKey(c = getCustomization()) {
  return ((c?.temperatures || []).find((t) => t.triggersColdFlow) || {}).key || null;
}

export function list(name, c = getCustomization()) {
  return (c?.lists && Array.isArray(c.lists[name])) ? c.lists[name] : [];
}

export function isModuleOn(key, c = getCustomization()) {
  const m = c?.modules?.[key];
  return m ? m.enabled !== false : true;
}

/** Module visible in navigation for a role ("admin" | "employee"). */
export function moduleVisibleFor(key, role, c = getCustomization()) {
  const m = c?.modules?.[key];
  if (!m) return true;
  if (m.enabled === false) return false;
  return role === "employee" ? m.employee !== false : m.admin !== false;
}

export function moduleLabel(key, fallback, c = getCustomization()) {
  return c?.modules?.[key]?.label || fallback;
}

export function can(permission, role = "employee", c = getCustomization()) {
  const group = c?.permissions?.[role === "user" ? "employee" : role];
  if (!group || !(permission in group)) return true;
  return !!group[permission];
}

export function term(key, fallback, c = getCustomization()) {
  return c?.general?.terminology?.[key] || fallback || key;
}

export function leadField(key, c = getCustomization()) {
  return c?.leadFields?.[key] || { visible: true, required: false, label: key };
}

export function activeCustomFields(c = getCustomization(), { role = "admin" } = {}) {
  return (c?.customFields || []).filter((f) => f.active && (role !== "employee" || f.employeeVisible));
}

/**
 * May this user DOWNLOAD call recordings? (Customize CRM → Permissions →
 * Call recordings). role: "super_admin" | "admin" | "user"; isTeamLead for
 * employees flagged as Team Lead. Default for everyone: no download.
 */
export function canDownloadRecordings(role, isTeamLead = false, c = getCustomization()) {
  const r = c?.permissions?.recordings || {};
  const rl = String(role || "").toLowerCase();
  if (rl === "super_admin" || rl === "superadmin") return !!r.superAdminCanDownload;
  if (rl === "admin") return !!r.adminCanDownload;
  if (isTeamLead && r.teamLeadCanDownload) return true;
  return !!r.employeeCanDownload;
}
