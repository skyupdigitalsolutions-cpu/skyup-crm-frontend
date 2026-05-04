import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../data/axiosConfig";

function maskPhone(phone) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "••••••";
  return digits.slice(0, 2) + "•••••" + digits.slice(-2);
}

const STATUS_CONFIG = {
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       dot: "#2563EB" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     dot: "#D97706" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         dot: "#DC2626" },
};
const TEMP_CONFIG = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    icon: "🔥" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400",icon: "☀️" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400",  icon: "❄️" },
};
const STATUS_OPTIONS   = ["New", "In Progress", "Converted", "Not Interested"];
const OUTCOME_OPTIONS  = ["Call Back", "Interested", "Not Reachable", "Meeting Scheduled", "Demo Done", "Converted", "Not Interested"];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function daysSince(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso);
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function mapLead(l) {
  // Check if any recording has a done transcription
  const recs = Array.isArray(l.recordings) ? l.recordings : [];
  const hasRecording  = recs.length > 0;
  const hasAiSummary  = recs.some(r => r.transcribeStatus === "done" && r.summary);

  return {
    id:           String(l._id),
    name:         l.name        || "Unknown",
    phone:        l.mobile      || l.phone || "",
    email:        l.email       || "",
    source:       l.source      || "—",
    campaign:     l.campaign    || "—",
    status:       l.status      || "New",
    temperature:  l.temperature || l.Quality || null,
    remark:       l.remark      || "",
    date:         fmtDate(l.date || l.createdAt),
    _raw_date:    l.date        || l.createdAt || null,
    callHistory:  Array.isArray(l.callHistory) ? l.callHistory : [],
    hasRecording,
    hasAiSummary,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}
function TempBadge({ temp }) {
  if (!temp) return null;
  const s = TEMP_CONFIG[temp];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {temp}
    </span>
  );
}

// ── Recording icon ────────────────────────────────────────────────────────────
function RecordingIcon({ title = "Has call recording" }) {
  return (
    <span title={title}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
      </svg>
    </span>
  );
}

// ── AI summary icon ───────────────────────────────────────────────────────────
function AiSummaryIcon({ title = "AI summary available" }) {
  return (
    <span title={title}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
    </span>
  );
}

