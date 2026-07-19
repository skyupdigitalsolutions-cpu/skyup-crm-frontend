import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../data/axiosConfig";
import {
  Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Users, Target, MousePointerClick, IndianRupee, Activity, Award,
  Calendar, ChevronUp, ChevronDown, ArrowUpDown, Search, Download,
  BarChart3, PieChart, LineChart as LineIcon, Layers, Bell, Star,
  Filter, X, Clock, CheckCircle2, XCircle, AlertCircle, Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Performance Marketing Dashboard — reads from GET /admin/marketing-dashboard
// Real CRM data: leads, statuses, campaigns, employees, follow-ups
// ─────────────────────────────────────────────────────────────────────────────

const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";
const num  = (v) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const pct  = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const STATUS_COLOR = {
  "New":            { bg: "#EFF6FF", text: "#2563EB", dot: "#2563EB" },
  "In Progress":    { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B" },
  "Converted":      { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
  "Not Interested": { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
  "Verification":   { bg: "#F5F3FF", text: "#7C3AED", dot: "#8B5CF6" },
};

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#64748B"];

const DATE_PRESETS = [
  { label: "Today",       from: isoDaysAgo(0),  to: isoDaysAgo(0) },
  { label: "Yesterday",   from: isoDaysAgo(1),  to: isoDaysAgo(1) },
  { label: "Last 7 days", from: isoDaysAgo(7),  to: isoDaysAgo(0) },
  { label: "Last 30 days",from: isoDaysAgo(30), to: isoDaysAgo(0) },
  { label: "Last 90 days",from: isoDaysAgo(90), to: isoDaysAgo(0) },
  { label: "Custom",      from: null,             to: null },
];

// ── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 64, h = 24;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 h-6">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, tint, trend, sparkData }) {
  const up = trend != null && trend > 0;
  const dn = trend != null && trend < 0;
  return (
    <div className={`${CARD} p-4 hover:shadow-md transition-all hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between mb-2">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${tint}22` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </span>
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-600" : dn ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
            {up ? <TrendingUp className="w-2.5 h-2.5" /> : dn ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
            {trend != null ? `${Math.abs(trend)}%` : "—"}
          </span>
        )}
      </div>
      <p className="text-[20px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B92A9]">{label}</p>
        <Sparkline data={sparkData} color={tint} />
      </div>
    </div>
  );
}

// ── Funnel chart (SVG trapezoids) ─────────────────────────────────────────────
function FunnelChart({ stages }) {
  const data = (stages || []).filter((s) => s.count > 0);
  if (!data.length) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No data</p>;
  const max = data[0].count;
  return (
    <div className="space-y-1.5">
      {data.map((s, i) => {
        const w = Math.max(20, (s.count / max) * 100);
        const drop = i > 0 && data[i - 1].count > 0 ? Math.round((1 - s.count / data[i - 1].count) * 100) : null;
        return (
          <div key={s.stage}>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="flex-1 flex justify-center">
                <div className="h-9 rounded-lg flex items-center justify-center transition-all" style={{ width: `${w}%`, background: s.color, minWidth: 60 }}>
                  <span className="text-white text-[11px] font-bold">{num(s.count)}</span>
                </div>
              </div>
              <div className="w-32 shrink-0">
                <p className="text-[11px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{s.stage}</p>
                {drop != null && <p className="text-[10px] text-rose-500">▼ {drop}% drop</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Area line chart (SVG with hover) ─────────────────────────────────────────
function AreaChart({ series, points, height = 180 }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const n = points.length;
  if (!n) return <div className="text-center text-[12px] text-[#8B92A9] py-10">No data</div>;
  const w = 640, h = height, pL = 36, pR = 8, pT = 10, pB = 22;
  const allMax = Math.max(1, ...series.flatMap((s) => s.data));
  const x = (i) => pL + (i / Math.max(1, n - 1)) * (w - pL - pR);
  const y = (v) => h - pB - ((v || 0) / allMax) * (h - pT - pB);
  const onMove = (e) => {
    const el = svgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(f * (n - 1)));
  };
  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>{series.map((s) => (
          <linearGradient key={s.key} id={`g${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.22" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}</defs>
        {[0,1,2,3,4].map((t) => { const gy = pT + (t / 4) * (h - pT - pB); return <line key={t} x1={pL} y1={gy} x2={w - pR} y2={gy} stroke="currentColor" className="text-[#EEF0F6] dark:text-[#1A1D2A]" strokeWidth="1" />; })}
        {series.map((s) => {
          const line = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const area = `${x(0)},${h - pB} ${line} ${x(n - 1)},${h - pB}`;
          return (<g key={s.key}><polygon points={area} fill={`url(#g${s.key})`} /><polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={line} /></g>);
        })}
        {points.map((p, i) => (i % Math.ceil(n / 7) === 0 || i === n - 1) ? <text key={i} x={x(i)} y={h - 5} textAnchor="middle" className="fill-[#B4B9C9]" style={{ fontSize: 8 }}>{p.slice(5)}</text> : null)}
        {hover != null && (<g><line x1={x(hover)} y1={pT} x2={x(hover)} y2={h - pB} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2" />{series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.data[hover] || 0)} r="3" fill="#fff" stroke={s.color} strokeWidth="2" />)}</g>)}
      </svg>
      {hover != null && (
        <div className="absolute top-1 px-2 py-1.5 rounded-lg bg-[#0F1117] text-white text-[10px] shadow-xl pointer-events-none z-10"
          style={{ left: `${(x(hover) / w) * 100}%`, transform: hover > n / 2 ? "translateX(-110%)" : "translateX(8%)" }}>
          <p className="font-bold mb-0.5">{points[hover]}</p>
          {series.map((s) => <p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}: <b className="ml-auto">{num(s.data[hover] || 0)}</b></p>)}
        </div>
      )}
      <div className="flex flex-wrap gap-3 justify-center mt-1">
        {series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}

// ── Donut chart ────────────────────────────────────────────────────────────────
function DonutChart({ data, onSliceClick }) {
  const rows = (data || []).filter((d) => (d.count || 0) > 0);
  const total = rows.reduce((s, d) => s + d.count, 0) || 1;
  let acc = 0;
  const R = 54, C = 2 * Math.PI * R;
  const [hov, setHov] = useState(null);
  if (!rows.length) return <div className="text-center text-[12px] text-[#8B92A9] py-8">No data</div>;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative w-[130px] h-[130px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <g transform="translate(70,70) rotate(-90)">
            <circle r={R} fill="none" stroke="currentColor" className="text-[#F1F3F9] dark:text-white/5" strokeWidth="16" />
            {rows.map((d, i) => {
              const frac = d.count / total;
              const el = <circle key={d.stage} r={R} fill="none" stroke={d.color} strokeWidth={hov === i ? 20 : 16}
                strokeLinecap="round" strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`}
                strokeDashoffset={-acc * C} className="cursor-pointer transition-all"
                onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                onClick={() => onSliceClick && onSliceClick(d.stage)} />;
              acc += frac; return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] text-[#8B92A9] uppercase tracking-wide">Total</span>
          <span className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{num(total)}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {rows.map((d, i) => (
          <div key={d.stage} className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onSliceClick && onSliceClick(d.stage)}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="flex-1 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">{d.stage}</span>
            <span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{num(d.count)}</span>
            <span className="text-[10px] text-[#8B92A9] w-10 text-right">{Math.round((d.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Rank bar ──────────────────────────────────────────────────────────────────
function RankBars({ rows, valueKey, labelKey, format }) {
  const data = (rows || []).slice(0, 8);
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  if (!data.length) return <div className="text-center text-[12px] text-[#8B92A9] py-6">No data</div>;
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB] truncate">{d[labelKey] || "—"}</span>
              <span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] ml-2">{format ? format(d[valueKey]) : num(d[valueKey])}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${((Number(d[valueKey]) || 0) / max) * 100}%`, background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}CC, ${COLORS[i % COLORS.length]})` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sortable table ────────────────────────────────────────────────────────────
function SortableTable({ columns, rows, initialSort }) {
  const [sort, setSort] = useState(initialSort || { key: columns[0].key, dir: "desc" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER = 10;
  const toggle = (k) => setSort((s) => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (rows || []).filter((r) => !q || columns.some((c) => String(r[c.key] || "").toLowerCase().includes(q)));
  }, [rows, search, columns]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      av = av ?? -Infinity; bv = bv ?? -Infinity;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sort]);
  const pages = Math.ceil(sorted.length / PER);
  const paged = sorted.slice((page - 1) * PER, page * PER);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
            className="w-full text-[12px] pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
        </div>
        <span className="text-[11px] text-[#8B92A9] ml-auto">{sorted.length} rows</span>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
            {columns.map((c) => (
              <th key={c.key} onClick={() => toggle(c.key)} className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 cursor-pointer whitespace-nowrap select-none hover:text-[#4B5168] ${c.align === "right" ? "text-right" : "text-left"}`}>
                <span className="inline-flex items-center gap-1">{c.label}{sort.key === c.key ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
                {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 text-[12px] text-[#222733] dark:text-[#C9CEE0] whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
            {!paged.length && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No rows</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-[11px] font-semibold ${page === p ? "bg-indigo-600 text-white" : "bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`${CARD} p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-[#8B92A9]" />}
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{title}</p>
      </div>
      {children}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function PerformanceMarketingDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [from,    setFrom]    = useState(isoDaysAgo(30));
  const [to,      setTo]      = useState(isoDaysAgo(0));
  const [preset,  setPreset]  = useState("Last 30 days");
  const [campaign,setCampaign]= useState("");
  const [source,  setSource]  = useState("");
  const [refresh, setRefresh] = useState(null); // auto-refresh interval mins
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = { from, to };
      if (campaign) params.campaign = campaign;
      if (source)   params.source   = source;
      const { data: d } = await api.get("/admin/marketing-dashboard", { params });
      setData(d);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load dashboard data.");
    } finally { setLoading(false); }
  }, [from, to, campaign, source]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh
  useEffect(() => {
    if (!refresh) return;
    const t = setInterval(() => load(), refresh * 60000);
    return () => clearInterval(t);
  }, [refresh, load]);

  const applyPreset = (p) => {
    setPreset(p.label);
    if (p.from) { setFrom(p.from); setTo(p.to); }
  };

  const k = data?.kpis || {};
  const daily = data?.daily || [];
  const dailyDates = daily.map((d) => d.date);

  // Sparkline history from daily data
  const sparkTotal     = daily.slice(-14).map((d) => d.total || 0);
  const sparkConverted = daily.slice(-14).map((d) => d.converted || 0);

  const statusDonut = [
    { stage: "New",            count: k.newLeads     || 0, color: "#3B82F6" },
    { stage: "In Progress",    count: k.inProgress   || 0, color: "#F59E0B" },
    { stage: "Verification",   count: k.verification || 0, color: "#8B5CF6" },
    { stage: "Converted",      count: k.converted    || 0, color: "#10B981" },
    { stage: "Not Interested", count: k.notInterested|| 0, color: "#EF4444" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14] p-4 md:p-6 space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </span>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Performance Marketing</h1>
            <p className="text-[11px] text-[#8B92A9]">Ad performance · Lead funnel · Conversion analytics</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Auto-refresh */}
          <select value={refresh || ""} onChange={(e) => setRefresh(e.target.value ? Number(e.target.value) : null)}
            className="text-[11px] font-semibold bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2.5 py-2 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
            <option value="">Manual refresh</option>
            <option value="5">Auto · 5 min</option>
            <option value="15">Auto · 15 min</option>
            <option value="30">Auto · 30 min</option>
          </select>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className={`${CARD} p-3`}>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date presets */}
          <div className="flex gap-1 flex-wrap">
            {DATE_PRESETS.filter((p) => p.label !== "Custom").map((p) => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${preset === p.label ? "bg-indigo-600 text-white" : "bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom dates */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("Custom"); }}
              className="text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
            <span className="text-[#8B92A9] text-[11px]">→</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("Custom"); }}
              className="text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
          </div>
          {/* More filters */}
          <div className="ml-auto flex items-center gap-2">
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2.5 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
              <option value="">All sources</option>
              {(data?.filters?.sources || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)}
              className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2.5 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
              <option value="">All campaigns</option>
              {(data?.filters?.campaigns || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(source || campaign) && (
              <button onClick={() => { setSource(""); setCampaign(""); }}
                className="text-[#8B92A9] hover:text-rose-500 transition-colors p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {loading && !data && <div className={`${CARD} p-12 flex justify-center`}><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" /></div>}

      {data && (
        <>
          {/* ── KPI Grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <KpiCard icon={Users}          label="Total Leads"   value={num(k.totalLeads)}     tint="#6366F1" trend={k.trends?.totalLeads} sparkData={sparkTotal} />
            <KpiCard icon={Star}           label="New"           value={num(k.newLeads)}        tint="#3B82F6" />
            <KpiCard icon={Activity}       label="In Progress"   value={num(k.inProgress)}      tint="#F59E0B" />
            <KpiCard icon={CheckCircle2}   label="Converted"     value={num(k.converted)}       tint="#10B981" trend={k.trends?.converted} sparkData={sparkConverted} />
            <KpiCard icon={XCircle}        label="Not Interested"value={num(k.notInterested)}   tint="#EF4444" />
            <KpiCard icon={Target}         label="Conv. Rate"    value={pct(k.conversionRate)}  tint="#8B5CF6" />
            <KpiCard icon={AlertCircle}    label="Verification"  value={num(k.verification)}    tint="#A855F7" />
            <KpiCard icon={Bell}           label="Today Followups" value={num(data.followups?.today)} tint="#F97316" />
            <KpiCard icon={Clock}          label="Upcoming"      value={num(data.followups?.upcoming)} tint="#0EA5E9" />
            <KpiCard icon={AlertTriangle}  label="Missed"        value={num(data.followups?.missed)}   tint="#EF4444" />
          </div>

          {/* ── Summary strip ──────────────────────────────────────────────── */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">Period Summary · {data.range?.from} → {data.range?.to}</p>
            <p className="text-[13px] leading-relaxed">
              <b>{num(k.totalLeads)}</b> leads generated — <b>{num(k.converted)}</b> converted (<b>{pct(k.conversionRate)}</b>),{" "}
              <b>{num(k.inProgress)}</b> in progress, <b>{num(k.newLeads)}</b> new.{" "}
              <b>{num(data.followups?.today)}</b> follow-ups due today, <b>{num(data.followups?.missed)}</b> missed.
            </p>
          </div>

          {/* ── Funnel + Status Donut ─────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Lead Funnel" icon={Layers}>
              <FunnelChart stages={data.funnel} />
            </Panel>
            <Panel title="Lead Status Breakdown" icon={PieChart}>
              <DonutChart data={statusDonut} />
            </Panel>
          </div>

          {/* ── Daily Trend ────────────────────────────────────────────────── */}
          <Panel title="Daily Lead Trend" icon={LineIcon}>
            <AreaChart
              points={dailyDates}
              series={[
                { key: "total",      label: "Total",       color: "#6366F1", data: daily.map((d) => d.total) },
                { key: "inProgress", label: "In Progress", color: "#F59E0B", data: daily.map((d) => d.inProgress) },
                { key: "converted",  label: "Converted",   color: "#10B981", data: daily.map((d) => d.converted) },
                { key: "new",        label: "New",         color: "#3B82F6", data: daily.map((d) => d.newLeads) },
              ]}
            />
          </Panel>

          {/* ── Campaign + Source ─────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Top Campaigns" icon={BarChart3}>
              <RankBars rows={data.campaigns} valueKey="total" labelKey="campaign" />
            </Panel>
            <Panel title="Lead Sources" icon={PieChart}>
              <DonutChart data={(data.sources || []).map((s, i) => ({ stage: s.source, count: s.count, color: COLORS[i % COLORS.length] }))} />
            </Panel>
          </div>

          {/* ── Campaign Table ────────────────────────────────────────────── */}
          <Panel title="Campaign Breakdown" icon={BarChart3}>
            <SortableTable
              initialSort={{ key: "total", dir: "desc" }}
              rows={data.campaigns || []}
              columns={[
                { key: "campaign",   label: "Campaign",    render: (r) => <span className="font-semibold">{r.campaign}</span> },
                { key: "source",     label: "Source" },
                { key: "total",      label: "Total",      align: "right", render: (r) => num(r.total) },
                { key: "newLeads",   label: "New",        align: "right", render: (r) => num(r.newLeads) },
                { key: "inProgress", label: "In Progress",align: "right", render: (r) => num(r.inProgress) },
                { key: "converted",  label: "Converted",  align: "right", render: (r) => <span className="text-emerald-600 font-semibold">{num(r.converted)}</span> },
                { key: "convRate",   label: "Conv %",     align: "right", render: (r) => <span className={`font-semibold ${r.convRate >= 10 ? "text-emerald-600" : r.convRate >= 5 ? "text-amber-600" : "text-[#8B92A9]"}`}>{pct(r.convRate)}</span> },
                { key: "notInt",     label: "Not Int.",   align: "right", render: (r) => <span className="text-rose-500">{num(r.notInt)}</span> },
              ]}
            />
          </Panel>

          {/* ── Employee Leaderboard ─────────────────────────────────────── */}
          <Panel title="Sales Executive Performance" icon={Award}>
            <SortableTable
              initialSort={{ key: "total", dir: "desc" }}
              rows={data.employees || []}
              columns={[
                { key: "name",       label: "Executive",  render: (r) => <span className="font-semibold">{r.name}</span> },
                { key: "total",      label: "Assigned",   align: "right", render: (r) => num(r.total) },
                { key: "inProgress", label: "In Progress",align: "right", render: (r) => num(r.inProgress) },
                { key: "converted",  label: "Converted",  align: "right", render: (r) => <span className="text-emerald-600 font-semibold">{num(r.converted)}</span> },
                { key: "notInt",     label: "Not Int.",   align: "right", render: (r) => <span className="text-rose-500">{num(r.notInt)}</span> },
                { key: "convRate",   label: "Conv %",     align: "right", render: (r) => (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[11px] font-bold" style={{ color: r.convRate >= 20 ? "#059669" : r.convRate >= 10 ? "#D97706" : "#EF4444" }}>{pct(r.convRate)}</span>
                  </span>
                )},
              ]}
            />
          </Panel>

          {/* ── Google Ads Performance (if available) ─────────────────────── */}
          {data.adPerformance && data.adPerformance.length > 0 && (
            <Panel title="Google Ads Campaign Performance" icon={Zap}>
              <SortableTable
                initialSort={{ key: "leads", dir: "desc" }}
                rows={data.adPerformance}
                columns={[
                  { key: "name",        label: "Campaign",    render: (r) => <span className="font-semibold">{r.name}</span> },
                  { key: "impressions", label: "Impressions", align: "right", render: (r) => num(r.impressions) },
                  { key: "clicks",      label: "Clicks",      align: "right", render: (r) => num(r.clicks) },
                  { key: "ctr",         label: "CTR",         align: "right", render: (r) => pct(r.ctr) },
                  { key: "cost",        label: "Spend",       align: "right", render: (r) => `₹${num(r.cost)}` },
                  { key: "leads",       label: "Leads",       align: "right", render: (r) => num(r.leads) },
                  { key: "cpl",         label: "CPL",         align: "right", render: (r) => `₹${num(r.cpl)}` },
                  { key: "converted",   label: "Converted",   align: "right", render: (r) => <span className="text-emerald-600 font-semibold">{num(r.converted)}</span> },
                ]}
              />
            </Panel>
          )}

          {/* ── Follow-up summary cards ──────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Today's Follow-ups",    count: data.followups?.today,    color: "#F97316", icon: Clock },
              { label: "Upcoming Follow-ups",   count: data.followups?.upcoming, color: "#0EA5E9", icon: Calendar },
              { label: "Missed Follow-ups",     count: data.followups?.missed,   color: "#EF4444", icon: AlertTriangle },
            ].map((f) => (
              <div key={f.label} className={`${CARD} p-4`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${f.color}22` }}>
                  <f.icon className="w-4 h-4" style={{ color: f.color }} />
                </div>
                <p className="text-[22px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-0.5">{num(f.count)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B92A9]">{f.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
