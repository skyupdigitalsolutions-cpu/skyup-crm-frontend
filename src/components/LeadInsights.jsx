// src/components/LeadInsights.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Daily Report → Lead Insights.
//
// Reuses rather than duplicates:
//   • GET /reports/lead-insights   — new, but built on the same Lead model
//     data every other report already reads (callHistory, scheduledCalls)
//   • LeadJourneyDrawer            — the existing full lead detail drawer
//     (info, call history, follow-ups, AI action-summary, recordings) —
//     opened exactly the way AdminLeadsPage.jsx already opens it
//   • utils/maskPhone, utils/dateUtils — same masking + IST date formatting
//     used everywhere else in the app
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../data/axiosConfig";
import { maskPhone, maskEmail } from "../utils/maskPhone";
import { formatTime, formatMedium } from "../utils/dateUtils";
import LeadJourneyDrawer from "./LeadJourneyDrawer";

// ── Small local toast — same shape as AdminLeadsPage's, kept self-contained
// so this component doesn't need to reach into that file. ────────────────────
function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const bg = type === "error" ? "bg-red-600" : "bg-emerald-600";
  return (
    <div className={`fixed bottom-6 right-6 z-[999] px-4 py-3 rounded-xl text-white text-[13px] font-semibold shadow-lg ${bg}`}>
      {message}
    </div>
  );
}

const TABLE_TABS = [
  { k: "",             l: "All" },
  { k: "new",          l: "New Leads" },
  { k: "followups",    l: "Follow-ups" },
  { k: "overdue",      l: "Overdue" },
  { k: "converted",    l: "Converted" },
  { k: "notConverted", l: "Not Converted" },
  { k: "pending",      l: "Pending" },
];

