import { useState, useMemo, useEffect, useRef } from "react";
import { fetchAll, getRole } from "../data/dataService";
import api from "../data/axiosConfig";
import { useDateFilter } from "../components/dataFilter";
import CRMEncryption from "../utils/CRMEncryption";
import { STATUS_CONFIG, getLeadDisplayStatus, ALL_STATUSES as ALL_STATUSES_SHARED } from "../utils/statusConfig";
import { normalizePhone } from "../utils/normalizePhone";
import { AlertTriangle } from "lucide-react";

// ── Phone masking helper ──────────────────────────────────────────────────────
function maskPhone(phone) {
  if (!phone) return "—";
  const str = String(phone).replace(/\s/g, "");
  if (str.length <= 4) return "••••";
  return str.slice(0, 2) + "•".repeat(Math.max(str.length - 4, 3)) + str.slice(-2);
}

// ── Role-aware phone display: superadmin sees full number, others see masked ──
function displayPhone(phone, role) {
  if (!phone) return "—";
  if (role === "superadmin") return String(phone).replace(/\s/g, "");
  return maskPhone(phone);
}

const crm = new CRMEncryption();

const CALL_LOGS_API = "/call-logs";

// ── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_COLORS = {
  "Google Ads":   "#2563EB",
  "Campaign":     "#7C3AED",
  "Facebook Ads": "#0891B2",
  "Web Form":     "#059669",
  "Referral":     "#D97706",
};

const STATUS_STYLE = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, { bg: v.bg, text: v.text }])
);
const ALL_STATUSES = ALL_STATUSES_SHARED;

