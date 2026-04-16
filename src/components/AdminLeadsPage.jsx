import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../data/axiosConfig";
import LeadJourneyDrawer from "./LeadJourneyDrawer";

const STATUS_CONFIG = {
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",    text: "text-blue-600 dark:text-blue-400",    dot: "#2563EB" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",  text: "text-amber-600 dark:text-amber-400",  dot: "#D97706" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-600 dark:text-red-400",      dot: "#DC2626" },
};
const TEMP_CONFIG = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    icon: "🔥" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400",icon: "☀️" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400",  icon: "❄️" },
};

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

function mapLead(l) {
  return {
    id:             String(l._id),
    name:           l.name           || "Unknown",
    phone:          l.mobile         || l.phone || "",
    email:          l.email          || "",
    source:         l.source         || "—",
    campaign:       l.campaign       || "—",
    agent:          l.assignedTo?.name || l.agent || "Unassigned",
    status:         l.status         || "New",
    Quality:        l.Quality        || null,
    remark:         l.remark         || "",
    date:           l.date ? new Date(l.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    createdAt:      l.createdAt      || l.date || null,
    _raw_date:      l.date           || l.createdAt || null,
    callHistory:    Array.isArray(l.callHistory)    ? l.callHistory    : [],
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
  };
}

function journeyProgress(lead) {
  if (lead.status === "Converted")      return 100;
  if (lead.status === "Not Interested") return 60;
  if (lead.status === "In Progress")    return Math.min(30 + lead.callHistory.length * 10, 80);
  return Math.min(lead.callHistory.length * 10, 25);
}

function fmtShortDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function daysSince(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return `${mo}mo ago`;
}

// ── Progress cell — the key upgrade ─────────────────────────────────────────
function ProgressCell({ lead }) {
  const sc    = STATUS_CONFIG[lead.status] || STATUS_CONFIG["New"];
  const pct   = journeyProgress(lead);
  const calls = lead.callHistory;
  const sched = lead.scheduledCalls;

  // Last call info
  const lastCall = calls.length
    ? [...calls].sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))[0]
    : null;

  // Next scheduled
  const nextSched = sched
    .filter(s => !s.done)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];

  const overdue = sched.filter(s => !s.done && new Date(s.scheduledAt) < new Date()).length;

  return (
    <div className="min-w-[190px] max-w-[220px]">
      {/* Progress bar */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="flex-1 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: sc.dot }} />
        </div>
        <span className="text-[10px] font-bold shrink-0" style={{ color: sc.dot }}>{pct}%</span>
      </div>

      {/* Stage mini-dots */}
      <div className="flex items-center gap-1 mb-2">
        {["In", "Assigned", "Called", "F/up", "Done"].map((s, i) => {
          const done = i === 0 ? true
            : i === 1 ? !!lead.agent
            : i === 2 ? calls.length > 0
            : i === 3 ? sched.some(c => c.done)
            : lead.status === "Converted";
          return (
            <div key={s} className="flex flex-col items-center gap-0.5" title={s}>
              <div className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: done ? sc.dot : "#E4E7EF" }} />
            </div>
          );
        })}
        <span className="text-[9px] text-[#C4C9D9] dark:text-[#3E4257] ml-0.5">
          {["Created", "Assigned", "Called", "Follow-up", "Converted"].filter((_, i) => {
            return i === 0 ? true
              : i === 1 ? !!lead.agent
              : i === 2 ? calls.length > 0
              : i === 3 ? sched.some(c => c.done)
              : lead.status === "Converted";
          }).length}/5 stages
        </span>
      </div>

      {/* Last call remark */}
      {lastCall && (
        <div className="mb-1.5">
          <div className="flex items-start gap-1">
            <span className="text-[9px] text-[#8B92A9] shrink-0 mt-0.5 font-semibold">Last call</span>
            <span className="text-[9px] text-[#8B92A9] shrink-0">{lastCall.calledAt ? `· ${fmtShortDate(lastCall.calledAt)}` : ""}</span>
          </div>
          {lastCall.remark ? (
            <p className="text-[10px] text-[#4B5168] dark:text-[#9DA3BB] leading-snug truncate italic">
              "{lastCall.remark}"
            </p>
          ) : (
            <p className="text-[10px] text-[#C4C9D9] dark:text-[#3E4257]">No remark</p>
          )}
        </div>
      )}

      {/* Next scheduled */}
      {nextSched && (
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold w-fit ${overdue > 0 ? "bg-red-50 dark:bg-red-950/40 text-red-500" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"}`}>
          {overdue > 0 ? "⚠️" : "📅"} {overdue > 0 ? `${overdue} overdue` : `Due ${fmtShortDate(nextSched.scheduledAt)}`}
        </div>
      )}

      {/* Call count */}
      <p className="text-[9px] text-[#8B92A9] mt-1">
        {calls.length} call{calls.length !== 1 ? "s" : ""}
        {sched.length > 0 ? ` · ${sched.length} scheduled` : ""}
        {lead.reassignCount > 0 ? ` · 🔄${lead.reassignCount}` : ""}
      </p>
    </div>
  );
}