const STATUS_BADGE = {
  converted:    { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#065F46] dark:text-[#34D399]", label: "Converted" },
  notConverted: { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#991B1B] dark:text-[#F87171]", label: "Not Converted" },
  overdue:      { bg: "bg-[#FFF7ED] dark:bg-[#2D1300]", text: "text-[#9A3412] dark:text-[#FB923C]", label: "Overdue" },
  followups:    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#92400E] dark:text-[#FCD34D]", label: "Follow-up" },
  new:          { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#1D4ED8] dark:text-[#4F8EF7]", label: "New" },
  pending:      { bg: "bg-[#F8F9FC] dark:bg-[#13161E]", text: "text-[#8B92A9]",                     label: "Pending" },
};

function KpiCard({ label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white dark:bg-[#1A1D27] border rounded-2xl p-4 transition ${
        active ? "border-[#2563EB] ring-1 ring-[#2563EB]" : "border-[#E4E7EF] dark:border-[#262A38] hover:border-[#C7D7FF]"
      }`}
    >
      <div className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{label}</div>
      <div className="text-[26px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mt-1.5">{value ?? "—"}</div>
    </button>
  );
}

// ── Lead Summary Modal ────────────────────────────────────────────────────────
// This is the "complete information on click" view — status + WHY it's in
// that status (converted/not-converted/in-progress reason), activity
// counts, and the most recent remarks, all in one place without needing to
// open the full call-by-call drawer first. "View Full Journey" still opens
// LeadJourneyDrawer for the deep call history / AI action-summary / recordings.
function LeadSummaryModal({ lead, isSuperAdmin, onClose, onViewFullJourney }) {
  if (!lead) return null;
  const badge = STATUS_BADGE[lead._bucket] || STATUS_BADGE.pending;
  const displayPhone = isSuperAdmin ? (lead.mobile || lead.primaryPhone || "—") : maskPhone(lead.mobile || lead.primaryPhone);
  const recentRemarks = [...(lead.callHistory || [])]
    .filter((c) => c.remark)
    .sort((a, b) => new Date(b.calledAt || 0) - new Date(a.calledAt || 0))
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{lead.name}</h3>
            <p className="text-[12px] text-[#8B92A9] mt-0.5">{displayPhone} · {lead.user?.name || "Unassigned"} · {lead.source || "—"}</p>
          </div>
          <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] text-[20px] leading-none shrink-0">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + WHY — the headline answer to "why is this lead in this state" */}
          <div>
            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mt-2 leading-snug">{lead._statusReason}</p>
          </div>

          {/* Activity Summary */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Activity Summary</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["Total Calls", lead._totalCalls],
                ["Connected", lead._totalConnected],
                ["Remarks", lead._totalRemarks],
                ["Pending Follow-ups", lead._pendingFollowUps],
                ["Completed", lead._completedFollowUps],
                ["Status", lead.status || "—"],
              ].map(([label, val]) => (
                <div key={label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3">
                  <div className="text-[10px] text-[#8B92A9] uppercase font-semibold">{label}</div>
                  <div className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mt-0.5 truncate">{val ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key dates */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
            <span><span className="text-[#8B92A9]">Last Response: </span><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{lead._lastResponse || "—"}</span></span>
            <span><span className="text-[#8B92A9]">Last Activity: </span><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{lead._lastActivity ? formatMedium(lead._lastActivity) : "—"}</span></span>
            <span><span className="text-[#8B92A9]">Next Follow-up: </span><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{lead._nextFollowUp ? formatMedium(lead._nextFollowUp) : "—"}</span></span>
          </div>

          {/* Recent remarks — quick read without opening the full drawer */}
          {recentRemarks.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Recent Remarks</p>
              <div className="space-y-2">
                {recentRemarks.map((r, i) => (
                  <div key={i} className="text-[12px] border-l-2 border-[#E4E7EF] dark:border-[#262A38] pl-3">
                    <span className="text-[#8B92A9]">{r.calledAt ? formatMedium(r.calledAt) : ""}{r.outcome ? ` — ${r.outcome}` : ""}</span>
                    <p className="text-[#4B5168] dark:text-[#9DA3BB]">{r.remark}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex justify-end">
          <button
            onClick={onViewFullJourney}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[12px] font-bold transition"
          >
            View Full Call History & AI Summary →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadInsights({ date, isSuperAdmin }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [page, setPage]       = useState(1);

  const [tableTab, setTableTab] = useState("");
  const [agentId, setAgentId]   = useState("");
  const [source, setSource]     = useState("");
  const [temperature, setTemperature] = useState("");
  const [search, setSearch]     = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [selectedLead, setSelectedLead] = useState(null); // full journey drawer (deep dive)
  const [summaryLead, setSummaryLead] = useState(null);   // quick summary modal (default click target)
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  // ── Date range — independent of the parent Daily Report page's single
  // day selector. "Lead Insights" needs to browse beyond just today: a
  // custom range, or every lead the caller can see, not only ones touched
  // on one specific day. ────────────────────────────────────────────────────
  const toISODate = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
  const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toISODate(d); };
  const startOfWeekISO = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day); return toISODate(d); };
  const startOfMonthISO = () => { const d = new Date(); d.setDate(1); return toISODate(d); };

  const [rangeMode, setRangeMode]   = useState("day"); // "day" | "range" | "all"
  const [singleDate, setSingleDate] = useState(() => toISODate(date || new Date()));
  const [customFrom, setCustomFrom] = useState(() => isoDaysAgo(7));
  const [customTo, setCustomTo]     = useState(() => toISODate(new Date()));
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const applyPreset = (preset) => {
    setShowCustomPicker(false);
    if (preset === "today")      { setRangeMode("day");   setSingleDate(toISODate(new Date())); }
    else if (preset === "yesterday") { setRangeMode("day"); setSingleDate(isoDaysAgo(1)); }
    else if (preset === "week")  { setRangeMode("range"); setCustomFrom(startOfWeekISO());  setCustomTo(toISODate(new Date())); }
    else if (preset === "month") { setRangeMode("range"); setCustomFrom(startOfMonthISO()); setCustomTo(toISODate(new Date())); }
    else if (preset === "all")   { setRangeMode("all"); }
    else if (preset === "custom") { setRangeMode("range"); setShowCustomPicker(true); }
  };

  const rangeLabel = rangeMode === "all"
    ? "All Leads"
    : rangeMode === "range"
    ? `${customFrom} → ${customTo}`
    : singleDate === toISODate(new Date())
    ? "Today"
    : singleDate;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const dateParams = rangeMode === "all"
        ? { allTime: "true" }
        : rangeMode === "range"
        ? { dateFrom: customFrom, dateTo: customTo }
        : { date: singleDate };
      const { data: res } = await api.get("/reports/lead-insights", {
        params: {
          ...dateParams,
          status: tableTab || undefined,
          agentId: agentId || undefined,
          source: source || undefined,
          temperature: temperature || undefined,
          search: search || undefined,
          page,
          limit: 25,
        },
      });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load lead insights.");
    } finally {
      setLoading(false);
    }
  }, [rangeMode, singleDate, customFrom, customTo, tableTab, agentId, source, temperature, search, page]);

  useEffect(() => { load(); }, [load]);

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever a filter (other than page itself) changes
  useEffect(() => { setPage(1); }, [tableTab, agentId, source, temperature, rangeMode, singleDate, customFrom, customTo]);

  const summary = data?.summary || {};
  const leads = data?.leads || [];
  const followUps = data?.followUps || [];
  const timeline = data?.timeline || [];
  const timelineTruncated = data?.timelineTruncated || false;
  const conversionAnalysis = data?.conversionAnalysis || {};
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Distinct agents/sources for the filter dropdowns, derived from what's on
  // this page's leads — good enough for a same-day filter set without a
  // separate lookup call.
  const agentOptions = useMemo(() => {
    const map = new Map();
    for (const l of leads) if (l.user?._id) map.set(l.user._id, l.user.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [leads]);
  const sourceOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))),
    [leads]
  );

  const displayPhone = (l) => (isSuperAdmin ? l.mobile || l.primaryPhone || "—" : maskPhone(l.mobile || l.primaryPhone));

  return (
    <div className="space-y-5">
      {/* ── Date range ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["week", "This Week"],
          ["month", "This Month"],
          ["all", "All Leads"],
        ].map(([k, label]) => {
          const active =
            (k === "today" && rangeMode === "day" && singleDate === toISODate(new Date())) ||
            (k === "yesterday" && rangeMode === "day" && singleDate === isoDaysAgo(1)) ||
            (k === "week" && rangeMode === "range" && customFrom === startOfWeekISO() && !showCustomPicker) ||
            (k === "month" && rangeMode === "range" && customFrom === startOfMonthISO() && !showCustomPicker) ||
            (k === "all" && rangeMode === "all");
          return (
            <button key={k} onClick={() => applyPreset(k)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
                active ? "bg-[#2563EB] text-white" : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
              }`}>
              {label}
            </button>
          );
        })}
        <button onClick={() => applyPreset("custom")}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
            showCustomPicker ? "bg-[#2563EB] text-white" : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
          }`}>
          Custom Range
        </button>

        {showCustomPicker && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-2.5 py-1.5 text-[#4B5168] dark:text-[#9DA3BB]" />
            <span className="text-[#8B92A9] text-[12px]">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-2.5 py-1.5 text-[#4B5168] dark:text-[#9DA3BB]" />
          </div>
        )}

        <span className="ml-auto text-[11px] font-semibold text-[#8B92A9]">
          Showing: <span className="text-[#0F1117] dark:text-[#F0F2FA]">{rangeLabel}</span>
        </span>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
          className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-3 py-2 text-[#4B5168] dark:text-[#9DA3BB]">
          <option value="">All Agents</option>
          {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}
          className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-3 py-2 text-[#4B5168] dark:text-[#9DA3BB]">
          <option value="">All Sources</option>
          {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={temperature} onChange={(e) => setTemperature(e.target.value)}
          className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-3 py-2 text-[#4B5168] dark:text-[#9DA3BB]">
          <option value="">All Temperature</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
        </select>
        <input
          type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search lead…"
          className="text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] rounded-lg px-3 py-2 text-[#4B5168] dark:text-[#9DA3BB] flex-1 min-w-[160px]"
        />
      </div>

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 dark:text-red-400 underline text-[11px] font-semibold">Retry</button>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="py-20 text-center text-[13px] text-[#8B92A9]">Loading lead insights…</div>
      ) : (
        <>
          {/* ── KPI cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KpiCard label="New Leads"     value={summary.newLeads}        active={tableTab === "new"}          onClick={() => setTableTab(tableTab === "new" ? "" : "new")} />
            <KpiCard label="Follow-ups"    value={summary.followUps}       active={tableTab === "followups"}    onClick={() => setTableTab(tableTab === "followups" ? "" : "followups")} />
            <KpiCard label="Calls Made"    value={summary.callsMade}       active={false} onClick={() => {}} />
            <KpiCard label="Connected"     value={summary.connectedCalls}  active={false} onClick={() => {}} />
            <KpiCard label="Unanswered"    value={summary.unansweredCalls} active={false} onClick={() => {}} />
            <KpiCard label="Converted"     value={summary.converted}       active={tableTab === "converted"}    onClick={() => setTableTab(tableTab === "converted" ? "" : "converted")} />
            <KpiCard label="Not Converted" value={summary.notConverted}    active={tableTab === "notConverted"} onClick={() => setTableTab(tableTab === "notConverted" ? "" : "notConverted")} />
            <KpiCard label="Pending"       value={summary.pending}         active={tableTab === "pending"}      onClick={() => setTableTab(tableTab === "pending" ? "" : "pending")} />
          </div>

          {/* ── Leads & Follow-ups table ─────────────────────────────────── */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Leads & Follow-ups</h2>
              <div className="flex items-center gap-1 bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg p-1 overflow-x-auto">
                {TABLE_TABS.map((t) => (
                  <button key={t.k} onClick={() => setTableTab(t.k)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                      tableTab === t.k ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-white dark:hover:bg-[#1A1D27]"
                    }`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            {leads.length === 0 ? (
              <p className="text-[13px] text-[#8B92A9] py-14 text-center">No leads found for the selected date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    <tr>
                      {["Lead","Phone","Agent","Source","Temp","Calls","Connected","Remarks","Status Reason","Last Activity","Next Follow-up","Status"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#8B92A9] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => {
                      const badge = STATUS_BADGE[l._bucket] || STATUS_BADGE.pending;
                      return (
                        <tr key={l._id} onClick={() => setSummaryLead(l)}
                          className="border-t border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]/50 cursor-pointer text-[12px]">
                          <td className="px-3 py-2.5 font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.name}</td>
                          <td className="px-3 py-2.5 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{displayPhone(l)}</td>
                          <td className="px-3 py-2.5 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.user?.name || "Unassigned"}</td>
                          <td className="px-3 py-2.5 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.source || "—"}</td>
                          <td className="px-3 py-2.5 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.temperature || l.leadCategory || "—"}</td>
                          <td className="px-3 py-2.5 text-center">{l._callsToday}</td>
                          <td className="px-3 py-2.5 text-center">{l._connectedToday}</td>
                          <td className="px-3 py-2.5 text-center">{l._remarksToday}</td>
                          <td className="px-3 py-2.5 text-[#4B5168] dark:text-[#9DA3BB] max-w-[220px] truncate" title={l._statusReason}>{l._statusReason || "—"}</td>
                          <td className="px-3 py-2.5 text-[#8B92A9] whitespace-nowrap">{l._lastActivity ? formatTime(l._lastActivity) : "—"}</td>
                          <td className="px-3 py-2.5 text-[#8B92A9] whitespace-nowrap">{l._nextFollowUp ? formatTime(l._nextFollowUp) : "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#8B92A9]">
                <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={pagination.page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] font-semibold disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))} disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] font-semibold disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Follow-ups in range ──────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Follow-ups {rangeMode === "day" ? "Today" : `— ${rangeLabel}`}</h2>
            </div>
            {followUps.length === 0 ? (
              <p className="text-[13px] text-[#8B92A9] py-10 text-center">No follow-ups scheduled for this day.</p>
            ) : (
              <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {followUps.map((f, i) => (
                  <div key={i}
                    onClick={() => { const l = leads.find((x) => x._id === f.leadId); if (l) setSummaryLead(l); }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]/50 cursor-pointer text-[12px]">
                    <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] flex-1 min-w-0 truncate">{f.leadName}</span>
                    <span className="text-[#8B92A9] w-28 shrink-0">{f.agent}</span>
                    <span className="text-[#8B92A9] w-20 shrink-0">{f.followUpTime ? formatTime(f.followUpTime) : "—"}</span>
                    <span className="text-[#4B5168] dark:text-[#9DA3BB] flex-1 min-w-0 truncate hidden sm:block">{f.lastRemark || f.previousResponse || "—"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      f.status === "Overdue" ? "bg-[#FEF2F2] text-[#991B1B]" : f.status === "Completed" ? "bg-[#ECFDF5] text-[#065F46]" : "bg-[#FFFBEB] text-[#92400E]"
                    }`}>{f.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Activity Timeline ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{rangeMode === "day" ? "Daily Activity" : "Activity"}</h2>
              {timelineTruncated && (
                <span className="text-[10px] text-[#8B92A9] font-semibold">Showing most recent 300 events</span>
              )}
            </div>
            {timeline.length === 0 ? (
              <p className="text-[13px] text-[#8B92A9] py-10 text-center">No activity recorded for this date.</p>
            ) : (
              <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
                {timeline.map((ev, i) => (
                  <div key={i} className="flex gap-3 text-[12px]">
                    <span className="text-[#8B92A9] w-16 shrink-0">{ev.time ? formatTime(ev.time) : "—"}</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{ev.type}</span>
                      <span className="text-[#4B5168] dark:text-[#9DA3BB]"> — {ev.leadName}</span>
                      {ev.detail && <p className="text-[#8B92A9] truncate">{ev.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Conversion Analysis ──────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Conversion Analysis</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); showToast("Click any lead above for its own conversion/non-conversion reason. This section only summarizes the whole day.", "success"); }}
                className="text-[11px] font-semibold text-[#2563EB] hover:underline">
                Where's my per-lead reason? →
              </a>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <KpiCard label="Total Leads" value={conversionAnalysis.totalLeads} onClick={() => {}} />
                <KpiCard label="Converted" value={conversionAnalysis.converted} onClick={() => {}} />
                <KpiCard label="Not Converted" value={conversionAnalysis.notConverted} onClick={() => {}} />
                <KpiCard label="Conv. Rate" value={`${conversionAnalysis.conversionRate || 0}%`} onClick={() => {}} />
                <KpiCard label="Non-Conv. Rate" value={`${conversionAnalysis.nonConversionRate || 0}%`} onClick={() => {}} />
              </div>
              {conversionAnalysis.reasons?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-3">Top Non-Conversion Reasons</p>
                  <div className="space-y-2.5">
                    {conversionAnalysis.reasons.slice(0, 6).map((r) => (
                      <div key={r.reason}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-[#4B5168] dark:text-[#9DA3BB]">{r.reason}</span>
                          <span className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">{r.percent}%</span>
                        </div>
                        <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${r.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Lead Summary Modal — click any lead to see status + reason + activity ── */}
      <LeadSummaryModal
        lead={summaryLead}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setSummaryLead(null)}
        onViewFullJourney={() => { setSelectedLead(summaryLead); setSummaryLead(null); }}
      />

      {/* ── Lead Detail Drawer — reused as-is, same props AdminLeadsPage passes ── */}
      {selectedLead && (
        <LeadJourneyDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          isSuperAdmin={isSuperAdmin}
          maskPhone={maskPhone}
          maskEmail={maskEmail}
          onLeadUpdated={() => load()}
          onToast={showToast}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
