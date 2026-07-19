import { useState, useCallback, useEffect } from "react";
import api from "../data/axiosConfig";
import {
  TrendingUp, AlertTriangle, AlertCircle, CheckCircle2, Info,
  Sparkles, Lightbulb, ThumbsUp, ThumbsDown, FileDown, Loader2,
  BarChart3, MousePointerClick, Target, Zap, Eye, ArrowUpRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Ad Performance Report (admin)
// GET /meta-config/insights?from=&to=  →  spend / CPM / CPC / CTR / reach +
// cost-per-lead + per-campaign setup-issue detection.
// ─────────────────────────────────────────────────────────────────────────────

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money  = (v) => v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const numfmt = (v) => Number(v || 0).toLocaleString("en-IN");

const ISSUE_STYLE = {
  error: { icon: AlertCircle,   bg: "bg-rose-50 dark:bg-rose-950/30",   border: "border-rose-200 dark:border-rose-800/50",   text: "text-rose-600 dark:text-rose-400" },
  warn:  { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/50", text: "text-amber-600 dark:text-amber-400" },
  info:  { icon: Info,          bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-200 dark:border-sky-800/50",     text: "text-sky-600 dark:text-sky-400" },
  ok:    { icon: CheckCircle2,  bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/50", text: "text-emerald-600 dark:text-emerald-400" },
};

const VERDICT_STYLE = {
  Scale:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Optimize: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Pause:    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Watch:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
};

const STAT_META = [
  { icon: BarChart3,         accent: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/30"  },
  { icon: Target,            accent: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { icon: ArrowUpRight,      accent: "text-sky-500",     bg: "bg-sky-50 dark:bg-sky-950/30"         },
  { icon: Zap,               accent: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/30"   },
  { icon: MousePointerClick, accent: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30"     },
  { icon: TrendingUp,        accent: "text-rose-500",    bg: "bg-rose-50 dark:bg-rose-950/30"       },
  { icon: Eye,               accent: "text-teal-500",    bg: "bg-teal-50 dark:bg-teal-950/30"       },
];

function StatCard({ label, value, icon: Icon, accent, bg }) {
  return (
    <div className={`relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{label}</p>
        <p className="text-[20px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5] leading-none">{value}</p>
      </div>
    </div>
  );
}

const CHART_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#64748B"];

// Ranked gradient bars
function RankBars({ rows, valueKey, labelKey, format }) {
  const data = (rows || []).filter((r) => (Number(r[valueKey]) || 0) > 0).slice(0, 8);
  if (!data.length) return <div className="text-[12px] text-[#8B92A9] py-8 text-center">No data in this range</div>;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="truncate text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB]" title={d[labelKey]}>{d[labelKey] || "—"}</span>
              <span className="text-[11px] font-bold tabular-nums text-[#0F1117] dark:text-[#DDE1F5] ml-2">{format ? format(d[valueKey]) : numfmt(d[valueKey])}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${((Number(d[valueKey]) || 0) / max) * 100}%`, background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}CC, ${CHART_COLORS[i % CHART_COLORS.length]})` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut with center total
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
              const el = <circle key={i} r={R} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="15" strokeLinecap="round" strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`} strokeDashoffset={-acc * C} />;
              acc += frac; return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#8B92A9] uppercase tracking-wide">{centerLabel || "Total"}</span>
          <span className="text-[13px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{format ? format(total) : numfmt(total)}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {rows.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate text-[#4B5168] dark:text-[#9DA3BB]" title={d.label}>{d.label}</span>
            <span className="ml-auto font-bold text-[#0F1117] dark:text-[#DDE1F5]">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-[#8B92A9]" />}
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function MetaInsightsReport() {
  const [from, setFrom]           = useState(isoDaysAgo(30));
  const [to, setTo]               = useState(isoDaysAgo(0));
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [error, setError]         = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/meta-config/insights", { params: { from, to, ai: "false" } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load Meta insights.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const generateAI = useCallback(async () => {
    setAiLoading(true); setError("");
    try {
      const { data } = await api.get("/meta-config/insights", { params: { from, to, ai: "true" }, timeout: 60000 });
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
  }, [from, to]);

  // Auto-reload whenever dates change (and on mount). No manual Run Report needed.
  useEffect(() => { load(); }, [from, to]); // eslint-disable-line

  const exportPDF = () => window.print();
  const t = data?.totals;

  return (
    <div className="print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white; } .no-print { display: none !important; } }`}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Meta Ad Performance</h1>
              <p className="text-[12px] text-[#8B92A9]">Spend, CPM, CPC, CTR, reach and cost-per-lead per campaign</p>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* Date range picker */}
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
              {loading && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin ml-1" />}
            </div>

            <button onClick={generateAI} disabled={aiLoading || loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[12px] font-semibold transition">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? "Generating…" : data?.aiAnalysis ? "Re-generate AI" : "Generate AI Report"}
            </button>

            <button onClick={exportPDF} disabled={!data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] text-[#4B5168] dark:text-[#9DA3BB] text-[12px] font-semibold hover:border-indigo-400 dark:hover:border-indigo-600 disabled:opacity-40 transition">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {t && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Spend",  value: money(t.spend) },
              { label: "Leads",        value: numfmt(t.leads) },
              { label: "Converted",    value: numfmt(t.converted || 0) },
              { label: "Conv. Rate",   value: t.conversionRatePct == null ? "—" : `${t.conversionRatePct}%` },
              { label: "Cost / Lead",  value: money(t.costPerLead) },
              { label: "Cost / Conv.", value: t.costPerConversion == null ? "—" : money(t.costPerConversion) },
              { label: "Clicks",       value: numfmt(t.clicks) },
            ].map((c, i) => (
              <StatCard key={c.label} label={c.label} value={c.value}
                icon={STAT_META[i].icon} accent={STAT_META[i].accent} bg={STAT_META[i].bg} />
            ))}
          </div>
        )}

        {/* ── Plain-language summary strip ─────────────────────────────────── */}
        {t && (
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500 via-blue-500 to-sky-500 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">At a glance</span>
            </div>
            {(t.spend || 0) > 0 || (t.leads || 0) > 0 ? (
              <p className="text-[13px] leading-relaxed">
                You spent <b>{money(t.spend)}</b> across <b>{numfmt((data.campaigns || []).length)}</b> campaign(s), reaching <b>{numfmt(t.impressions)}</b> impressions
                and <b>{numfmt(t.clicks)}</b> clicks, and captured <b>{numfmt(t.leads)}</b> leads at <b>{money(t.costPerLead)}</b> each.
                {(t.converted || 0) > 0 ? <> Of those, <b>{numfmt(t.converted)}</b> converted{t.costPerConversion != null ? <> at <b>{money(t.costPerConversion)}</b> per conversion</> : null}.</> : null}
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed opacity-95">No Meta spend or leads in this period. Pick a wider date range or a period when campaigns were active.</p>
            )}
          </div>
        )}

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        {data && Array.isArray(data.campaigns) && data.campaigns.some((c) => c.metrics && (c.metrics.spend || 0) > 0) && (() => {
          const rows = data.campaigns.map((c) => ({
            name:  c.campaignName || "—",
            spend: (c.metrics && c.metrics.spend) || 0,
            leads: c.leads || 0,
            cpl:   c.costPerLead || 0,
          }));
          const bySpend = [...rows].sort((a, b) => b.spend - a.spend);
          const byLeads = [...rows].sort((a, b) => b.leads - a.leads);
          const byCpl   = rows.filter((r) => r.cpl > 0).sort((a, b) => a.cpl - b.cpl); // lower = better
          return (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                <ChartCard title="Spend by Campaign" icon={BarChart3}>
                  <RankBars rows={bySpend} valueKey="spend" labelKey="name" format={money} />
                </ChartCard>
                <ChartCard title="Spend Share" icon={Target}>
                  <Donut data={bySpend.map((r) => ({ label: r.name, value: r.spend }))} format={money} centerLabel="Spend" />
                </ChartCard>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <ChartCard title="Leads by Campaign" icon={Target}>
                  <RankBars rows={byLeads} valueKey="leads" labelKey="name" format={numfmt} />
                </ChartCard>
                <ChartCard title="Cost per Lead (lower is better)" icon={TrendingUp}>
                  <RankBars rows={byCpl} valueKey="cpl" labelKey="name" format={money} />
                </ChartCard>
              </div>
            </>
          );
        })()}

        {/* ── AI analysis panel ───────────────────────────────────────────── */}
        {data && (
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Performance Analysis & Suggestions</span>
              {data.aiFromCache && (
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">Cached</span>
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
                    <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed border-l-2 border-indigo-400 pl-3">
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
                            <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
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
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3">Campaign Breakdown</h2>
            <div className="space-y-3">
              {data.campaigns.map((c) => (
                <div key={c.configId} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                  {/* Campaign header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{c.campaignName}</p>
                        {c.adSetName && <p className="text-[11px] text-[#8B92A9]">Ad set: {c.adSetName}</p>}
                      </div>
                    </div>
                    {!c.configured && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F0F2FA] dark:bg-[#1E2133] text-[#8B92A9]">Not configured</span>
                    )}
                  </div>

                  {/* Metrics row */}
                  {c.configured && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 bg-[#F8F9FC] dark:bg-[#0D0F14]">
                      {[
                        ["Spend",     money(c.metrics.spend)],
                        ["Leads",     numfmt(c.leads)],
                        ["Converted", numfmt(c.converted || 0)],
                        ["Cost/Lead", money(c.costPerLead)],
                        ["Cost/Conv",  c.costPerConversion == null ? "—" : money(c.costPerConversion)],
                        ["CPM",       money(c.metrics.cpm)],
                        ["CPC",       money(c.metrics.cpc)],
                        ["CTR",       `${c.metrics.ctr || 0}%`],
                        ["Reach",     numfmt(c.metrics.reach)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex flex-col px-4 py-3 border-r border-b md:border-b-0 border-[#E4E7EF] dark:border-[#1E2133] last:border-r-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-1">{k}</span>
                          <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{v}</span>
                        </div>
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

                  {/* Per-adset AI suggestion */}
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
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {data && !loading && (!data.campaigns || data.campaigns.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl">
            <BarChart3 className="w-9 h-9 text-[#C4C9DA]" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No campaigns found</p>
            <p className="text-[12px] text-[#8B92A9]">No Meta campaigns are configured for this company.</p>
          </div>
        )}
      </div>
    </div>
  );
}
