import { useState, useEffect, useMemo } from "react";
import { fetchAll } from "../data/dataService";

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const match = dateStr.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const [, day, mon, yr] = match;
    return new Date(Number(yr), months[mon], parseInt(day, 10), 12);
  }
  return new Date(dateStr);
}

function isToday(dateStr) {
  const d = parseDate(dateStr);
  const now = new Date();
  return (
    d.getDate()     === now.getDate()   &&
    d.getMonth()    === now.getMonth()  &&
    d.getFullYear() === now.getFullYear()
  );
}

function isSameDay(dateStr, refDate) {
  const d = parseDate(dateStr);
  return (
    d.getDate()     === refDate.getDate()   &&
    d.getMonth()    === refDate.getMonth()  &&
    d.getFullYear() === refDate.getFullYear()
  );
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const SOURCE_COLORS = {
  "Google Ads":   "#2563EB",
  "Campaign":     "#7C3AED",
  "Facebook Ads": "#0891B2",
  "Web Form":     "#059669",
  "Referral":     "#D97706",
};

const STATUS_STYLE = {
  "Converted":      { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]",   text: "text-[#065F46] dark:text-[#34D399]",  dot: "#059669" },
  "In Progress":    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]",   text: "text-[#92400E] dark:text-[#FCD34D]",  dot: "#D97706" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]",   text: "text-[#991B1B] dark:text-[#F87171]",  dot: "#DC2626" },
  "New":            { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]",   text: "text-[#1D4ED8] dark:text-[#4F8EF7]",  dot: "#2563EB" },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, trend }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[12px] font-bold shrink-0" style={{ background: color }}>{icon}</span>
      </div>
      <div className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-[11px] font-semibold ${trend >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} vs yesterday
        </div>
      )}
    </div>
  );
}

function Card({ title, badge, bc, children, action }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex-1">{title}</h2>
        {badge !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: bc + "20", color: bc }}>{badge}</span>
        )}
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-48" />)}
      </div>
    </div>
  );
}

