// src/marketing/mkt/ui.jsx
// Shared building blocks for the Performance Marketing dashboard.
// Colour is SEMANTIC and consistent on every screen:
//   green = good / won · red = problem / lost · amber = attention / in progress
//   blue = informational / new · violet = brand / system
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, ChevronUp, Columns3, Info, Loader2, AlertTriangle, Minus, Search } from "lucide-react";

// ── Context (filters, drill-down, dictionary) ────────────────────────────────
export const MktCtx = createContext(null);
export const useMkt = () => useContext(MktCtx);

// ── Formatters ───────────────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDay = (iso) => {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10).split("-");
  if (s.length < 3) return String(iso);
  return `${Number(s[2])} ${MONTHS[Number(s[1]) - 1]} ${s[0]}`;
};
export const fmtDayShort = (iso) => { const s = String(iso || "").slice(0, 10).split("-"); return s.length < 3 ? "" : `${Number(s[2])} ${MONTHS[Number(s[1]) - 1]}`; };
export const fmtRange = (a, b) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);
export const fmtDateTime = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}, ${x.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
};
export const ago = (d) => {
  if (!d) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const num = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("en-IN"));
export const inr = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
export const inrShort = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return inr(n);
};
export const pct = (v, d = 1) => (v == null ? "—" : `${Number(v).toFixed(d)}%`);
export const mins = (m) => {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${(m / 60).toFixed(m < 600 ? 1 : 0)} h`;
  return `${(m / 1440).toFixed(1)} d`;
};
export const fmtBy = (format, v) => {
  switch (format) {
    case "inr": return inr(v);
    case "pct": return pct(v);
    case "x": return v == null ? "—" : `${Number(v).toFixed(2)}×`;
    case "dec": return v == null ? "—" : Number(v).toFixed(2);
    case "min": return mins(v);
    default: return num(v);
  }
};
export const CHANNEL_LABEL = { meta: "Meta", google: "Google Ads", linkedin: "LinkedIn", website: "Website", whatsapp: "WhatsApp", organic: "Organic / Other", other: "Other" };
export const STAGE_LABEL = { new: "New", contact_attempted: "Contact attempted", contacted: "Contacted", qualified: "Qualified", meeting: "Meeting", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" };

// ── Semantic tones ───────────────────────────────────────────────────────────
export const TONE = {
  good: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
  bad: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/10",
  warn: "text-amber-800 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
  info: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10",
  brand: "text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10",
  neutral: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/5",
};
export function Badge({ tone = "neutral", children, className = "" }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE[tone] || TONE.neutral} ${className}`}>{children}</span>;
}
export const statusTone = (s) => {
  const v = String(s || "").toUpperCase();
  if (v === "ACTIVE" || v === "ENABLED") return "good";
  if (v.includes("PAUSED")) return "warn";
  if (v.includes("DELETED") || v.includes("REMOVED") || v.includes("DISAPPROVED")) return "bad";
  return "neutral";
};
export const stageTone = (s) => (s === "won" ? "good" : s === "lost" ? "bad" : s === "new" ? "info" : "warn");

