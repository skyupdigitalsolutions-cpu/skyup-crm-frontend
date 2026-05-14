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

// ── Chart.js loader ───────────────────────────────────────────────────────────
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

// ── Modal Overlay ─────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children, accentColor = "#2563EB" }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-2xl max-h-[85vh] flex flex-col
          bg-white dark:bg-[#13161E]
          rounded-t-3xl sm:rounded-2xl
          border border-[#E5E7EB] dark:border-[#262A38]
          shadow-2xl overflow-hidden
          animate-in"
        style={{
          animation: "slideUp 0.22s cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: accentColor }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</h2>
            {subtitle && (
              <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl
              text-[#6B7280] dark:text-[#565C75]
              hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D27]
              hover:text-[#0F1117] dark:hover:text-[#F0F2FA]
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 overscroll-contain">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Phone Reveal Modal ────────────────────────────────────────────────────────
function PhoneRevealModal({ open, onClose, data }) {
  if (!data) return null;
  const { topRevealed = [], totalReveals = 0, leadsRevealed = 0 } = data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="👁 Phone Number Reveals"
      subtitle={`${totalReveals} total reveals · ${leadsRevealed} unique leads viewed`}
      accentColor="#7C3AED"
    >
      {topRevealed.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3"></div>
          <p className="text-[14px] text-[#6B7280] dark:text-[#565C75]">No phone reveals recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="flex items-center justify-between px-3 pb-1 mb-1 border-b border-[#F0F2FA] dark:border-[#1E2130]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Lead</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Views</span>
          </div>

          {topRevealed.map((item, i) => {
            const heat =
              item.count >= 10 ? { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", bar: "#DC2626", label: "High" }
              : item.count >= 5  ? { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", bar: "#D97706", label: "Med" }
              : { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", bar: "#2563EB", label: "Low" };

            const maxCount = Math.max(...topRevealed.map((x) => x.count), 1);
            const pct = Math.round((item.count / maxCount) * 100);

            return (
              <div
                key={i}
                className="group flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#F8F9FC] dark:hover:bg-[#1A1D27] transition-colors"
              >
                {/* Rank */}
                <span className="w-6 text-[12px] font-bold text-[#9CA3AF] dark:text-[#565C75] shrink-0 tabular-nums text-center">
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#8B92A9] font-mono mt-0.5">
                    {"•".repeat(Math.max(0, (item.mobile || "").length - 4))}
                    {(item.mobile || "").slice(-4)}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden w-full">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: heat.bar }}
                    />
                  </div>
                </div>

                {/* Badge */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full ${heat.bg} ${heat.text}`}>
                    👁 {item.count}
                  </span>
                  <span className={`text-[10px] font-medium ${heat.text}`}>{heat.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Leads Detail Modal (Hot / Warm) ───────────────────────────────────────────
function LeadsDetailModal({ open, onClose, title, leads, accentColor, emptyEmoji }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(q) ||
        (l.agent || "").toLowerCase().includes(q) ||
        (l.status || "").toLowerCase().includes(q) ||
        (l.source || "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const statusColors = {
    "Converted":      { bg: "bg-green-50 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-400",  dot: "#16A34A" },
    "In Progress":    { bg: "bg-amber-50 dark:bg-amber-950/40",   text: "text-amber-700 dark:text-amber-400",  dot: "#D97706" },
    "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",       text: "text-red-700 dark:text-red-400",      dot: "#DC2626" },
    "New":            { bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-700 dark:text-blue-400",    dot: "#2563EB" },
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={`${leads.length} leads total${filtered.length !== leads.length ? ` · ${filtered.length} shown` : ""}`}
      accentColor={accentColor}
    >
      {/* Search */}
      {leads.length > 5 && (
        <div className="mb-4 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] dark:text-[#565C75] pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, agent, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px]
              bg-[#F8F9FC] dark:bg-[#1A1D27]
              border border-[#E5E7EB] dark:border-[#262A38]
              text-[#0F1117] dark:text-[#F0F2FA]
              placeholder:text-[#9CA3AF] dark:placeholder:text-[#565C75]
              focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
              transition-colors"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3">{emptyEmoji || ""}</div>
          <p className="text-[14px] text-[#6B7280] dark:text-[#565C75]">
            {search ? "No leads match your search." : "No leads found."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead, i) => {
            const sc = statusColors[lead.status] || statusColors["New"];
            return (
              <div
                key={lead.id || i}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl
                  bg-[#F8F9FC] dark:bg-[#1A1D27]
                  border border-[#E5E7EB] dark:border-[#262A38]
                  hover:border-blue-300 dark:hover:border-blue-800
                  transition-colors group"
              >
                {/* Avatar / initials */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                  style={{ background: accentColor }}
                >
                  {(lead.name || "?").charAt(0).toUpperCase()}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                      {lead.name || "—"}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: sc.dot }} />
                      {lead.status || "Unknown"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {/* Assigned to */}
                    <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium text-[#374151] dark:text-[#9DA3BB]">
                        {lead.agent || "Unassigned"}
                      </span>
                    </span>

                    {/* Source */}
                    {lead.source && (
                      <span className="text-[11px] text-[#9CA3AF] dark:text-[#565C75]">
                        · {lead.source}
                      </span>
                    )}

                    {/* Date */}
                    {lead.date && (
                      <span className="text-[11px] text-[#9CA3AF] dark:text-[#565C75]">
                        · {lead.date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile number (masked) */}
                {lead.mobile && (
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-mono text-[#9CA3AF] dark:text-[#565C75]">
                      {"•".repeat(Math.max(0, lead.mobile.length - 4))}
                      {lead.mobile.slice(-4)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
const KPI_STYLES = {
  blue:   { icon: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",     trend: "text-green-600 dark:text-green-400" },
  green:  { icon: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400", trend: "text-green-600 dark:text-green-400" },
  amber:  { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400", trend: "text-green-600 dark:text-green-400" },
  red:    { icon: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",         trend: "text-red-600 dark:text-red-400" },
  purple: { icon: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400", trend: "text-green-600 dark:text-green-400" },
};

function KpiCard({ label, value, sub, up, icon, variant = "blue", onClick, clickable }) {
  const s = KPI_STYLES[variant] || KPI_STYLES.blue;
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5 transition-all
        ${clickable
          ? "cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 hover:-translate-y-0.5 active:translate-y-0 select-none group"
          : "hover:shadow-md"
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {clickable && (
            <span className="text-[9px] font-semibold text-[#9CA3AF] dark:text-[#565C75] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              View
            </span>
          )}
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.icon} ${clickable ? "group-hover:scale-110 transition-transform" : ""}`}>
            {icon}
          </span>
        </div>
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
          {clickable && (
            <svg className="w-3 h-3 ml-auto text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

// ── Range toggle ──────────────────────────────────────────────────────────────
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

// ── Refresh icon ──────────────────────────────────────────────────────────────
function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${spinning ? "animate-spin" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
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
const IconEye      = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;

// ── Source & pipeline colors ──────────────────────────────────────────────────
const SOURCE_COLORS = {
  "Google Ads":   "#2563EB",
  "Campaign":     "#7C3AED",
  "Facebook Ads": "#0891B2",
  "Web Form":     "#16A34A",
  "Referral":     "#D97706",
};

const PIPELINE_SEGMENTS_CONFIG = [
  { key: "new",       label: "New",            color: "#2563EB" },
  { key: "progress",  label: "In progress",    color: "#D97706" },
  { key: "lost",      label: "Not interested", color: "#DC2626" },
  { key: "converted", label: "Converted",      color: "#16A34A" },
];

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [allLeads,    setAllLeads]    = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [dbAdmins,    setDbAdmins]    = useState([]);
  const [dbUsers,     setDbUsers]     = useState([]);
  const [companyPlan, setCompanyPlan] = useState("basic");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [range,       setRange]       = useState("week");
  const [superStats,  setSuperStats]  = useState(null);
  const [dashStats,   setDashStats]   = useState(null);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [phoneModal, setPhoneModal] = useState(false);
  const [hotModal,   setHotModal]   = useState(false);
  const [warmModal,  setWarmModal]  = useState(false);

  const chartReady = useChartJS();
  const role        = getRole();
  const user        = getStoredUser();
  const isSuperAdmin = role === "superadmin";

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const loadData = (isRefresh = false) => {
    if (role === "user") { setLoading(false); return; }
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
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
      total: allTotal,
      converted,
      rate: `${allTotal > 0 ? Math.round((converted / allTotal) * 100) : 0}%`,
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
        label, color,
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
            l.status === "Converted"        ? "#16A34A"
            : l.status === "In Progress"    ? "#D97706"
            : l.status === "Not Interested" ? "#DC2626"
            : "#2563EB",
        })),
    [allLeads]
  );

  // ── Hot / Warm lead lists derived from allLeads ───────────────────────────
  // "Hot" = quality.hot from dashStats; we derive the actual lead list locally
  // as a reasonable approximation (all major fields filled).
  const hotLeads = useMemo(
    () =>
      allLeads.filter(
        (l) => l.name && l.mobile && l.email && l.source && l.agent && l.status
      ),
    [allLeads]
  );

  const warmLeads = useMemo(
    () =>
      allLeads.filter((l) => {
        const filled = [l.name, l.mobile, l.email, l.source, l.agent, l.status].filter(Boolean).length;
        return filled >= 3 && filled < 6;
      }),
    [allLeads]
  );

  const maxLeads          = Math.max(...agentStats.map((a) => a.leads), 1);
  const pipelineSegs      = PIPELINE_SEGMENTS_CONFIG.map((cfg) => ({ label: cfg.label, color: cfg.color, value: pipeline[cfg.key] }));
  const pipelineTotal     = pipelineSegs.reduce((s, x) => s + x.value, 0);
  const uniqueSources     = [...new Set(allLeads.map((l) => l.source))].length;
  const uniqueCampaigns   = [...new Set(allLeads.map((l) => l.campaign).filter((c) => c && c !== "—"))].length;

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Dashboard</h1>
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
          <KpiCard label="Total Companies"  value={superStats.totalCompanies}  sub="Registered companies" up icon={IconBuilding} variant="blue" />
          <KpiCard label="Active Companies" value={superStats.activeCompanies} sub="Currently active"     up icon={IconCheck}    variant="green" />
          <KpiCard label="Total Admins"     value={superStats.totalAdmins}     sub="Across all companies" up icon={IconUsers}    variant="purple" />
          <KpiCard label="Total Users"      value={superStats.totalUsers}      sub="Across all companies" up icon={IconUsers}    variant="amber" />
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Leads"    value={kpi.total.toLocaleString()}     sub={`${kpi.rangeTotal} in selected range`} up icon={IconUsers} variant="blue" />
        <KpiCard label="Conversions"    value={kpi.converted.toLocaleString()} sub={`${kpi.rate} conversion rate`}        up={kpi.converted > 0} icon={IconCheck} variant="green" />
        <KpiCard label="Conv. Rate"     value={kpi.rate}                       sub={`${pipeline.progress} in progress`}   up={parseInt(kpi.rate, 10) >= 15} icon={IconPct} variant="amber" />
        <KpiCard label="Not Interested" value={pipeline.lost.toLocaleString()} sub="Review needed"                       up={false} icon={IconClock} variant="red" />
      </div>

      {/* ── Quality KPI row + Phone Reveal Stats ── */}
      {dashStats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/*  Hot Leads — clickable */}
            <KpiCard
              label=" Hot Leads"
              value={dashStats.quality.hot.toLocaleString()}
              sub="All fields filled · Click to view"
              up={dashStats.quality.hot > 0}
              icon={IconCheck}
              variant="red"
              clickable
              onClick={() => setHotModal(true)}
            />

            {/* 🌡 Warm Leads — clickable */}
            <KpiCard
              label="🌡 Warm Leads"
              value={dashStats.quality.warm.toLocaleString()}
              sub="Partially filled · Click to view"
              up={dashStats.quality.warm > 0}
              icon={IconUsers}
              variant="amber"
              clickable
              onClick={() => setWarmModal(true)}
            />

            {/* 👁 Phone Reveals — clickable */}
            <KpiCard
              label="👁 Phone Reveals"
              value={dashStats.phoneReveal.totalReveals.toLocaleString()}
              sub={`${dashStats.phoneReveal.leadsRevealed} leads · Click to view`}
              up={false}
              icon={IconEye}
              variant="purple"
              clickable
              onClick={() => setPhoneModal(true)}
            />
          </div>
        </>
      )}

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Leads over time */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-5 flex-wrap">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Leads over time</h2>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  <span className="w-3 h-1.5 rounded-full bg-[#2563EB] inline-block" />
                  New leads
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  <span className="inline-block" style={{ width: 14, height: 0, borderTop: "2px dashed #16A34A", verticalAlign: "middle" }} />
                  Converted
                </span>
              </div>
            </div>
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

        {/* Pipeline status */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-5">Pipeline status</h2>
          <div className="flex items-center gap-4">
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

        {/* User performance */}
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
                    <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
                      {a.conv} conv
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#F3F4F6] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((a.leads / maxLeads) * 100)}%`, background: a.color }}
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

        {/* Leads by source */}
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

        {/* Recent activity */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Recent activity</h2>
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
                <div key={i} className="flex gap-3 py-3 border-b border-[#F3F4F6] dark:border-[#262A38] last:border-0">
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

      {/* ── Modals ── */}
      <PhoneRevealModal
        open={phoneModal}
        onClose={() => setPhoneModal(false)}
        data={dashStats?.phoneReveal}
      />

      <LeadsDetailModal
        open={hotModal}
        onClose={() => setHotModal(false)}
        title=" Hot Leads"
        leads={hotLeads}
        accentColor="#DC2626"
        emptyEmoji=""
      />

      <LeadsDetailModal
        open={warmModal}
        onClose={() => setWarmModal(false)}
        title=" Warm Leads"
        leads={warmLeads}
        accentColor="#D97706"
        emptyEmoji=""
      />
    </div>
  );
}
