import { useState, useCallback, useEffect } from "react";
import api from "../data/axiosConfig";
import {
  TrendingUp, AlertTriangle, AlertCircle, CheckCircle2, Info,
  Sparkles, Lightbulb, ThumbsUp, ThumbsDown, FileDown, Loader2,
  BarChart3, Target, Zap, ArrowUpRight, Users, PauseCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Source Performance Report (Google Ads / Website) — admin
//
// Shares the Meta Ad Performance layout, but the data is built from CRM lead
// data (there is no live ad-insights API for these channels), so it reports
// leads / converted / conversion rate per campaign — plus cost-per-lead for
// Google Ads where a spend has been entered on the campaign config.
//
// Driven entirely by props so both tabs reuse this one component:
//   endpoint   e.g. "/google-ads-config/insights"
//   title, subtitle, Icon
//   theme      "blue" | "emerald"  (accent styling)
//   withCost   Google Ads = true, Website = false
// ─────────────────────────────────────────────────────────────────────────────

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money  = (v) => v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const numfmt = (v) => Number(v || 0).toLocaleString("en-IN");
const pct    = (v) => v == null ? "—" : `${v}%`;

const ISSUE_STYLE = {
  error: { icon: AlertCircle,   bg: "bg-rose-50 dark:bg-rose-950/30",       border: "border-rose-200 dark:border-rose-800/50",       text: "text-rose-600 dark:text-rose-400" },
  warn:  { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-amber-200 dark:border-amber-800/50",     text: "text-amber-600 dark:text-amber-400" },
  info:  { icon: Info,          bg: "bg-sky-50 dark:bg-sky-950/30",         border: "border-sky-200 dark:border-sky-800/50",         text: "text-sky-600 dark:text-sky-400" },
  ok:    { icon: CheckCircle2,  bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/50", text: "text-emerald-600 dark:text-emerald-400" },
};

const VERDICT_STYLE = {
  Scale:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Optimize: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Pause:    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Watch:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
};

// Per-theme accent classes so the two tabs read as siblings of Meta, not clones.
const THEME = {
  blue: {
    solid: "bg-blue-600", solidHover: "hover:bg-blue-700",
    headerIcon: "bg-blue-600",
    cardIcon: "bg-blue-100 dark:bg-blue-950/40", cardIconText: "text-blue-600 dark:text-blue-400",
    aiBar: "from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20",
    aiBadge: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    borderHover: "hover:border-blue-400 dark:hover:border-blue-600",
    numChip: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    barL: "border-blue-400", spin: "text-blue-500",
  },
  emerald: {
    solid: "bg-emerald-600", solidHover: "hover:bg-emerald-700",
    headerIcon: "bg-emerald-600",
    cardIcon: "bg-emerald-100 dark:bg-emerald-950/40", cardIconText: "text-emerald-600 dark:text-emerald-400",
    aiBar: "from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
    aiBadge: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    borderHover: "hover:border-emerald-400 dark:hover:border-emerald-600",
    numChip: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    barL: "border-emerald-400", spin: "text-emerald-500",
  },
};

const STAT_ICONS = [BarChart3, Users, Target, ArrowUpRight, Zap, TrendingUp, BarChart3];
const STAT_ACCENT = ["text-indigo-500", "text-blue-500", "text-emerald-500", "text-sky-500", "text-violet-500", "text-amber-500", "text-teal-500"];
const STAT_BG = [
  "bg-indigo-50 dark:bg-indigo-950/30", "bg-blue-50 dark:bg-blue-950/30",
  "bg-emerald-50 dark:bg-emerald-950/30", "bg-sky-50 dark:bg-sky-950/30",
  "bg-violet-50 dark:bg-violet-950/30", "bg-amber-50 dark:bg-amber-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
];

function StatCard({ label, value, icon: Icon, accent, bg }) {
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 flex flex-col gap-3">
      <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{label}</p>
        <p className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">{value}</p>
      </div>
    </div>
  );
}

export default function SourcePerformanceReport({
  endpoint,
  title = "Performance",
  subtitle = "",
  icon: HeaderIcon = TrendingUp,
  theme = "blue",
  withCost = false,
}) {
  const th = THEME[theme] || THEME.blue;

  const [from, setFrom]           = useState(isoDaysAgo(30));
  const [to, setTo]               = useState(isoDaysAgo(0));
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [error, setError]         = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get(endpoint, { params: { from, to, ai: "false" } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load performance report.");
    } finally {
      setLoading(false);
    }
  }, [from, to, endpoint]);

  const generateAI = useCallback(async () => {
    setAiLoading(true); setError("");
    try {
      const { data } = await api.get(endpoint, { params: { from, to, ai: "true" }, timeout: 60000 });
      setData(data);
    } catch (e) {
      const status = e?.response?.status;
      setError(
        e.code === "ECONNABORTED" ? "AI report timed out — try again in a moment." :
        status === 429            ? "AI is rate-limited. Please wait a moment and retry." :
        e?.response?.data?.message || "AI report failed."
      );
    } finally {
      setAiLoading(false);
    }
  }, [from, to, endpoint]);

  useEffect(() => { load(); }, [from, to]); // eslint-disable-line

  const exportPDF = () => window.print();
  const t = data?.totals;

  // KPI cards differ by channel: Google Ads shows spend/cost, Website is lead-only.
  const kpis = t ? (withCost ? [
    { label: "Total Spend",  value: money(t.cost) },
    { label: "Leads",        value: numfmt(t.leads) },
    { label: "Converted",    value: numfmt(t.converted) },
    { label: "Conv. Rate",   value: pct(t.conversionRatePct) },
    { label: "Cost / Lead",  value: t.costPerLead == null ? "—" : money(t.costPerLead) },
    { label: "Cost / Conv.", value: t.costPerConversion == null ? "—" : money(t.costPerConversion) },
    { label: "Campaigns",    value: numfmt(t.campaigns) },
  ] : [
    { label: "Leads",        value: numfmt(t.leads) },
    { label: "Converted",    value: numfmt(t.converted) },
    { label: "Conv. Rate",   value: pct(t.conversionRatePct) },
    { label: "Sources",      value: numfmt(t.campaigns) },
  ]) : [];

  const gridCols = withCost ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white; } .no-print { display: none !important; } }`}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${th.headerIcon} flex items-center justify-center`}>
              <HeaderIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{title}</h1>
              <p className="text-[12px] text-[#8B92A9]">{subtitle}</p>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl px-3 py-2">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="text-[12px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
              </div>
              <span className="text-[#C4C9DA] text-sm">→</span>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="text-[12px] font-semibold bg-transparent text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none cursor-pointer" />
              </div>
              {loading && <Loader2 className={`w-3.5 h-3.5 ${th.spin} animate-spin ml-1`} />}
            </div>

            <button onClick={generateAI} disabled={aiLoading || loading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${th.solid} ${th.solidHover} disabled:opacity-50 text-white text-[12px] font-semibold transition`}>
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? "Generating…" : data?.aiAnalysis ? "Re-generate AI" : "Generate AI Report"}
            </button>

            <button onClick={exportPDF} disabled={!data}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] text-[#4B5168] dark:text-[#9DA3BB] text-[12px] font-semibold ${th.borderHover} disabled:opacity-40 transition`}>
              <FileDown className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-[13px] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── KPI stat grid ────────────────────────────────────────────────── */}
        {loading && !t && (
          <div className={`grid ${gridCols} gap-3`}>
            {Array.from({ length: withCost ? 7 : 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {t && (
          <div className={`grid ${gridCols} gap-3`}>
            {kpis.map((c, i) => (
              <StatCard key={c.label} label={c.label} value={c.value}
                icon={STAT_ICONS[i]} accent={STAT_ACCENT[i]} bg={STAT_BG[i]} />
            ))}
          </div>
        )}

        {/* ── AI analysis panel ───────────────────────────────────────────── */}
        {data && (
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className={`flex items-center gap-2.5 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r ${th.aiBar}`}>
              <div className={`w-7 h-7 rounded-lg ${th.solid} flex items-center justify-center shrink-0`}>
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Performance Analysis & Suggestions</span>
              {data.aiFromCache && (
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${th.aiBadge}`}>Cached</span>
              )}
            </div>
            <div className="p-5">
              {!data.aiAnalysis && !data.aiAnalysisError ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Sparkles className="w-7 h-7 text-[#C4C9DA]" />
                  <p className="text-[13px] text-[#8B92A9]">No AI analysis yet.</p>
                  <p className="text-[12px] text-[#C4C9DA]">Click "Generate AI Report" above to run it.</p>
                </div>
              ) : data.aiAnalysisError ? (
                <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {data.aiAnalysisError}
                </div>
              ) : (
                <div className="space-y-4">
                  {data.aiAnalysis.summary && (
                    <p className={`text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed border-l-2 ${th.barL} pl-3`}>
                      {data.aiAnalysis.summary}
                    </p>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    {Array.isArray(data.aiAnalysis.topPerformers) && data.aiAnalysis.topPerformers.length > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Top Performers</span>
                        </div>
                        <ul className="space-y-2">
                          {data.aiAnalysis.topPerformers.map((p, i) => (
                            <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">
                              <span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{p.campaign}:</span> {p.why}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(data.aiAnalysis.underperformers) && data.aiAnalysis.underperformers.length > 0 && (
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Needs Attention</span>
                        </div>
                        <ul className="space-y-2">
                          {data.aiAnalysis.underperformers.map((p, i) => (
                            <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">
                              <span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{p.campaign}:</span> {p.issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {Array.isArray(data.aiAnalysis.suggestions) && data.aiAnalysis.suggestions.length > 0 && (
                    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">Improvement Suggestions</span>
                      </div>
                      <ul className="space-y-2">
                        {data.aiAnalysis.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                            <span className={`w-5 h-5 rounded-full ${th.numChip} text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5`}>{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Per-campaign cards ──────────────────────────────────────────── */}
        {data?.campaigns?.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3">
              {withCost ? "Campaign Breakdown" : "Source Breakdown"}
            </h2>
            <div className="space-y-3">
              {data.campaigns.map((c) => {
                const statusEntries = Object.entries(c.statusBreakdown || {}).sort((a, b) => b[1] - a[1]);
                const metrics = withCost ? [
                  ["Spend",     c.hasCost ? money(c.cost) : "—"],
                  ["Leads",     numfmt(c.leads)],
                  ["Converted", numfmt(c.converted)],
                  ["Conv Rate", pct(c.conversionRatePct)],
                  ["Cost/Lead", c.costPerLead == null ? "—" : money(c.costPerLead)],
                  ["Cost/Conv", c.costPerConversion == null ? "—" : money(c.costPerConversion)],
                ] : [
                  ["Leads",     numfmt(c.leads)],
                  ["Converted", numfmt(c.converted)],
                  ["Conv Rate", pct(c.conversionRatePct)],
                ];
                return (
                  <div key={c.configId} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl ${th.cardIcon} flex items-center justify-center shrink-0`}>
                          <BarChart3 className={`w-4 h-4 ${th.cardIconText}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{c.campaignName}</p>
                          {!c.configured && <p className="text-[11px] text-[#8B92A9]">Leads tagged to this name (no matching config)</p>}
                        </div>
                      </div>
                      {!c.active && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F0F2FA] dark:bg-[#1E2133] text-[#8B92A9]">
                          <PauseCircle className="w-3 h-3" /> Paused
                        </span>
                      )}
                    </div>

                    {/* Metrics row */}
                    <div className={`grid grid-cols-3 ${withCost ? "sm:grid-cols-6" : "sm:grid-cols-3"} bg-[#F8F9FC] dark:bg-[#0D0F14]`}>
                      {metrics.map(([k, v]) => (
                        <div key={k} className="flex flex-col px-4 py-3 border-r border-b sm:border-b-0 border-[#E4E7EF] dark:border-[#1E2133] last:border-r-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-1">{k}</span>
                          <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status breakdown chips */}
                    {statusEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-5 py-3 border-t border-[#E4E7EF] dark:border-[#1E2133]">
                        {statusEntries.map(([st, n]) => (
                          <span key={st} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F2FA] dark:bg-[#1E2133] text-[#4B5168] dark:text-[#9DA3BB]">
                            {st}: {n}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Issues */}
                    {(c.issues || []).length > 0 && (
                      <div className="px-5 py-3 space-y-2 border-t border-[#E4E7EF] dark:border-[#1E2133]">
                        {c.issues.map((iss, idx) => {
                          const st = ISSUE_STYLE[iss.level] || ISSUE_STYLE.info;
                          const Icon = st.icon;
                          return (
                            <div key={idx} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${st.bg} border ${st.border}`}>
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${st.text}`} />
                              <span className={`text-[12px] font-medium ${st.text}`}>{iss.msg}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Per-campaign AI suggestion */}
                    {c.aiSuggestion && (
                      <div className="px-5 pb-4 pt-2 border-t border-[#E4E7EF] dark:border-[#1E2133]">
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 mt-2">
                          <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                          <div className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">
                            {c.aiVerdict && (
                              <span className={`inline-block mr-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${VERDICT_STYLE[c.aiVerdict] || VERDICT_STYLE.Watch}`}>
                                {c.aiVerdict}
                              </span>
                            )}
                            {c.aiSuggestion}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {data && !loading && (!data.campaigns || data.campaigns.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl">
            <BarChart3 className="w-9 h-9 text-[#C4C9DA]" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No data in this period</p>
            <p className="text-[12px] text-[#8B92A9]">
              {withCost
                ? "No Google Ads leads or campaigns were found for the selected dates."
                : "No website leads or sources were found for the selected dates."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
