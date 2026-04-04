import { useState, useEffect, useMemo } from "react";
import api from "../data/axiosConfig";

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return new Date(NaN);
  const m = str.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (m) {
    const mo = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    return new Date(+m[3], mo[m[2]], +m[1], 12);
  }
  return new Date(str);
}
function isSameDay(str, ref) {
  const d = parseDate(str);
  return d.getDate()===ref.getDate() && d.getMonth()===ref.getMonth() && d.getFullYear()===ref.getFullYear();
}
function addDays(d, n) { const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtLong(d)  { return d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
function fmtShort(d) { return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function fmtISO(d)   { return d.toISOString().slice(0,10); }

// ── Styles ────────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  "New":            { bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]",   dot:"#2563EB" },
  "In Progress":    { bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]",   dot:"#D97706" },
  "Converted":      { bg:"bg-[#ECFDF5] dark:bg-[#052E1C]", text:"text-[#059669] dark:text-[#34D399]",   dot:"#059669" },
  "Not Interested": { bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]",   dot:"#DC2626" },
};
const TEMP_STYLE = {
  Hot:  { bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]", icon:"🔥" },
  Warm: { bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]", icon:"☀️" },
  Cold: { bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]", icon:"❄️" },
};
const SOURCE_COLORS = {
  "Google Ads":"#2563EB","Facebook Ads":"#0891B2","Web Form":"#059669",
  "Referral":"#D97706","Campaign":"#7C3AED","Other":"#8B92A9",
};

// ── Mini components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, trend }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px]" style={{background:color+"20"}}>{icon}</div>
      </div>
      <div className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1">{value}</div>
      {sub && <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-[11px] font-semibold mt-1 ${trend>=0?"text-[#059669]":"text-[#DC2626]"}`}>
          {trend>=0?"▲":"▼"} {Math.abs(trend)} vs yesterday
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["New"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:s.dot}}/>
      {status}
    </span>
  );
}

function TempBadge({ temp }) {
  if (!temp) return null;
  const s = TEMP_STYLE[temp];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {temp}
    </span>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value/total)*100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
          <span className="text-[10px] text-[#8B92A9] w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:color}}/>
      </div>
    </div>
  );
}

function Card({ title, badge, bc, children }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex-1">{title}</h2>
        {badge !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:(bc||"#2563EB")+"20",color:(bc||"#2563EB")}}>{badge}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Mini bar chart (7-day trend) ──────────────────────────────────────────────
function WeekChart({ allLeads, viewDate }) {
  const days = Array.from({length:7}, (_,i) => addDays(viewDate, i-6));
  const counts = days.map(d => allLeads.filter(l => isSameDay(l.date, d)).length);
  const max = Math.max(...counts, 1);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-20">
        {days.map((d, i) => {
          const isToday = isSameDay(d.toISOString(), viewDate);
          const h = Math.max(4, Math.round((counts[i]/max)*72));
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md transition-all duration-500"
                style={{height:`${h}px`, background: isToday ? "#2563EB" : "#BFDBFE"}}/>
              <span className="text-[9px] text-[#8B92A9] dark:text-[#565C75]">
                {d.toLocaleDateString("en-GB",{weekday:"short"}).slice(0,2)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-2">Last 7 days · highlighted = selected date</p>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F0F4FF] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3"/>
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8"/>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_,i)=><div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-28"/>)}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserDailyReport() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [allLeads,  setAllLeads]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [viewDate,  setViewDate]  = useState(new Date());
  const [activeTab, setActiveTab] = useState("overview");

  const isToday = isSameDay(viewDate.toISOString(), new Date());

  // ── Fetch user's own leads once ───────────────────────────────────────────
  useEffect(() => {
    api.get("/lead/my-leads")
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setAllLeads(raw.map(l => ({
          id:          String(l._id),
          name:        l.name        || "Unknown",
          phone:       l.mobile      || l.phone || "",
          source:      l.source      || "Other",
          campaign:    l.campaign    || "—",
          status:      l.status      || "New",
          temperature: l.temperature || null,
          remark:      l.remark      || "",
          date:        l.date
            ? new Date(l.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
            : "—",
          _raw:        l.date || l.createdAt || null,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Date nav ──────────────────────────────────────────────────────────────
  const goBack    = () => setViewDate(d => addDays(d, -1));
  const goForward = () => { if (!isToday) setViewDate(d => addDays(d, 1)); };
  const goToday   = () => setViewDate(new Date());

  // ── Filter leads for selected date ───────────────────────────────────────
  const dayLeads  = useMemo(() => allLeads.filter(l => isSameDay(l.date, viewDate)), [allLeads, viewDate]);
  const prevLeads = useMemo(() => allLeads.filter(l => isSameDay(l.date, addDays(viewDate,-1))), [allLeads, viewDate]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total       = dayLeads.length;
    const converted   = dayLeads.filter(l => l.status==="Converted").length;
    const inProgress  = dayLeads.filter(l => l.status==="In Progress").length;
    const notInt      = dayLeads.filter(l => l.status==="Not Interested").length;
    const newLeads    = dayLeads.filter(l => l.status==="New").length;
    const contacted   = dayLeads.filter(l => l.status!=="New").length;
    const hot         = dayLeads.filter(l => l.temperature==="Hot").length;
    const warm        = dayLeads.filter(l => l.temperature==="Warm").length;
    const cold        = dayLeads.filter(l => l.temperature==="Cold").length;
    const convRate    = total > 0 ? Math.round((converted/total)*100) : 0;
    const prevTotal   = prevLeads.length;
    const prevConv    = prevLeads.filter(l=>l.status==="Converted").length;
    return { total, converted, inProgress, notInt, newLeads, contacted, hot, warm, cold, convRate,
      trendTotal: total - prevTotal, trendConv: converted - prevConv };
  }, [dayLeads, prevLeads]);

  // ── Sources breakdown ─────────────────────────────────────────────────────
  const sources = useMemo(() =>
    Object.entries(SOURCE_COLORS).map(([label, color]) => ({
      label, color, count: dayLeads.filter(l => l.source === label).length,
    })).filter(s => s.count > 0)
  , [dayLeads]);

  // ── All-time follow-ups (In Progress) ─────────────────────────────────────
  const followUps = useMemo(() =>
    allLeads.filter(l => l.status === "In Progress").slice(0, 30)
  , [allLeads]);

  // ── Conversions for selected date ─────────────────────────────────────────
  const conversions = useMemo(() =>
    dayLeads.filter(l => l.status === "Converted")
  , [dayLeads]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Name","Phone","Source","Campaign","Status","Temperature","Date","Remark"];
    const rows = dayLeads.map(l =>
      [l.name, l.phone, l.source, l.campaign, l.status, l.temperature||"", l.date, l.remark.replace(/,/g,";")]
        .map(v => `"${v}"`).join(",")
    );
    if (!rows.length) { alert(`No leads for ${fmtShort(viewDate)}.`); return; }
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {type:"text/csv"});
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `my_daily_report_${fmtISO(viewDate)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const TABS = [
    { id:"overview",     label:"Overview",       count: null },
    { id:"leads",        label:"Today's Leads",  count: dayLeads.length },
    { id:"followups",    label:"Follow-ups",     count: followUps.length },
    { id:"conversions",  label:"Conversions",    count: conversions.length },
    { id:"trend",        label:"My Trend",       count: null },
  ];

  if (loading) return <Skeleton/>;

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] px-6 py-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${isToday ? "bg-[#059669] animate-pulse" : "bg-[#8B92A9]"}`}/>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#059669]" : "text-[#8B92A9]"}`}>
              {isToday ? "Live — today" : "Historical report"}
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">My Daily Report</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            {fmtLong(viewDate)} · <span className="font-semibold text-[#2563EB]">{user?.name || "Agent"}</span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date nav */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
            <button onClick={goBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={goToday}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${isToday ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]"}`}>
              {isToday ? "Today" : fmtShort(viewDate)}
            </button>
            <button onClick={goForward} disabled={isToday}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] disabled:opacity-30 disabled:cursor-not-allowed transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {/* Export */}
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Info banner if no leads ──────────────────────────────────────── */}
      {dayLeads.length === 0 && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] border border-[#C7D7FF] dark:border-[#2D3A6B]">
          <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/></svg>
          <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7]">
            No leads recorded for {fmtShort(viewDate)}.{" "}
            {isToday ? "New leads will appear here as you add them." : "Try navigating to another date."}
          </p>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Leads Today"    value={stats.total}      icon="📋" color="#2563EB" sub="Assigned to you"              trend={stats.trendTotal}/>
        <StatCard label="Converted"      value={stats.converted}  icon="✅" color="#059669" sub={`${stats.convRate}% rate`}     trend={stats.trendConv}/>
        <StatCard label="In Progress"    value={stats.inProgress} icon="⏳" color="#D97706" sub="Need follow-up"/>
        <StatCard label="Hot Leads 🔥"   value={stats.hot}        icon="🔥" color="#DC2626" sub={`${stats.warm} warm · ${stats.cold} cold`}/>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition ${
              activeTab===t.id ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"
            }`}>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab===t.id ? "bg-white/20 text-white" : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Conversion funnel */}
            <Card title="Conversion funnel">
              <div className="space-y-3">
                <FunnelBar label="Total leads"    value={stats.total}      total={stats.total} color="#2563EB"/>
                <FunnelBar label="Contacted"      value={stats.contacted}  total={stats.total} color="#0891B2"/>
                <FunnelBar label="In Progress"    value={stats.inProgress} total={stats.total} color="#D97706"/>
                <FunnelBar label="Converted"      value={stats.converted}  total={stats.total} color="#059669"/>
                <FunnelBar label="Not Interested" value={stats.notInt}     total={stats.total} color="#DC2626"/>
              </div>
              {stats.total > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">Conversion rate</span>
                  <span className="text-[22px] font-bold text-[#059669] dark:text-[#34D399]">{stats.convRate}%</span>
                </div>
              )}
            </Card>

            {/* Source breakdown */}
            <Card title="Leads by source" badge={stats.total} bc="#2563EB">
              {sources.length === 0 ? (
                <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] py-8 text-center">No leads for {fmtShort(viewDate)}.</p>
              ) : (
                <div className="space-y-3.5">
                  {sources.map(s => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}}/>
                          <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{s.count}</span>
                          <span className="text-[10px] text-[#8B92A9] w-8 text-right">{Math.round(s.count/(stats.total||1)*100)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${Math.round(s.count/(stats.total||1)*100)}%`,background:s.color}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Status breakdown */}
            <Card title="Status breakdown">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"New",          value:stats.newLeads,   ...STATUS_STYLE["New"]},
                  {label:"In Progress",  value:stats.inProgress, ...STATUS_STYLE["In Progress"]},
                  {label:"Converted",    value:stats.converted,  ...STATUS_STYLE["Converted"]},
                  {label:"Not Int.",     value:stats.notInt,     ...STATUS_STYLE["Not Interested"]},
                ].map(s => (
                  <div key={s.label} className={`rounded-xl px-4 py-3.5 ${s.bg}`}>
                    <div className={`text-[24px] font-bold ${s.text}`}>{s.value}</div>
                    <div className={`text-[11px] font-semibold ${s.text} opacity-80 mt-0.5`}>{s.label}</div>
                    {stats.total > 0 && (
                      <div className={`text-[10px] ${s.text} opacity-60 mt-0.5`}>{Math.round(s.value/(stats.total||1)*100)}%</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Temperature heatmap */}
          <Card title="Lead temperature — today">
            <div className="grid grid-cols-3 gap-4">
              {[
                {label:"Hot 🔥",  value:stats.hot,  bg:"bg-[#FEF2F2] dark:bg-[#2D0A0A]", text:"text-[#DC2626] dark:text-[#F87171]", bar:"#DC2626"},
                {label:"Warm ☀️", value:stats.warm, bg:"bg-[#FFFBEB] dark:bg-[#2D1F00]", text:"text-[#D97706] dark:text-[#FCD34D]", bar:"#D97706"},
                {label:"Cold ❄️", value:stats.cold, bg:"bg-[#EEF3FF] dark:bg-[#1A2540]", text:"text-[#2563EB] dark:text-[#4F8EF7]", bar:"#2563EB"},
              ].map(t => (
                <div key={t.label} className={`rounded-2xl p-4 text-center ${t.bg}`}>
                  <div className={`text-[30px] font-bold ${t.text}`}>{t.value}</div>
                  <div className={`text-[12px] font-semibold ${t.text} mt-1`}>{t.label}</div>
                  <div className="h-1.5 bg-white/40 dark:bg-black/20 rounded-full mt-3 overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${stats.total>0?Math.round(t.value/stats.total*100):0}%`,background:t.bar}}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════ TODAY'S LEADS ═══════════════════ */}
      {activeTab === "leads" && (
        <Card title={`Leads on ${fmtShort(viewDate)}`} badge={dayLeads.length} bc="#2563EB">
          {dayLeads.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-[40px] mb-3">📋</div>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads for {fmtShort(viewDate)}.</p>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-1">Try navigating to a different date.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayLeads.map((l, i) => (
                <div key={l.id||i}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                  <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                    {l.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{l.name}</span>
                      <span className="text-[11px] text-[#8B92A9] font-mono">{l.phone||"—"}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{background:(SOURCE_COLORS[l.source]||"#8B92A9")+"20",color:(SOURCE_COLORS[l.source]||"#8B92A9")}}>
                        {l.source}
                      </span>
                      <StatusBadge status={l.status}/>
                      {l.temperature && <TempBadge temp={l.temperature}/>}
                      {l.remark && <span className="text-[10px] text-[#8B92A9] italic truncate max-w-[180px]">{l.remark}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-[#8B92A9]">{l.campaign !== "—" ? l.campaign : ""}</div>
                    <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{l.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ═══════════════════ FOLLOW-UPS ═══════════════════ */}
      {activeTab === "followups" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total Follow-ups"  value={followUps.length}                        icon="⏳" color="#D97706" sub="In Progress leads"/>
            <StatCard label="Hot Follow-ups 🔥" value={followUps.filter(l=>l.temperature==="Hot").length} icon="🔥" color="#DC2626" sub="Call them now"/>
            <StatCard label="All-time In Progress" value={allLeads.filter(l=>l.status==="In Progress").length} icon="📌" color="#7C3AED" sub="Across all days"/>
          </div>

          <Card title="Pending follow-ups" badge={followUps.length} bc="#D97706">
            {followUps.length === 0 ? (
              <p className="text-[13px] text-center text-[#8B92A9] dark:text-[#565C75] py-10">No pending follow-ups. Great work! 🎉</p>
            ) : (
              <div className="space-y-2">
                {followUps.map((l, i) => {
                  const urgent = l.temperature === "Hot";
                  return (
                    <div key={l.id||i}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${urgent ? "border-[#FDE68A] dark:border-[#78350F] bg-[#FFFBEB] dark:bg-[#2D1F00]" : "border-[#E4E7EF] dark:border-[#262A38]"}`}>
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{background: urgent ? "#DC2626" : "#D97706"}}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{l.name}</span>
                            <span className="text-[11px] text-[#8B92A9] font-mono">{l.phone||"—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {l.temperature && <TempBadge temp={l.temperature}/>}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{background:(SOURCE_COLORS[l.source]||"#8B92A9")+"20",color:(SOURCE_COLORS[l.source]||"#8B92A9")}}>
                              {l.source}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic">
                            {l.remark || "Follow-up required"}
                          </p>
                          <span className="text-[10px] text-[#8B92A9] shrink-0 ml-2">{l.date}</span>
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

      {/* ═══════════════════ CONVERSIONS ═══════════════════ */}
      {activeTab === "conversions" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Today's Closures"  value={conversions.length}   icon="🏆" color="#059669" sub={fmtShort(viewDate)} trend={stats.trendConv}/>
            <StatCard label="Conv. Rate Today"  value={`${stats.convRate}%`} icon="📈" color="#7C3AED" sub="For selected day"/>
            <StatCard label="All-time Conv."    value={allLeads.filter(l=>l.status==="Converted").length} icon="✅" color="#2563EB" sub="Total converted"/>
            <StatCard label="All-time Rate"     value={`${allLeads.length>0?Math.round(allLeads.filter(l=>l.status==="Converted").length/allLeads.length*100):0}%`} icon="%" color="#D97706" sub="Overall"/>
          </div>

          <Card title={`Conversions on ${fmtShort(viewDate)}`} badge={conversions.length} bc="#059669">
            {conversions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="text-[40px] mb-3">🎯</div>
                <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No conversions on {fmtShort(viewDate)}.</p>
                <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-1">Try navigating to a different date.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversions.map((l, i) => (
                  <div key={l.id||i}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#D1FAE5] dark:border-[#065F46]">
                    <div className="w-9 h-9 rounded-full bg-[#059669] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {l.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[13px] font-semibold text-[#065F46] dark:text-[#34D399]">{l.name}</span>
                        {l.campaign !== "—" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-[#065F46] dark:text-[#34D399] font-medium">{l.campaign}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#059669] dark:text-[#34D399] opacity-80">
                        {l.source} · {l.phone||"—"} · {l.date}
                      </div>
                      {l.remark && <p className="text-[11px] text-[#059669] opacity-60 italic mt-0.5">{l.remark}</p>}
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#059669] text-white shrink-0">Converted</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════════════════ MY TREND ═══════════════════ */}
      {activeTab === "trend" && (
        <div className="space-y-5">
          {/* 7-day bar chart */}
          <Card title="7-day lead activity">
            <WeekChart allLeads={allLeads} viewDate={viewDate}/>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* All-time stats */}
            <Card title="All-time summary">
              <div className="space-y-3">
                {[
                  {label:"Total leads assigned", value:allLeads.length,                                          color:"#2563EB"},
                  {label:"Converted",             value:allLeads.filter(l=>l.status==="Converted").length,      color:"#059669"},
                  {label:"In Progress",           value:allLeads.filter(l=>l.status==="In Progress").length,   color:"#D97706"},
                  {label:"Not Interested",        value:allLeads.filter(l=>l.status==="Not Interested").length,color:"#DC2626"},
                  {label:"New (untouched)",        value:allLeads.filter(l=>l.status==="New").length,           color:"#7C3AED"},
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-[#F0F2FA] dark:border-[#1E2130] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}}/>
                      <span className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB]">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${allLeads.length>0?Math.round(s.value/allLeads.length*100):0}%`,background:s.color}}/>
                      </div>
                      <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] w-6 text-right">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                <span className="text-[12px] text-[#8B92A9]">Overall conversion rate</span>
                <span className="text-[22px] font-bold text-[#059669] dark:text-[#34D399]">
                  {allLeads.length>0?Math.round(allLeads.filter(l=>l.status==="Converted").length/allLeads.length*100):0}%
                </span>
              </div>
            </Card>

            {/* Hot leads pipeline */}
            <Card title="Hot leads — act now 🔥">
              {allLeads.filter(l=>l.temperature==="Hot" && l.status!=="Converted").length === 0 ? (
                <p className="text-[13px] text-center text-[#8B92A9] dark:text-[#565C75] py-10">No hot leads right now.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {allLeads.filter(l=>l.temperature==="Hot" && l.status!=="Converted").map((l,i) => (
                    <div key={l.id||i} className="flex items-center gap-3 p-3 rounded-xl bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]">
                      <span className="text-[18px]">🔥</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#DC2626] dark:text-[#F87171] truncate">{l.name}</p>
                        <p className="text-[10px] text-[#8B92A9] font-mono">{l.phone||"—"}</p>
                      </div>
                      <StatusBadge status={l.status}/>
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