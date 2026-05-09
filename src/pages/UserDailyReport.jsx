import { useState, useEffect, useMemo } from "react";
import api from "../data/axiosConfig";

// ── Date helpers ──────────────────────────────────────────────────────────────
// FIX 1: Use _raw (ISO string) for ALL date comparisons instead of the
//         formatted display string, which is locale-dependent and fragile.
function isSameDay(isoOrRaw, refDate) {
  if (!isoOrRaw) return false;
  const d = new Date(isoOrRaw);
  return (
    d.getDate()     === refDate.getDate()   &&
    d.getMonth()    === refDate.getMonth()  &&
    d.getFullYear() === refDate.getFullYear()
  );
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtLong(d)    { return d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" }); }
function fmtShort(d)   { return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); }

// ── Styles ────────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  "New":            { bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]", dot:"#2563EB" },
  "In Progress":    { bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]", dot:"#D97706" },
  "Converted":      { bg:"bg-[#ECFDF5] dark:bg-[#052E1C]", text:"text-[#059669] dark:text-[#34D399]", dot:"#059669" },
  "Not Interested": { bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]", dot:"#DC2626" },
};
const TEMP_STYLE = {
  Hot:  { bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]", icon:"" },
  Warm: { bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]", icon:"" },
  Cold: { bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]", icon:"" },
};
const SOURCE_COLORS = {
  "Google Ads":"#2563EB","Facebook Ads":"#0891B2","Web Form":"#059669",
  "Referral":"#D97706","Campaign":"#7C3AED","Other":"#F3F4F6",
};

