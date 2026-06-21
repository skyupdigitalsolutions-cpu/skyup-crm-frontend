import { useState, useCallback, useEffect } from "react";
import api from "../data/axiosConfig";
import {
  TrendingUp, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Info, DollarSign,
  Sparkles, Lightbulb, ThumbsUp, ThumbsDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Ad Performance Report (admin)
// GET /meta-config/insights?from=&to=  →  spend / CPM / CPC / CTR / reach +
// cost-per-lead + per-campaign setup-issue detection.
//
// Requires each Meta campaign config to have adAccountId + an ads_read token
// set (Campaigns page). Configs without them show as "not configured".
// ─────────────────────────────────────────────────────────────────────────────

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
const numfmt = (v) => Number(v || 0).toLocaleString("en-IN");

const ISSUE_STYLE = {
  error: { icon: AlertCircle,   cls: "text-rose-600" },
  warn:  { icon: AlertTriangle, cls: "text-amber-600" },
  info:  { icon: Info,          cls: "text-sky-600" },
  ok:    { icon: CheckCircle2,  cls: "text-emerald-600" },
};

// Per-adset AI verdict → pill color
const VERDICT_STYLE = {
  Scale:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Optimize: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Pause:    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Watch:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
};

export default function MetaInsightsReport() {
  const [from, setFrom]       = useState(isoDaysAgo(30));
  const [to, setTo]           = useState(isoDaysAgo(0));
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // Load metrics WITHOUT AI so viewing the report doesn't trigger the AI
      // call (and its rate limits). AI runs on demand via "Generate AI Report".
      const { data } = await api.get("/meta-config/insights", { params: { from, to, ai: "false" } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load Meta insights.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const [aiLoading, setAiLoading] = useState(false);
  const generateAI = useCallback(async () => {
    setAiLoading(true); setError("");
    try {
      const { data } = await api.get("/meta-config/insights", { params: { from, to, ai: "true" } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "AI report failed.");
    } finally {
      setAiLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, []); // eslint-disable-line  (no AI on mount)

  const exportPDF = () => window.print();

  const t = data?.totals;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-[#6366F1]" />
        <h1 className="text-xl font-bold text-[#0F1117] dark:text-[#F0F2FA]">Meta Ad Performance</h1>
      </div>
      <p className="text-sm text-[#64748B] mb-5">
        Spend, CPM, CPC, CTR, reach and cost-per-lead per campaign, with setup-issue detection.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6 no-print">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-sm" />
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#6366F1] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Loading…" : "Run Report"}
        </button>
        <button onClick={generateAI} disabled={aiLoading || loading || !data}
          className="px-4 py-2 rounded-lg bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {aiLoading ? "Generating…" : (data?.aiAnalysis ? "Re-generate AI Report" : "Generate AI Report")}
        </button>
        <button onClick={exportPDF} disabled={!data}
          className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] text-[#475569] dark:text-[#94A3B8] text-sm font-semibold disabled:opacity-50">
          Export PDF
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total Spend",  value: money(t.spend),        icon: DollarSign },
            { label: "Cost / Lead",  value: money(t.costPerLead) },
            { label: "Leads",        value: numfmt(t.leads) },
            { label: "Impressions",  value: numfmt(t.impressions) },
            { label: "Clicks",       value: numfmt(t.clicks) },
          ].map((c) => (
            <div key={c.label} className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D0F14] border border-[#E2E8F0] dark:border-[#1E2130]">
              <div className="text-[11px] uppercase tracking-wide text-[#64748B]">{c.label}</div>
              <div className="text-lg font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI analysis + improvement suggestions */}
      {data && (data.aiAnalysis || data.aiAnalysisError) && (
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#6366F1]/10 to-[#8B5CF6]/10 border-b border-[#E2E8F0] dark:border-[#1E2130]">
            <Sparkles className="w-4 h-4 text-[#6366F1]" />
            <span className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">AI Performance Analysis & Suggestions</span>
          </div>
          <div className="p-4">
            {data.aiAnalysisError ? (
              <div className="text-sm text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {data.aiAnalysisError}
              </div>
            ) : (
              <div className="space-y-4">
                {data.aiAnalysis.summary && (
                  <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{data.aiAnalysis.summary}</p>
                )}

                {Array.isArray(data.aiAnalysis.topPerformers) && data.aiAnalysis.topPerformers.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Top Performers
                    </div>
                    <ul className="space-y-1.5">
                      {data.aiAnalysis.topPerformers.map((p, i) => (
                        <li key={i} className="text-sm text-[#334155] dark:text-[#CBD5E1]">
                          <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{p.campaign}:</span> {p.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(data.aiAnalysis.underperformers) && data.aiAnalysis.underperformers.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-1">
                      <ThumbsDown className="w-3.5 h-3.5 text-rose-500" /> Needs Attention
                    </div>
                    <ul className="space-y-1.5">
                      {data.aiAnalysis.underperformers.map((p, i) => (
                        <li key={i} className="text-sm text-[#334155] dark:text-[#CBD5E1]">
                          <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{p.campaign}:</span> {p.issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(data.aiAnalysis.suggestions) && data.aiAnalysis.suggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Improvement Suggestions
                    </div>
                    <ul className="space-y-1.5">
                      {data.aiAnalysis.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-[#334155] dark:text-[#CBD5E1] flex gap-2">
                          <span className="text-[#10B981] font-bold">→</span> {s}
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

      {/* Per-campaign cards */}
      {data?.campaigns?.length > 0 ? (
        <div className="space-y-3">
          {data.campaigns.map((c) => (
            <div key={c.configId} className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] dark:bg-[#0D0F14] border-b border-[#E2E8F0] dark:border-[#1E2130]">
                <div>
                  <div className="font-bold text-[#0F1117] dark:text-[#F0F2FA] text-sm">{c.campaignName}</div>
                  {c.adSetName && <div className="text-xs text-[#64748B]">Ad set: {c.adSetName}</div>}
                </div>
                {!c.configured && (
                  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[#64748B]">Not configured</span>
                )}
              </div>

              {c.configured && (
                <div className="grid grid-cols-3 md:grid-cols-7 gap-px bg-[#E2E8F0] dark:bg-[#1E2130]">
                  {[
                    ["Spend", money(c.metrics.spend)],
                    ["Cost/Lead", money(c.costPerLead)],
                    ["Leads", numfmt(c.leads)],
                    ["CPM", money(c.metrics.cpm)],
                    ["CPC", money(c.metrics.cpc)],
                    ["CTR", `${c.metrics.ctr || 0}%`],
                    ["Reach", numfmt(c.metrics.reach)],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white dark:bg-[#0D0F14] p-3">
                      <div className="text-[10px] uppercase tracking-wide text-[#64748B]">{k}</div>
                      <div className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Issues */}
              <div className="px-4 py-3 space-y-1.5">
                {(c.issues || []).map((iss, idx) => {
                  const st = ISSUE_STYLE[iss.level] || ISSUE_STYLE.info;
                  const Icon = st.icon;
                  return (
                    <div key={idx} className={`flex items-start gap-2 text-sm ${st.cls}`}>
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" /> <span>{iss.msg}</span>
                    </div>
                  );
                })}
              </div>

              {/* Per-ad-set AI suggestion */}
              {c.aiSuggestion && (
                <div className="px-4 pb-3 -mt-1">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-50 dark:bg-violet-500/10">
                    <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-[#334155] dark:text-[#CBD5E1]">
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
      ) : data ? (
        <div className="text-sm text-[#64748B]">No Meta campaigns found for this company.</div>
      ) : null}
    </div>
  );
}