// ── Layout atoms ─────────────────────────────────────────────────────────────
export function Panel({ title, subtitle, action, children, className = "", pad = true }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white dark:border-[#1F2533] dark:bg-[#121620] ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#1A2030]">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}
export function Loader({ label = "Loading…" }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}
export function ErrorBox({ msg, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{msg}</div>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Try again</button>}
    </div>
  );
}
export function Empty({ children }) { return <p className="py-8 text-center text-[13px] text-slate-500">{children}</p>; }

// ── Tooltip (definition · formula · this period's calculation) ──────────────
export function MetricInfo({ k, calc, period }) {
  const { dict, range } = useMkt();
  const d = dict && dict.metrics ? dict.metrics[k] : null;
  const [open, setOpen] = useState(false);
  if (!d) return null;
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={`About ${d.label}`} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded">
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-5 z-50 w-64 -translate-x-1/2 rounded-lg bg-slate-900 p-3 text-left text-[12px] font-normal leading-snug text-slate-100 shadow-xl">
          <span className="block font-semibold text-white">{d.label}</span>
          <span className="mt-1 block text-slate-300">{d.definition}</span>
          <span className="mt-2 block text-slate-200"><span className="text-slate-400">Formula </span>{d.formula}</span>
          {calc && <span className="mt-1 block text-slate-200"><span className="text-slate-400">This period </span>{calc}</span>}
          <span className="mt-1 block text-slate-400">{period || (range ? fmtRange(range.from, range.to) : "")}</span>
          <span className="mt-1 block text-[11px] text-slate-500">{d.kind === "optimization" ? "Optimization metric — decides where money goes" : d.kind === "diagnostic" ? "Diagnostic metric — explains why" : "Volume"}</span>
        </span>
      )}
    </span>
  );
}