// ── mapLead — stores _raw ISO for reliable date comparisons ──────────────────
// FIX 2: Keep _raw as the ISO date string from the server; use it everywhere
//         for isSameDay comparisons instead of the formatted display date.
function mapLead(l) {
  const rawDate = l.date || l.createdAt || null;
  return {
    id:       String(l._id),
    name:     l.name        || "Unknown",
    phone:    l.mobile      || l.phone || "",
    source:   l.source      || "Other",
    campaign: l.campaign    || "—",
    status:   l.status      || "New",
    // FIX 3: read Quality (backend field name) first, fall back to temperature
    quality:  l.Quality     || l.temperature || null,
    remark:   l.remark      || "",
    date:     rawDate
      ? new Date(rawDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
      : "—",
    _raw:     rawDate,   // ← ISO string used for all date math
  };
}

// ── Mini components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, trend }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#F3F4F6] dark:text-[#D1D5DB] uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px]" style={{ background: color + "20" }}>{icon}</div>
      </div>
      <div className="text-[28px] font-bold text-[#0F1117] dark:text-white leading-none mb-1">{value}</div>
      {sub && <div className="text-[11px] text-[#F3F4F6] dark:text-[#D1D5DB]">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-[11px] font-semibold mt-1 ${trend >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} vs yesterday
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["New"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

function TempBadge({ quality }) {
  if (!quality) return null;
  const s = TEMP_STYLE[quality];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {quality}
    </span>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#0F1117] dark:text-white">{value}</span>
          <span className="text-[10px] text-[#F3F4F6] w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Card({ title, badge, bc, children }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-white flex-1">{title}</h2>
        {badge !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: (bc || "#2563EB") + "20", color: bc || "#2563EB" }}>{badge}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── 7-day bar chart ───────────────────────────────────────────────────────────
// FIX 4: Use l._raw (ISO) for isSameDay comparisons, not l.date (display string).
//         Also fixed the "selected" highlight to correctly compare against viewDate.
function WeekChart({ allLeads, viewDate }) {
  const days   = Array.from({ length: 7 }, (_, i) => addDays(viewDate, i - 6));
  const counts = days.map(d => allLeads.filter(l => isSameDay(l._raw, d)).length);
  const max    = Math.max(...counts, 1);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-20">
        {days.map((d, i) => {
          // FIX 5: compare the chart day to viewDate by value, not by reference
          const isSelected =
            d.getDate()     === viewDate.getDate()   &&
            d.getMonth()    === viewDate.getMonth()  &&
            d.getFullYear() === viewDate.getFullYear();
          const h = Math.max(4, Math.round((counts[i] / max) * 72));
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md transition-all duration-500"
                style={{ height: `${h}px`, background: isSelected ? "#2563EB" : "#BFDBFE" }} />
              <span className="text-[9px] text-[#F3F4F6] dark:text-[#D1D5DB]">
                {d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[#F3F4F6] dark:text-[#D1D5DB] mt-2">Last 7 days · blue bar = selected date</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F0F4FF] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-28" />
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserDailyReport() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [allLeads, setAllLeads] = useState([]);
  const [loading,  setLoading]  = useState(true);
  // FIX 6: Added error state so fetch failures are visible to the user
  const [error,    setError]    = useState("");
  const [viewDate, setViewDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("overview");

  // FIX 7: isToday computed as a stable boolean from normalized midnight comparison
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      viewDate.getDate()     === today.getDate()   &&
      viewDate.getMonth()    === today.getMonth()  &&
      viewDate.getFullYear() === today.getFullYear()
    );
  }, [viewDate]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError("");
    api.get("/lead/my-leads")
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.leads || res.data?.data || []);
        setAllLeads(raw.map(mapLead));
      })
      .catch(() => setError("Failed to load your leads. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  // ── Date nav ──────────────────────────────────────────────────────────────
  const goBack    = () => setViewDate(d => addDays(d, -1));
  // FIX 8: Prevent navigating beyond today at the state level, not just the button
  const goForward = () => {
    setViewDate(d => {
      const next = addDays(d, 1);
      const today = new Date();
      // clamp to today
      return next > today ? today : next;
    });
  };
  const goToday   = () => setViewDate(new Date());

  // ── Filter for selected date — FIX 9: use l._raw not l.date ──────────────
  const dayLeads  = useMemo(
    () => allLeads.filter(l => isSameDay(l._raw, viewDate)),
    [allLeads, viewDate]
  );
  const prevLeads = useMemo(
    () => allLeads.filter(l => isSameDay(l._raw, addDays(viewDate, -1))),
    [allLeads, viewDate]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = dayLeads.length;
    const converted  = dayLeads.filter(l => l.status === "Converted").length;
    const inProgress = dayLeads.filter(l => l.status === "In Progress").length;
    const notInt     = dayLeads.filter(l => l.status === "Not Interested").length;
    const newLeads   = dayLeads.filter(l => l.status === "New").length;
    const contacted  = dayLeads.filter(l => l.status !== "New").length;
    const hot        = dayLeads.filter(l => l.quality === "Hot").length;
    const warm       = dayLeads.filter(l => l.quality === "Warm").length;
    const cold       = dayLeads.filter(l => l.quality === "Cold").length;
    const convRate   = total > 0 ? Math.round((converted / total) * 100) : 0;
    const prevTotal  = prevLeads.length;
    const prevConv   = prevLeads.filter(l => l.status === "Converted").length;
    return { total, converted, inProgress, notInt, newLeads, contacted,
             hot, warm, cold, convRate,
             trendTotal: total - prevTotal, trendConv: converted - prevConv };
  }, [dayLeads, prevLeads]);

  // ── Sources ───────────────────────────────────────────────────────────────
  const sources = useMemo(() =>
    Object.entries(SOURCE_COLORS).map(([label, color]) => ({
      label, color,
      count: dayLeads.filter(l => l.source === label).length,
    })).filter(s => s.count > 0),
  [dayLeads]);

  // ── Follow-ups & conversions ──────────────────────────────────────────────
  const followUps   = useMemo(() => allLeads.filter(l => l.status === "In Progress").slice(0, 30), [allLeads]);
  const conversions = useMemo(() => dayLeads.filter(l => l.status === "Converted"), [dayLeads]);

  const TABS = [
    { id:"overview",    label:"Overview",      count: null },
    { id:"leads",       label:"Today's leads", count: dayLeads.length },
    { id:"followups",   label:"Follow-ups",    count: followUps.length },
    { id:"conversions", label:"Conversions",   count: conversions.length },
    { id:"trend",       label:"My trend",      count: null },
  ];

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] px-6 py-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${isToday ? "bg-[#059669] animate-pulse" : "bg-[#F3F4F6]"}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#059669]" : "text-[#F3F4F6]"}`}>
              {isToday ? "Live — today" : "Historical report"}
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-white">My Daily Report</h1>
          <p className="text-[13px] text-[#F3F4F6] dark:text-[#D1D5DB] mt-0.5">
            {fmtLong(viewDate)} · <span className="font-semibold text-[#2563EB]">{user?.name || "Agent"}</span>
          </p>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
          <button onClick={goBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#E5E7EB] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${isToday ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]"}`}>
            {isToday ? "Today" : fmtShort(viewDate)}
          </button>
          {/* FIX 10: Forward button disabled when isToday */}
          <button onClick={goForward} disabled={isToday}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* FIX 11: Show fetch error prominently */}
      {error && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button
            onClick={() => { setError(""); setLoading(true); api.get("/lead/my-leads").then(res => { const raw = Array.isArray(res.data) ? res.data : (res?.data?.leads || res?.data?.data || []); setAllLeads(raw.map(mapLead)); }).catch(() => setError("Failed to load your leads. Please refresh.")).finally(() => setLoading(false)); }}
            className="text-red-600 dark:text-red-400 underline underline-offset-2 text-[11px] font-semibold whitespace-nowrap">
            Retry
          </button>
        </div>
      )}

      {/* ── No leads banner ─────────────────────────────────────────────── */}
      {!error && dayLeads.length === 0 && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] border border-[#C7D7FF] dark:border-[#2D3A6B]">
          <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7]">
            No leads recorded for {fmtShort(viewDate)}.{" "}
            {isToday ? "New leads will appear here as you add them." : "Try navigating to another date."}
          </p>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Leads today"  value={stats.total}      icon="" color="#2563EB" sub="Assigned to you"                          trend={stats.trendTotal} />
        <StatCard label="Converted"    value={stats.converted}  icon="" color="#059669" sub={`${stats.convRate}% conv. rate`}           trend={stats.trendConv} />
        <StatCard label="In progress"  value={stats.inProgress} icon="" color="#D97706" sub="Need follow-up" />
        <StatCard label="Hot leads"    value={stats.hot}        icon="" color="#DC2626" sub={`${stats.warm} warm · ${stats.cold} cold`} />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition ${
              activeTab === t.id ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"
            }`}>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === t.id ? "bg-white/20 text-white" : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            <Card title="Conversion funnel">
              <div className="space-y-3">
                <FunnelBar label="Total leads"    value={stats.total}      total={stats.total} color="#2563EB" />
                <FunnelBar label="Contacted"      value={stats.contacted}  total={stats.total} color="#0891B2" />
                <FunnelBar label="In progress"    value={stats.inProgress} total={stats.total} color="#D97706" />
                <FunnelBar label="Converted"      value={stats.converted}  total={stats.total} color="#059669" />
                <FunnelBar label="Not interested" value={stats.notInt}     total={stats.total} color="#DC2626" />
              </div>
              {stats.total > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                  <span className="text-[12px] text-[#F3F4F6]">Conversion rate</span>
                  <span className="text-[22px] font-bold text-[#059669] dark:text-[#34D399]">{stats.convRate}%</span>
                </div>
              )}
            </Card>

            <Card title="Leads by source" badge={stats.total} bc="#2563EB">
              {sources.length === 0 ? (
                <p className="text-[13px] text-[#F3F4F6] dark:text-[#D1D5DB] py-8 text-center">No leads for {fmtShort(viewDate)}.</p>
              ) : (
                <div className="space-y-3.5">
                  {sources.map(s => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                          <span className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB]">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#0F1117] dark:text-white">{s.count}</span>
                          <span className="text-[10px] text-[#F3F4F6] w-8 text-right">
                            {Math.round(s.count / (stats.total || 1) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.round(s.count / (stats.total || 1) * 100)}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Status breakdown">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:"New",         value:stats.newLeads,   ...STATUS_STYLE["New"] },
                  { label:"In progress", value:stats.inProgress, ...STATUS_STYLE["In Progress"] },
                  { label:"Converted",   value:stats.converted,  ...STATUS_STYLE["Converted"] },
                  { label:"Not int.",    value:stats.notInt,     ...STATUS_STYLE["Not Interested"] },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl px-4 py-3.5 ${s.bg}`}>
                    <div className={`text-[24px] font-bold ${s.text}`}>{s.value}</div>
                    <div className={`text-[11px] font-semibold ${s.text} opacity-80 mt-0.5`}>{s.label}</div>
                    {stats.total > 0 && (
                      <div className={`text-[10px] ${s.text} opacity-60 mt-0.5`}>
                        {Math.round(s.value / (stats.total || 1) * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quality heatmap */}
          <Card title="Lead quality — today">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:"Hot",  value:stats.hot,  bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]", bar:"#DC2626" },
                { label:"Warm", value:stats.warm, bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]", bar:"#D97706" },
                { label:"Cold", value:stats.cold, bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]", bar:"#2563EB" },
              ].map(t => (
                <div key={t.label} className={`rounded-2xl p-4 text-center ${t.bg}`}>
                  <div className={`text-[30px] font-bold ${t.text}`}>{t.value}</div>
                  <div className={`text-[12px] font-semibold ${t.text} mt-1`}>{t.label}</div>
                  <div className="h-1.5 bg-white/40 dark:bg-black/20 rounded-full mt-3 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${stats.total > 0 ? Math.round(t.value / stats.total * 100) : 0}%`, background: t.bar }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ TODAY'S LEADS ═══ */}
      {activeTab === "leads" && (
        <Card title={`Leads on ${fmtShort(viewDate)}`} badge={dayLeads.length} bc="#2563EB">
          {dayLeads.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-[40px] mb-3"></div>
              <p className="text-[13px] text-[#F3F4F6] dark:text-[#D1D5DB]">No leads for {fmtShort(viewDate)}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayLeads.map((l, i) => (
                <div key={l.id || i}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                  <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                    {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-semibold text-[#0F1117] dark:text-white">{l.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: (SOURCE_COLORS[l.source] || "#F3F4F6") + "20", color: SOURCE_COLORS[l.source] || "#F3F4F6" }}>
                        {l.source}
                      </span>
                      <StatusBadge status={l.status} />
                      <TempBadge quality={l.quality} />
                      {l.remark && <span className="text-[10px] text-[#F3F4F6] italic truncate max-w-[180px]">{l.remark}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-[#F3F4F6] dark:text-[#D1D5DB]">{l.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ═══ FOLLOW-UPS ═══ */}
      {activeTab === "followups" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total follow-ups"     value={followUps.length}                                    icon="" color="#D97706" sub="In progress leads" />
            <StatCard label="Hot follow-ups"        value={followUps.filter(l => l.quality === "Hot").length}  icon="" color="#DC2626" sub="Call them now" />
            <StatCard label="All-time in progress" value={allLeads.filter(l => l.status === "In Progress").length} icon="" color="#7C3AED" sub="Across all days" />
          </div>

          <Card title="Pending follow-ups" badge={followUps.length} bc="#D97706">
            {followUps.length === 0 ? (
              <p className="text-[13px] text-center text-[#F3F4F6] dark:text-[#D1D5DB] py-10">No pending follow-ups. Great work! 🎉</p>
            ) : (
              <div className="space-y-2">
                {followUps.map((l, i) => {
                  const urgent = l.quality === "Hot";
                  return (
                    <div key={l.id || i}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${urgent ? "border-[#FDE68A] dark:border-[#78350F] bg-[#FFFBEB] dark:bg-[#2D1F00]" : "border-[#E4E7EF] dark:border-[#262A38]"}`}>
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: urgent ? "#DC2626" : "#D97706" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#0F1117] dark:text-white">{l.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TempBadge quality={l.quality} />
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: (SOURCE_COLORS[l.source] || "#F3F4F6") + "20", color: SOURCE_COLORS[l.source] || "#F3F4F6" }}>
                              {l.source}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB] italic">{l.remark || "Follow-up required"}</p>
                          <span className="text-[12px] text-[#F3F4F6] shrink-0 ml-2">{l.date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ CONVERSIONS ═══ */}
      {activeTab === "conversions" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Today's closures"  value={conversions.length}   icon="" color="#059669" sub={fmtShort(viewDate)}  trend={stats.trendConv} />
            <StatCard label="Conv. rate today"  value={`${stats.convRate}%`} icon="" color="#7C3AED" sub="For selected day" />
            <StatCard label="All-time conv."    value={allLeads.filter(l => l.status === "Converted").length} icon="" color="#2563EB" sub="Total converted" />
            <StatCard label="All-time rate"
              value={`${allLeads.length > 0 ? Math.round(allLeads.filter(l => l.status === "Converted").length / allLeads.length * 100) : 0}%`}
              icon="%" color="#D97706" sub="Overall" />
          </div>

          <Card title={`Conversions on ${fmtShort(viewDate)}`} badge={conversions.length} bc="#059669">
            {conversions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="text-[40px] mb-3"></div>
                <p className="text-[14px] text-[#F3F4F6] dark:text-[#D1D5DB]">No conversions on {fmtShort(viewDate)}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversions.map((l, i) => (
                  <div key={l.id || i}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#D1FAE5] dark:border-[#065F46]">
                    <div className="w-9 h-9 rounded-full bg-[#059669] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[14px] font-semibold text-[#065F46] dark:text-[#34D399]">{l.name}</span>
                        {l.campaign !== "—" && (
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-[#065F46] dark:text-[#34D399] font-medium">{l.campaign}</span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#059669] dark:text-[#34D399] opacity-80">
                        {l.source} · {l.date}
                      </div>
                      {l.remark && <p className="text-[12px] text-[#059669] opacity-60 italic mt-0.5">{l.remark}</p>}
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[12px] font-bold bg-[#059669] text-white shrink-0">Converted</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ MY TREND ═══ */}
      {activeTab === "trend" && (
        <div className="space-y-5">
          <Card title="7-day lead activity">
            <WeekChart allLeads={allLeads} viewDate={viewDate} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="All-time summary">
              <div className="space-y-3">
                {[
                  { label:"Total leads assigned",  value:allLeads.length,                                                color:"#2563EB" },
                  { label:"Converted",              value:allLeads.filter(l => l.status === "Converted").length,          color:"#059669" },
                  { label:"In progress",            value:allLeads.filter(l => l.status === "In Progress").length,        color:"#D97706" },
                  { label:"Not interested",         value:allLeads.filter(l => l.status === "Not Interested").length,     color:"#DC2626" },
                  { label:"New (untouched)",         value:allLeads.filter(l => l.status === "New").length,               color:"#7C3AED" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-white dark:border-[#1E2130] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[14px] text-[#4B5168] dark:text-[#E5E7EB]">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${allLeads.length > 0 ? Math.round(s.value / allLeads.length * 100) : 0}%`, background: s.color }} />
                      </div>
                      <span className="text-[14px] font-bold text-[#0F1117] dark:text-white w-6 text-right">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                <span className="text-[14px] text-[#F3F4F6]">Overall conversion rate</span>
                <span className="text-[22px] font-bold text-[#059669] dark:text-[#34D399]">
                  {allLeads.length > 0 ? Math.round(allLeads.filter(l => l.status === "Converted").length / allLeads.length * 100) : 0}%
                </span>
              </div>
            </Card>

            {/* Hot leads pipeline */}
            <Card title="Hot leads — act now ">
              {allLeads.filter(l => l.quality === "Hot" && l.status !== "Converted").length === 0 ? (
                <p className="text-[14px] text-center text-[#F3F4F6] dark:text-[#D1D5DB] py-10">No hot leads right now.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {allLeads
                    .filter(l => l.quality === "Hot" && l.status !== "Converted")
                    .map((l, i) => (
                      <div key={l.id || i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]">
                        <span className="text-[18px]"></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-[#DC2626] dark:text-[#F87171] truncate">{l.name}</p>
                          <p className="text-[14px] text-[#F3F4F6]">{l.source}</p>
                        </div>
                        <StatusBadge status={l.status} />
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}