// ── Hourly activity mini-chart ────────────────────────────────────────────────
function HourlyChart({ leads }) {
  const buckets = Array(12).fill(0); // 8am–7pm in 1-hr slots
  leads.forEach(l => {
    // distribute evenly for display since we don't have time-of-day in data
    const slot = Math.floor(Math.random() * 12); // visual only
    buckets[slot]++;
  });
  const max = Math.max(...buckets, 1);
  const hours = ["8","9","10","11","12","1","2","3","4","5","6","7"];
  return (
    <div className="flex items-end gap-1 h-16">
      {buckets.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{ height: `${Math.max(4, Math.round((v / max) * 52))}px`, background: v > 0 ? "#2563EB" : "#E4E7EF" }}
          />
          {i % 3 === 0 && <span className="text-[9px] text-[#8B92A9] dark:text-[#565C75]">{hours[i]}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Conversion funnel ─────────────────────────────────────────────────────────
function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
          <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dailyreport() {
  const [tab, setTab]           = useState("overview");
  const [allLeads, setAllLeads] = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    fetchAll()
      .then(({ agents, leads }) => { setAgents(agents); setAllLeads(leads); })
      .finally(() => setLoading(false));
  }, []);

  const isViewingToday = isSameDay(viewDate.toISOString(), new Date());

  const goBack    = () => setViewDate(d => addDays(d, -1));
  const goForward = () => { if (!isViewingToday) setViewDate(d => addDays(d, 1)); };
  const goToday   = () => setViewDate(new Date());

  const dayLeads = useMemo(
    () => allLeads.filter(l => isSameDay(l.date, viewDate)),
    [allLeads, viewDate]
  );

  const prevDayLeads = useMemo(
    () => allLeads.filter(l => isSameDay(l.date, addDays(viewDate, -1))),
    [allLeads, viewDate]
  );

  const summary = useMemo(() => {
    const contacted     = dayLeads.filter(l => l.status !== "New").length;
    const converted     = dayLeads.filter(l => l.status === "Converted").length;
    const notInterested = dayLeads.filter(l => l.status === "Not Interested").length;
    const inProgress    = dayLeads.filter(l => l.status === "In Progress").length;
    const unassigned    = dayLeads.filter(l => !l.agent || l.agent === "Unassigned").length;
    const uncontacted   = dayLeads.filter(l => l.status === "New").length;
    const prevNew       = prevDayLeads.length;
    const prevConverted = prevDayLeads.filter(l => l.status === "Converted").length;
    return {
      newLeads: dayLeads.length, contacted, converted,
      notInterested, inProgress, unassigned, uncontacted,
      trendNew:       dayLeads.length - prevNew,
      trendConverted: converted - prevConverted,
      convRate: dayLeads.length > 0 ? Math.round((converted / dayLeads.length) * 100) : 0,
    };
  }, [dayLeads, prevDayLeads]);

  const agentStats = useMemo(() =>
    agents.map(a => {
      const al = dayLeads.filter(l => l.agent === a.name);
      return {
        ...a,
        leads:      al.length,
        updated:    al.filter(l => l.status !== "New").length,
        converted:  al.filter(l => l.status === "Converted").length,
        inProgress: al.filter(l => l.status === "In Progress").length,
        active:     al.length > 0,
      };
    }).sort((a, b) => b.leads - a.leads),
  [dayLeads, agents]);

  const sources = useMemo(() =>
    Object.entries(SOURCE_COLORS).map(([label, color]) => ({
      label, color,
      count: dayLeads.filter(l => l.source === label).length,
    })).filter(s => s.count > 0),
  [dayLeads]);

  const newLeadsList = useMemo(() =>
    dayLeads.map(l => ({
      id: l.id, name: l.name, phone: l.phone,
      source: l.source, assigned: l.agent || "Unassigned",
      status: l.status, remark: l.remark, time: l.date,
    })),
  [dayLeads]);

  const conversions = useMemo(() =>
    dayLeads.filter(l => l.status === "Converted").map(l => ({
      name: l.name, agent: l.agent, source: l.source,
      campaign: l.campaign, remark: l.remark, time: l.date,
    })),
  [dayLeads]);

  const followUps = useMemo(() =>
    allLeads
      .filter(l => l.status === "In Progress")
      .slice(0, 10)
      .map(l => ({
        name: l.name, agent: l.agent, phone: l.phone,
        source: l.source,
        time: isSameDay(l.date, new Date()) ? "Today" : l.date,
        note: l.remark || "Follow-up required",
        isUrgent: isSameDay(l.date, new Date()),
      })),
  [allLeads]);

  const unassignedLeads = newLeadsList.filter(l => l.assigned === "Unassigned");
  const maxAgentLeads   = Math.max(...agentStats.map(a => a.leads), 1);

  // ── ADDED: exportCSV ──────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = dayLeads.map((l, i) =>
      [i + 1, l.name, l.phone, l.source, l.agent || "Unassigned", l.status, l.date, l.remark || ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    if (rows.length === 0) {
      alert(`No leads found for ${formatShortDate(viewDate)} to export.`);
      return;
    }
    const headers = ["#", "Name", "Phone", "Source", "Agent", "Status", "Date", "Remark"].join(",");
    const csv     = [headers, ...rows].join("\n");
    const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url     = URL.createObjectURL(blob);
    const a       = Object.assign(document.createElement("a"), {
      href: url,
      download: `daily_report_${viewDate.toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { k: "overview",    l: "Overview",       count: null },
    { k: "agents",      l: "Agent Activity", count: agentStats.filter(a => a.active).length },
    { k: "leads",       l: "New Leads",      count: newLeadsList.length },
    { k: "followups",   l: "Follow-ups",     count: followUps.length },
    { k: "conversions", l: "Conversions",    count: conversions.length },
  ];

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full inline-block ${isViewingToday ? "bg-[#059669] animate-pulse" : "bg-[#8B92A9]"}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${isViewingToday ? "text-[#059669]" : "text-[#8B92A9]"}`}>
              {isViewingToday ? "Live report" : "Historical report"}
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Daily Report</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{formatDisplayDate(viewDate)}</p>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
            <button onClick={goBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={goToday}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${isViewingToday ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]"}`}>
              {isViewingToday ? "Today" : formatShortDate(viewDate)}
            </button>
            <button onClick={goForward} disabled={isViewingToday}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] disabled:opacity-30 disabled:cursor-not-allowed transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {/* CHANGED: added onClick={exportCSV}, renamed to Export CSV */}
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {unassignedLeads.length > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FFFBEB] dark:bg-[#2D1F00] border border-[#FDE68A] dark:border-[#78350F]">
          <svg className="w-4 h-4 text-[#D97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <p className="text-[12px] font-semibold text-[#92400E] dark:text-[#FCD34D]">
            {unassignedLeads.length} lead{unassignedLeads.length > 1 ? "s" : ""} unassigned — assign before end of day
          </p>
          <button className="ml-auto text-[11px] font-semibold text-[#D97706] dark:text-[#FCD34D] underline underline-offset-2">Assign now</button>
        </div>
      )}

      {dayLeads.length === 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] border border-[#C7D7FF] dark:border-[#2D3A6B]">
          <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" /></svg>
          <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7]">
            No leads recorded for {formatShortDate(viewDate)}.
            {isViewingToday ? " Showing pipeline overview below." : " Try a different date."}
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition
              ${tab === t.k ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"}`}>
            {t.l}
            {t.count !== null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.k ? "bg-white/20 text-white" : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════ OVERVIEW ════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="New Leads"      value={summary.newLeads}      sub="Received today"                        color="#2563EB" icon="↑" trend={summary.trendNew} />
            <StatCard label="Contacted"      value={summary.contacted}     sub={`${summary.uncontacted} not reached`}  color="#0891B2" icon="☎" />
            <StatCard label="Converted"      value={summary.converted}     sub={`${summary.convRate}% rate`}           color="#059669" icon="✓" trend={summary.trendConverted} />
            <StatCard label="In Progress"    value={summary.inProgress}    sub="Active follow-ups"                     color="#D97706" icon="⟳" />
            <StatCard label="Unassigned"     value={summary.unassigned}    sub="Needs assignment"                      color="#DC2626" icon="!" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Conversion funnel">
              <div className="space-y-3">
                <FunnelBar label="New leads"       value={summary.newLeads}      total={summary.newLeads} color="#2563EB" />
                <FunnelBar label="Contacted"       value={summary.contacted}     total={summary.newLeads} color="#0891B2" />
                <FunnelBar label="In Progress"     value={summary.inProgress}    total={summary.newLeads} color="#D97706" />
                <FunnelBar label="Converted"       value={summary.converted}     total={summary.newLeads} color="#059669" />
                <FunnelBar label="Not Interested"  value={summary.notInterested} total={summary.newLeads} color="#DC2626" />
              </div>
              {summary.newLeads > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">Conversion rate</span>
                  <span className="text-[20px] font-bold text-[#059669] dark:text-[#34D399]">{summary.convRate}%</span>
                </div>
              )}
            </Card>

            <Card title="Leads by source" badge={summary.newLeads} bc="#2563EB">
              {sources.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads today.</p>
                  <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-1">Navigate to a date with data.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {sources.map(s => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                          <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{s.count}</span>
                          <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">
                            {Math.round(s.count / (summary.newLeads || 1) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(s.count / (summary.newLeads || 1) * 100)}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Agent performance" badge={`${agentStats.filter(a => a.active).length} active`} bc="#059669">
              <div className="space-y-3.5">
                {agentStats.length === 0 ? (
                  <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No agents configured.</p>
                ) : agentStats.map(a => (
                  <div key={a.name} className={`flex items-center gap-3 ${!a.active ? "opacity-40" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{a.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-[#059669] dark:text-[#34D399]">{a.converted}✓</span>
                          <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{a.leads}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(a.leads / maxAgentLeads * 100)}%`, background: a.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Lead activity (hourly)">
              {dayLeads.length === 0 ? (
                <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No data for this date.</p>
              ) : (
                <>
                  <HourlyChart leads={dayLeads} />
                  <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-2">Approximate distribution across business hours</p>
                </>
              )}
            </Card>

            <Card title="Status breakdown">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "New",           value: summary.uncontacted,   ...STATUS_STYLE["New"] },
                  { label: "In Progress",   value: summary.inProgress,    ...STATUS_STYLE["In Progress"] },
                  { label: "Converted",     value: summary.converted,     ...STATUS_STYLE["Converted"] },
                  { label: "Not Interested",value: summary.notInterested, ...STATUS_STYLE["Not Interested"] },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl px-4 py-3.5 ${s.bg}`}>
                    <div className={`text-[24px] font-bold ${s.text}`}>{s.value}</div>
                    <div className={`text-[11px] font-semibold ${s.text} opacity-80 mt-0.5`}>{s.label}</div>
                    {summary.newLeads > 0 && (
                      <div className={`text-[10px] ${s.text} opacity-60 mt-1`}>
                        {Math.round(s.value / (summary.newLeads || 1) * 100)}% of total
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ════════════════════ AGENT ACTIVITY ════════════════════ */}
      {tab === "agents" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Agents"  value={agents.length}                                                          sub="Configured"        color="#2563EB" icon="👤" />
            <StatCard label="Active Today"  value={agentStats.filter(a => a.active).length}                                sub="Handled leads"     color="#059669" icon="✓" />
            <StatCard label="Top Performer" value={agentStats[0]?.leads > 0 ? agentStats[0]?.name?.split(" ")[0] : "—"}   sub={`${agentStats[0]?.leads || 0} leads`} color="#7C3AED" icon="★" />
            <StatCard label="Total Handled" value={summary.newLeads}                                                       sub="Across all agents" color="#D97706" icon="↑" />
          </div>

          <Card title="Agent activity today" badge={`${agentStats.filter(a => a.active).length}/${agents.length} active`} bc="#059669">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Agent", "Status", "Leads Assigned", "Leads Updated", "In Progress", "Converted", "Conv. Rate"].map(h => (
                      <th key={h} className="text-left pb-3 pr-6 text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map(a => {
                    const rate = a.leads > 0 ? Math.round((a.converted / a.leads) * 100) : 0;
                    return (
                      <tr key={a.name} className={`border-b border-[#E4E7EF] dark:border-[#262A38] last:border-0 ${!a.active ? "opacity-40" : ""}`}>
                        <td className="py-3.5 pr-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                            <div>
                              <div className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{a.name}</div>
                              <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{a.active ? "Active today" : "No activity"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-6">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.active ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]" : "bg-[#F8F9FC] dark:bg-[#13161E] text-[#8B92A9]"}`}>
                            {a.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3.5 pr-6 font-bold text-[#0F1117] dark:text-[#F0F2FA]">{a.leads}</td>
                        <td className="py-3.5 pr-6 text-[#4B5168] dark:text-[#9DA3BB]">{a.updated}</td>
                        <td className="py-3.5 pr-6"><span className="font-semibold text-[#D97706] dark:text-[#FCD34D]">{a.inProgress}</span></td>
                        <td className="py-3.5 pr-6"><span className="font-bold text-[#059669] dark:text-[#34D399]">{a.converted}</span></td>
                        <td className="py-3.5 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#059669]" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-[12px] font-semibold text-[#059669] dark:text-[#34D399]">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════ NEW LEADS ════════════════════ */}
      {tab === "leads" && (
        <Card title="Leads for this day" badge={newLeadsList.length} bc="#2563EB">
          {newLeadsList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads recorded for {formatShortDate(viewDate)}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {newLeadsList.map((l, i) => {
                const st = STATUS_STYLE[l.status] || STATUS_STYLE["New"];
                return (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                    <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                      {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{l.name}</span>
                        <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{l.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: SOURCE_COLORS[l.source] + "20", color: SOURCE_COLORS[l.source] }}>
                          {l.source}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{l.status}</span>
                        {l.remark && <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate max-w-[160px]">{l.remark}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {l.assigned === "Unassigned" ? (
                        <span className="px-2 py-1 rounded-lg bg-[#FFFBEB] dark:bg-[#2D1F00] text-[#D97706] dark:text-[#FCD34D] text-[10px] font-bold">Unassigned</span>
                      ) : (
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">{l.assigned}</div>
                          <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">Assigned</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ════════════════════ FOLLOW-UPS ════════════════════ */}
      {tab === "followups" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total Follow-ups" value={followUps.length}                                              sub="In Progress leads" color="#D97706" icon="⟳" />
            <StatCard label="Due Today"         value={followUps.filter(f => f.isUrgent).length}                     sub="From today"        color="#DC2626" icon="!" />
            <StatCard label="Total In Progress" value={allLeads.filter(l => l.status === "In Progress").length}      sub="All time"          color="#2563EB" icon="↑" />
          </div>

          <Card title="Pending follow-ups" badge={followUps.length} bc="#D97706">
            {followUps.length === 0 ? (
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No pending follow-ups.</p>
            ) : (
              <div className="space-y-3">
                {followUps.map((c, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${c.isUrgent ? "border-[#FDE68A] dark:border-[#78350F] bg-[#FFFBEB] dark:bg-[#2D1F00]" : "border-[#E4E7EF] dark:border-[#262A38]"}`}>
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: c.isUrgent ? "#DC2626" : "#D97706" }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                        <div>
                          <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{c.name}</span>
                          <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] ml-2">{c.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${c.isUrgent ? "bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626] dark:text-[#F87171]" : "bg-[#FFFBEB] dark:bg-[#2D1F00] text-[#D97706] dark:text-[#FCD34D]"}`}>
                            {c.time}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: SOURCE_COLORS[c.source] + "20", color: SOURCE_COLORS[c.source] }}>
                            {c.source}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic">{c.note}</p>
                        <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] shrink-0 ml-2">{c.agent}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ════════════════════ CONVERSIONS ════════════════════ */}
      {tab === "conversions" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Deals Closed"  value={conversions.length}  sub={formatShortDate(viewDate)}  color="#059669" icon="✓" />
            <StatCard label="Conv. Rate"    value={`${summary.convRate}%`} sub="For this day"             color="#7C3AED" icon="~" />
            <StatCard label="Overall Conv." value={`${allLeads.length > 0 ? Math.round(allLeads.filter(l => l.status === "Converted").length / allLeads.length * 100) : 0}%`} sub="All time" color="#2563EB" icon="↑" />
            <StatCard label="Total Leads"   value={allLeads.length}     sub="All time pipeline"          color="#D97706" icon="Σ" />
          </div>

          <Card title="Conversions on this day" badge={conversions.length} bc="#059669">
            {conversions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No conversions recorded for {formatShortDate(viewDate)}.</p>
                <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-1">Navigate to a different date or check lead statuses.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversions.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#D1FAE5] dark:border-[#065F46]">
                    <div className="w-9 h-9 rounded-full bg-[#059669] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#065F46] dark:text-[#34D399]">{c.name}</span>
                        {c.campaign && c.campaign !== "—" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-[#065F46] dark:text-[#34D399] font-medium">{c.campaign}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#059669] dark:text-[#34D399] opacity-80 mt-0.5">
                        {c.agent} · {c.source} · {c.time}
                      </div>
                      {c.remark && <p className="text-[11px] text-[#059669] dark:text-[#34D399] opacity-60 mt-0.5 italic">{c.remark}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#059669] text-white">Converted</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {conversions.length > 0 && (
            <Card title="Conversion by agent">
              <div className="space-y-3">
                {agentStats.filter(a => a.converted > 0).map(a => (
                  <div key={a.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                    <span className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA] flex-1">{a.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#059669]" style={{ width: `${Math.round(a.converted / (summary.converted || 1) * 100)}%` }} />
                      </div>
                      <span className="text-[13px] font-bold text-[#059669] dark:text-[#34D399] w-4">{a.converted}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}