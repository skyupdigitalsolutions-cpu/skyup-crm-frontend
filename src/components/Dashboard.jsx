import { useState, useMemo, useEffect, useRef } from "react";
import api from "../data/axiosConfig";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import UserManagement from "./UserMangement";
import AdminChat from "./Adminchat";
import LeadTimeline from "./LeadTimeLine";
import AdminAttendanceView from "./AdminAttendanceView";

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const match = dateStr.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const [, day, mon, yr] = match;
    return new Date(Number(yr), months[mon], parseInt(day, 10), 12);
  }
  return new Date(dateStr);
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function getRangeWindow(range) {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week": {
      const s = startOfDay(new Date());
      s.setDate(s.getDate() - 6);
      return { start: s, end: endOfDay(now) };
    }
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return { start: new Date(now.getFullYear(), q * 3, 1), end: endOfDay(now) };
    }
    default:
      return null;
  }
}

function filterByRange(leads, range) {
  const win = getRangeWindow(range);
  if (!win) return leads;
  return leads.filter((l) => {
    const d = parseDate(l.date);
    return d >= win.start && d <= win.end;
  });
}

function buildChartBuckets(leads, range) {
  const now = new Date();
  if (range === "today") {
    const hours = Array.from({ length: 8 }, (_, i) => 9 + i);
    return {
      labels: hours.map((h) => `${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`),
      new:    hours.map((h) => leads.filter((l) => parseDate(l.date).getHours() === h).length),
      conv:   hours.map((h) => leads.filter((l) => l.status === "Converted" && parseDate(l.date).getHours() === h).length),
    };
  }
  if (range === "week") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      labels: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i); return days[d.getDay()];
      }),
      new: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i);
        return leads.filter((l) => parseDate(l.date).toDateString() === d.toDateString()).length;
      }),
      conv: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i);
        return leads.filter((l) => l.status === "Converted" && parseDate(l.date).toDateString() === d.toDateString()).length;
      }),
    };
  }
  if (range === "month") {
    return {
      labels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
      new:    [1, 2, 3, 4].map((w) => leads.filter((l) => Math.ceil(parseDate(l.date).getDate() / 7) === w).length),
      conv:   [1, 2, 3, 4].map((w) => leads.filter((l) => l.status === "Converted" && Math.ceil(parseDate(l.date).getDate() / 7) === w).length),
    };
  }
  const q = Math.floor(now.getMonth() / 3);
  const months = [q * 3, q * 3 + 1, q * 3 + 2];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    labels: months.map((m) => MON[m]),
    new:    months.map((m) => leads.filter((l) => parseDate(l.date).getMonth() === m).length),
    conv:   months.map((m) => leads.filter((l) => l.status === "Converted" && parseDate(l.date).getMonth() === m).length),
  };
}