const PER_PAGE = 15;

export default function AdminLeadsPage() {
  const [allLeads, setAllLeads] = useState([]);
  const [agents,   setAgents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);

  const [search,      setSearch]      = useState("");
  const [filterSt,    setFilterSt]    = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSrc,   setFilterSrc]   = useState("All");
  const [filterTemp,  setFilterTemp]  = useState("All");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [sortBy,      setSortBy]      = useState("date_desc");
  const [page,        setPage]        = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/leads/admin/all");
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAllLeads(raw.map(mapLead));
      const agentSet = new Set();
      raw.forEach(l => { const n = l.assignedTo?.name || l.agent; if (n) agentSet.add(n); });
      setAgents([...agentSet]);
    } catch {
      try {
        const { fetchAll } = await import("../data/dataService");
        const { leads } = await fetchAll();
        setAllLeads((leads || []).map(l => ({ ...mapLead({ ...l, _id: l.id || l._id }), agent: l.agent || "Unassigned" })));
        const agentSet = new Set((leads || []).map(l => l.agent).filter(Boolean));
        setAgents([...agentSet]);
      } catch {
        setError("Failed to load leads. Please refresh.");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const uniqueSources = useMemo(() =>
    [...new Set(allLeads.map(l => l.source).filter(s => s && s !== "—"))],
  [allLeads]);

  const kpi = useMemo(() => {
    const total      = allLeads.length;
    const converted  = allLeads.filter(l => l.status === "Converted").length;
    const inProgress = allLeads.filter(l => l.status === "In Progress").length;
    const notInt     = allLeads.filter(l => l.status === "Not Interested").length;
    const newLeads   = allLeads.filter(l => l.status === "New").length;
    return { total, converted, inProgress, notInt, newLeads };
  }, [allLeads]);

  const displayed = useMemo(() => {
    let res = allLeads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.agent || "").toLowerCase().includes(q);
      const matchSt    = filterSt    === "All" || l.status    === filterSt;
      const matchAgent = filterAgent === "All" || l.agent     === filterAgent;
      const matchSrc   = filterSrc   === "All" || l.source    === filterSrc;
      const matchTemp  = filterTemp  === "All" || l.Quality   === filterTemp;
      let matchDate = true;
      if (dateFrom) matchDate = matchDate && new Date(l._raw_date) >= new Date(dateFrom);
      if (dateTo)   matchDate = matchDate && new Date(l._raw_date) <= new Date(dateTo + "T23:59:59");
      return matchSearch && matchSt && matchAgent && matchSrc && matchTemp && matchDate;
    });
    res = res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      if (sortBy === "progress")  return journeyProgress(b) - journeyProgress(a);
      return 0;
    });
    return res;
  }, [allLeads, search, filterSt, filterAgent, filterSrc, filterTemp, dateFrom, dateTo, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterAgent("All"); setFilterSrc("All");
    setFilterTemp("All"); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Lead Management</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Full pipeline view — click any lead to see its complete journey with remarks & dates</p>
        </div>
        <button onClick={fetchLeads}
          className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition"
          title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: "Total",        value: kpi.total,      color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-700 dark:text-blue-300",     filter: "All" },
          { label: "New",          value: kpi.newLeads,   color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-600 dark:text-blue-400",     filter: "New" },
          { label: "In Progress",  value: kpi.inProgress, color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-600 dark:text-amber-400",   filter: "In Progress" },
          { label: "Converted",    value: kpi.converted,  color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/30",text: "text-emerald-600 dark:text-emerald-400",filter: "Converted" },
          { label: "Not Interested",value: kpi.notInt,    color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",       text: "text-red-600 dark:text-red-400",       filter: "Not Interested" },
        ].map(s => (
          <button key={s.label}
            onClick={() => { setFilterSt(filterSt === s.filter ? "All" : s.filter); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] ${s.bg} ${s.text} ${filterSt === s.filter ? "" : "border-transparent"}`}
            style={{ borderColor: filterSt === s.filter ? s.color : undefined }}>
            <span className="text-[18px] font-black">{s.value}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, agent…" className={INP + " pl-9 w-full"} />
          </div>
          <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All agents</option>
            {agents.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All sources</option>
            {uniqueSources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterTemp} onChange={e => { setFilterTemp(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All qualities</option>
            <option>Hot</option><option>Warm</option><option>Cold</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={INP} title="From date" />
          <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} className={INP} title="To date" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
            <option value="progress">By journey progress</option>
          </select>
          {(search || filterSt !== "All" || filterAgent !== "All" || filterSrc !== "All" || filterTemp !== "All" || dateFrom || dateTo) && (
            <button onClick={clearFilters} className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-2">
          {displayed.length} leads found {displayed.length !== allLeads.length ? `(filtered from ${allLeads.length})` : ""}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px]">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {error}
          <button onClick={fetchLeads} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <span className="text-[13px]">Loading leads…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-[48px]">🔍</span>
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">No leads match your filters</p>
            <button onClick={clearFilters} className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">Clear Filters</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Lead", "Contact", "Agent", "Source / Campaign", "Date", "Status", "Quality", "Progress & Activity", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                    return (
                      <tr key={l.id}
                        className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group"
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

                        {/* Contact */}
                        <td className="px-4 py-3">
                          <p className="font-mono text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.phone || "—"}</p>
                          {l.email && <p className="text-[10px] text-[#8B92A9] truncate max-w-[130px]">{l.email}</p>}
                        </td>

                        {/* Agent */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[8px] font-black text-purple-600 dark:text-purple-400 shrink-0">
                              {(l.agent || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[90px]">{l.agent || "Unassigned"}</span>
                          </div>
                          {l.reassignCount > 0 && (
                            <p className="text-[9px] text-purple-400 mt-0.5">🔄 {l.reassignCount} reassign{l.reassignCount > 1 ? "s" : ""}</p>
                          )}
                        </td>

                        {/* Source / Campaign */}
                        <td className="px-4 py-3">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[110px]">{l.source}</p>
                          {l.campaign !== "—" && <p className="text-[10px] text-[#8B92A9] truncate max-w-[110px]">{l.campaign}</p>}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA]">{l.date}</p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>

                        {/* Quality */}
                        <td className="px-4 py-3"><TempBadge temp={l.Quality} /></td>

                        {/* Progress & Activity — the upgraded column */}
                        <td className="px-4 py-3">
                          <ProgressCell lead={l} />
                        </td>

                        {/* Open button */}
                        <td className="px-4 py-3">
                          <button onClick={e => { e.stopPropagation(); setSelected(l); }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[10px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center gap-1 whitespace-nowrap">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                            
                          </button>
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

      {/* Journey drawer */}
      {selected && <LeadJourneyDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}