export function Delta({ m, compact = false }) {
  if (!m || m.deltaPct == null) return compact ? null : <span className="text-[11px] text-slate-400">no comparison</span>;
  const up = m.deltaPct > 0, flat = Math.abs(m.deltaPct) < 2;
  const cls = m.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : m.tone === "bad" ? "text-red-600 dark:text-red-400" : "text-slate-500";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ${cls}`} title={m.prev != null ? `Previous: ${fmtBy(m.format, m.prev)}` : ""}>
      <Icon className="h-3.5 w-3.5" />{Math.abs(m.deltaPct).toFixed(1)}%{!compact && <span className="ml-1 font-normal text-slate-400">vs prev.</span>}
    </span>
  );
}

// Metric cell for the KPI strips. Clicking opens the source leads.
export function MetricCell({ m, onClick, emphasis = false }) {
  const clickable = !!onClick;
  const Tag = clickable ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`group flex min-w-0 flex-col items-start gap-1 px-4 py-3 text-left ${clickable ? "hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400" : ""}`}>
      <span className="flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">{m.label}<MetricInfo k={m.key} calc={m.calc} /></span>
      <span className={`tabular-nums font-semibold text-slate-900 dark:text-slate-50 ${emphasis ? "text-[24px] leading-7" : "text-[19px] leading-6"} ${clickable ? "group-hover:text-violet-700 dark:group-hover:text-violet-300" : ""}`}>
        {fmtBy(m.format, m.value)}
        {m.estimated && <span className="ml-1 align-middle text-[11px] font-medium text-amber-600" title="Includes estimated revenue">est.</span>}
      </span>
      <Delta m={m} />
      {m.warning && <span className="text-[11px] text-amber-700 dark:text-amber-300">{m.warning}</span>}
    </Tag>
  );
}

// Clickable number inside tables.
export function DrillNum({ value, drill, title, format = "num", className = "" }) {
  const { openDrill } = useMkt();
  if (!value || !drill) return <span className={`tabular-nums ${className}`}>{fmtBy(format, value)}</span>;
  return (
    <button onClick={(e) => { e.stopPropagation(); openDrill(drill, title); }} className={`tabular-nums underline decoration-slate-300 decoration-dotted underline-offset-2 hover:text-violet-700 hover:decoration-violet-400 dark:hover:text-violet-300 ${className}`}>
      {fmtBy(format, value)}
    </button>
  );
}

// ── Data table with sorting, search and a column chooser ─────────────────────
// columns: [{ key, label, align, format, render(row), metric (dictionary key), default:false, sortValue(row) }]
export function DataTable({ id, columns, rows, rowKey = (r, i) => i, search = true, perPage = 25, onRowClick, expandable, empty = "No rows for this selection.", initialSort }) {
  const storeKey = id ? `mkt_cols_${id}` : null;
  const [visible, setVisible] = useState(() => {
    try { const s = storeKey && localStorage.getItem(storeKey); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return columns.filter((c) => c.default !== false).map((c) => c.key);
  });
  const [chooser, setChooser] = useState(false);
  const [sort, setSort] = useState(initialSort || { key: null, dir: "desc" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const ref = useRef(null);
  useEffect(() => { if (storeKey) try { localStorage.setItem(storeKey, JSON.stringify(visible)); } catch { /* ignore */ } }, [visible, storeKey]);
  useEffect(() => {
    if (!chooser) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setChooser(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [chooser]);

  const cols = columns.filter((c) => c.always || visible.includes(c.key));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows || [];
    return (rows || []).filter((r) => columns.some((c) => String(c.searchValue ? c.searchValue(r) : r[c.key] ?? "").toLowerCase().includes(s)));
  }, [rows, q, columns]);
  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col && col.sortValue ? col.sortValue(r) : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "string" || typeof bv === "string") return sort.dir === "asc" ? String(av || "").localeCompare(String(bv || "")) : String(bv || "").localeCompare(String(av || ""));
      const x = av == null ? -Infinity : av, y = bv == null ? -Infinity : bv;
      return sort.dir === "asc" ? x - y : y - x;
    });
  }, [filtered, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const shown = sorted.slice((page - 1) * perPage, page * perPage);
  const toggleSort = (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));

  return (
    <div className="space-y-2">
      {(search || columns.some((c) => !c.always)) && (
        <div className="flex items-center gap-2">
          {search && (
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search" className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] text-slate-900 focus:border-violet-400 focus:outline-none dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100" />
            </label>
          )}
          <span className="ml-auto text-[12px] text-slate-500">{num(sorted.length)} rows</span>
          {columns.some((c) => !c.always) && (
            <div className="relative" ref={ref}>
              <button onClick={() => setChooser(!chooser)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-300 dark:hover:bg-white/5">
                <Columns3 className="h-3.5 w-3.5" />Columns
              </button>
              {chooser && (
                <div className="absolute right-0 z-40 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-[#1F2533] dark:bg-[#121620]">
                  {columns.filter((c) => !c.always).map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
                      <input type="checkbox" checked={visible.includes(c.key)} onChange={() => setVisible((v) => (v.includes(c.key) ? v.filter((x) => x !== c.key) : [...v, c.key]))} className="accent-violet-600" />
                      {c.label}
                    </label>
                  ))}
                  <button onClick={() => setVisible(columns.filter((c) => c.default !== false).map((c) => c.key))} className="mt-1 w-full rounded px-2 py-1 text-left text-[12px] text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10">Reset to default</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1F2533]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#0F131B]">
              {expandable && <th className="w-8" />}
              {cols.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300 ${c.align === "right" ? "text-right" : "text-left"}`}>
                  <button onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                    {c.label}
                    {c.metric && <MetricInfo k={c.metric} />}
                    {sort.key === c.key ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const k = rowKey(r, i);
              const open = !!expanded[k];
              return (
                <RowFrag key={k}>
                  <tr onClick={() => { if (expandable) setExpanded((e) => ({ ...e, [k]: !e[k] })); else if (onRowClick) onRowClick(r); }}
                    className={`border-t border-slate-100 dark:border-[#1A2030] ${expandable || onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]" : ""}`}>
                    {expandable && <td className="pl-2 text-slate-400">{expandable(r) ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}</td>}
                    {cols.map((c) => (
                      <td key={c.key} className={`px-3 py-2 align-top text-slate-800 dark:text-slate-200 ${c.align === "right" ? "whitespace-nowrap text-right tabular-nums" : ""} ${c.className || ""}`}>
                        {c.render ? c.render(r) : c.format ? fmtBy(c.format, r[c.key]) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                  {expandable && open && expandable(r) && (
                    <tr className="bg-slate-50/60 dark:bg-white/[0.02]"><td colSpan={cols.length + 1} className="p-0">{expandable(r)}</td></tr>
                  )}
                </RowFrag>
              );
            })}
            {!shown.length && <tr><td colSpan={cols.length + (expandable ? 1 : 0)}><Empty>{empty}</Empty></td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12px] text-slate-600 dark:text-slate-300">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-[#1F2533]">Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-[#1F2533]">Next</button>
        </div>
      )}
    </div>
  );
}
function RowFrag({ children }) { return <>{children}</>; }