// ── Chart.js loader (loads script once globally) ──────────────────────────────
function useChartJS() {
  const [ready, setReady] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) { setReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

// ── Detect dark mode ──────────────────────────────────────────────────────────
function isDarkMode() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ── LineChart ─────────────────────────────────────────────────────────────────
function LineChart({ data1, data2, labels }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    const dark      = isDarkMode();
    const textColor = dark ? "#9DA3BB" : "#6B7280";
    const gridColor = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    const bgColor   = dark ? "#1A1D27" : "#ffffff";

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "New leads",
            data: data1,
            borderColor: "#2563EB",
            backgroundColor: "rgba(37,99,235,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2563EB",
            pointBorderColor: bgColor,
            pointBorderWidth: 2,
            borderWidth: 2,
          },
          {
            label: "Converted",
            data: data2,
            borderColor: "#16A34A",
            backgroundColor: "rgba(22,163,74,0.07)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#16A34A",
            pointBorderColor: bgColor,
            pointBorderWidth: 2,
            borderWidth: 2,
            borderDash: [5, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: dark ? "#1A1D27" : "#ffffff",
            titleColor: dark ? "#F0F2FA" : "#0F1117",
            bodyColor: dark ? "#9DA3BB" : "#6B7280",
            borderColor: dark ? "#262A38" : "#E5E7EB",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: textColor, font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false },
            ticks: {
              color: textColor,
              font: { size: 11 },
              stepSize: 1,
              callback: (v) => (Number.isInteger(v) ? v : ""),
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.data.labels = labels;
    chartRef.current.data.datasets[0].data = data1;
    chartRef.current.data.datasets[1].data = data2;
    chartRef.current.update();
  }, [data1, data2, labels]);

  return (
    <div style={{ position: "relative", width: "100%", height: 200 }}>
      <canvas ref={canvasRef} role="img" aria-label="Line chart of new and converted leads over time" />
    </div>
  );
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ segments }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const values  = segments.map((s) => s.value);
  const colors  = segments.map((s) => s.color);
  const total   = values.reduce((a, b) => a + b, 0);
  const allZero = total === 0;

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    const dark       = isDarkMode();
    const emptyColor = dark ? "#262A38" : "#E5E7EB";
    const borderCol  = dark ? "#1A1D27" : "#ffffff";

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: allZero ? ["No data"] : segments.map((s) => s.label),
        datasets: [{
          data: allZero ? [1] : values,
          backgroundColor: allZero ? [emptyColor] : colors,
          borderColor: borderCol,
          borderWidth: 3,
          hoverOffset: allZero ? 0 : 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !allZero,
            backgroundColor: dark ? "#1A1D27" : "#ffffff",
            titleColor: dark ? "#F0F2FA" : "#0F1117",
            bodyColor: dark ? "#9DA3BB" : "#6B7280",
            borderColor: dark ? "#262A38" : "#E5E7EB",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const dark       = isDarkMode();
    const emptyColor = dark ? "#262A38" : "#E5E7EB";
    chartRef.current.data.labels = allZero ? ["No data"] : segments.map((s) => s.label);
    chartRef.current.data.datasets[0].data = allZero ? [1] : values;
    chartRef.current.data.datasets[0].backgroundColor = allZero ? [emptyColor] : colors;
    chartRef.current.options.plugins.tooltip.enabled = !allZero;
    chartRef.current.update();
  }, [segments]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} role="img" aria-label="Donut chart showing pipeline status breakdown" />
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
// FIX: Each KPI type now has a distinct icon bg/color so cards are immediately
//      distinguishable at a glance, not just by label text.
const KPI_STYLES = {
  blue:   { icon: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",   trend: "text-green-600 dark:text-green-400" },
  green:  { icon: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400", trend: "text-green-600 dark:text-green-400" },
  amber:  { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400", trend: "text-green-600 dark:text-green-400" },
  red:    { icon: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",       trend: "text-red-600 dark:text-red-400" },
  purple: { icon: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400", trend: "text-green-600 dark:text-green-400" },
};

function KpiCard({ label, value, sub, up, icon, variant = "blue" }) {
  const s = KPI_STYLES[variant] || KPI_STYLES.blue;
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
          {label}
        </span>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.icon}`}>
          {icon}
        </span>
      </div>
      <div className="text-[30px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-2">
        {value}
      </div>
      {sub && (
        <div className={`text-[12px] font-medium flex items-center gap-1 ${up ? s.trend : "text-red-600 dark:text-red-400"}`}>
          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Range toggle button group ─────────────────────────────────────────────────
// FIX: Extracted as a component so it always renders consistently and the
//      active state is clearly visible with a white pill + shadow.
function RangeToggle({ range, onChange }) {
  const RANGES = { today: "Today", week: "Week", month: "Month", quarter: "Quarter" };
  return (
    <div className="flex items-center gap-1 bg-[#F3F4F6] dark:bg-[#13161E] border border-[#E5E7EB] dark:border-[#262A38] rounded-xl p-1">
      {Object.entries(RANGES).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${range === key
              ? "bg-white dark:bg-[#1A1D27] text-[#0F1117] dark:text-[#F0F2FA] shadow-sm"
              : "text-[#6B7280] dark:text-[#565C75] hover:text-[#374151] dark:hover:text-[#9DA3BB] hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="text-[12px] font-bold text-red-600 dark:text-red-400 underline underline-offset-2 shrink-0 hover:text-red-800 dark:hover:text-red-300 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
      </div>
    </div>
  );
}

// ── Refresh icon (spins while loading) ────────────────────────────────────────
function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconUsers    = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" /></svg>;
const IconCheck    = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconPct      = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const IconClock    = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconBuilding = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;

// ── Source color map ──────────────────────────────────────────────────────────
// FIX: Each source has a visually distinct, accessible color.
const SOURCE_COLORS = {
  "Google Ads":   "#2563EB",  // Blue
  "Campaign":     "#7C3AED",  // Purple
  "Facebook Ads": "#0891B2",  // Cyan
  "Web Form":     "#16A34A",  // Green  (was #059669, now higher contrast)
  "Referral":     "#D97706",  // Amber
};

const RANGE_LABELS = { today: "Today", week: "Week", month: "Month", quarter: "Quarter" };

// ── Pipeline status colors ────────────────────────────────────────────────────
// FIX: Stronger, more distinct colors for each pipeline stage.
const PIPELINE_SEGMENTS_CONFIG = [
  { key: "new",       label: "New",            color: "#2563EB" },  // Blue
  { key: "progress",  label: "In progress",    color: "#D97706" },  // Amber
  { key: "lost",      label: "Not interested", color: "#DC2626" },  // Red
  { key: "converted", label: "Converted",      color: "#16A34A" },  // Green
];

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [allLeads,    setAllLeads]    = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [dbAdmins,    setDbAdmins]    = useState([]);
  const [dbUsers,     setDbUsers]     = useState([]);
  const [companyPlan, setCompanyPlan] = useState("basic");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);   // FIX: separate spinner state for refresh button
  const [error,       setError]       = useState(null);
  const [range,       setRange]       = useState("week");
  const [superStats,  setSuperStats]  = useState(null);
  const [dashStats,   setDashStats]   = useState(null);

  const chartReady = useChartJS();
  const role        = getRole();
  const user        = getStoredUser();
  const isSuperAdmin = role === "superadmin";

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const loadData = (isRefresh = false) => {
    if (role === "user") { setLoading(false); return; }
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    fetchAll()
      .then(({ agents, leads, stats }) => {
        setAgents(agents || []);
        setAllLeads(leads || []);
        if (stats) setSuperStats(stats);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    if (role === "admin") {
      import("../data/axiosConfig").then(({ default: api }) => {
        Promise.all([
          api.get("/admin/"),
          api.get("/admin/company/users"),
          api.get("/admin/company/me"),
        ])
          .then(([adminsRes, usersRes, companyRes]) => {
            setDbAdmins(adminsRes.data || []);
            setDbUsers(usersRes.data || []);
            setCompanyPlan(companyRes.data?.plan || "basic");
          })
          .catch(() => {});
      });
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Fetch admin dashboard stats (quality + phone reveal) ─────────────────────
  useEffect(() => {
    api.get("/admin/dashboard-stats")
      .then(r => setDashStats(r.data))
      .catch(() => {});
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const leads = useMemo(() => filterByRange(allLeads, range), [allLeads, range]);

  const kpi = useMemo(() => {
    const allTotal   = allLeads.length;
    const converted  = allLeads.filter((l) => l.status === "Converted").length;
    const rangeTotal = leads.length;
    return {
      total:     allTotal,
      converted,
      rate:      `${allTotal > 0 ? Math.round((converted / allTotal) * 100) : 0}%`,
      rangeTotal,
    };
  }, [leads, allLeads]);

  const chart = useMemo(() => buildChartBuckets(leads, range), [leads, range]);

  const pipeline = useMemo(() => ({
    new:       leads.filter((l) => l.status === "New").length,
    progress:  leads.filter((l) => l.status === "In Progress").length,
    lost:      leads.filter((l) => l.status === "Not Interested").length,
    converted: leads.filter((l) => l.status === "Converted").length,
  }), [leads]);

  const agentStats = useMemo(
    () =>
      agents
        .map((a) => {
          const al = leads.filter((l) => l.agent === a.name);
          return { ...a, leads: al.length, conv: al.filter((l) => l.status === "Converted").length };
        })
        .sort((a, b) => b.leads - a.leads),
    [leads, agents]
  );

  const sourceStats = useMemo(() => {
    const total = leads.length || 1;
    return Object.entries(SOURCE_COLORS)
      .map(([label, color]) => ({
        label,
        color,
        count: leads.filter((l) => l.source === label).length,
        pct:   Math.round((leads.filter((l) => l.source === label).length / total) * 100),
      }))
      .filter((s) => s.pct > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [leads]);

  const activity = useMemo(
    () =>
      [...allLeads]
        .sort((a, b) => String(b.id).localeCompare(String(a.id)))
        .slice(0, 6)
        .map((l) => ({
          text: `${l.agent} · ${l.name} — ${l.status}`,
          time: l.date,
          dot:
            l.status === "Converted"      ? "#16A34A"
            : l.status === "In Progress"  ? "#D97706"
            : l.status === "Not Interested" ? "#DC2626"
            : "#2563EB",
        })),
    [allLeads]
  );

  const maxLeads = Math.max(...agentStats.map((a) => a.leads), 1);

  const pipelineSegs = PIPELINE_SEGMENTS_CONFIG.map((cfg) => ({
    label: cfg.label,
    color: cfg.color,
    value: pipeline[cfg.key],
  }));

  const pipelineTotal   = pipelineSegs.reduce((s, x) => s + x.value, 0);
  const uniqueSources   = [...new Set(allLeads.map((l) => l.source))].length;
  const uniqueCampaigns = [...new Set(allLeads.map((l) => l.campaign).filter((c) => c && c !== "—"))].length;

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Dashboard</h1>
            {/* FIX: SuperAdmin badge is purple, Admin is blue — clearly distinct */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                ${isSuperAdmin
                  ? "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400"
                  : "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                }`}
            >
              {isSuperAdmin ? "SuperAdmin" : "Admin"}
            </span>
          </div>
          <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">
            Welcome back, {user?.name || "Admin"} ·{" "}
            {isSuperAdmin
              ? `${superStats?.totalCompanies || 0} companies · ${allLeads.length} total leads`
              : `${allLeads.length} total leads · ${agents.length} users`}
          </p>
        </div>

        {/* FIX: Refresh button shows a spinner while refreshing so users know
               something is happening. Calls loadData(true) to avoid full skeleton flash. */}
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className={`p-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]
            text-[#6B7280] hover:text-[#2563EB] dark:hover:text-[#4F8EF7]
            hover:border-blue-300 dark:hover:border-blue-700
            transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${refreshing ? "opacity-60 cursor-not-allowed" : ""}`}
          title="Refresh data"
          aria-label="Refresh dashboard data"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && <ErrorBanner message={error} onRetry={() => loadData()} />}

      {/* ── SuperAdmin extra stats ── */}
      {isSuperAdmin && superStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Companies"  value={superStats.totalCompanies}  sub="Registered companies"   up icon={IconBuilding} variant="blue" />
          <KpiCard label="Active Companies" value={superStats.activeCompanies} sub="Currently active"       up icon={IconCheck}    variant="green" />
          <KpiCard label="Total Admins"     value={superStats.totalAdmins}     sub="Across all companies"   up icon={IconUsers}    variant="purple" />
          <KpiCard label="Total Users"      value={superStats.totalUsers}      sub="Across all companies"   up icon={IconUsers}    variant="amber" />
        </div>
      )}

      {/* ── KPI row ── */}
      {/* FIX: Each card has a distinct variant so colours are unique and
               identifiable — not all the same blue. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Leads"
          value={kpi.total.toLocaleString()}
          sub={`${kpi.rangeTotal} in selected range`}
          up
          icon={IconUsers}
          variant="blue"
        />
        <KpiCard
          label="Conversions"
          value={kpi.converted.toLocaleString()}
          sub={`${kpi.rate} conversion rate`}
          up={kpi.converted > 0}
          icon={IconCheck}
          variant="green"
        />
        <KpiCard
          label="Conv. Rate"
          value={kpi.rate}
          sub={`${pipeline.progress} in progress`}
          up={parseInt(kpi.rate, 10) >= 15}
          icon={IconPct}
          variant="amber"
        />
        <KpiCard
          label="Not Interested"
          value={pipeline.lost.toLocaleString()}
          sub="Review needed"
          up={false}
          icon={IconClock}
          variant="red"
        />
      </div>

      {/* ── Quality KPI row + Phone Reveal Stats ── */}
      {dashStats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="🔥 Hot Leads"
              value={dashStats.quality.hot.toLocaleString()}
              sub="All fields filled"
              up={dashStats.quality.hot > 0}
              icon={IconCheck}
              variant="red"
            />
            <KpiCard
              label="🌡 Warm Leads"
              value={dashStats.quality.warm.toLocaleString()}
              sub="Partially filled"
              up={dashStats.quality.warm > 0}
              icon={IconUsers}
              variant="amber"
            />
            <KpiCard
              label="👁 Phone Reveals"
              value={dashStats.phoneReveal.totalReveals.toLocaleString()}
              sub={`${dashStats.phoneReveal.leadsRevealed} leads viewed`}
              up={false}
              icon={IconClock}
              variant="purple"
            />
          </div>

          {dashStats.phoneReveal.topRevealed.length > 0 && (
            <div className="bg-white dark:bg-[#13161E] rounded-2xl p-5 shadow-sm border border-[#F0F2FA] dark:border-[#1E2130] mb-6">
              <h3 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">
                👁 Most Viewed Phone Numbers
              </h3>
              <div className="space-y-2">
                {dashStats.phoneReveal.topRevealed.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#F0F2FA] dark:border-[#1E2130] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#0F1117] dark:text-[#F0F2FA]">{item.name}</p>
                      <p className="text-[11px] text-[#8B92A9] font-mono">
                        {"•".repeat(Math.max(0, (item.mobile || "").length - 4)) + (item.mobile || "").slice(-4)}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      item.count >= 10 ? "bg-red-100 dark:bg-red-950/40 text-red-600"
                      : item.count >= 5 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600"
                      : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]"
                    }`}>
                      👁 {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* ── Leads over time ── */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            {/* Left: title + legend */}
            <div className="flex items-center gap-5 flex-wrap">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Leads over time</h2>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  <span className="w-3 h-1.5 rounded-full bg-[#2563EB] inline-block" />
                  New leads
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  {/* FIX: Green dashed legend for Converted — distinct from blue solid */}
                  <span
                    className="inline-block"
                    style={{ width: 14, height: 0, borderTop: "2px dashed #16A34A", verticalAlign: "middle" }}
                  />
                  Converted
                </span>
              </div>
            </div>

            {/* Right: range toggle — FIX: now a dedicated component with clear active state */}
            <RangeToggle range={range} onChange={setRange} />
          </div>

          {leads.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-[13px] text-[#6B7280] dark:text-[#565C75]">
              <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              No leads in this period
            </div>
          ) : chartReady ? (
            <LineChart data1={chart.new} data2={chart.conv} labels={chart.labels} />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[12px] text-[#6B7280] dark:text-[#565C75]">
              Loading chart…
            </div>
          )}
        </div>

        {/* ── Pipeline status ── */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-5">Pipeline status</h2>
          <div className="flex items-center gap-4">
            {/* FIX: Explicit pixel dimensions on wrapper — required so Chart.js renders */}
            <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
              {chartReady ? (
                <DonutChart segments={pipelineSegs} />
              ) : (
                <div className="w-full h-full rounded-full border-4 border-[#E5E7EB] dark:border-[#262A38]" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                  {pipelineTotal.toLocaleString()}
                </span>
                <span className="text-[9px] text-[#6B7280] dark:text-[#565C75] mt-0.5">total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3 flex-1">
              {pipelineSegs.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[11px] text-[#4B5563] dark:text-[#9DA3BB] flex-1 leading-none">{s.label}</span>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                    {s.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── User performance ── */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">
            {isSuperAdmin ? "Top users" : "User performance"}
          </h2>
          {agentStats.every((a) => a.leads === 0) ? (
            <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">No activity in this period.</p>
          ) : (
            <div className="space-y-4">
              {agentStats.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: a.color }}
                      >
                        {a.avatar}
                      </div>
                      <span className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                    </div>
                    {/* FIX: Conversion count shown with a green badge for visibility */}
                    <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
                      {a.conv} conv
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#F3F4F6] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((a.leads / maxLeads) * 100)}%`,
                          background: a.color,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#565C75] w-8 text-right tabular-nums">
                      {a.leads}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Leads by source ── */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Leads by source</h2>
          <div className="space-y-3">
            {sourceStats.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">No data for this period.</p>
            ) : (
              sourceStats.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[12px] text-[#4B5563] dark:text-[#9DA3BB]">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#6B7280] dark:text-[#565C75] tabular-nums">{s.count}</span>
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums w-8 text-right">
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#F3F4F6] dark:bg-[#262A38] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] dark:border-[#262A38] grid grid-cols-2 gap-3">
            {[
              { label: "Total leads",  value: allLeads.length },
              { label: "Active users", value: agents.length },
              { label: "Sources",      value: uniqueSources },
              { label: "Campaigns",    value: uniqueCampaigns },
            ].map((s) => (
              <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
                <div className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{s.value}</div>
                <div className="text-[10px] text-[#6B7280] dark:text-[#565C75] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent activity ── */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Recent activity</h2>
            {/* FIX: "Live" badge is now visually distinct with a pulsing green dot */}
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
          </div>
          <div className="space-y-0">
            {activity.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#565C75] py-4">No recent activity.</p>
            ) : (
              activity.map((a, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-3 border-b border-[#F3F4F6] dark:border-[#262A38] last:border-0"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: a.dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#4B5563] dark:text-[#9DA3BB] leading-snug truncate">{a.text}</p>
                    <span className="text-[10px] text-[#9CA3AF] dark:text-[#565C75] mt-0.5 block">{a.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Sub-components ── */}
      <AdminChat />
      <div className="mt-5 p-2">
        <AdminAttendanceView />
      </div>
      <UserManagement
        currentPlan={companyPlan}
        existingAdmins={dbAdmins}
        existingUsers={dbUsers}
      />
    </div>
  );
}