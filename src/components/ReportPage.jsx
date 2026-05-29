import { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import api from "../data/axiosConfig";
import { useDateFilter } from "../components/dataFilter";
import CRMEncryption from "../utils/CRMEncryption";

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

const STATUS_STYLE = {
  "Converted":      { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#065F46] dark:text-[#34D399]" },
  "In Progress":    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#92400E] dark:text-[#FCD34D]" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#991B1B] dark:text-[#F87171]" },
  "New":            { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#1D4ED8] dark:text-[#4F8EF7]" },
};

const OUTCOME_STYLE = {
  "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",        text: "text-red-600 dark:text-red-400" },
  "Interested":     { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  "Call Back":      { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400" },
  "No Answer":      { bg: "bg-gray-100 dark:bg-gray-900/40",      text: "text-gray-500 dark:text-gray-400" },
};

const ALL_SOURCES  = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral"];
const ALL_STATUSES = ["Converted", "In Progress", "Not Interested", "New"];

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

// ── Searchable Employee Select ───────────────────────────────────────────────────
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
  const [name, setName]           = useState("");
  const [color, setColor]         = useState("#2563EB");
  const [isGlobal, setIsGlobal]   = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [error, setError]         = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    try {
      const { data } = await api.post("/project/admin", { name: name.trim(), color, isGlobal });
      onProjectsChange([data, ...projects]);
      setName(""); setColor("#2563EB"); setIsGlobal(true);
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
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete project.");
    } finally { setDeleting(null); }
  };

  const handleToggleGlobal = async (project) => {
    try {
      const { data } = await api.put(`/project/admin/${project._id}`, { isGlobal: !project.isGlobal });
      onProjectsChange(projects.map(p => p._id === project._id ? data : p));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update project.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Manage Projects</h2>
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Create colour-coded tags to categorise leads</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Create new project */}
        <div className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-4 mb-4 shrink-0">
          <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3">New Project</p>
          <div className="flex gap-2 mb-3">
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

          {/* Color picker */}
          {/* <div className="flex flex-wrap gap-2 mb-3">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full border-2 transition shrink-0"
                style={{
                  background: c,
                  borderColor: color === c ? "#0F1117" : "transparent",
                  transform: color === c ? "scale(1.25)" : "scale(1)",
                }}
                title={c}
              />
            ))}
          </div> */}

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

        {/* Existing projects list */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No projects yet</p>
            </div>
          ) : projects.map(p => (
            <div key={p._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] group">
              {/* Color dot */}
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color || "#2563EB" }} />

              {/* Name */}
              <span className="flex-1 text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{p.name}</span>

              {/* Global badge + toggle */}
              <button
                onClick={() => handleToggleGlobal(p)}
                title={p.isGlobal ? "Click to make admin-only" : "Click to make global"}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition shrink-0 ${
                  p.isGlobal
                    ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]"
                    : "bg-[#F8F9FC] dark:bg-[#1A1D27] text-[#8B92A9] dark:text-[#565C75] border border-[#E4E7EF] dark:border-[#262A38]"
                }`}
              >
                {p.isGlobal ? "Global" : "Admin only"}
              </button>

              {/* Delete */}
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

        <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
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
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">
        Projects
      </label>

      {/* Trigger button */}
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

      {/* Dropdown panel */}
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
                  {/* Color swatch */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: p.color || "#2563EB" }}
                  />
                  <span className="flex-1 font-medium text-[#0F1117] dark:text-white">{p.name}</span>
                  {/* Checkmark */}
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
  const [form, setForm] = useState({ ...lead });
  const [reassignReason, setReassignReason] = useState("");
  const [saving, setSaving] = useState(false);
  // Multi-select project toggle — initialise from the lead's existing projects
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

  // Detect if the employee has been changed from the original
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
            // { label: "Phone",     key: "phone" },
            { label: "Campaign",  key: "campaign" },
            { label: "Remark",    key: "remark" },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
            </div>
          ))}
          {/* Date: read-only display — not editable via this form */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Date</label>
            <input type="text" value={form.date || "—"} readOnly
              className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed" />
          </div>
          {[
            { label: "Source", key: "source", options: ALL_SOURCES },
            { label: "Employee",  key: "agent",  options: agents.map(a => a.name) },
            { label: "Status", key: "status", options: ALL_STATUSES },
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

        {/* ── Project tag buttons (multi-select) ── */}
        {projects.length > 0 && (
  <ProjectDropdown
    projects={projects}
    selectedProjects={selectedProjects}
    toggleProject={toggleProject}
  />
)}

        {/* Reassign Reason — visible only when employee is changed */}
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
            // Validate: reassign reason is required when employee changes
            if (agentChanged && !reassignReason.trim()) {
              alert("Please enter a reason for reassigning this lead.");
              return;
            }
            const role = getRole();
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

              // FIX: include user ID for agent reassignment so employee changes
              // are actually persisted. adminUpdateLead accepts `user` (ObjectId);
              // updateLead (user role) strips it server-side — safe to always send.
              if (form.agent) {
                const selectedAgent = agents.find(a => a.name === form.agent);
                if (selectedAgent?.id) basePayload.user = selectedAgent.id;
              }

              // Include reassign reason if employee changed — backend stores it
              // in activityTimeline for a full audit trail.
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
              // FIX: use the server's response to update local state so the table
              // always reflects what was actually saved (not just what was in the form).
              // Fall back to form merge if the server returns an unexpected shape.
              const merged = updatedFromServer?._id
                ? {
                    ...lead,
                    ...form,
                    // keep server-authoritative fields
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

// ── Remarks History Panel ─────────────────────────────────────────────────────
// FIX: accepts `role` prop and uses displayPhone() instead of maskPhone()
function RemarksHistoryModal({ lead, role, onClose }) {
  const callHistory      = Array.isArray(lead.callHistory)      ? lead.callHistory      : [];
  const activityTimeline = Array.isArray(lead.activityTimeline) ? lead.activityTimeline : [];

  // Merge call-history entries and reassign activity-timeline events into one
  // chronological list so the admin can see the full story in one place.
  const callEntries = callHistory.map(e => ({ _type: "call", ...e, _ts: new Date(e.calledAt) }));
  const reassignEntries = activityTimeline
    .filter(e => e.action === "reassigned" || e.action === "merged")
    .map(e => ({ _type: e.action === "merged" ? "merge" : "reassign", ...e, _ts: new Date(e.timestamp) }));

  const merged = [...callEntries, ...reassignEntries].sort((a, b) => b._ts - a._ts);

  const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {displayPhone(lead.phone, role)} · {lead.source}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Current remark + status */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span>
          {lead.remark && (
            <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic truncate">"{lead.remark}"</span>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[#7C3AED] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
          </svg>
          <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            Call History & Remarks
          </span>
          <span className="ml-auto text-[11px] text-[#8B92A9] dark:text-[#565C75] bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full">
            {merged.length} {merged.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Merged timeline list */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2">
          {merged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
              </svg>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No call history yet</p>
              <p className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">Remarks appear here after employee interactions</p>
            </div>
          ) : merged.map((entry, i) => {

            // ── Reassign event card ───────────────────────────────────────────
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
                        <p className="text-[12px] font-semibold text-[#D97706] dark:text-[#FCD34D] leading-none">
                          Lead Reassigned
                        </p>
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
                      <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">
                        "{entry.note}"
                      </p>
                    </div>
                  ) : (
                    <p className="ml-8 text-[11px] text-[#C4C9D9] dark:text-[#3E4257] italic">No reason recorded</p>
                  )}
                </div>
              );
            }

            // ── Merge event card ──────────────────────────────────────────────
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
                        <p className="text-[12px] font-semibold text-[#059669] dark:text-[#34D399] leading-none">
                          Duplicate Lead Merged
                        </p>
                        <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#059669] bg-[#D1FAE5] dark:bg-[#064E3B] px-1.5 py-0.5 rounded-md font-semibold uppercase shrink-0">
                      system
                    </span>
                  </div>
                  {entry.note && (
                    <div className="ml-8">
                      <p className="text-[11px] text-[#065F46] dark:text-[#6EE7B7] italic leading-relaxed">
                        {entry.note}
                      </p>
                    </div>
                  )}
                </div>
              );
            }

            // ── Call history card (default) ───────────────────────────────────
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
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                        {entry.userName || "Employee"}
                      </p>
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
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">
                      "{entry.remark}"
                    </p>
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
// FIX: accepts `role` prop and uses displayPhone() instead of hardcoded maskPhone()
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

  const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];

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

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              {/* FIX: use displayPhone() so superadmin sees full number */}
              <p className="text-[12px] text-[#8B92A9] mt-0.5 font-mono">
                {displayPhone(lead.phone, role)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Lead info grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Status",   value: <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span> },
            { label: "Source",   value: lead.source },
            { label: "Employee",    value: lead.agent },
            { label: "Date",     value: lead.date },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-medium text-[#8B92A9] uppercase tracking-wide mb-1">{label}</p>
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{value}</div>
            </div>
          ))}
        </div>

        {/* ── All Remarks (CRM call history) ── */}
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

        {/* ── Mobile Call Recordings ── */}
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

// ── Close Lead (Wrong Entry) Modal ────────────────────────────────────────────
function CloseLeadModal({ lead, onClose, onClosed }) {
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Please enter a remark/reason before closing this lead.");
      return;
    }
    const role   = getRole();
    const leadId = lead._id || lead.id;
    // Only admins can close a lead — users don't have this button
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
  const [leads, setLeads]         = useState([]);
  const [agents, setAgents]       = useState([]);
  const [projects, setProjects]   = useState([]);
  const [projectFilter, setProjectFilter] = useState("All");
  const [manageProjects, setManageProjects] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // FIX: role is read once at the top level and passed down to modals
  const role = getRole();

  useEffect(() => {
    fetchAll()
      .then(({ agents, leads }) => {
        setAgents(agents);
        setLeads(leads);
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));

    // Fetch projects visible to admin
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
  // Additional numbers modal state
  const [addNumberLead, setAddNumberLead]   = useState(null);  // lead being edited
  const [newNumber, setNewNumber]           = useState("");
  const [newLabel, setNewLabel]             = useState("");
  const [addNumLoading, setAddNumLoading]   = useState(false);
  const [mergeToast, setMergeToast]         = useState(null);  // { name, id } of merged lead
  const [closeLead, setCloseLead]           = useState(null);  // lead to close as wrong entry
  const PER_PAGE = 8;

  const isWithinRange = useDateFilter(timeFilter);
  const statuses   = ["All", ...ALL_STATUSES];

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
      const q = search.toLowerCase();
      // Project filter: check if any of the lead's project IDs match the selected project
      const matchProject = projectFilter === "All" || (
        Array.isArray(l.projects) && l.projects.some(p =>
          (p?._id || p) === projectFilter
        )
      );
      return (
        matchProject &&
        (!q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.campaign?.toLowerCase().includes(q)) &&
        (statusFilter === "All" || l.status === statusFilter) &&
        (agentFilter  === "All" || l.agent  === agentFilter)
      );
    })
    .sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "") : new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
  [leads, search, statusFilter, agentFilter, projectFilter, sortBy, isWithinRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const saveLead = updated => setLeads(ls => ls.map(l => l.id === updated.id ? { ...l, ...updated } : l));

  // Remove closed lead from active list (it still exists in DB but is marked isClosed)
  const handleLeadClosed = (leadId) => setLeads(ls => ls.filter(l => l.id !== leadId && l._id !== leadId));

  // ── Additional numbers ────────────────────────────────────────────────────
  const handleAddNumber = async () => {
    if (!newNumber.trim() || !addNumberLead) return;
    const role = getRole();
    const endpoint =
      role === "superadmin" ? `/lead/admin/${addNumberLead.id}/additional-numbers` :
      role === "admin"      ? `/lead/admin/${addNumberLead.id}/additional-numbers` :
                              `/lead/${addNumberLead.id}/additional-numbers`;
    setAddNumLoading(true);
    try {
      const { data } = await api.post(endpoint, { number: newNumber.trim(), label: newLabel.trim() });

      if (data.merged) {
        // Auto-merge happened: remove the duplicate from the active list,
        // update the primary lead with the new merged data, show a toast.
        setLeads(ls => ls
          .filter(l => l.id !== data.mergedLeadId && l._id !== data.mergedLeadId)
          .map(l => l.id === addNumberLead.id || l._id === addNumberLead.id
            ? { ...l, additionalNumbers: data.additionalNumbers, callHistory: data.lead?.callHistory ?? l.callHistory }
            : l
          )
        );
        setAddNumberLead(prev => ({
          ...prev,
          additionalNumbers: data.additionalNumbers,
          callHistory: data.lead?.callHistory ?? prev.callHistory,
        }));
        setMergeToast({ name: data.mergedLeadName, id: data.mergedLeadId });
        setTimeout(() => setMergeToast(null), 6000);
      } else {
        setLeads(ls => ls.map(l =>
          l.id === addNumberLead.id ? { ...l, additionalNumbers: data.additionalNumbers } : l
        ));
        setAddNumberLead(prev => ({ ...prev, additionalNumbers: data.additionalNumbers }));
      }
      setNewNumber("");
      setNewLabel("");
    } catch (err) {
      alert("Failed to add number: " + (err.response?.data?.message || err.message));
    } finally {
      setAddNumLoading(false);
    }
  };

  const handleRemoveNumber = async (leadId, idx) => {
    const role = getRole();
    const endpoint =
      role === "superadmin" ? `/lead/admin/${leadId}/additional-numbers/${idx}` :
      role === "admin"      ? `/lead/admin/${leadId}/additional-numbers/${idx}` :
                              `/lead/${leadId}/additional-numbers/${idx}`;
    try {
      const { data } = await api.delete(endpoint);
      setLeads(ls => ls.map(l =>
        l.id === leadId ? { ...l, additionalNumbers: data.additionalNumbers } : l
      ));
      setAddNumberLead(prev => prev?.id === leadId ? { ...prev, additionalNumbers: data.additionalNumbers } : prev);
    } catch (err) {
      alert("Failed to remove number: " + (err.response?.data?.message || err.message));
    }
  };

  const displayDate = (dateStr) => {
    if (!dateStr) return "—";
    if (/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const exportCSV = () => {
    const headers = ["#", "Name", "Phone", "Source", "Campaign", "Employee", "Status", "Date", "Remark", "Call Count"];
    const rows = filtered.map((l, i) =>
      [i + 1, l.name, l.phone, l.source, l.campaign, l.agent, l.status, l.date, l.remark, (l.callHistory || []).length]
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

      {manageProjects && (
        <ManageProjectsModal
          projects={projects}
          onClose={() => setManageProjects(false)}
          onProjectsChange={setProjects}
        />
      )}

      {editLead      && <EditLeadModal lead={editLead} agents={agents} projects={projects} onClose={() => setEditLead(null)} onSave={saveLead} />}

      {/* Close Lead (Wrong Entry) modal */}
      {closeLead && (
        <CloseLeadModal
          lead={closeLead}
          onClose={() => setCloseLead(null)}
          onClosed={handleLeadClosed}
        />
      )}

      {/* FIX: pass role to RecordingModal so superadmin sees unmasked phone */}
      {recordingLead && (
        <RecordingModal
          lead={recordingLead}
          role={role}
          onClose={() => setRecordingLead(null)}
        />
      )}

      {/* FIX: pass role to RemarksHistoryModal so superadmin sees unmasked phone */}
      {remarksLead && (
        <RemarksHistoryModal
          lead={remarksLead}
          role={role}
          onClose={() => setRemarksLead(null)}
        />
      )}

      {/* ── Additional Numbers Modal ── */}
      {addNumberLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                Linked Numbers — {addNumberLead.name}
              </h2>
              <button onClick={() => { setAddNumberLead(null); setNewNumber(""); setNewLabel(""); setMergeToast(null); }}
                className="text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#F0F2FA] transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Merge success banner */}
            {mergeToast && (
              <div className="mb-3 flex items-start gap-2 bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#6EE7B7] dark:border-[#065F46] rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div>
                  <p className="text-[12px] font-semibold text-[#065F46] dark:text-[#34D399]">Leads merged successfully</p>
                  <p className="text-[11px] text-[#059669] dark:text-[#6EE7B7] mt-0.5">
                    "{mergeToast.name}" was a duplicate — its call history, remarks and numbers have been combined into this lead.
                  </p>
                </div>
              </div>
            )}

            {/* Primary number */}
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1">Primary</p>
              <div className="flex items-center gap-2">
                {addNumberLead.isClosed && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]"
                    title={addNumberLead.closeReason ? `Closed: ${addNumberLead.closeReason}` : "Closed — wrong entry"}
                  >
                    <svg className="w-2.5 h-2.5 text-[#DC2626] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="10"/>
                    </svg>
                    <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wide">Closed</span>
                  </span>
                )}
                <span className={`text-[13px] font-medium font-mono ${addNumberLead.isClosed ? "text-[#DC2626] dark:text-[#F87171]" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
                  {displayPhone(addNumberLead.phone, role)}
                </span>
              </div>
            </div>

            {/* Existing additional numbers */}
            {(addNumberLead.additionalNumbers?.length > 0) && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1">Additional</p>
                <ul className="space-y-1.5">
                  {addNumberLead.additionalNumbers.map((n, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {n.label === "Merged primary" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#6EE7B7] dark:border-[#065F46] shrink-0">
                            <svg className="w-2.5 h-2.5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                            </svg>
                            <span className="text-[9px] font-bold text-[#059669] uppercase">Merged</span>
                          </span>
                        )}
                        <span className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{n.number}</span>
                        {n.label && n.label !== "Merged primary" && (
                          <span className="ml-1 text-[11px] text-[#8B92A9] shrink-0">({n.label})</span>
                        )}
                      </div>
                      <button onClick={() => handleRemoveNumber(addNumberLead.id, i)}
                        className="text-red-400 hover:text-red-600 transition shrink-0" title="Remove">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add new number */}
            <div className="border-t border-[#E4E7EF] dark:border-[#262A38] pt-3 mt-3">
              <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-2">Add Number</p>
              <input
                type="tel"
                placeholder="Phone number"
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
                className="w-full mb-2 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#8B92A9] focus:outline-none focus:border-[#2563EB]"
              />
              <input
                type="text"
                placeholder="Label (e.g. WhatsApp, Office) — optional"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-full mb-3 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#8B92A9] focus:outline-none focus:border-[#2563EB]"
              />
              <button
                onClick={handleAddNumber}
                disabled={!newNumber.trim() || addNumLoading}
                className="w-full py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {addNumLoading ? "Saving…" : "Add Number"}
              </button>
            </div>
          </div>
        </div>
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
                const count = leads.filter(l => l.status === s).length;
                const st = STATUS_STYLE[s] ?? STATUS_STYLE["New"];
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
                const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];
                const callCount = (lead.callHistory || []).length;
                return (
                  <tr key={lead.id} className={`border-b border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A] transition ${i % 2 === 0 ? "" : "bg-[#FAFBFF] dark:bg-[#1E2130]"}`}>
                    <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75]">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                          {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{lead.name}</span>
                      </div>
                    </td>

                    {/* FIX: use displayPhone() — superadmin sees full number, others see masked */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono">
                      <div className="flex items-center gap-1.5">
                        {lead.isClosed && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]"
                            title={lead.closeReason ? `Closed: ${lead.closeReason}` : "Closed — wrong entry"}
                          >
                            <svg className="w-2.5 h-2.5 text-[#DC2626] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <circle cx="10" cy="10" r="10"/>
                            </svg>
                            <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wide">Closed</span>
                          </span>
                        )}
                        <span className={lead.isClosed ? "text-[#DC2626] dark:text-[#F87171]" : "text-[#4B5168] dark:text-[#9DA3BB]"}>
                          {displayPhone(lead.phone, role)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.source}</td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB]">{lead.campaign}</td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.agent}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.bg} ${st.text}`}>{lead.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap">{displayDate(lead.date)}</td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Edit */}
                        <button onClick={() => setEditLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] text-[#8B92A9] transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        {/* Add / view additional numbers */}
                        <button onClick={() => setAddNumberLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#059669] hover:text-[#059669] text-[#8B92A9] transition" title="Linked Numbers">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                          </svg>
                          {lead.additionalNumbers?.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#059669] text-white text-[9px] flex items-center justify-center font-bold">
                              {lead.additionalNumbers.length}
                            </span>
                          )}
                        </button>
                        {/* Remarks history */}
                        <button onClick={() => setRemarksLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[#8B92A9] transition" title="Call History & Remarks">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
                          </svg>
                        </button>
                        {/* Recording */}
                        <button onClick={() => setRecordingLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#0891B2] hover:text-[#0891B2] text-[#8B92A9] transition" title="Call Recording">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                          </svg>
                        </button>
                        {/* Close Lead (Wrong Entry) — admin/superadmin only */}
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

              {Array.from(
                { length: Math.min(3, totalPages) },
                (_, i) => {
                  let start = Math.max(1, page - 1);
                  if (start + 2 > totalPages) start = Math.max(1, totalPages - 2);
                  return start + i;
                }
              ).map(n => (
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
