import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../data/axiosConfig";
import {
  Loader2, AlertTriangle, RefreshCw, Eye, MousePointerClick, IndianRupee,
  Target, BarChart3, ExternalLink, Layers, Zap, Activity, Image,
  ChevronDown, ChevronUp, ArrowUpDown, Search, TrendingUp, TrendingDown,
  Minus, Users, Percent, Star, AlertCircle, CheckCircle2, Info,
} from "lucide-react";

// GET /meta-config/ad-level?from=&to=
// Campaign-level grouping + individual ad performance + creative + improvement tips.

const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money = (v) => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const num   = (v) => Number(v || 0).toLocaleString("en-IN");
const pct   = (v) => v == null ? "—" : `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#64748B"];

const STATUS_STYLE = {
  ACTIVE:          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  PAUSED:          "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  DELETED:         "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  CAMPAIGN_PAUSED: "bg-slate-100 text-slate-500 dark:bg-white/5",
  ADSET_PAUSED:    "bg-slate-100 text-slate-500 dark:bg-white/5",
};

// ── Performance score from metrics ──────────────────────────────────────────
function scoreAd(m) {
  const ctr = Number(m.ctr) || 0;
  const cpc = Number(m.cpc) || 0;
  const freq= Number(m.frequency) || 0;
  if (ctr >= 2 && freq <= 4) return { label: "Good",          color: "#10B981", bg: "bg-emerald-50 dark:bg-emerald-950/20", icon: CheckCircle2 };
  if (ctr >= 1 || (cpc > 0 && freq <= 6)) return { label: "Fair",   color: "#F59E0B", bg: "bg-amber-50 dark:bg-amber-950/20",   icon: Info };
  return { label: "Needs Attention", color: "#EF4444", bg: "bg-rose-50 dark:bg-rose-950/20", icon: AlertCircle };
}

// ── Improvement tips from ad metrics ─────────────────────────────────────────
function getTips(m, cr) {
  const tips = [];
  const ctr  = Number(m.ctr)  || 0;
  const freq = Number(m.frequency) || 0;
  const cpc  = Number(m.cpc)  || 0;
  const reach= Number(m.reach)|| 0;
  const impr = Number(m.impressions) || 0;

  if (ctr < 1)  tips.push("Low CTR (< 1%) — try a stronger hook in your headline or use a more attention-grabbing image/video.");
  if (ctr >= 3) tips.push("High CTR — this ad is performing well. Consider increasing the budget to scale reach.");
  if (freq > 5) tips.push(`High frequency (${Number(freq).toFixed(1)}×) — the same audience is seeing this too often. Refresh the creative or expand the audience.`);
  if (freq > 8) tips.push("Audience fatigue — CPM is likely rising. Pause or rotate this ad creative.");
  if (cpc > 50) tips.push("High CPC — test different creatives or audience segments to reduce click cost.");
  if (reach > 0 && impr > 0 && (impr / reach) > 6) tips.push("Very high frequency relative to reach — widen your audience targeting.");
  if (!cr.headline && !cr.body) tips.push("No creative copy detected — ensure the ad creative is properly set up in Meta Ads Manager.");
  if (cr.cta === "LEARN_MORE" && ctr < 1) tips.push("'Learn More' CTA with low CTR — try 'Sign Up', 'Get Quote', or 'Contact Us' for a more direct call-to-action.");
  return tips.length ? tips : ["Ad is performing within normal range. Monitor frequency and CTR over time."];
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, tint }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E4E7EF] dark:border-[#1E2133] p-3.5 hover:shadow-md transition-all"
      style={{ background: `linear-gradient(135deg, ${tint}14 0%, transparent 70%)` }}>
      <div className="absolute -right-4 -top-4 w-14 h-14 rounded-full opacity-[0.07]" style={{ background: tint }} />
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${tint}22` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{label}</span>
      </div>
      <p className="text-[20px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{value}</p>
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ data, format, centerLabel }) {
  const rows = (data || []).filter((d) => (Number(d.value) || 0) > 0);
  const total = rows.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  let acc = 0; const R = 52, C = 2 * Math.PI * R;
  if (!rows.length) return <div className="text-[12px] text-[#8B92A9] py-6 text-center">No data</div>;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[120px] h-[120px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <g transform="translate(70,70) rotate(-90)">
            <circle r={R} fill="none" stroke="currentColor" className="text-[#F1F3F9] dark:text-white/5" strokeWidth="15" />
            {rows.slice(0, 10).map((d, i) => {
              const frac = (Number(d.value) || 0) / total;
              const el = <circle key={i} r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="15" strokeLinecap="round"
                strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`} strokeDashoffset={-acc * C} />;
              acc += frac; return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#8B92A9] uppercase tracking-wide">{centerLabel || "Total"}</span>
          <span className="text-[13px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{format ? format(total) : num(total)}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {rows.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate text-[#4B5168] dark:text-[#9DA3BB]" title={d.label}>{d.label}</span>
            <span className="ml-auto font-bold text-[#0F1117] dark:text-[#DDE1F5]">{format ? format(d.value) : `${Math.round((d.value / total) * 100)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Campaign summary card ─────────────────────────────────────────────────────
function CampaignCard({ name, ads, idx }) {
  const [open, setOpen] = useState(false);
  const spend = ads.reduce((s, a) => s + (a.metrics.spend || 0), 0);
  const impr  = ads.reduce((s, a) => s + (a.metrics.impressions || 0), 0);
  const reach = ads.reduce((s, a) => s + (a.metrics.reach || 0), 0);
  const clicks= ads.reduce((s, a) => s + (a.metrics.clicks || 0), 0);
  const ctr   = impr > 0 ? (clicks / impr) * 100 : 0;
  const active= ads.filter((a) => a.status === "ACTIVE").length;
  const paused= ads.filter((a) => a.status === "PAUSED" || a.status === "CAMPAIGN_PAUSED").length;
  const score = scoreAd({ ctr, cpc: spend > 0 && clicks > 0 ? spend / clicks : 0, frequency: 0 });
  const ScoreIcon = score.icon;

  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* Campaign header */}
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(!open)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0"
          style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{name}</p>
          <p className="text-[11px] text-[#8B92A9]">{ads.length} ads · {active} active · {paused} paused</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{money(spend)}</p>
            <p className="text-[10px] text-[#8B92A9]">Spent</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{pct(ctr)}</p>
            <p className="text-[10px] text-[#8B92A9]">CTR</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${score.bg}`} style={{ color: score.color }}>
            <ScoreIcon className="w-3 h-3" />{score.label}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-[#8B92A9]" /> : <ChevronDown className="w-4 h-4 text-[#8B92A9]" />}
        </div>
      </div>

      {/* Campaign metrics strip */}
      <div className="grid grid-cols-4 sm:grid-cols-8 bg-[#F8F9FC] dark:bg-[#0D0F14] border-t border-[#E4E7EF] dark:border-[#1E2133] divide-x divide-[#E4E7EF] dark:divide-[#1E2133]">
        {[["Spend", money(spend)], ["Impressions", num(impr)], ["Reach", num(reach)], ["Clicks", num(clicks)],
          ["CTR", pct(ctr)], ["CPM", money(impr > 0 ? (spend / impr) * 1000 : 0)], ["CPC", money(clicks > 0 ? spend / clicks : 0)], ["Ads", ads.length]].map(([k, v]) => (
          <div key={k} className="flex flex-col px-2 py-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</span>
            <span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      {/* Expanded — individual ads */}
      {open && (
        <div className="divide-y divide-[#F1F3F9] dark:divide-white/5">
          {ads.map((ad, i) => <AdRow key={ad.adId || i} ad={ad} />)}
        </div>
      )}
    </div>
  );
}

// ── Individual ad row (inside campaign card) ──────────────────────────────────
function AdRow({ ad }) {
  const [showCreative, setShowCreative] = useState(false);
  const [showTips,     setShowTips]     = useState(false);
  const m  = ad.metrics || {};
  const cr = ad.creative || {};
  const score = scoreAd(m);
  const tips  = getTips(m, cr);
  const statusCls = STATUS_STYLE[ad.status] || "bg-slate-100 text-slate-500 dark:bg-white/5";
  const ScoreIcon = score.icon;

  return (
    <div className="px-4 py-3 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.015] transition-colors">
      {/* Row header */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{ad.adName}</p>
          <p className="text-[10px] text-[#8B92A9] truncate">{ad.adsetName}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {ad.status && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>
              {ad.status.toLowerCase().replace(/_/g, " ")}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${score.bg}`} style={{ color: score.color }}>
            <ScoreIcon className="w-3 h-3" />{score.label}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-2">
        {[["Spend", money(m.spend)], ["Impr.", num(m.impressions)], ["Reach", num(m.reach)], ["Clicks", num(m.clicks)],
          ["CTR", pct(m.ctr)], ["CPM", money(m.cpm)], ["CPC", money(m.cpc)], ["Freq.", Number(m.frequency || 0).toFixed(1) + "×"]].map(([k, v]) => (
          <div key={k} className="bg-[#F8F9FC] dark:bg-white/5 rounded-lg px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</p>
            <p className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        {(cr.body || cr.headline || cr.thumbnail) && (
          <button onClick={() => setShowCreative(!showCreative)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            <Image className="w-3 h-3" />{showCreative ? "Hide creative" : "View creative"}
          </button>
        )}
        <button onClick={() => setShowTips(!showTips)}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${showTips ? "text-amber-600" : "text-[#8B92A9] hover:text-amber-600"}`}>
          <Zap className="w-3 h-3" />{showTips ? "Hide tips" : `${tips.length} improvement tip${tips.length !== 1 ? "s" : ""}`}
        </button>
        {cr.linkUrl && (
          <a href={cr.linkUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline ml-auto">
            <ExternalLink className="w-3 h-3" />{cr.linkUrl.replace(/^https?:\/\//, "").slice(0, 35)}{cr.linkUrl.length > 40 ? "…" : ""}
          </a>
        )}
      </div>

      {/* Creative panel */}
      {showCreative && (cr.body || cr.headline || cr.thumbnail) && (
        <div className="mt-3 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133]">
          <div className="flex gap-3">
            {cr.thumbnail && (
              <img src={cr.thumbnail} alt="Ad" className="w-20 h-20 object-cover rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] shrink-0"
                onError={(e) => { e.target.style.display = "none"; }} />
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              {cr.headline && <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{cr.headline}</p>}
              {cr.body && <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{cr.body}</p>}
              {cr.cta && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                  <Zap className="w-3 h-3" />{cr.cta.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Improvement tips */}
      {showTips && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Improvement Suggestions
          </p>
          <ul className="space-y-1.5">
            {tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800/40 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Sortable flat ads table ───────────────────────────────────────────────────
function AdsTable({ ads }) {
  const [sort, setSort] = useState({ key: "spend", dir: "desc" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1); const PER = 15;
  const toggle = (k) => setSort((s) => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (ads || []).filter((a) => !q || a.adName.toLowerCase().includes(q) || (a.campaignName || "").toLowerCase().includes(q));
  }, [ads, search]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sort.key === "spend" ? a.metrics.spend : sort.key === "ctr" ? a.metrics.ctr : sort.key === "impressions" ? a.metrics.impressions : sort.key === "clicks" ? a.metrics.clicks : sort.key === "cpc" ? a.metrics.cpc : sort.key === "frequency" ? a.metrics.frequency : (a[sort.key] || 0);
      const bv = sort.key === "spend" ? b.metrics.spend : sort.key === "ctr" ? b.metrics.ctr : sort.key === "impressions" ? b.metrics.impressions : sort.key === "clicks" ? b.metrics.clicks : sort.key === "cpc" ? b.metrics.cpc : sort.key === "frequency" ? b.metrics.frequency : (b[sort.key] || 0);
      return sort.dir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return arr;
  }, [filtered, sort]);
  const pages = Math.ceil(sorted.length / PER);
  const paged = sorted.slice((page - 1) * PER, page * PER);
  const cols = [
    { key: "adName",      label: "Ad" },
    { key: "campaignName",label: "Campaign" },
    { key: "status",      label: "Status" },
    { key: "score",       label: "Score" },
    { key: "spend",       label: "Spend",       align: "right" },
    { key: "impressions", label: "Impr.",        align: "right" },
    { key: "clicks",      label: "Clicks",       align: "right" },
    { key: "ctr",         label: "CTR",          align: "right" },
    { key: "cpc",         label: "CPC",          align: "right" },
    { key: "frequency",   label: "Freq.",         align: "right" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ads or campaigns…"
            className="w-full text-[12px] pl-8 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
        </div>
        <span className="text-[11px] text-[#8B92A9] ml-auto">{sorted.length} ads</span>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
            {cols.map((c) => (
              <th key={c.key} onClick={() => toggle(c.key)}
                className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 cursor-pointer whitespace-nowrap select-none hover:text-[#4B5168] ${c.align === "right" ? "text-right" : "text-left"}`}>
                <span className="inline-flex items-center gap-1">{c.label}{sort.key === c.key ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {paged.map((ad, i) => {
              const m = ad.metrics || {}; const score = scoreAd(m); const ScoreIcon = score.icon;
              const statusCls = STATUS_STYLE[ad.status] || "bg-slate-100 text-slate-500 dark:bg-white/5";
              return (
                <tr key={ad.adId || i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] max-w-[180px] truncate" title={ad.adName}>{ad.adName}</td>
                  <td className="px-3 py-2.5 text-[11px] text-[#8B92A9] max-w-[140px] truncate" title={ad.campaignName}>{ad.campaignName}</td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls}`}>{(ad.status || "").toLowerCase().replace(/_/g, " ")}</span></td>
                  <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${score.bg}`} style={{ color: score.color }}><ScoreIcon className="w-3 h-3" />{score.label}</span></td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{money(m.spend)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-[#4B5168] dark:text-[#9DA3BB]">{num(m.impressions)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-[#4B5168] dark:text-[#9DA3BB]">{num(m.clicks)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-semibold" style={{ color: Number(m.ctr) >= 2 ? "#10B981" : Number(m.ctr) >= 1 ? "#F59E0B" : "#EF4444" }}>{pct(m.ctr)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-[#4B5168] dark:text-[#9DA3BB]">{money(m.cpc)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums" style={{ color: Number(m.frequency) > 5 ? "#EF4444" : Number(m.frequency) > 3 ? "#F59E0B" : "#10B981" }}>{Number(m.frequency || 0).toFixed(1)}×</td>
                </tr>
              );
            })}
            {!paged.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No ads match</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="flex justify-center gap-1">{Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
        <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-[11px] font-semibold ${page === p ? "bg-indigo-600 text-white" : "bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] hover:bg-indigo-50"}`}>{p}</button>
      ))}</div>}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function MetaAdLevelReport() {
  const [from,    setFrom]   = useState(isoDaysAgo(30));
  const [to,      setTo]     = useState(isoDaysAgo(0));
  const [data,    setData]   = useState(null);
  const [loading, setLoad]   = useState(false);
  const [error,   setError]  = useState("");
  const [view,    setView]   = useState("campaigns"); // campaigns | table

  const load = useCallback(async () => {
    setLoad(true); setError("");
    try { const { data: d } = await api.get("/meta-config/ad-level", { params: { from, to } }); setData(d); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load ad-level data."); }
    finally { setLoad(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const ctr = (t.impressions > 0) ? ((t.clicks / t.impressions) * 100).toFixed(2) : 0;

  // Group ads by campaign
  const byCampaign = useMemo(() => {
    const map = {};
    (data?.ads || []).forEach((a) => {
      const k = a.campaignName || "Unknown";
      if (!map[k]) map[k] = [];
      map[k].push(a);
    });
    return Object.entries(map).sort((a, b) => {
      const sa = a[1].reduce((s, x) => s + (x.metrics.spend || 0), 0);
      const sb = b[1].reduce((s, x) => s + (x.metrics.spend || 0), 0);
      return sb - sa;
    });
  }, [data]);

  const goodAds = (data?.ads || []).filter((a) => scoreAd(a.metrics).label === "Good").length;
  const needsAds= (data?.ads || []).filter((a) => scoreAd(a.metrics).label === "Needs Attention").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </span>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Meta Ad-Level Performance</p>
          <p className="text-[11px] text-[#8B92A9]">Spend · reach · CTR · frequency · creative preview · improvement tips per ad</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl px-3 py-2">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="text-[11px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
            </div>
            <span className="text-[#C4C9DA]">→</span>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="text-[11px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
            </div>
            {loading && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin ml-1" />}
          </div>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-[11px] font-bold shadow-sm">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-600 text-[13px] font-semibold"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {loading && !data && <div className={`${CARD} p-12 flex justify-center`}><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" /></div>}

      {data && !data.configured && (
        <div className={`${CARD} p-8 text-center`}>
          <BarChart3 className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">No Meta ad accounts configured</p>
          <p className="text-[12px] text-[#8B92A9]">Add an Ad Account ID + ads_read token to a Meta campaign config.</p>
        </div>
      )}

      {data && data.configured && data.ads && (
        <>
          {data.errors && data.errors.length > 0 && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>{data.errors.map((e) => `${e.account}: ${e.error}`).join(" · ")}</span>
            </div>
          )}

          {/* Summary strip */}
          {t.spend > 0 && (
            <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1.5">{data.ads.length} ads across {byCampaign.length} campaigns · {data.range?.from} → {data.range?.to}</p>
              <p className="text-[13px] leading-relaxed">
                Total spend <b>{money(t.spend)}</b> — reached <b>{num(t.reach)}</b> people with <b>{num(t.impressions)}</b> impressions
                and <b>{num(t.clicks)}</b> clicks (<b>{pct(ctr)}</b> CTR).{" "}
                <b className="text-emerald-300">{goodAds} ads</b> performing well,{" "}
                <b className="text-rose-300">{needsAds} ads</b> need attention.
              </p>
            </div>
          )}

          {/* KPIs */}
          {t.spend > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Kpi icon={IndianRupee}       label="Total Spend"    value={"₹" + Number(t.spend).toLocaleString("en-IN", { maximumFractionDigits: 0 })} tint="#EF4444" />
              <Kpi icon={Eye}               label="Impressions"    value={Number(t.impressions).toLocaleString("en-IN")} tint="#6366F1" />
              <Kpi icon={Users}             label="Reach"          value={Number(t.reach).toLocaleString("en-IN")}       tint="#10B981" />
              <Kpi icon={MousePointerClick} label="Clicks"         value={Number(t.clicks).toLocaleString("en-IN")}      tint="#0EA5E9" />
              <Kpi icon={Percent}           label="CTR"            value={pct(ctr)}            tint="#F59E0B" />
              <Kpi icon={Activity}          label="Campaigns"      value={byCampaign.length}   tint="#8B5CF6" />
              <Kpi icon={CheckCircle2}      label="Good Ads"       value={goodAds}             tint="#10B981" />
              <Kpi icon={AlertCircle}       label="Need Attention" value={needsAds}            tint="#EF4444" />
            </div>
          )}

          {/* Spend share donut */}
          {byCampaign.length > 0 && t.spend > 0 && (
            <div className={`${CARD} p-4`}>
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Spend Share by Campaign</p>
              <Donut data={byCampaign.map(([name, ads]) => ({ label: name, value: ads.reduce((s, a) => s + (a.metrics.spend || 0), 0) }))} format={money} centerLabel="Spend" />
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Ad Details</p>
            <div className="ml-auto flex items-center gap-1 bg-[#F1F3F9] dark:bg-white/5 rounded-xl p-1">
              {[["campaigns", "By Campaign"], ["table", "Table View"]].map(([v, l]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${view === v ? "bg-white dark:bg-[#11131C] text-indigo-600 shadow-sm" : "text-[#8B92A9] hover:text-[#4B5168]"}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Campaign view */}
          {view === "campaigns" && (
            <div className="space-y-2.5">
              {byCampaign.length === 0 && <div className={`${CARD} p-10 text-center text-[12px] text-[#8B92A9]`}>No ads found in this period.</div>}
              {byCampaign.map(([name, ads], i) => <CampaignCard key={name} name={name} ads={ads} idx={i} />)}
            </div>
          )}

          {/* Table view */}
          {view === "table" && <AdsTable ads={data.ads} />}
        </>
      )}
    </div>
  );
}