// ── Update drawer ─────────────────────────────────────────────────────────────
function UpdateDrawer({ lead, onClose, onSaved }) {
  const [status,  setStatus]  = useState(lead.status);
  const [remark,  setRemark]  = useState("");
  const [outcome, setOutcome] = useState("Call Back");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const isNI = status === "Not Interested";

  const handleSave = async () => {
    if (!remark.trim()) return setError("Remark is required.");
    setSaving(true);
    setError("");
    try {
      if (isNI) {
        await api.patch(`/lead/${lead.id}/not-interested`, { remark: remark.trim() });
      } else {
        await api.patch(`/lead/${lead.id}`, { status, remark: remark.trim(), outcome });
      }
      onSaved({ ...lead, status, remark: remark.trim() });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG["New"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
                <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] font-mono mt-0.5">{maskPhone(lead.phone)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={lead.status} />
              {lead.temperature && <TempBadge temp={lead.temperature} />}
              <span className="text-[10px] text-[#8B92A9]">{lead.source}</span>
              {lead.hasRecording && <RecordingIcon />}
              {lead.hasAiSummary && <AiSummaryIcon />}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lead info strip */}
        <div className="px-6 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38] grid grid-cols-2 gap-y-1.5 shrink-0">
          {[
            { label: "Campaign", value: lead.campaign !== "—" ? lead.campaign : "—" },
            { label: "Date",     value: lead.date },
            { label: "Source",   value: lead.source },
            { label: "Calls",    value: lead.callHistory.length || 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-bold text-[#8B92A9] uppercase tracking-widest">{label}</p>
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Last remark */}
        {lead.remark && (
          <div className="px-6 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] shrink-0">
            <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Last Remark</p>
            <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic">"{lead.remark}"</p>
          </div>
        )}

        {/* Call history */}
        {lead.callHistory.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] shrink-0">
            <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">
              Call History ({lead.callHistory.length})
            </p>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {[...lead.callHistory].reverse().map((h, i) => (
                <div key={i} className="flex gap-2.5 text-[11px]">
                  <div className="w-1.5 shrink-0 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{h.outcome || "Call Back"}</span>
                      <span className="text-[#8B92A9] shrink-0 text-[10px]">{h.calledAt ? fmtDate(h.calledAt) : "—"}</span>
                    </div>
                    <p className="text-[#4B5168] dark:text-[#9DA3BB] italic truncate">{h.remark || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Update form */}
        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
          <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">Update Lead</p>

          {/* Status */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => {
                const sc2   = STATUS_CONFIG[s];
                const active = status === s;
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-2 rounded-xl border-2 text-[12px] font-semibold transition flex items-center gap-1.5 ${
                      active
                        ? `${sc2.bg} ${sc2.text} border-current`
                        : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#CBD5E1]"
                    }`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? sc2.dot : "#CBD5E1" }} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outcome */}
          {!isNI && (
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Call Outcome</label>
              <select value={outcome} onChange={e => setOutcome(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition">
                {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Remark */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Remark <span className="text-red-500">*</span>
              {isNI && <span className="ml-1 font-normal text-[10px] text-[#8B92A9]">(reason required for Not Interested)</span>}
            </label>
            <textarea
              value={remark}
              onChange={e => { setRemark(e.target.value); setError(""); }}
              rows={4}
              placeholder="Add your call notes…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-[12px] text-red-600 dark:text-red-400">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !remark.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {saving
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving…</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save Update</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI pill ──────────────────────────────────────────────────────────────────
function KpiPill({ label, value, color, bg, text, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] ${bg} ${text} ${active ? "" : "border-transparent"}`}
      style={{ borderColor: active ? color : undefined }}>
      <span className="text-[18px] font-black">{value}</span>
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PER_PAGE = 15;

export default function UserLeadsPage() {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);

  const [search,     setSearch]     = useState("");
  const [filterSt,   setFilterSt]   = useState("All");
  const [filterTemp, setFilterTemp] = useState("All");
  const [filterSrc,  setFilterSrc]  = useState("All");
  const [sortBy,     setSortBy]     = useState("date_desc");
  const [page,       setPage]       = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/lead/my-leads");
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setLeads(raw.map(mapLead));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leads. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSaved = useCallback((updated) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
  }, []);

  const sources = useMemo(() =>
    [...new Set(leads.map(l => l.source).filter(s => s && s !== "—"))],
  [leads]);

  const kpi = useMemo(() => ({
    total:      leads.length,
    newLeads:   leads.filter(l => l.status === "New").length,
    inProgress: leads.filter(l => l.status === "In Progress").length,
    converted:  leads.filter(l => l.status === "Converted").length,
    notInt:     leads.filter(l => l.status === "Not Interested").length,
    hot:        leads.filter(l => l.temperature === "Hot").length,
  }), [leads]);

  const displayed = useMemo(() => {
    let res = leads.filter(l => {
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.source.toLowerCase().includes(q) || l.campaign.toLowerCase().includes(q);
      const matchSt     = filterSt   === "All" || l.status     === filterSt;
      const matchTemp   = filterTemp === "All" || l.temperature === filterTemp;
      const matchSrc    = filterSrc  === "All" || l.source      === filterSrc;
      return matchSearch && matchSt && matchTemp && matchSrc;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [leads, search, filterSt, filterTemp, filterSrc, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterTemp("All"); setFilterSrc("All"); setPage(1);
  };
  const hasFilter = search || filterSt !== "All" || filterTemp !== "All" || filterSrc !== "All";

  const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">My Leads</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Your assigned leads — click any row to update status &amp; add call notes
          </p>
        </div>
        <button onClick={fetchLeads}
          className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition"
          title="Refresh">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      {/* KPI pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: "Total",          value: kpi.total,      color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-700 dark:text-blue-300",       filter: "All"           },
          { label: "New",            value: kpi.newLeads,   color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-600 dark:text-blue-400",       filter: "New"           },
          { label: "In Progress",    value: kpi.inProgress, color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-600 dark:text-amber-400",     filter: "In Progress"   },
          { label: "Converted",      value: kpi.converted,  color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", filter: "Converted"     },
          { label: "Not Interested", value: kpi.notInt,     color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-600 dark:text-red-400",         filter: "Not Interested"},
        ].map(s => (
          <KpiPill key={s.label} {...s}
            active={filterSt === s.filter}
            onClick={() => { setFilterSt(filterSt === s.filter ? "All" : s.filter); setPage(1); }} />
        ))}
        {kpi.hot > 0 && (
          <button
            onClick={() => { setFilterTemp(filterTemp === "Hot" ? "All" : "Hot"); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ${filterTemp === "Hot" ? "" : "border-transparent"}`}
            style={{ borderColor: filterTemp === "Hot" ? "#DC2626" : undefined }}>
            <span className="text-[18px] font-black">{kpi.hot}</span>
            🔥 Hot
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, source, campaign…"
              className={INP + " pl-9 w-full"} />
          </div>
          <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All sources</option>
            {sources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterTemp} onChange={e => { setFilterTemp(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All quality</option>
            <option>Hot</option><option>Warm</option><option>Cold</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
          </select>
          {hasFilter && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-2">
          {displayed.length} leads {displayed.length !== leads.length ? `(filtered from ${leads.length})` : ""}
          {" · "}
          <span className="text-[#E84444] dark:text-[#F87171] font-medium">📵 Phone numbers are masked for security</span>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px]">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {error}
          <button onClick={fetchLeads} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-[13px]">Loading your leads…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-[48px]">🔍</span>
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {leads.length === 0 ? "No leads assigned yet" : "No leads match your filters"}
            </p>
            {leads.length > 0 && (
              <button onClick={clearFilters}
                className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {/* Removed last empty "" column — no more edit button column */}
                    {["Lead", "Phone 📵", "Source / Campaign", "Date", "Status", "Quality", "Calls", "Media"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                    return (
                      <tr key={l.id}
                        className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer"
                        onClick={() => setSelected(l)}>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.name}</p>
                              <p className="text-[10px] text-[#8B92A9]">{daysSince(l._raw_date) || "—"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Phone — masked */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#4B5168] dark:text-[#9DA3BB] tracking-wider bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-lg text-[11px]">
                              {maskPhone(l.phone)}
                            </span>
                          </div>
                          {l.email && (
                            <p className="text-[10px] text-[#8B92A9] mt-0.5 truncate max-w-[120px]">
                              {l.email.replace(/(.{2})(.*)(@.*)/, "$1••••$3")}
                            </p>
                          )}
                        </td>

                        {/* Source / Campaign */}
                        <td className="px-4 py-3">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[120px]">{l.source}</p>
                          {l.campaign !== "—" && (
                            <p className="text-[10px] text-[#8B92A9] truncate max-w-[120px]">{l.campaign}</p>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA]">{l.date}</p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>

                        {/* Quality */}
                        <td className="px-4 py-3"><TempBadge temp={l.temperature} /></td>

                        {/* Calls */}
                        <td className="px-4 py-3">
                          {l.callHistory.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                              📞 {l.callHistory.length}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#8B92A9]">—</span>
                          )}
                        </td>

                        {/* ── Media icons (recording + AI summary) ── */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {l.hasRecording  && <RecordingIcon />}
                            {l.hasAiSummary  && <AiSummaryIcon />}
                            {!l.hasRecording && !l.hasAiSummary && (
                              <span className="text-[11px] text-[#8B92A9]">—</span>
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
              <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="text-[11px] text-[#8B92A9]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayed.length)} of {displayed.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition ${page === n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]"}`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer note */}
      <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] text-center mt-4">
        📵 Phone numbers are masked — only your admin can see full numbers · Updates are saved to your call history
      </p>

      {/* Drawer */}
      {selected && (
        <UpdateDrawer lead={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