// ── Charts (dependency-free SVG) ─────────────────────────────────────────────
export function TrendChart({ points, series, granularity }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const n = points.length;
  if (!n) return <Empty>No data for this period.</Empty>;
  const W = 760, H = 220, pl = 8, pr = 8, pt = 12, pb = 24;
  const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i / (n - 1)) * (W - pl - pr));
  const scaled = series.map((s) => {
    const max = Math.max(1, ...points.map((p) => Number(p[s.key]) || 0));
    return { ...s, max, y: (v) => H - pb - ((Number(v) || 0) / max) * (H - pt - pb) };
  });
  const label = (t) => (granularity === "hour" ? `${String(t).slice(11, 13)}:00` : fmtDayShort(t));
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label="Performance trend"
        onMouseMove={(e) => { const b = ref.current.getBoundingClientRect(); setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) * (n - 1))); }}
        onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={pl} x2={W - pr} y1={H - pb - f * (H - pt - pb)} y2={H - pb - f * (H - pt - pb)} className="stroke-slate-100 dark:stroke-[#1A2030]" />)}
        {scaled.map((s) => (
          s.kind === "bar"
            ? <g key={s.key}>{points.map((p, i) => { const bw = Math.max(2, ((W - pl - pr) / n) * 0.55); const y = s.y(p[s.key]); return <rect key={i} x={x(i) - bw / 2} y={y} width={bw} height={H - pb - y} fill={s.color} opacity="0.22" rx="2" />; })}</g>
            : <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points.map((p, i) => `${x(i)},${s.y(p[s.key])}`).join(" ")} />
        ))}
        {points.map((p, i) => ((i % step === 0 && (n - 1 - i >= step / 2 || i === n - 1)) || i === n - 1) ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">{label(p.t)}</text> : null)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg bg-slate-900 px-3 py-2 text-[12px] text-slate-100 shadow-lg" style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > n / 2 ? "translateX(-105%)" : "translateX(8px)" }}>
          <p className="font-semibold">{granularity === "hour" ? `${fmtDay(points[hover].t)} ${label(points[hover].t)}` : fmtDay(points[hover].t)}</p>
          {series.map((s) => <p key={s.key} className="flex items-center gap-2 whitespace-nowrap"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}: <b>{s.format === "inr" ? inr(points[hover][s.key]) : num(points[hover][s.key])}</b></p>)}
        </div>
      )}
    </div>
  );
}

