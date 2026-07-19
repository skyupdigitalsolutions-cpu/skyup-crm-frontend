import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import {
  Loader2, AlertTriangle, RefreshCw, Eye, MousePointerClick, IndianRupee,
  Target, BarChart3, Play, Image, FileText, ExternalLink, TrendingUp,
  ChevronDown, ChevronUp, Layers, Zap, Activity,
} from "lucide-react";

// GET /meta-config/ad-level?from=&to=
// Shows individual ad performance (spend, impressions, clicks, CTR) + creative
// (ad copy, headline, CTA, thumbnail, link) for all Meta ads in the date range.

const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money  = (v) => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const num    = (v) => Number(v || 0).toLocaleString("en-IN");
const pct    = (v) => v == null ? "—" : `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#64748B"];

const STATUS_STYLE = {
  ACTIVE:         "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  PAUSED:         "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  DELETED:        "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  CAMPAIGN_PAUSED:"bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
  ADSET_PAUSED:   "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
};

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, tint }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E4E7EF] dark:border-[#1E2133] p-3.5 transition-all hover:shadow-md"
      style={{ background: `linear-gradient(135deg, ${tint}14 0%, transparent 70%)` }}>
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-[0.07]" style={{ background: tint }} />
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

// ── Spend bars per campaign ───────────────────────────────────────────────────
function SpendBars({ ads }) {
  const byC = {};
  (ads || []).forEach((a) => {
    const k = a.campaignName || "Unknown";
    byC[k] = (byC[k] || 0) + (a.metrics.spend || 0);
  });
  const rows = Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max  = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return null;
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3 flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Spend by Campaign</p>
      <div className="space-y-2.5">
        {rows.map(([name, spend], i) => (
          <div key={name} className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="truncate text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB]">{name}</span>
                <span className="text-[11px] font-bold tabular-nums text-[#0F1117] dark:text-[#DDE1F5] ml-2">{money(spend)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(spend / max) * 100}%`, background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}CC, ${COLORS[i % COLORS.length]})` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Individual ad card ────────────────────────────────────────────────────────
function AdCard({ ad, idx }) {
  const [expanded, setExpanded] = useState(false);
  const m  = ad.metrics || {};
  const cr = ad.creative || {};
  const statusStyle = STATUS_STYLE[ad.status] || "bg-slate-100 text-slate-500 dark:bg-white/5";
  const hasThumbnail = !!cr.thumbnail;
  const hasCreative  = cr.body || cr.headline || cr.cta || cr.linkUrl;

  return (
    <div className={`${CARD} overflow-hidden transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#1E2133]">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
          style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{ad.adName}</p>
          <p className="text-[10px] text-[#8B92A9] truncate">{ad.campaignName}{ad.adsetName ? ` › ${ad.adsetName}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ad.status && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusStyle}`}>
              {ad.status.toLowerCase().replace(/_/g, " ")}
            </span>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-[#8B92A9] hover:text-indigo-600 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-4 sm:grid-cols-7 bg-[#F8F9FC] dark:bg-[#0D0F14] divide-x divide-[#E4E7EF] dark:divide-[#1E2133]">
        {[
          ["Spend",  money(m.spend)],
          ["Impr.",  num(m.impressions)],
          ["Reach",  num(m.reach)],
          ["Clicks", num(m.clicks)],
          ["CTR",    pct(m.ctr)],
          ["CPM",    money(m.cpm)],
          ["CPC",    money(m.cpc)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col px-3 py-2.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</span>
            <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      {/* Expandable creative */}
      {expanded && (
        <div className="px-4 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3 flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> Ad Creative</p>
          {hasCreative || hasThumbnail ? (
            <div className="flex gap-4">
              {hasThumbnail && (
                <img src={cr.thumbnail} alt="Ad thumbnail"
                  className="w-24 h-24 object-cover rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] shrink-0"
                  onError={(e) => { e.target.style.display = "none"; }} />
              )}
              <div className="flex-1 min-w-0 space-y-2">
                {cr.headline && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9]">Headline</span>
                    <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mt-0.5">{cr.headline}</p>
                  </div>
                )}
                {cr.body && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9]">Ad Copy</span>
                    <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5 leading-relaxed line-clamp-4">{cr.body}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {cr.cta && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                      <Zap className="w-3 h-3" />{cr.cta.replace(/_/g, " ")}
                    </span>
                  )}
                  {cr.linkUrl && (
                    <a href={cr.linkUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      {cr.linkUrl.replace(/^https?:\/\//, "").slice(0, 40)}{cr.linkUrl.length > 40 ? "…" : ""}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[#8B92A9]">No creative data available for this ad.</p>
          )}
          <p className="text-[10px] text-[#C4C9DA] mt-3">Ad ID: {ad.adId}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaAdLevelReport() {
  const [from, setFrom]     = useState(isoDaysAgo(30));
  const [to,   setTo]       = useState(isoDaysAgo(0));
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(false);
  const [error,  setError]  = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | paused

  const load = useCallback(async () => {
    setLoad(true); setError("");
    try {
      const { data: d } = await api.get("/meta-config/ad-level", { params: { from, to } });
      setData(d);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load ad-level data.");
    } finally { setLoad(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const ads = (data?.ads || []).filter((a) => {
    const matchSearch = !search || a.adName.toLowerCase().includes(search.toLowerCase()) || (a.campaignName || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "active" ? a.status === "ACTIVE" : a.status !== "ACTIVE";
    return matchSearch && matchFilter;
  });

  const t = data?.totals || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </span>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Meta Ad-Level Performance</p>
          <p className="text-[11px] text-[#8B92A9]">Individual ad spend, reach, clicks, CTR + creative preview</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl px-3 py-2">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="text-[12px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
            </div>
            <span className="text-[#C4C9DA]">→</span>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="text-[12px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
            </div>
            {loading && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin ml-1" />}
          </div>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-[11px] font-bold shadow-sm">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 text-[13px] font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Not configured */}
      {data && !data.configured && (
        <div className={`${CARD} p-8 text-center`}>
          <BarChart3 className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">No Meta ad accounts configured</p>
          <p className="text-[12px] text-[#8B92A9]">Add an Ad Account ID + ads_read token to a Meta campaign config to see individual ad performance.</p>
        </div>
      )}

      {loading && !data && (
        <div className={`${CARD} p-12 flex justify-center`}><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" /></div>
      )}

      {data && data.configured && (
        <>
          {/* Account errors */}
          {data.errors && data.errors.length > 0 && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>Some accounts had errors: {data.errors.map((e) => `${e.account}: ${e.error}`).join(" · ")}</span>
            </div>
          )}

          {/* Summary strip */}
          {t.spend > 0 && (
            <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">Ad-level summary · {data.ads.length} ads in period</p>
              <p className="text-[13px] leading-relaxed">
                Total spend <b>{money(t.spend)}</b> across <b>{num(t.impressions)}</b> impressions and <b>{num(t.reach)}</b> unique reach,
                generating <b>{num(t.clicks)}</b> clicks.
                {" "}<b>{(data.ads || []).filter((a) => a.status === "ACTIVE").length}</b> ads currently active,{" "}
                <b>{(data.ads || []).filter((a) => a.status === "PAUSED" || a.status === "CAMPAIGN_PAUSED" || a.status === "ADSET_PAUSED").length}</b> paused.
              </p>
            </div>
          )}

          {/* KPIs */}
          {t.spend > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Kpi icon={IndianRupee} label="Total Spend"   value={"₹" + Number(t.spend).toLocaleString("en-IN", { maximumFractionDigits: 0 })} tint="#EF4444" />
              <Kpi icon={Eye}         label="Impressions"   value={Number(t.impressions).toLocaleString("en-IN")} tint="#6366F1" />
              <Kpi icon={Target}      label="Reach"         value={Number(t.reach).toLocaleString("en-IN")} tint="#10B981" />
              <Kpi icon={MousePointerClick} label="Clicks"  value={Number(t.clicks).toLocaleString("en-IN")} tint="#0EA5E9" />
            </div>
          )}

          {/* Spend bars */}
          {data.ads.length > 0 && <SpendBars ads={data.ads} />}

          {/* Filter + search */}
          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ads or campaigns…"
              className="flex-1 min-w-[180px] text-[12px] px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
            {["all", "active", "paused"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold capitalize border transition-colors ${filter === f ? "bg-indigo-600 text-white border-indigo-600" : "border-[#E4E7EF] dark:border-[#1E2133] text-[#8B92A9] hover:border-indigo-400"}`}>
                {f}
              </button>
            ))}
            <span className="text-[11px] text-[#8B92A9]">{ads.length} ads</span>
          </div>

          {/* Ad cards */}
          {ads.length > 0 ? (
            <div className="space-y-2">
              {ads.map((ad, i) => <AdCard key={ad.adId || i} ad={ad} idx={i} />)}
            </div>
          ) : (
            <div className={`${CARD} p-10 text-center`}>
              <Layers className="w-7 h-7 text-[#C4C9DA] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No ads found</p>
              <p className="text-[12px] text-[#8B92A9] mt-0.5">Try a wider date range or different filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
