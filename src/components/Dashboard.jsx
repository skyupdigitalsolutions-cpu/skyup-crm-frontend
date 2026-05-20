import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Users, CheckCircle, BarChart2, Clock, Building2, Eye,
  RefreshCw, AlertTriangle, X, Search, ChevronRight,
  Flame, Thermometer, Snowflake, TrendingUp, TrendingDown,
  Activity, Zap, ArrowUpRight,
} from "lucide-react";
import api from "../data/axiosConfig";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import UserManagement from "./UserMangement";
import AdminChat from "./Adminchat";
import LeadTimeline from "./LeadTimeLine";
import AdminAttendanceView from "./AdminAttendanceView";
import CompanyBrandSettings from "./CompanyBrandSettings";
import SuperAdminFilter from "./SuperAdminFilter";

// ── Phone masking helper ──────────────────────────────────────────────────────
function maskPhone(phone) {
  if (!phone) return "—";
  const str = String(phone).replace(/\s/g, "");
  if (str.length <= 4) return "••••";
  return str.slice(0, 2) + "•".repeat(Math.max(str.length - 4, 3)) + str.slice(-2);
}

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col
          bg-white dark:bg-[#13161E]
          rounded-t-3xl sm:rounded-2xl
          border border-[#E5E7EB] dark:border-[#262A38]
          shadow-2xl overflow-hidden"
        style={{ animation: "slideUp 0.22s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        <div className="h-1 w-full shrink-0" style={{ background: accentColor }} />
        <div className="flex justify-center pt-2 pb-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#E5E7EB] dark:bg-[#262A38]" />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] sm:text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{title}</h2>
            {subtitle && (
              <p className="text-[11px] sm:text-[12px] text-[#6B7280] dark:text-[#565C75] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl ml-3 shrink-0
              text-[#6B7280] dark:text-[#565C75]
              hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D27]
              hover:text-[#0F1117] dark:hover:text-[#F0F2FA]
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 overscroll-contain">
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

// ── Heat helpers (shared) ─────────────────────────────────────────────────────
function heatFor(count) {
  if (count >= 10) return { bg: "bg-red-50 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    bar: "#DC2626", label: "High" };
  if (count >= 5)  return { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", bar: "#D97706", label: "Med"  };
  return               { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", bar: "#7C3AED", label: "Low"  };
}

// ── Admin-level lead list (drill-down view) ───────────────────────────────────
function AdminLeadRevealList({ leads, onBack, adminName }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) =>
      (l.name || "").toLowerCase().includes(q) ||
      (l.mobile || "").includes(q)
    );
  }, [leads, search]);

  const maxCount = Math.max(...leads.map((l) => l.count), 1);

  return (
    <div>
      {/* Back header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-purple-600 dark:text-purple-400
            hover:text-purple-800 dark:hover:text-purple-300 transition-colors group"
        >
          <span className="w-6 h-6 flex items-center justify-center rounded-lg
            bg-purple-50 dark:bg-purple-500/10
            group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 transition-colors">
            ←
          </span>
          All Admins
        </button>
        <span className="text-[#D1D5DB] dark:text-[#374151]">·</span>
        <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{adminName}</span>
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75]">
          {leads.length} lead{leads.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search */}
      {leads.length > 5 && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            placeholder="Search lead name or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px]
              bg-[#F8F9FC] dark:bg-[#1A1D27]
              border border-[#E5E7EB] dark:border-[#262A38]
              text-[#0F1117] dark:text-[#F0F2FA]
              placeholder:text-[#9CA3AF] dark:placeholder:text-[#565C75]
              focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500
              transition-colors"
          />
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-[#F0F2FA] dark:border-[#1E2130]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Lead</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Reveals</span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <Eye className="w-8 h-8 mx-auto mb-2 text-[#D1D5DB] dark:text-[#374151]" />
          <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">
            {search ? "No leads match your search." : "No reveals for this admin."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 mt-1">
          {filtered.map((item, i) => {
            const heat = heatFor(item.count);
            const pct  = Math.round((item.count / maxCount) * 100);
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-3 rounded-xl
                  bg-[#F8F9FC] dark:bg-[#1A1D27]
                  border border-[#E5E7EB] dark:border-[#262A38]
                  hover:border-purple-300 dark:hover:border-purple-800
                  transition-colors"
              >
                {/* Rank */}
                <span className="w-5 text-[11px] font-bold text-[#9CA3AF] dark:text-[#565C75] shrink-0 tabular-nums text-center">
                  {i + 1}
                </span>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                    {(item.name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{item.name || "—"}</p>
                  <p className="text-[11px] font-mono text-[#8B92A9] mt-0.5">{maskPhone(item.mobile)}</p>
                  <div className="mt-1.5 h-1 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: heat.bar }} />
                  </div>
                </div>
                {/* Badge */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full ${heat.bg} ${heat.text}`}>
                    <Eye className="w-3 h-3" /> {item.count}
                  </span>
                  <span className={`text-[10px] font-medium ${heat.text}`}>{heat.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Phone Reveal Modal (SuperAdmin: Admin list → drill-down; Admin: flat list) ──
function PhoneRevealModal({ open, onClose, data, isSuperAdmin }) {
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Reset drill-down when modal closes
  useEffect(() => { if (!open) setSelectedAdmin(null); }, [open]);

  if (!data) return null;

  const { topRevealed = [], totalReveals = 0, leadsRevealed = 0, byAdmin = [] } = data;

  // ── SuperAdmin: two-level view ─────────────────────────────────────────────
  if (isSuperAdmin) {
    // byAdmin expected shape: [{ adminName, adminEmail?, totalReveals, leadsRevealed, leads: [{ name, mobile, count }] }]
    // Fallback: derive from topRevealed if byAdmin not present
    const adminList = byAdmin.length > 0 ? byAdmin : [];
    const maxAdminReveals = Math.max(...adminList.map((a) => a.totalReveals || 0), 1);

    return (
      <Modal
        open={open}
        onClose={() => { setSelectedAdmin(null); onClose(); }}
        title={selectedAdmin ? "Phone Reveals by Admin" : "Phone Reveals · By Admin"}
        subtitle={
          selectedAdmin
            ? `${selectedAdmin.leads?.length || 0} leads · ${selectedAdmin.totalReveals || 0} total reveals`
            : `${totalReveals} total reveals · ${adminList.length} admin${adminList.length !== 1 ? "s" : ""}`
        }
        accentColor="#7C3AED"
      >
        {selectedAdmin ? (
          // ── Drill-down: leads revealed by this admin ──
          <AdminLeadRevealList
            leads={selectedAdmin.leads || []}
            adminName={selectedAdmin.adminName}
            onBack={() => setSelectedAdmin(null)}
          />
        ) : adminList.length === 0 ? (
          <div className="py-12 text-center">
            <Eye className="w-10 h-10 mx-auto mb-3 text-[#D1D5DB] dark:text-[#374151]" />
            <p className="text-[14px] text-[#6B7280] dark:text-[#565C75]">No phone reveals recorded yet.</p>
          </div>
        ) : (
          // ── Admin list view ──
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-[#F0F2FA] dark:border-[#1E2130]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Admin</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Reveals</span>
            </div>
            {adminList
              .slice()
              .sort((a, b) => (b.totalReveals || 0) - (a.totalReveals || 0))
              .map((admin, i) => {
                const heat = heatFor(admin.totalReveals || 0);
                const pct  = Math.round(((admin.totalReveals || 0) / maxAdminReveals) * 100);
                const initials = (admin.adminName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedAdmin(admin)}
                    className="w-full text-left group flex items-center gap-3 sm:gap-4 px-3 py-3.5 rounded-xl
                      bg-[#F8F9FC] dark:bg-[#1A1D27]
                      border border-[#E5E7EB] dark:border-[#262A38]
                      hover:border-purple-300 dark:hover:border-purple-700
                      hover:bg-white dark:hover:bg-[#1E2130]
                      transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    {/* Rank */}
                    <span className="w-5 text-[11px] font-bold text-[#9CA3AF] dark:text-[#565C75] shrink-0 tabular-nums text-center">
                      {i + 1}
                    </span>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <span className="text-[12px] font-bold text-purple-600 dark:text-purple-400">{initials}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                          {admin.adminName || "Unknown Admin"}
                        </p>
                        {admin.adminEmail && (
                          <span className="text-[10px] text-[#9CA3AF] dark:text-[#565C75] truncate hidden sm:inline">
                            {admin.adminEmail}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
                          {admin.leadsRevealed || 0} unique lead{(admin.leadsRevealed || 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: heat.bar }}
                        />
                      </div>
                    </div>
                    {/* Badge + chevron */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full ${heat.bg} ${heat.text}`}>
                        <Eye className="w-3 h-3" /> {admin.totalReveals || 0}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] dark:text-[#565C75] group-hover:text-purple-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </Modal>
    );
  }

  // ── Admin role: flat list (original behaviour) ─────────────────────────────
  const maxCount = Math.max(...topRevealed.map((x) => x.count), 1);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Phone Number Reveals"
      subtitle={`${totalReveals} total reveals · ${leadsRevealed} unique leads viewed`}
      accentColor="#7C3AED"
    >
      {topRevealed.length === 0 ? (
        <div className="py-12 text-center">
          <Eye className="w-10 h-10 mx-auto mb-3 text-[#D1D5DB] dark:text-[#374151]" />
          <p className="text-[14px] text-[#6B7280] dark:text-[#565C75]">No phone reveals recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 pb-1 mb-1 border-b border-[#F0F2FA] dark:border-[#1E2130]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Lead</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#565C75]">Views</span>
          </div>
          {topRevealed.map((item, i) => {
            const heat = heatFor(item.count);
            const pct  = Math.round((item.count / maxCount) * 100);
            return (
              <div key={i} className="group flex items-center gap-3 sm:gap-4 px-3 py-3 rounded-xl hover:bg-[#F8F9FC] dark:hover:bg-[#1A1D27] transition-colors">
                <span className="w-5 sm:w-6 text-[12px] font-bold text-[#9CA3AF] dark:text-[#565C75] shrink-0 tabular-nums text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#8B92A9] font-mono mt-0.5">{maskPhone(item.mobile)}</p>
                  <div className="mt-1.5 h-1 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden w-full">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: heat.bar }} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full ${heat.bg} ${heat.text}`}>
                    <Eye className="w-3 h-3" /> {item.count}
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

// ── Leads Detail Modal ────────────────────────────────────────────────────────
function LeadsDetailModal({ open, onClose, title, leads, accentColor, TitleIcon }) {
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
      {leads.length > 5 && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] dark:text-[#565C75] pointer-events-none" />
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
          {TitleIcon && <TitleIcon className="w-10 h-10 mx-auto mb-3 text-[#D1D5DB] dark:text-[#374151]" />}
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
                className="flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl
                  bg-[#F8F9FC] dark:bg-[#1A1D27]
                  border border-[#E5E7EB] dark:border-[#262A38]
                  hover:border-blue-300 dark:hover:border-blue-800
                  transition-colors"
              >
                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] font-bold text-white shrink-0"
                  style={{ background: accentColor }}
                >
                  {(lead.name || "?").charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                      {lead.name || "—"}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: sc.dot }} />
                      {lead.status || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                      <Users className="w-3 h-3 shrink-0" />
                      <span className="font-medium text-[#374151] dark:text-[#9DA3BB] truncate max-w-[100px]">
                        {lead.agent || "Unassigned"}
                      </span>
                    </span>
                    {lead.source && (
                      <span className="text-[11px] text-[#9CA3AF] dark:text-[#565C75] truncate">· {lead.source}</span>
                    )}
                    {lead.date && (
                      <span className="text-[11px] text-[#9CA3AF] dark:text-[#565C75] hidden sm:inline">· {lead.date}</span>
                    )}
                  </div>
                </div>

                {lead.mobile && (
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-[11px] font-mono text-[#9CA3AF] dark:text-[#565C75]">
                      {maskPhone(lead.mobile)}
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
  blue:   { icon: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",       ring: "hover:ring-blue-200 dark:hover:ring-blue-800" },
  green:  { icon: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",   ring: "hover:ring-green-200 dark:hover:ring-green-800" },
  amber:  { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",   ring: "hover:ring-amber-200 dark:hover:ring-amber-800" },
  red:    { icon: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",           ring: "hover:ring-red-200 dark:hover:ring-red-800" },
  purple: { icon: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400", ring: "hover:ring-purple-200 dark:hover:ring-purple-800" },
};

function KpiCard({ label, value, sub, up, IconComponent, variant = "blue", onClick, clickable }) {
  const s = KPI_STYLES[variant] || KPI_STYLES.blue;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onClick?.() : undefined}
      className={`bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38]
        rounded-2xl p-4 sm:p-5 transition-all duration-200
        ${clickable
          ? `cursor-pointer hover:shadow-lg hover:ring-2 ${s.ring} hover:-translate-y-0.5 active:translate-y-0 select-none group`
          : "hover:shadow-md"
        }`}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <span className="text-[10px] sm:text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider leading-tight pr-2">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {clickable && (
            <ArrowUpRight className="w-3 h-3 text-[#9CA3AF] dark:text-[#565C75] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center ${s.icon} ${clickable ? "group-hover:scale-110 transition-transform" : ""}`}>
            {IconComponent && <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </span>
        </div>
      </div>
      <div className="text-[24px] sm:text-[30px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1.5 sm:mb-2 tabular-nums">
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] sm:text-[12px] font-medium flex items-center gap-1 ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {up
            ? <TrendingUp className="w-3 h-3 shrink-0" />
            : <TrendingDown className="w-3 h-3 shrink-0" />
          }
          <span className="truncate">{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Range toggle ──────────────────────────────────────────────────────────────
function RangeToggle({ range, onChange }) {
  const RANGES = { today: "Today", week: "Week", month: "Month", quarter: "Qtr" };
  return (
    <div className="flex items-center gap-0.5 sm:gap-1 bg-[#F3F4F6] dark:bg-[#13161E] border border-[#E5E7EB] dark:border-[#262A38] rounded-xl p-1">
      {Object.entries(RANGES).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[12px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${range === key
              ? "bg-white dark:bg-[#1A1D27] text-[#0F1117] dark:text-[#F0F2FA] shadow-sm"
              : "text-[#6B7280] dark:text-[#565C75] hover:text-[#374151] dark:hover:text-[#9DA3BB]"
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
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="text-[13px] font-semibold text-red-700 dark:text-red-400 truncate">{message}</p>
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
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-2" />
      <div className="h-4 w-52 sm:w-64 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-6 sm:mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-24 sm:h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-56 sm:h-64" />
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-56 sm:h-64" />
      </div>
    </div>
  );
}

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
  const [companyPlan, setCompanyPlan] = useState("basic");   // admin's real plan
  const [superAdminPlan, setSuperAdminPlan] = useState(null); // superadmin's real plan (null = loading)
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [range,       setRange]       = useState("week");
  const [superStats,  setSuperStats]  = useState(null);
  const [dashStats,   setDashStats]   = useState(null);

  const [hotLeads,  setHotLeads]  = useState([]);
  const [warmLeads, setWarmLeads] = useState([]);

  const [phoneModal, setPhoneModal] = useState(false);
  const [hotModal,   setHotModal]   = useState(false);
  const [warmModal,  setWarmModal]  = useState(false);

  const chartReady   = useChartJS();
  const role         = getRole();
  const user         = getStoredUser();
  const isSuperAdmin = role === "superadmin";

  // ── Fetch dashboard stats ─────────────────────────────────────────────────
  const fetchDashStats = () => {
    api.get("/admin/dashboard-stats")
      .then((r) => setDashStats(r.data))
      .catch(() => {});
  };

  // ── Fetch lead data ───────────────────────────────────────────────────────
  const loadData = (isRefresh = false) => {
    if (role === "user") { setLoading(false); return; }
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
    setError(null);

    fetchAll()
      .then(({ agents, leads, stats }) => {
        const safeLeads = leads || [];
        setAgents(agents || []);
        setAllLeads(safeLeads);
        if (stats) setSuperStats(stats);
        setHotLeads(safeLeads.filter((l) => l.temperature === "Hot"  || l.Quality === "Hot"));
        setWarmLeads(safeLeads.filter((l) => l.temperature === "Warm" || l.Quality === "Warm"));
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    // ── Fetch real plan for admin role ─────────────────────────────────────
    if (role === "admin") {
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
    }
  };

  // ── Fetch real subscription plan for SuperAdmin ───────────────────────────
  const fetchSuperAdminPlan = useCallback(() => {
    if (!isSuperAdmin) return;
    api.get("/razorpay/subscription")
      .then((r) => {
        const nameToId = { Starter: "starter", Growth: "growth", Enterprise: "enterprise" };
        const planId = nameToId[r.data?.planName] || r.data?.planName?.toLowerCase() || "starter";
        setSuperAdminPlan(planId);
      })
      .catch(() => {
        // fallback: derive from subscription endpoint or default starter
        setSuperAdminPlan("starter");
      });
  }, [isSuperAdmin]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { fetchSuperAdminPlan(); }, [fetchSuperAdminPlan]);

  useEffect(() => {
    fetchDashStats();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDashStats();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
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
    const counts = leads.reduce((acc, l) => {
      const src = l.source?.trim();
      if (src) acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const FALLBACK_COLORS = [
      "#2563EB", "#7C3AED", "#0891B2", "#16A34A",
      "#D97706", "#DC2626", "#0D9488", "#9333EA",
    ];
    return Object.entries(counts)
      .map(([label, count], i) => ({
        label,
        count,
        color: SOURCE_COLORS[label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        pct: Math.round((count / total) * 100),
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
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

  const maxLeads        = Math.max(...agentStats.map((a) => a.leads), 1);
  const pipelineSegs    = PIPELINE_SEGMENTS_CONFIG.map((cfg) => ({ label: cfg.label, color: cfg.color, value: pipeline[cfg.key] }));
  const pipelineTotal   = pipelineSegs.reduce((s, x) => s + x.value, 0);
  const uniqueSources   = [...new Set(allLeads.map((l) => l.source))].length;
  const uniqueCampaigns = [...new Set(allLeads.map((l) => l.campaign).filter((c) => c && c !== "—"))].length;

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-4 sm:px-6 py-6 sm:py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-[20px] sm:text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Dashboard</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0
                ${isSuperAdmin
                  ? "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400"
                  : "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                }`}
            >
              {isSuperAdmin ? "SuperAdmin" : "Admin"}
            </span>
          </div>
          <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-[#565C75] truncate">
            Welcome back, {user?.name || "Admin"} ·{" "}
            {isSuperAdmin
              ? `${superStats?.totalCompanies || 0} companies · ${allLeads.length} total leads`
              : `${allLeads.length} total leads · ${agents.length} users`}
          </p>
        </div>

        <button
          onClick={() => { loadData(true); fetchDashStats(); }}
          disabled={refreshing}
          className={`p-2 sm:p-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]
            text-[#6B7280] hover:text-[#2563EB] dark:hover:text-[#4F8EF7]
            hover:border-blue-300 dark:hover:border-blue-700
            transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${refreshing ? "opacity-60 cursor-not-allowed" : ""}`}
          title="Refresh data"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`w-4 h-4 transition-transform ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && <ErrorBanner message={error} onRetry={() => loadData()} />}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        <KpiCard label="Total Leads"    value={kpi.total.toLocaleString()}     sub={`${kpi.rangeTotal} in selected range`} up IconComponent={Users}       variant="blue" />
        <KpiCard label="Conversions"    value={kpi.converted.toLocaleString()} sub={`${kpi.rate} conversion rate`}        up={kpi.converted > 0} IconComponent={CheckCircle} variant="green" />
        <KpiCard label="Conv. Rate"     value={kpi.rate}                       sub={`${pipeline.progress} in progress`}   up={parseInt(kpi.rate, 10) >= 15} IconComponent={BarChart2} variant="amber" />
        <KpiCard label="Not Interested" value={pipeline.lost.toLocaleString()} sub="Review needed"                       up={false} IconComponent={Clock} variant="red" />
      </div>

      {/* ── Quality KPI row + Phone Reveal Stats ── */}
      {dashStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
          <KpiCard
            label="Hot Leads"
            value={dashStats.quality.hot.toLocaleString()}
            sub="All fields filled · Tap to view"
            up={dashStats.quality.hot > 0}
            IconComponent={Flame}
            variant="red"
            clickable
            onClick={() => setHotModal(true)}
          />
          <KpiCard
            label="Warm Leads"
            value={dashStats.quality.warm.toLocaleString()}
            sub="Partially filled · Tap to view"
            up={dashStats.quality.warm > 0}
            IconComponent={Thermometer}
            variant="amber"
            clickable
            onClick={() => setWarmModal(true)}
          />
          <KpiCard
            label="Phone Reveals"
            value={dashStats.phoneReveal.totalReveals.toLocaleString()}
            sub={`${dashStats.phoneReveal.leadsRevealed} leads · Tap to view`}
            up={false}
            IconComponent={Eye}
            variant="purple"
            clickable
            onClick={() => { fetchDashStats(); setPhoneModal(true); }}
          />
        </div>
      )}

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">

        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
              <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Leads over time</h2>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  <span className="w-3 h-1.5 rounded-full bg-[#2563EB] inline-block shrink-0" />
                  New leads
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  <span className="inline-block shrink-0" style={{ width: 14, height: 0, borderTop: "2px dashed #16A34A", verticalAlign: "middle" }} />
                  Converted
                </span>
              </div>
            </div>
            <RangeToggle range={range} onChange={setRange} />
          </div>

          {leads.length === 0 ? (
            <div className="h-[180px] sm:h-[200px] flex flex-col items-center justify-center gap-2 text-[13px] text-[#6B7280] dark:text-[#565C75]">
              <BarChart2 className="w-8 h-8 opacity-40" />
              No leads in this period
            </div>
          ) : chartReady ? (
            <LineChart data1={chart.new} data2={chart.conv} labels={chart.labels} />
          ) : (
            <div className="h-[180px] sm:h-[200px] flex items-center justify-center text-[12px] text-[#6B7280] dark:text-[#565C75]">
              Loading chart…
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4 sm:mb-5">Pipeline status</h2>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
              {chartReady ? (
                <DonutChart segments={pipelineSegs} />
              ) : (
                <div className="w-full h-full rounded-full border-4 border-[#E5E7EB] dark:border-[#262A38]" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[18px] sm:text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none tabular-nums">
                  {pipelineTotal.toLocaleString()}
                </span>
                <span className="text-[9px] text-[#6B7280] dark:text-[#565C75] mt-0.5">total</span>
              </div>
            </div>
            <div className="space-y-2.5 sm:space-y-3 flex-1 min-w-0">
              {pipelineSegs.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[10px] sm:text-[11px] text-[#4B5563] dark:text-[#9DA3BB] flex-1 leading-none truncate">{s.label}</span>
                  <span className="text-[11px] sm:text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums shrink-0">
                    {s.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3 sm:mb-4">
            {isSuperAdmin ? "Top users" : "User performance"}
          </h2>
          {agentStats.every((a) => a.leads === 0) ? (
            <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">No activity in this period.</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {agentStats.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shrink-0"
                        style={{ background: a.color }}
                      >
                        {a.avatar}
                      </div>
                      <span className="text-[11px] sm:text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{a.name}</span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {a.conv} conv
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 sm:h-2 bg-[#F3F4F6] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((a.leads / maxLeads) * 100)}%`, background: a.color }}
                      />
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-[#6B7280] dark:text-[#565C75] w-6 sm:w-8 text-right tabular-nums shrink-0">
                      {a.leads}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3 sm:mb-4">Leads by source</h2>
          <div className="space-y-2.5 sm:space-y-3">
            {sourceStats.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">No data for this period.</p>
            ) : (
              sourceStats.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[11px] sm:text-[12px] text-[#4B5563] dark:text-[#9DA3BB] truncate">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] sm:text-[11px] text-[#6B7280] dark:text-[#565C75] tabular-nums">{s.count}</span>
                      <span className="text-[11px] sm:text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums w-7 sm:w-8 text-right">
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 sm:h-1.5 bg-[#F3F4F6] dark:bg-[#262A38] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-[#E5E7EB] dark:border-[#262A38] grid grid-cols-2 gap-2 sm:gap-3">
            {[
              { label: "Total leads",  value: allLeads.length },
              { label: "Active users", value: agents.length },
              { label: "Sources",      value: uniqueSources },
              { label: "Campaigns",    value: uniqueCampaigns },
            ].map((s) => (
              <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5">
                <div className="text-[14px] sm:text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{s.value}</div>
                <div className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#565C75] mt-0.5 truncate">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Recent activity</h2>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
          </div>
          <div className="space-y-0">
            {activity.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#565C75] py-4">No recent activity.</p>
            ) : (
              activity.map((a, i) => (
                <div key={i} className="flex gap-2.5 sm:gap-3 py-2.5 sm:py-3 border-b border-[#F3F4F6] dark:border-[#262A38] last:border-0">
                  <div className="mt-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ background: a.dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-[12px] text-[#4B5563] dark:text-[#9DA3BB] leading-snug truncate">{a.text}</p>
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

      {/*
        ── UserManagement:
           • SuperAdmin → rendered with their REAL fetched plan (never hardcoded)
           • Admin      → rendered with company-scoped real plan
           • User role  → hidden entirely
        ── superAdminPlan is null while loading to avoid a flash of wrong limits
      */}
      {/* ── Admin-Based Filter (SuperAdmin only) ── */}
      {isSuperAdmin && <SuperAdminFilter />}

      {isSuperAdmin && superAdminPlan !== null && (
        <UserManagement
          currentPlan={superAdminPlan}
          existingAdmins={[]}
          existingUsers={[]}
        />
      )}

    
      {role === "admin" && (
        <UserManagement
          currentPlan={companyPlan}
          existingAdmins={dbAdmins}
          existingUsers={dbUsers}
        />
      )}

      {/* ── Modals ── */}
      <PhoneRevealModal
        open={phoneModal}
        onClose={() => setPhoneModal(false)}
        data={dashStats?.phoneReveal}
        isSuperAdmin={isSuperAdmin}
      />

      <LeadsDetailModal
        open={hotModal}
        onClose={() => setHotModal(false)}
        title="Hot Leads"
        leads={hotLeads}
        accentColor="#DC2626"
        TitleIcon={Flame}
      />

      <LeadsDetailModal
        open={warmModal}
        onClose={() => setWarmModal(false)}
        title="Warm Leads"
        leads={warmLeads}
        accentColor="#D97706"
        TitleIcon={Thermometer}
      />
    </div>
  );
}