// True funnel with stage-to-stage conversion and drop-off.
export function FunnelChart({ steps, onStep }) {
  if (!steps || !steps.length) return <Empty>No leads in this period.</Empty>;
  const max = Math.max(1, steps[0].count);
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => {
        const w = Math.max(3, (s.count / max) * 100);
        const weak = s.stepRate != null && s.stepRate < 35 && i > 0;
        return (
          <li key={s.key}>
            <button onClick={() => onStep && onStep(s)} className="group grid w-full grid-cols-[130px_1fr_150px] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] max-sm:grid-cols-[100px_1fr]">
              <span className="text-[13px] text-slate-700 dark:text-slate-300">{s.label}</span>
              <span className="relative h-6 rounded bg-slate-100 dark:bg-white/5">
                <span className={`absolute inset-y-0 left-0 rounded ${s.key === "won" ? "bg-emerald-500" : "bg-violet-500/80"}`} style={{ width: `${w}%` }} />
                <span className="absolute inset-y-0 left-2 flex items-center text-[12px] font-semibold tabular-nums text-white mix-blend-normal" style={{ color: w < 12 ? "inherit" : undefined }}>{num(s.count)}</span>
              </span>
              <span className="text-right text-[12px] tabular-nums max-sm:col-span-2 max-sm:text-left">
                {s.stepRate == null ? <span className="text-slate-400">100%</span> : <span className={weak ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}>{pct(s.stepRate, 0)} of previous</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function HBars({ rows, labelKey, valueKey, format = "num", onClick, tone = "brand" }) {
  if (!rows || !rows.length) return <Empty>No data.</Empty>;
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  const bar = { brand: "bg-violet-500/70", bad: "bg-red-500/70", good: "bg-emerald-500/70", warn: "bg-amber-500/70", info: "bg-blue-500/70" }[tone];
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i}>
          <button onClick={() => onClick && onClick(r)} className="w-full text-left">
            <div className="mb-0.5 flex justify-between gap-2 text-[12px]"><span className="truncate text-slate-700 dark:text-slate-300">{r[labelKey]}</span><span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{fmtBy(format, r[valueKey])}{r.pct != null && <span className="ml-1 font-normal text-slate-400">{pct(r.pct, 0)}</span>}</span></div>
            <div className="h-2 rounded bg-slate-100 dark:bg-white/5"><div className={`h-2 rounded ${bar}`} style={{ width: `${((Number(r[valueKey]) || 0) / max) * 100}%` }} /></div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[#1F2533] dark:bg-[#0F131B]">
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded-md font-medium ${size === "sm" ? "px-2 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"} ${value === v ? "bg-white text-violet-700 shadow-sm dark:bg-[#1A2030] dark:text-violet-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"}`}>{l}</button>
      ))}
    </div>
  );
}

export function SyncNote({ sync }) {
  if (!sync) return null;
  return <p className="text-[12px] text-slate-500">Platform data updated {ago(sync.metaFetchedAt || sync.builtAt)}{sync.googleSource === "manual" ? " · Google spend is manually entered" : ""}</p>;
}

export function downloadCSV(filename, columns, rows) {
  const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [columns.map((c) => esc(c.label)).join(",")].concat(rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(",")));
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Common business columns for any performance row (spend → ROAS).
export function businessColumns(drillFor) {
  return [
    { key: "spend", label: "Spend", align: "right", format: "inr", metric: "spend" },
    { key: "leads", label: "Leads", align: "right", metric: "leads", render: (r) => <DrillNum value={r.leads} drill={drillFor && drillFor(r, {})} title={`Leads · ${r.name || r.channel}`} /> },
    { key: "cpl", label: "CPL", align: "right", format: "inr", metric: "cpl" },
    { key: "qualified", label: "Qualified", align: "right", metric: "qualified", render: (r) => <DrillNum value={r.qualified} drill={drillFor && drillFor(r, { reached: "qualified" })} title={`Qualified · ${r.name || r.channel}`} /> },
    { key: "qualRate", label: "Qual. %", align: "right", format: "pct", metric: "qualRate" },
    { key: "cpql", label: "CPQL", align: "right", metric: "cpql", render: (r) => <span className="font-semibold">{inr(r.cpql)}</span> },
    { key: "opportunities", label: "Opportunities", align: "right", metric: "opportunities", render: (r) => <DrillNum value={r.opportunities} drill={drillFor && drillFor(r, { reached: "meeting" })} title={`Opportunities · ${r.name || r.channel}`} /> },
    { key: "won", label: "Won", align: "right", metric: "won", render: (r) => <DrillNum value={r.won} drill={drillFor && drillFor(r, { reached: "won" })} title={`Won · ${r.name || r.channel}`} className={r.won ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""} /> },
    { key: "revenue", label: "Revenue", align: "right", format: "inr", metric: "revenue", default: true },
    { key: "cac", label: "CAC", align: "right", format: "inr", metric: "cac" },
    { key: "roas", label: "ROAS", align: "right", format: "x", metric: "roas" },
  ];
}
