import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../data/axiosConfig";
import {
  Loader2, BarChart3, RefreshCw, AlertTriangle, Eye, MousePointerClick,
  IndianRupee, Target, Percent, TrendingUp, Film, Layers, Sparkles,
  ChevronUp, ChevronDown, ArrowUpDown, Monitor, Smartphone, Tablet, Tv, HelpCircle,
} from "lucide-react";

// Google Ads — visual analytics (KPIs + interactive charts + tables) from GET /google-ads-api/report

const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const compact = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
};
const cur = (v) => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
const curC = (v) => (v == null ? "—" : "₹" + compact(v));
const pct = (v) => (v == null ? "—" : `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`);
const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#64748B"];

const DEVICE_ICON = { MOBILE: Smartphone, DESKTOP: Monitor, TABLET: Tablet, CONNECTED_TV: Tv, OTHER: HelpCircle, UNKNOWN: HelpCircle };

// ── Gradient KPI card ─────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, tint, hint }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E4E7EF] dark:border-[#1E2133] p-3.5 transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: `linear-gradient(135deg, ${tint}14 0%, transparent 70%)` }}>
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-[0.08]" style={{ background: tint }} />
      <div className="flex items-center gap-2 mb-2 relative">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}22` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{label}</span>
      </div>
      <p className="text-[22px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none relative">{value}</p>
      {hint && <p className="text-[10px] text-[#8B92A9] mt-1 relative">{hint}</p>}
    </div>
  );
}

// ── Interactive area line chart (SVG hover tooltip) ──────────────────────────
function AreaLineChart({ points, series, height = 190, fmt }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const n = points.length;
  if (!n) return <div className="text-[12px] text-[#8B92A9] py-12 text-center">No data in this range</div>;
  const w = 640, h = height, padL = 42, padR = 12, padT = 12, padB = 24;
  const allMax = Math.max(1, ...series.flatMap((s) => s.data));
  const x = (i) => padL + (i * (w - padL - padR)) / Math.max(1, n - 1);
  const y = (v) => h - padB - ((Number(v) || 0) / allMax) * (h - padT - padB);
  const ticks = 4;

  const onMove = (e) => {
    const el = svgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (n - 1)));
  };

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: ticks + 1 }).map((_, t) => {
          const gy = padT + (t * (h - padT - padB)) / ticks;
          const val = allMax * (1 - t / ticks);
          return (
            <g key={t}>
              <line x1={padL} y1={gy} x2={w - padR} y2={gy} stroke="currentColor" className="text-[#EEF0F6] dark:text-[#1A1D2A]" strokeWidth="1" />
              <text x={padL - 6} y={gy + 3} textAnchor="end" className="fill-[#B4B9C9]" style={{ fontSize: 9 }}>{compact(val)}</text>
            </g>
          );
        })}
        {series.map((s) => {
          const line = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const area = `${padL},${h - padB} ${line} ${x(n - 1)},${h - padB}`;
          return (
            <g key={s.key}>
              <polygon points={area} fill={`url(#grad-${s.key})`} />
              <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
            </g>
          );
        })}
        {points.map((p, i) => (i % Math.ceil(n / 6) === 0 || i === n - 1) ? (
          <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-[#B4B9C9]" style={{ fontSize: 9 }}>{p.slice(5)}</text>
        ) : null)}
        {hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={h - padB} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.data[hover])} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="absolute top-1 px-2.5 py-1.5 rounded-lg bg-[#0F1117] text-white text-[10px] shadow-xl pointer-events-none z-10"
          style={{ left: `${(x(hover) / w) * 100}%`, transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})` }}>
          <p className="font-bold mb-0.5">{points[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <span className="font-semibold ml-auto">{fmt && fmt[s.key] ? fmt[s.key](s.data[hover]) : num(s.data[hover])}</span>
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-4 justify-center mt-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Ranked gradient bars ─────────────────────────────────────────────────────
function RankBars({ rows, valueKey, labelKey, format }) {
  const data = (rows || []).slice(0, 7);
  if (!data.length) return <div className="text-[12px] text-[#8B92A9] py-8 text-center">No data</div>;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="truncate text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB]" title={d[labelKey]}>{d[labelKey] || "—"}</span>
              <span className="text-[11px] font-bold tabular-nums text-[#0F1117] dark:text-[#DDE1F5] ml-2">{format ? format(d[valueKey]) : num(d[valueKey])}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${((Number(d[valueKey]) || 0) / max) * 100}%`, background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}CC, ${COLORS[i % COLORS.length]})` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Donut with center total ──────────────────────────────────────────────────
function Donut({ data, format, centerLabel }) {
  const rows = (data || []).filter((d) => (Number(d.value) || 0) > 0);
  const total = rows.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  let acc = 0;
  const R = 54, C = 2 * Math.PI * R;
  if (!rows.length) return <div className="text-[12px] text-[#8B92A9] py-8 text-center">No data</div>;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[130px] h-[130px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <g transform="translate(70,70) rotate(-90)">
            <circle r={R} fill="none" stroke="currentColor" className="text-[#F1F3F9] dark:text-white/5" strokeWidth="15" />
            {rows.slice(0, 10).map((d, i) => {
              const frac = (Number(d.value) || 0) / total;
              const el = <circle key={i} r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="15" strokeLinecap="round" strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`} strokeDashoffset={-acc * C} />;
              acc += frac; return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#8B92A9] uppercase tracking-wide">{centerLabel || "Total"}</span>
          <span className="text-[14px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{format ? format(total) : num(total)}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {rows.slice(0, 6).map((d, i) => {
          const DIcon = DEVICE_ICON[String(d.label).toUpperCase()] || null;
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              {DIcon && <DIcon className="w-3 h-3 text-[#8B92A9] shrink-0" />}
              <span className="truncate text-[#4B5168] dark:text-[#9DA3BB] capitalize">{String(d.label).toLowerCase().replace(/_/g, " ")}</span>
              <span className="ml-auto font-bold text-[#0F1117] dark:text-[#DDE1F5]">{Math.round((d.value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortableTable({ columns, rows, initialSort }) {
  const [sort, setSort] = useState(initialSort || { key: columns[0].key, dir: "desc" });
  const sorted = useMemo(() => {
    const arr = [...(rows || [])];
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      av = av ?? -Infinity; bv = bv ?? -Infinity;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sort]);
  const toggle = (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  if (!rows || !rows.length) return <div className={`${CARD} py-6 text-center text-[12px] text-[#8B92A9]`}>No rows</div>;
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
          {columns.map((c) => (
            <th key={c.key} onClick={() => toggle(c.key)}
              className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 cursor-pointer whitespace-nowrap select-none hover:text-[#4B5168] ${c.align === "right" ? "text-right" : "text-left"}`}>
              <span className="inline-flex items-center gap-1">{c.label}{sort.key === c.key ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 text-[12px] text-[#222733] dark:text-[#C9CEE0] whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : "text-left"}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, sub, icon: Icon, children }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-[#8B92A9]" />}
        <div>
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</p>
          {sub && <p className="text-[11px] text-[#8B92A9]">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function GoogleAdsBreakdown({ from, to }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setNote("");
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get("/google-ads-api/report", { params });
      setReport(data);
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === "NOT_CONNECTED") setNote("Connect Google Ads above to see analytics.");
      else if (code === "NO_ACCOUNT") setNote("Pick a Google Ads account above to load analytics.");
      else if (code === "NO_DEV_TOKEN") setNote("Server developer token not set — add it to load analytics.");
      else setNote(e?.response?.data?.message || "Could not load Google Ads analytics.");
      setReport(null);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const o = report?.overall || {};
  const ts = report?.timeseries || [];
  const dates = ts.map((d) => d.date);
  const hasData = (o.impressions || 0) > 0 || (o.cost || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-white" /></span>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Google Ads Analytics</p>
          {report?.account?.customerName && <p className="text-[11px] text-[#8B92A9]">{report.account.customerName} · {report.range?.from} → {report.range?.to}</p>}
        </div>
        <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-[11px] font-bold shadow-sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>

      {note && <div className={`${CARD} p-6 text-center`}><p className="text-[12px] text-[#8B92A9]">{note}</p></div>}
      {loading && !report && <div className={`${CARD} p-12 flex justify-center`}><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" /></div>}

      {report && !note && (
        <>
          {report.partialErrors && Object.keys(report.partialErrors).some((k) => report.partialErrors[k]) && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>Some sections couldn't load: {Object.keys(report.partialErrors).filter((k) => report.partialErrors[k]).join(", ")}. Everything else is shown below.</span>
            </div>
          )}

          {/* Plain-language summary strip */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500 via-blue-500 to-sky-500 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1.5"><Sparkles className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wider opacity-90">At a glance</span></div>
            {hasData ? (
              <p className="text-[13px] leading-relaxed">
                You spent <b>{cur(o.cost)}</b> to get <b>{num(o.impressions)}</b> impressions and <b>{num(o.clicks)}</b> clicks
                (<b>{pct(o.ctr)}</b> CTR), driving <b>{num(o.conversions)}</b> conversions at <b>{cur(o.costPerConversion)}</b> each.
                Average cost per click was <b>{cur(o.avgCpc)}</b>.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed opacity-95">No ad spend in this period. Pick a wider date range or a period when your campaigns were active to see the numbers come alive.</p>
            )}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Kpi icon={Eye} label="Impressions" value={compact(o.impressions)} tint="#6366F1" hint={num(o.impressions)} />
            <Kpi icon={MousePointerClick} label="Clicks" value={compact(o.clicks)} tint="#0EA5E9" hint={`${pct(o.ctr)} CTR`} />
            <Kpi icon={IndianRupee} label="Cost" value={curC(o.cost)} tint="#EF4444" hint={cur(o.cost)} />
            <Kpi icon={Target} label="Conversions" value={num(o.conversions)} tint="#10B981" hint={`${cur(o.costPerConversion)}/conv`} />
            <Kpi icon={Percent} label="CTR" value={pct(o.ctr)} tint="#F59E0B" />
            <Kpi icon={IndianRupee} label="Avg CPC" value={cur(o.avgCpc)} tint="#8B5CF6" />
            <Kpi icon={TrendingUp} label="CPM" value={cur(o.cpm)} tint="#EC4899" hint="per 1,000 impr." />
            <Kpi icon={Film} label="Video Views" value={compact(o.videoViews)} tint="#14B8A6" hint={num(o.videoViews)} />
          </div>

          {/* Time series */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Impressions & Clicks" sub="Daily trend — hover for details" icon={TrendingUp}>
              <AreaLineChart points={dates}
                fmt={{ impr: num, clk: num }}
                series={[
                  { key: "impr", label: "Impressions", color: "#6366F1", data: ts.map((d) => d.impressions) },
                  { key: "clk", label: "Clicks", color: "#0EA5E9", data: ts.map((d) => d.clicks) },
                ]} />
            </Panel>
            <Panel title="Cost & Conversions" sub="Daily trend — hover for details" icon={IndianRupee}>
              <AreaLineChart points={dates}
                fmt={{ cost: cur, conv: num }}
                series={[
                  { key: "cost", label: "Cost", color: "#EF4444", data: ts.map((d) => d.cost) },
                  { key: "conv", label: "Conversions", color: "#10B981", data: ts.map((d) => d.conversions) },
                ]} />
            </Panel>
          </div>

          {/* Bars + donut */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Top Campaigns by Spend" icon={BarChart3}>
              <RankBars rows={[...(report.campaigns || [])].sort((a, b) => b.cost - a.cost)} valueKey="cost" labelKey="campaignName" format={cur} />
            </Panel>
            <Panel title="Spend by Device" icon={Monitor}>
              <Donut data={(report.devices || []).map((d) => ({ label: d.device, value: d.cost }))} format={cur} centerLabel="Spend" />
            </Panel>
          </div>

          <Panel title="Top Ad Groups by Spend" icon={Layers}>
            <RankBars rows={[...(report.adGroups || [])].sort((a, b) => b.cost - a.cost)} valueKey="cost" labelKey="adGroupName" format={cur} />
          </Panel>

          {/* Tables */}
          <div>
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Ad Groups</p>
            <SortableTable initialSort={{ key: "cost", dir: "desc" }} rows={report.adGroups} columns={[
              { key: "adGroupName", label: "Ad Group", render: (r) => <span className="font-semibold">{r.adGroupName}</span> },
              { key: "campaignName", label: "Campaign" },
              { key: "impressions", label: "Impr.", align: "right", render: (r) => num(r.impressions) },
              { key: "clicks", label: "Clicks", align: "right", render: (r) => num(r.clicks) },
              { key: "cost", label: "Cost", align: "right", render: (r) => cur(r.cost) },
              { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
              { key: "avgCpc", label: "CPC", align: "right", render: (r) => cur(r.avgCpc) },
              { key: "conversions", label: "Conv.", align: "right", render: (r) => num(r.conversions) },
            ]} />
          </div>

          <div>
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Campaigns</p>
            <SortableTable initialSort={{ key: "cost", dir: "desc" }} rows={report.campaigns} columns={[
              { key: "campaignName", label: "Campaign", render: (r) => <span className="font-semibold">{r.campaignName}</span> },
              { key: "status", label: "Status", render: (r) => {
                  const s = String(r.status || "").toUpperCase();
                  const on = s === "ENABLED" || s === "ACTIVE";
                  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${on ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>{s ? s.toLowerCase() : "—"}</span>;
                } },
              { key: "impressions", label: "Impr.", align: "right", render: (r) => num(r.impressions) },
              { key: "clicks", label: "Clicks", align: "right", render: (r) => num(r.clicks) },
              { key: "cost", label: "Cost", align: "right", render: (r) => cur(r.cost) },
              { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
              { key: "conversions", label: "Conv.", align: "right", render: (r) => num(r.conversions) },
              { key: "videoViews", label: "Views", align: "right", render: (r) => num(r.videoViews) },
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