const OUTCOME_STYLE = {
  "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",        text: "text-red-600 dark:text-red-400" },
  "Interested":     { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  "Call Back":      { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400" },
  "No Answer":      { bg: "bg-gray-100 dark:bg-gray-900/40",      text: "text-gray-500 dark:text-gray-400" },
};

const ALL_SOURCES = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral"];

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function daysSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ── Searchable Employee Select ────────────────────────────────────────────────
function AgentSelect({ value, onChange, agents, className }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const containerRef      = useRef(null);
  const inputRef          = useRef(null);

  const options  = ["All", ...agents];
  const filtered = query.trim()
    ? options.filter(a => a.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (agent) => {
    onChange(agent);
    setOpen(false);
    setQuery("");
  };

  const label = value === "All" ? "All employees" : value;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${className} flex items-center justify-between gap-2 min-w-[140px]`}
      >
        <span className="truncate">{label}</span>
        <svg
          className={`w-3 h-3 shrink-0 text-[#8B92A9] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-56 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search agent…"
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-[12px] text-[#8B92A9] italic">No employees found</p>
            ) : filtered.map(agent => {
              const isSelected = agent === value;
              const displayName = agent === "All" ? "All employees" : agent;
              return (
                <button
                  key={agent}
                  type="button"
                  onClick={() => select(agent)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition
                    ${isSelected
                      ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] font-semibold"
                      : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"
                    }`}
                >
                  <span className="w-4 shrink-0">
                    {isSelected && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
      <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
      {sub && <span className={`text-[12px] font-medium ${accent}`}>{sub}</span>}
    </div>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-3 py-4 md:px-6 md:py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
      </div>
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-96" />
    </div>
  );
}

// ── Manage Projects Modal (Admin) ─────────────────────────────────────────────
function ManageProjectsModal({ projects, onClose, onProjectsChange }) {
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [color,       setColor]       = useState("#2563EB");
  const [isGlobal,    setIsGlobal]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);
  const [error,       setError]       = useState("");

  // Detail / edit panel — null = list view, object = selected project
  const [detail,      setDetail]      = useState(null);
  const [editName,    setEditName]    = useState("");
  const [editDesc,    setEditDesc]    = useState("");
  const [editColor,   setEditColor]   = useState("#2563EB");
  const [updating,    setUpdating]    = useState(false);
  const [updateError, setUpdateError] = useState("");

  const openDetail = (p) => {
    setDetail(p);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditColor(p.color || "#2563EB");
    setUpdateError("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    try {
      const { data } = await api.post("/project/admin", {
        name: name.trim(),
        description: description.trim(),
        color,
        isGlobal,
      });
      onProjectsChange([data, ...projects]);
      setName(""); setDescription(""); setColor("#2563EB"); setIsGlobal(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this project? It will be removed from all leads.")) return;
    setDeleting(id);
    try {
      await api.delete(`/project/admin/${id}`);
      onProjectsChange(projects.filter(p => p._id !== id));
      if (detail?._id === id) setDetail(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete project.");
    } finally { setDeleting(null); }
  };

  const handleToggleGlobal = async (project) => {
    try {
      const { data } = await api.put(`/project/admin/${project._id}`, { isGlobal: !project.isGlobal });
      onProjectsChange(projects.map(p => p._id === project._id ? data : p));
      if (detail?._id === project._id) setDetail(data);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update project.");
    }
  };

  const handleSaveDetail = async () => {
    if (!editName.trim()) { setUpdateError("Project name is required."); return; }
    setUpdating(true); setUpdateError("");
    try {
      const { data } = await api.put(`/project/admin/${detail._id}`, {
        name:        editName.trim(),
        description: editDesc.trim(),
        color:       editColor,
      });
      onProjectsChange(projects.map(p => p._id === data._id ? data : p));
      setDetail(data);
    } catch (err) {
      setUpdateError(err.response?.data?.message || "Failed to save changes.");
    } finally { setUpdating(false); }
  };

  const PRESET_COLORS = [
    "#2563EB","#7C3AED","#DB2777","#DC2626",
    "#EA580C","#D97706","#16A34A","#0891B2","#475569",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0F2FA] dark:border-[#262A38] shrink-0">
          <div className="flex items-center gap-2.5">
            {detail && (
              <button onClick={() => setDetail(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                {detail ? detail.name : "Manage Projects"}
              </h2>
              <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {detail ? "Project details & settings" : "Create colour-coded tags to categorise leads"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Detail / Edit panel ── */}
        {detail ? (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Color dot + name */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
              <span className="w-5 h-5 rounded-full shrink-0 ring-2 ring-white dark:ring-[#1A1D27]" style={{ background: editColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{detail.name}</p>
                <p className="text-[10px] text-[#8B92A9]">{detail.isGlobal ? "Visible to everyone" : "Admin only"}</p>
              </div>
              <button
                onClick={() => handleToggleGlobal(detail)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 transition ${
                  detail.isGlobal
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-[#F8F9FC] dark:bg-[#1A1D27] text-[#8B92A9] border border-[#E4E7EF] dark:border-[#262A38]"
                }`}
              >
                {detail.isGlobal ? "Global" : "Admin only"}
              </button>
            </div>

            {/* Edit Name */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Project Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>

            {/* Edit Description */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Add a description for this project…"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition resize-none"
              />
            </div>

            {/* Edit Color */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    style={{ background: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${editColor === c ? "scale-125 ring-2 ring-offset-2 ring-[#2563EB]" : "hover:scale-110"}`}
                  />
                ))}
                <input
                  type="color"
                  value={editColor}
                  onChange={e => setEditColor(e.target.value)}
                  className="w-6 h-6 rounded-full border-0 cursor-pointer bg-transparent"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Created info */}
            <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">
              Created {detail.createdAt ? new Date(detail.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </div>

            {updateError && <p className="text-[11px] text-red-500">{updateError}</p>}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveDetail}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                {updating
                  ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                }
                {updating ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => handleDelete(detail._id)}
                disabled={deleting === detail._id}
                className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[13px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                Delete
              </button>
            </div>
          </div>

        ) : (

          /* ── List view ── */
          <>
            {/* Create new project form */}
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38] px-6 py-4 shrink-0">
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3">New Project</p>

              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  placeholder="Project name"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
                />
                <button
                  onClick={handleCreate}
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "…" : "+ Add"}
                </button>
              </div>

              {/* Description */}
              <textarea
                rows={2}
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 mb-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition resize-none"
              />

              {/* Color presets */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ background: c }}
                    className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-[#2563EB]" : "hover:scale-110"}`}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-5 h-5 rounded-full border-0 cursor-pointer bg-transparent"
                  title="Custom color"
                />
              </div>

              {/* Visibility toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setIsGlobal(v => !v)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${isGlobal ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isGlobal ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                  {isGlobal ? "Visible to everyone in company" : "Visible to admins only"}
                </span>
              </label>
              {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
            </div>

            {/* Project list */}
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                  <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No projects yet</p>
                </div>
              ) : projects.map(p => (
                <div key={p._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] group hover:border-[#2563EB]/40 transition">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color || "#2563EB" }} />

                  {/* Name — clickable to open detail */}
                  <button
                    onClick={() => openDetail(p)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate group-hover:text-[#2563EB] transition">{p.name}</p>
                    {p.description && (
                      <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] truncate mt-0.5">{p.description}</p>
                    )}
                  </button>

                  <button
                    onClick={() => handleToggleGlobal(p)}
                    title={p.isGlobal ? "Click to make admin-only" : "Click to make global"}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition shrink-0 ${
                      p.isGlobal
                        ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]"
                        : "bg-[#F8F9FC] dark:bg-[#1A1D27] text-[#8B92A9] dark:text-[#565C75] border border-[#E4E7EF] dark:border-[#262A38]"
                    }`}
                  >
                    {p.isGlobal ? "Global" : "Admin"}
                  </button>

                  <button
                    onClick={() => handleDelete(p._id)}
                    disabled={deleting === p._id}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[#C4C9D9] dark:text-[#3E4257] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-40 shrink-0"
                    title="Delete project"
                  >
                    {deleting === p._id
                      ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    }
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
              <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Project Dropdown (multi-select) ───────────────────────────────────────────
function ProjectDropdown({ projects, selectedProjects, toggleProject }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedNames = projects.filter(p => selectedProjects.includes(String(p._id)));

  return (
    <div ref={ref} className="relative pt-3 mt-2">
      <label className="block text-[11px] font-medium text-[#8B92A9] mb-1 uppercase tracking-wide">
        Projects
      </label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-left transition focus:outline-none focus:border-[#2563EB] hover:border-[#2563EB]/50"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedNames.length === 0 ? (
            <span className="text-[#8B92A9]">Select projects…</span>
          ) : (
            selectedNames.map(p => (
              <span
                key={p._id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ background: p.color || "#2563EB" }}
              >
                {p.name}
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); toggleProject(String(p._id)); }}
                  className="opacity-80 hover:opacity-100 cursor-pointer leading-none"
                >✕</span>
              </span>
            ))
          )}
        </div>
        <svg
          className={"w-3.5 h-3.5 shrink-0 ml-2 text-[#8B92A9] transition-transform " + (open ? "rotate-180" : "")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[100] mt-1.5 w-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-48 overflow-y-auto">
            {projects.map(p => {
              const active = selectedProjects.includes(String(p._id));
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => toggleProject(String(p._id))}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition text-left"
                >
                  <span className="flex-1 font-medium text-[#0F1117] dark:text-white">{p.name}</span>
                  {active && (
                    <svg className="w-3.5 h-3.5 shrink-0" style={{ color: p.color || "#2563EB" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          {selectedNames.length > 0 && (
            <div className="border-t border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
              <button
                type="button"
                onClick={() => selectedNames.forEach(p => toggleProject(String(p._id)))}
                className="text-[11px] text-red-500 hover:text-red-600 font-semibold transition"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, agents, projects = [], onClose, onSave }) {
  const [form, setForm]                   = useState({ ...lead });
  const [reassignReason, setReassignReason] = useState("");
  const [saving, setSaving]               = useState(false);
  const [selectedProjects, setSelectedProjects] = useState(() => {
    if (!Array.isArray(lead.projects)) return [];
    return lead.projects.map(p => p?._id || String(p)).filter(Boolean);
  });

  const toggleProject = (id) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const agentChanged = form.agent && form.agent !== lead.agent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Edit Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Lead Name", key: "name" },
            { label: "Campaign",  key: "campaign" },
            { label: "Remark",    key: "remark" },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Date</label>
            <input type="text" value={form.date || "—"} readOnly
              className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed" />
          </div>
          {[
            { label: "Source",   key: "source",  options: ALL_SOURCES },
            { label: "Employee", key: "agent",   options: agents.map(a => a.name) },
            { label: "Status",   key: "status",  options: ALL_STATUSES },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {projects.length > 0 && (
          <ProjectDropdown
            projects={projects}
            selectedProjects={selectedProjects}
            toggleProject={toggleProject}
          />
        )}

        {agentChanged && (
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#D97706] dark:text-[#FCD34D] uppercase tracking-wide flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Reassign Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reassignReason}
              onChange={e => setReassignReason(e.target.value)}
              placeholder="Why is this lead being reassigned? (required)"
              className="px-3 py-2 rounded-xl border border-[#D97706] dark:border-[#92400E] bg-[#FFFBEB] dark:bg-[#2D1F00] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#D97706] resize-none"
            />
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition disabled:opacity-50">Cancel</button>
          <button disabled={saving} onClick={async () => {
            if (agentChanged && !reassignReason.trim()) {
              alert("Please enter a reason for reassigning this lead.");
              return;
            }
            const role   = getRole();
            const leadId = form._id || form.id;
            const endpoint =
              role === "superadmin" ? `/lead/superadmin/${leadId}` :
              role === "admin"      ? `/lead/admin/${leadId}` :
                                     `/lead/${leadId}`;
            try {
              setSaving(true);
              const basePayload = {
                name:     form.name,
                mobile:   form.phone || form.mobile,
                source:   form.source,
                campaign: form.campaign === "—" ? "" : form.campaign,
                status:   form.status,
                remark:   form.remark,
                projects: selectedProjects,
              };

              if (form.agent) {
                const selectedAgent = agents.find(a => a.name === form.agent);
                if (selectedAgent?.id) basePayload.user = selectedAgent.id;
              }

              if (agentChanged && reassignReason.trim()) {
                basePayload.reassignReason = reassignReason.trim();
              }

              let payload = basePayload;
              const keyString = crm.getLocalKey();
              if (keyString) {
                try {
                  const encryptedData = await crm.encrypt(
                    { name: basePayload.name, mobile: basePayload.mobile, email: form.email || "", remark: basePayload.remark },
                    keyString
                  );
                  payload = { ...basePayload, encryptedData };
                } catch { /* send plain */ }
              }
              const { data: updatedFromServer } = await api.put(endpoint, payload);
              const merged = updatedFromServer?._id
                ? {
                    ...lead,
                    ...form,
                    name:     updatedFromServer.name     ?? form.name,
                    mobile:   updatedFromServer.mobile   ?? form.mobile,
                    phone:    updatedFromServer.mobile   ?? form.phone,
                    source:   updatedFromServer.source   ?? form.source,
                    campaign: updatedFromServer.campaign ?? form.campaign,
                    status:   updatedFromServer.status   ?? form.status,
                    remark:   updatedFromServer.remark   ?? form.remark,
                    agent:    updatedFromServer.user?.name ?? form.agent,
                  }
                : { ...lead, ...form };
              onSave(merged);
              onClose();
            } catch (err) {
              alert("Failed to save: " + (err.response?.data?.message || err.message));
            } finally {
              setSaving(false);
            }
          }} className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Remarks History Modal ─────────────────────────────────────────────────────
function RemarksHistoryModal({ lead, role, onClose }) {
  const callHistory      = Array.isArray(lead.callHistory)      ? lead.callHistory      : [];
  const activityTimeline = Array.isArray(lead.activityTimeline) ? lead.activityTimeline : [];

  const callEntries = callHistory.map(e => ({ _type: "call", ...e, _ts: new Date(e.calledAt) }));
  const reassignEntries = activityTimeline
    .filter(e => e.action === "reassigned" || e.action === "merged")
    .map(e => ({ _type: e.action === "merged" ? "merge" : "reassign", ...e, _ts: new Date(e.timestamp) }));

  const mergedTimeline = [...callEntries, ...reassignEntries].sort((a, b) => b._ts - a._ts);

  const { config: st } = getLeadDisplayStatus(lead);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {displayPhone(lead.primaryPhone || lead.phone, role)} · {lead.source}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span>
          {lead.remark && (
            <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic truncate">"{lead.remark}"</span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[#7C3AED] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
          </svg>
          <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call History & Remarks</span>
          <span className="ml-auto text-[11px] text-[#8B92A9] dark:text-[#565C75] bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full">
            {mergedTimeline.length} {mergedTimeline.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-2">
          {mergedTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
              </svg>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No call history yet</p>
              <p className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">Remarks appear here after employee interactions</p>
            </div>
          ) : mergedTimeline.map((entry, i) => {
            if (entry._type === "reassign") {
              return (
                <div key={`reassign-${i}`} className="bg-[#FFFBEB] dark:bg-[#2D1F00] border border-[#FDE68A] dark:border-[#92400E] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#FEF3C7] dark:bg-[#3D2800] flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-[#D97706] dark:text-[#FCD34D] leading-none">Lead Reassigned</p>
                        <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#D97706] bg-[#FEF3C7] dark:bg-[#3D2800] px-1.5 py-0.5 rounded-md font-semibold uppercase shrink-0">
                      {entry.role || "admin"}
                    </span>
                  </div>
                  {entry.note ? (
                    <div className="ml-8">
                      <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D] font-medium mb-0.5">Reason:</p>
                      <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{entry.note}"</p>
                    </div>
                  ) : (
                    <p className="ml-8 text-[11px] text-[#C4C9D9] dark:text-[#3E4257] italic">No reason recorded</p>
                  )}
                </div>
              );
            }

            if (entry._type === "merge") {
              return (
                <div key={`merge-${i}`} className="bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#6EE7B7] dark:border-[#065F46] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#D1FAE5] dark:bg-[#064E3B] flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-[#059669] dark:text-[#34D399] leading-none">Duplicate Lead Merged</p>
                        <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#059669] bg-[#D1FAE5] dark:bg-[#064E3B] px-1.5 py-0.5 rounded-md font-semibold uppercase shrink-0">
                      system
                    </span>
                  </div>
                  {entry.note && (
                    <div className="ml-8">
                      <p className="text-[11px] text-[#065F46] dark:text-[#6EE7B7] italic leading-relaxed">{entry.note}</p>
                    </div>
                  )}
                </div>
              );
            }

            const outcome = entry.outcome || "No Answer";
            const os = OUTCOME_STYLE[outcome] || OUTCOME_STYLE["No Answer"];
            return (
              <div key={`call-${i}`} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[9px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                      {callEntries.length - callEntries.findIndex(c => c === entry)}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{entry.userName || "Employee"}</p>
                      <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDateTime(entry.calledAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${os.bg} ${os.text}`}>{outcome}</span>
                    {entry.calledAt && (
                      <span className="text-[9px] text-[#8B92A9] bg-[#F0F2FA] dark:bg-[#1E2130] px-1.5 py-0.5 rounded-md">
                        {daysSince(entry.calledAt)}
                      </span>
                    )}
                  </div>
                </div>
                {entry.remark ? (
                  <div className="ml-8">
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{entry.remark}"</p>
                  </div>
                ) : (
                  <p className="ml-8 text-[11px] text-[#C4C9D9] dark:text-[#3E4257] italic">No remark added</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recording & Remarks Modal ─────────────────────────────────────────────────
function RecordingModal({ lead, role, onClose }) {
  const [mobileLogs, setMobileLogs] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    api.get(`${CALL_LOGS_API}/lead/${lead.id || lead._id}`)
      .then(res => {
        const logs = Array.isArray(res.data?.logs) ? res.data.logs : [];
        setMobileLogs(logs);
      })
      .catch(() => setError("Failed to fetch call logs."))
      .finally(() => setLoading(false));
  }, [lead]);

  const { config: st } = getLeadDisplayStatus(lead);
  const allCallHistory = Array.isArray(lead.callHistory) ? [...lead.callHistory] : [];
  const recordingsFromMobile = mobileLogs.filter(l => l.recordings?.length > 0);

  const fmtDur = (sec) => {
    if (!sec) return null;
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              <p className="text-[12px] text-[#8B92A9] mt-0.5 font-mono">
                {displayPhone(lead.primaryPhone || lead.phone, role)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Status",   value: <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span> },
            { label: "Source",   value: lead.source },
            { label: "Employee", value: lead.agent },
            { label: "Date",     value: lead.date },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-medium text-[#8B92A9] uppercase tracking-wide mb-1">{label}</p>
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">
            All Remarks ({allCallHistory.length})
          </p>
          {allCallHistory.length === 0 ? (
            <p className="text-[12px] text-[#8B92A9] italic px-1">No remarks recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {[...allCallHistory]
                .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
                .map((h, i) => (
                <div key={i} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5 border border-[#E4E7EF] dark:border-[#262A38]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#2563EB]">{h.userName || "Employee"}</span>
                    <span className="text-[10px] text-[#8B92A9]">
                      {h.calledAt ? new Date(h.calledAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  {h.outcome && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEF3FF] text-[#2563EB] mb-1">{h.outcome}</span>
                  )}
                  {h.remark ? (
                    <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic">"{h.remark}"</p>
                  ) : (
                    <p className="text-[11px] text-[#C4C9D9] italic">No remark added</p>
                  )}
                  {h.recordingUrl && (
                    <div className="mt-2">
                      <audio controls controlsList="nodownload" src={`https://skyup-crm-backend.onrender.com${h.recordingUrl}`} className="w-full h-7 rounded-lg accent-[#2563EB]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3.5 h-3.5 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              Mobile Recordings ({recordingsFromMobile.length})
            </span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <svg className="w-3.5 h-3.5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-[12px] text-[#8B92A9]">Loading call recordings...</span>
            </div>
          )}
          {error && !loading && <p className="text-[12px] text-red-500 py-2">{error}</p>}
          {!loading && !error && recordingsFromMobile.length === 0 && (
            <div className="flex items-center gap-2 py-2">
              <svg className="w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-[12px] text-[#8B92A9]">No mobile recordings uploaded for this lead.</p>
            </div>
          )}
          {!loading && recordingsFromMobile.length > 0 && (
            <div className="space-y-3">
              {recordingsFromMobile.map((log, i) => (
                <div key={log._id || i} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
                      {log.user?.name || "Employee"} · {log.callType}
                    </span>
                    <span className="text-[10px] text-[#8B92A9]">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      {log.duration > 0 ? ` · ${fmtDur(log.duration)}` : ""}
                    </span>
                  </div>
                  {log.remark && (
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic mb-1.5">"{log.remark}"</p>
                  )}
                  {(log.recordings || []).map((rec, ri) => (
                    <audio key={ri} controls controlsList="nodownload"
                      src={rec.url?.startsWith("http") ? rec.url : `https://skyup-crm-backend.onrender.com${rec.url}`}
                      preload="none"
                      onError={(e) => { e.target.style.display = "none"; }}
                      className="w-full h-7 rounded-lg accent-[#2563EB] mb-1" />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Phone Numbers Modal ───────────────────────────────────────────────────────
// Manages exactly two phone numbers: primaryPhone + optional secondaryPhone.
//
// Backend API contract:
//   PUT    /lead/(admin|superadmin)/:id/secondary-phone  { secondaryPhone }  → add / update
//   DELETE /lead/(admin|superadmin)/:id/secondary-phone                      → remove
//   PUT    /lead/(admin|superadmin)/:id/swap-phones                          → swap primary ↔ secondary
//
// After every mutation the parent list is refreshed via onLeadUpdated.
function PhoneNumbersModal({ lead, role, onClose, onLeadUpdated }) {
  const leadId = lead._id || lead.id;

  const [primaryPhone,   setPrimaryPhone]   = useState(lead.primaryPhone   || lead.phone || "");
  const [secondaryPhone, setSecondaryPhone] = useState(lead.secondaryPhone || "");
  const [newSecondary,   setNewSecondary]   = useState("");
  const [busy,           setBusy]           = useState(false);
  const [busyOp,         setBusyOp]         = useState(null); // "add" | "remove" | "swap"
const [errorMsg,  setErrorMsg]  = useState("");
const [mergeLead, setMergeLead] = useState(null);   // populated when 409 returned
const [merging,   setMerging]   = useState(false);
  // Build role-aware API endpoint prefix
  const endpoint = (path) => {
    const r = getRole();
    // superadmin uses /lead/superadmin/:id/* routes (protectSuperAdmin middleware)
    // admin uses /lead/admin/:id/* routes (protectAdmin middleware)
    // user uses /lead/:id/* routes (protect middleware)
    const prefix = r === "superadmin" ? "superadmin" : r === "admin" ? "admin" : "";
    return prefix ? `/lead/${prefix}/${leadId}/${path}` : `/lead/${leadId}/${path}`;
  };

  // Apply server response to local state + propagate update to parent list
  // Backend returns { success: true, lead: {...} } for all phone mutations.
  // Unwrap the nested lead object before reading phone fields.
  const applyUpdate = (raw) => {
    const data         = raw?.lead ?? raw;            // unwrap { success, lead } wrapper
    const newPrimary   = data.primaryPhone   ?? primaryPhone;
    const newSecondary = data.secondaryPhone ?? "";
    setPrimaryPhone(newPrimary);
    setSecondaryPhone(newSecondary);
    onLeadUpdated({
      ...lead,
      primaryPhone:   newPrimary,
      secondaryPhone: newSecondary,
      // keep legacy phone field in sync so other modals still work
      phone: newPrimary,
    });
  };

  const handleAddSecondary = async () => {
    const trimmed = newSecondary.trim();
    if (!trimmed) { setErrorMsg("Please enter a phone number."); return; }
    if (!normalizePhone(trimmed)) { setErrorMsg("Enter a valid 10-digit phone number."); return; }
    if (normalizePhone(trimmed) === normalizePhone(primaryPhone)) {
      setErrorMsg("Secondary number must differ from the primary.");
      return;
    }
    setBusy(true); setBusyOp("add"); setErrorMsg("");
 try {
  const { data } = await api.put(endpoint("secondary-phone"), { secondaryPhone: trimmed });
  applyUpdate(data);
  setNewSecondary("");
} catch (err) {
  const status = err.response?.status;
  const data   = err.response?.data;
  if (status === 409 && data?.existingLead) {
    setMergeLead(data.existingLead);   // triggers merge UI
  } else {
    setErrorMsg(data?.message || "Failed to save secondary number.");
  }
} finally { setBusy(false); setBusyOp(null); }
  };

  const handleRemoveSecondary = async () => {
    setBusy(true); setBusyOp("remove"); setErrorMsg("");
    try {
      const { data } = await api.delete(endpoint("secondary-phone"));
      applyUpdate(data);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to remove secondary number.");
    } finally { setBusy(false); setBusyOp(null); }
  };

  const handleSwap = async () => {
    if (!secondaryPhone) return;
    setBusy(true); setBusyOp("swap"); setErrorMsg("");
    try {
      const { data } = await api.put(endpoint("swap-phones"));
      applyUpdate(data);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to swap phone numbers.");
    } finally { setBusy(false); setBusyOp(null); }
  };

  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );

  const PhoneIcon = ({ className = "" }) => (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
    </svg>
  );

   const handleMergeReport = async () => {
  if (!mergeLead) return;
  const targetId = mergeLead._id || mergeLead.id;
  // The number typed (newSecondary) already belongs to mergeLead as its primary.
  // The correct secondary to add to mergeLead is the CURRENT lead's own primary phone
  // (the lead being absorbed into the target).
  const sourcePhone = normalizePhone((lead.primaryPhone || lead.phone || "").trim());
  if (!sourcePhone) { setErrorMsg("Cannot determine current lead's primary number."); return; }
  setMerging(true); setErrorMsg("");
  try {
    const r = getRole();
    const prefix = r === "superadmin" ? "superadmin" : r === "admin" ? "admin" : "";
    const ep = prefix ? `/lead/${prefix}/${targetId}/merge` : `/lead/${targetId}/merge`;
    const { data } = await api.post(ep, {
      secondaryPhone: sourcePhone,   // current lead's primary becomes target's secondary
      sourceName:     lead.name,
      sourceMobile:   sourcePhone,   // the source lead's own primary phone
      sourceLeadId:   lead._id || lead.id,  // backend marks source as mergedInto
    });
    // Update the survivor lead in the list
    applyUpdate(data?.lead || data);
    // Signal caller to remove the absorbed (source) lead from the list
    const absorbedId = data?.absorbedLeadId || lead._id || lead.id;
    onLeadUpdated({ ...(data?.lead || data), _mergedAbsorbedId: String(absorbedId) });
    setMergeLead(null);
    setNewSecondary("");
    onClose();
  } catch (err) {
    setErrorMsg(err.response?.data?.message || "Merge failed.");
  } finally { setMerging(false); }
}; 

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Phone Numbers</h2>
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{lead.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Primary number */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Primary Number</p>
          <div className="flex items-center gap-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-2.5">
            <PhoneIcon className="text-[#2563EB]" />
            <span className="text-[13px] font-semibold font-mono text-[#0F1117] dark:text-[#F0F2FA] flex-1">
              {displayPhone(primaryPhone, role)}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full shrink-0">
              Primary
            </span>
          </div>
        </div>

        {/* Secondary number */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Secondary Number</p>

          {secondaryPhone ? (
            <>
              <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-2.5">
                <PhoneIcon className="text-[#059669]" />
                <span className="text-[13px] font-semibold font-mono text-[#0F1117] dark:text-[#F0F2FA] flex-1">
                  {displayPhone(secondaryPhone, role)}
                </span>
                {/* Swap primary ↔ secondary */}
                <button
                  onClick={handleSwap}
                  disabled={busy}
                  title="Swap primary ↔ secondary"
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#7C3AED] hover:bg-[#F3EEFF] dark:hover:bg-[#2A1F40] hover:border-[#7C3AED] transition disabled:opacity-50"
                >
                  {busy && busyOp === "swap" ? <Spinner /> : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                  )}
                </button>
                {/* Remove secondary */}
                <button
                  onClick={handleRemoveSecondary}
                  disabled={busy}
                  title="Remove secondary number"
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-[#DC2626] transition disabled:opacity-50"
                >
                  {busy && busyOp === "remove" ? <Spinner /> : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  )}
                </button>
              </div>
              {/* Swap hint */}
              <div className="mt-2 flex items-start gap-2 bg-[#F3EEFF] dark:bg-[#1E1030] border border-[#DDD6FE] dark:border-[#4C1D95] rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-[11px] text-[#6D28D9] dark:text-[#C4B5FD]">
                  Use the swap button (↕) to promote the secondary to primary without losing either number.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border border-dashed border-[#C4C9D9] dark:border-[#3E4257] rounded-xl px-3 py-2.5">
              <PhoneIcon className="text-[#C4C9D9] dark:text-[#3E4257]" />
              <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] italic">No secondary number added</span>
            </div>
          )}
        </div>

        {/* Add secondary form — only shown when no secondary exists */}
        {!secondaryPhone && (
          <div className="border-t border-[#E4E7EF] dark:border-[#262A38] pt-4">
            <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-2">
              Add Secondary Number
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={newSecondary}
                onChange={e => { setNewSecondary(e.target.value); setErrorMsg(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleAddSecondary(); }}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
              />
              <button
                onClick={handleAddSecondary}
                disabled={!newSecondary.trim() || busy}
                className="px-4 py-2 rounded-xl bg-[#059669] text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {busy && busyOp === "add" ? <Spinner /> : null}
                Save
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <p className="mt-2 text-[11px] text-red-500">{errorMsg}</p>
        )}


        {/* Merge offer */}
{mergeLead && (
  <div className="mt-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
    <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800">
      <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Number belongs to &quot;{mergeLead.name}&quot;
      </p>
    </div>
    <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
      <p>Primary: <span className="font-mono">{mergeLead.primaryPhone || mergeLead.mobile}</span></p>
      {mergeLead.secondaryPhone && <p>Secondary: <span className="font-mono">{mergeLead.secondaryPhone}</span></p>}
    </div>
    {(() => {
      const isAlreadyPrimary = normalizePhone(newSecondary.trim()) === normalizePhone(mergeLead.primaryPhone || mergeLead.mobile || "");
      if (mergeLead.secondaryPhone && !isAlreadyPrimary) {
        return <p className="px-3 pb-2 text-[11px] text-red-500">Cannot merge — that lead already has two numbers.</p>;
      }
      return (
        <div className="px-3 pb-3 space-y-2">
          {isAlreadyPrimary && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              This number is already the <strong>primary</strong> of &quot;{mergeLead.name}&quot;. Click <strong>Merge Data</strong> to combine records — no secondary will be added.
            </p>
          )}
          {errorMsg && <p className="text-[11px] text-red-500">{errorMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setMergeLead(null); setErrorMsg(""); }}
              className="flex-1 py-1.5 rounded-lg border border-amber-300 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition">
              Cancel
            </button>
            <button onClick={handleMergeReport} disabled={merging}
              className="flex-1 py-1.5 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {merging ? "Merging…" : isAlreadyPrimary ? "Merge Data" : "Add as Secondary & Merge"}
            </button>
          </div>
        </div>
      );
    })()}
  </div>
)}
        <div className="mt-5 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Close Lead (Wrong Entry) Modal ────────────────────────────────────────────
function CloseLeadModal({ lead, onClose, onClosed }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Please enter a remark/reason before closing this lead.");
      return;
    }
    const leadId   = lead._id || lead.id;
    const endpoint = `/lead/admin/${leadId}/close-wrong-entry`;
    try {
      setSaving(true);
      await api.patch(endpoint, { reason: reason.trim() });
      onClosed(leadId);
      onClose();
    } catch (err) {
      alert("Failed to close lead: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#FEF2F2] dark:bg-[#2D0A0A] flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Close Lead — Wrong Entry</h2>
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{lead.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] text-[#991B1B] dark:text-[#F87171] font-medium">
            This will mark the lead as closed (wrong entry). The record is kept for audit purposes and will be hidden from active views.
          </p>
        </div>

        <div className="flex flex-col gap-1 mb-4">
          <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">
            Reason / Remark <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry, wrong phone number, test lead…"
            className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#DC2626] resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !reason.trim()}
            className="flex-1 py-2 rounded-xl bg-[#DC2626] text-white text-[13px] font-semibold hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? "Closing…" : "Close Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [leads, setLeads]               = useState([]);
  const [agents, setAgents]             = useState([]);
  const [projects, setProjects]         = useState([]);
  const [projectFilter, setProjectFilter] = useState("All");
  const [manageProjects, setManageProjects] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(null);

  const role = getRole();

  useEffect(() => {
    fetchAll()
      .then(({ agents, leads }) => {
        setAgents(agents);
        setLeads(leads);
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));

    api.get("/project/admin")
      .then(res => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProjects([]));
  }, []);

  const [search, setSearch]               = useState("");
  const [statusFilter, setStatus]         = useState("All");
  const [agentFilter, setAgent]           = useState("All");
  const [sortBy, setSortBy]               = useState("date");
  const [page, setPage]                   = useState(1);
  const [editLead, setEditLead]           = useState(null);
  const [recordingLead, setRecordingLead] = useState(null);
  const [remarksLead, setRemarksLead]     = useState(null);
  const [timeFilter, setTimeFilter]       = useState("All");
  const [phoneLead, setPhoneLead]         = useState(null); // PhoneNumbersModal trigger
  const [closeLead, setCloseLead]         = useState(null);
  const PER_PAGE = 8;

  const isWithinRange = useDateFilter(timeFilter);
  const statuses = ["All", ...ALL_STATUSES];

  const agentStats = useMemo(() => agents.map(agent => {
    const agentLeads = leads.filter(l => l.agent === agent.name);
    return { ...agent, leads: agentLeads.length, converted: agentLeads.filter(l => l.status === "Converted").length };
  }), [leads, agents]);

  const sourceStats = useMemo(() => {
    const FALLBACK_COLORS = [
      "#2563EB", "#7C3AED", "#0891B2", "#059669",
      "#D97706", "#DC2626", "#0D9488", "#9333EA",
    ];
    const counts = leads.reduce((acc, l) => {
      const src = l.source?.trim();
      if (src) acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, count], i) => ({
        label,
        count,
        color: SOURCE_COLORS[label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const converted = leads.filter(l => l.status === "Converted").length;
  const convRate  = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;
  const maxLeads  = Math.max(...agentStats.map(a => a.leads), 1);

  const filtered = useMemo(() => leads
    .filter(l => {
      if (!isWithinRange(l.date)) return false;
      // Employees (user role) must not see closed leads —
      // backend filters them out, this is a safety net for stale state.
      if (role !== "admin" && role !== "superadmin" && l.isClosed && !l.mergedInto) return false;
      const q = search.toLowerCase();
      const matchProject = projectFilter === "All" || (
        Array.isArray(l.projects) && l.projects.some(p => (p?._id || p) === projectFilter)
      );
      return (
        matchProject &&
        (!q || l.name?.toLowerCase().includes(q) ||
          (l.primaryPhone || l.phone || "").includes(q) ||
          (l.secondaryPhone || "").includes(q) ||
          l.campaign?.toLowerCase().includes(q) ||
          (l.mergedSourceName && l.mergedSourceName.toLowerCase().includes(q))) &&
        (statusFilter === "All" || (() => {
          const { label } = getLeadDisplayStatus(l);
          return label === statusFilter;
        })()) &&
        (agentFilter === "All" || l.agent === agentFilter)
      );
    })
    .sort((a, b) => sortBy === "name"
      ? (a.name || "").localeCompare(b.name || "")
      : new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ),
  [leads, search, statusFilter, agentFilter, projectFilter, sortBy, isWithinRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const saveLead = updated => setLeads(ls => ls.map(l => l.id === updated.id ? { ...l, ...updated } : l));

  // Called by PhoneNumbersModal after any phone mutation; keeps modal state fresh
  const handlePhoneUpdate = (updatedLead) => {
    // Merge: remove the absorbed source lead from the list
    if (updatedLead._mergedAbsorbedId) {
      const absorbedId = String(updatedLead._mergedAbsorbedId);
      setLeads(ls => ls.filter(l => String(l.id || l._id) !== absorbedId));
      setPhoneLead(prev => prev && String(prev.id || prev._id) === absorbedId ? null : prev);
    }
    setLeads(ls => ls.map(l =>
      (l.id === updatedLead.id || l._id === updatedLead._id)
        ? { ...l, ...updatedLead }
        : l
    ));
    // Keep the open modal's lead reference fresh so UI reflects the change
    setPhoneLead(prev => prev ? { ...prev, ...updatedLead } : null);
  };

  const handleLeadClosed = (leadId) => setLeads(ls => ls.filter(l => l.id !== leadId && l._id !== leadId));

  const displayDate = (dateStr) => {
    if (!dateStr) return "—";
    if (/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const exportCSV = () => {
    const headers = ["#", "Name", "Primary Phone", "Secondary Phone", "Source", "Campaign", "Employee", "Status", "Date", "Remark", "Call Count"];
    const rows = filtered.map((l, i) =>
      [
        i + 1, l.name,
        l.primaryPhone || l.phone || "",
        l.secondaryPhone || "",
        l.source, l.campaign, l.agent, l.status, l.date, l.remark,
        (l.callHistory || []).length,
      ]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "leads_export.csv" });
    a.click();
  };

  const filterBtn = (current, setter, arr) =>
    arr.map(v => (
      <button key={v} onClick={() => { setter(v); setPage(1); }}
        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition whitespace-nowrap
          ${v === current
            ? "bg-[#2563EB] text-white"
            : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
          }`}>{v}</button>
    ));

  if (loading) return <Skeleton />;

  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-[#0D0F14]">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-8 max-w-sm text-center">
        <div className="text-red-500 text-[14px] font-semibold mb-2">Failed to load data</div>
        <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-4">{fetchError}</p>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-3 py-4 md:px-6 md:py-8">

      {/* ── Modals ── */}
      {manageProjects && (
        <ManageProjectsModal
          projects={projects}
          onClose={() => setManageProjects(false)}
          onProjectsChange={setProjects}
        />
      )}

      {editLead && (
        <EditLeadModal lead={editLead} agents={agents} projects={projects} onClose={() => setEditLead(null)} onSave={saveLead} />
      )}

      {closeLead && (
        <CloseLeadModal lead={closeLead} onClose={() => setCloseLead(null)} onClosed={handleLeadClosed} />
      )}

      {recordingLead && (
        <RecordingModal lead={recordingLead} role={role} onClose={() => setRecordingLead(null)} />
      )}

      {remarksLead && (
        <RemarksHistoryModal lead={remarksLead} role={role} onClose={() => setRemarksLead(null)} />
      )}

      {/* Phone Numbers Modal — primary + optional secondary only */}
      {phoneLead && (
        <PhoneNumbersModal
          lead={phoneLead}
          role={role}
          onClose={() => setPhoneLead(null)}
          onLeadUpdated={handlePhoneUpdate}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Report Page</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{leads.length} total leads · {agents.length} agents</p>
        </div>
        <div className="flex items-center gap-2">
          {(role === "admin" || role === "superadmin") && (
            <button onClick={() => setManageProjects(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] text-[13px] font-semibold hover:border-[#7C3AED] hover:text-[#7C3AED] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>
              Manage Projects
            </button>
          )}
          {role === "superadmin" && (
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads"    value={leads.length} sub={`${leads.length} in pipeline`} accent="text-[#059669] dark:text-[#34D399]" />
        <StatCard label="Converted"      value={converted} sub={`${convRate}% conversion rate`} accent="text-[#059669] dark:text-[#34D399]" />
        <StatCard label="In Progress"    value={leads.filter(l => l.status === "In Progress").length} sub="Active pipeline" accent="text-[#D97706] dark:text-[#FCD34D]" />
        <StatCard label="Not Interested" value={leads.filter(l => l.status === "Not Interested").length} sub="Review needed" accent="text-[#DC2626] dark:text-[#F87171]" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Employee performance</h2>
          <div className="space-y-4">
            {agentStats.sort((a, b) => b.leads - a.leads).map(a => (
              <div key={a.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                    <span className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                    <span className="text-[#059669] dark:text-[#34D399] font-semibold">{a.converted} conv</span>
                    <span>{a.leads} leads</span>
                  </div>
                </div>
                <MiniBar value={a.leads} max={maxLeads} color={a.color} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Leads by source</h2>
          <div className="space-y-3">
            {sourceStats.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] flex-1">{s.label}</span>
                <div className="flex-1 h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(s.count / leads.length * 100)}%`, background: s.color }} />
                </div>
                <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] w-5 text-right">{s.count}</span>
                <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{Math.round(s.count / leads.length * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <h3 className="text-[12px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3">Pipeline status</h3>
            <div className="grid grid-cols-2 gap-2">
              {ALL_STATUSES.map(s => {
                const count = leads.filter(l => getLeadDisplayStatus(l).label === s).length;
                const st = STATUS_CONFIG[s] ?? STATUS_CONFIG["New"];
                return (
                  <div key={s} className={`rounded-xl px-3 py-2.5 ${st.bg}`}>
                    <div className={`text-[18px] font-bold ${st.text}`}>{count}</div>
                    <div className={`text-[10px] font-medium ${st.text} opacity-80`}>{s}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Leads table ── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              All leads
              <span className="ml-2 text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75]">{filtered.length} results</span>
            </h2>
            <div className="flex items-center gap-2">
              <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                <option value="All">Time: All</option>
                <option value="Daily">Time: Daily</option>
                <option value="Weekly">Time: Weekly</option>
                <option value="Monthly">Time: Monthly</option>
                <option value="Quarterly">Time: Quarterly</option>
              </select>
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                <option value="date">Sort: Latest</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-44" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">{filterBtn(statusFilter, setStatus, statuses)}</div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] self-center">Employee:</span>
              <AgentSelect
                value={agentFilter}
                onChange={(val) => { setAgent(val); setPage(1); }}
                agents={agents.map(a => a.name)}
                className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] transition"
              />
            </div>
            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] self-center">Project:</span>
                <select
                  value={projectFilter}
                  onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none hover:border-[#2563EB] transition"
                >
                  <option value="All">All Projects</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-b-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                  {["#", "Lead Name", "Phone", "Source", "Campaign", "Employee", "Status", "Date", "Calls", "Remark", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads match your filters.</td></tr>
                ) : paged.map((lead, i) => {
                  const { label: displayLabel, config: st } = getLeadDisplayStatus(lead);
                  const callCount  = (lead.callHistory || []).length;
                  // primaryPhone is the canonical primary; fall back to legacy phone field
                  const primary    = lead.primaryPhone   || lead.phone  || null;
                  const secondary  = lead.secondaryPhone || null;

                  return (
                    <tr key={lead.id || lead._id} className={`border-b border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A] transition ${i % 2 === 0 ? "" : "bg-[#FAFBFF] dark:bg-[#1E2130]"}`}>
                      <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75]">{(page - 1) * PER_PAGE + i + 1}</td>

                      {/* Lead name + avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                            {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{lead.name}</span>
                        </div>
                      </td>

                      {/* Phone — primary + optional secondary badge */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB]">
                            {displayPhone(primary, role)}
                          </span>
                          {secondary && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#059669] dark:text-[#34D399]">
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                              </svg>
                              {displayPhone(secondary, role)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.source}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB]">{lead.campaign}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.agent}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.bg} ${st.text}`}>{displayLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap">{displayDate(lead.date)}</td>

                      {/* Call count badge */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setRemarksLead(lead)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition
                            ${callCount > 0
                              ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] hover:bg-[#DBEAFE]"
                              : "bg-[#F8F9FC] dark:bg-[#13161E] text-[#8B92A9] dark:text-[#565C75] hover:bg-[#F1F4FF]"
                            }`}
                          title={callCount > 0 ? "View call history & remarks" : "No calls yet"}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                          </svg>
                          {callCount}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] max-w-[140px] truncate">{lead.remark}</td>

                      {/* Action buttons */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">

                          {/* Edit lead */}
                          <button
                            onClick={() => setEditLead(lead)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] text-[#8B92A9] transition"
                            title="Edit lead"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>

                          {/* Phone numbers (primary + secondary) */}
                          <button
                            onClick={() => setPhoneLead(lead)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition
                              ${secondary
                                ? "border-[#059669] text-[#059669] bg-[#ECFDF5] dark:bg-[#052E1C] hover:bg-[#D1FAE5]"
                                : "border-[#E4E7EF] dark:border-[#262A38] hover:border-[#059669] hover:text-[#059669] text-[#8B92A9]"
                              }`}
                            title={secondary ? "View / manage phone numbers (has secondary)" : "Manage phone numbers"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                          </button>

                          {/* Call history & remarks */}
                          <button
                            onClick={() => setRemarksLead(lead)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[#8B92A9] transition"
                            title="Call History & Remarks"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
                            </svg>
                          </button>

                          {/* Call recording */}
                          <button
                            onClick={() => setRecordingLead(lead)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#0891B2] hover:text-[#0891B2] text-[#8B92A9] transition"
                            title="Call Recording"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                            </svg>
                          </button>

                          {/* Close lead — admin / superadmin only */}
                          {(role === "admin" || role === "superadmin") && (
                            <button
                              onClick={() => setCloseLead(lead)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#DC2626] hover:text-[#DC2626] text-[#8B92A9] transition"
                              title="Close Lead (Wrong Entry)"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
              <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>

                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  let start = Math.max(1, page - 1);
                  if (start + 2 > totalPages) start = Math.max(1, totalPages - 2);
                  return start + i;
                }).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-8 w-8 rounded-lg text-[12px] font-semibold transition ${
                      n === page
                        ? "bg-[#2563EB] text-white border border-[#2563EB]"
                        : "border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB]"
                    }`}
                  >
                    {n}
                  </button>
                ))}

                {totalPages > 3 && (
                  <span className="px-2 text-[#8B92A9]">...</span>
                )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
