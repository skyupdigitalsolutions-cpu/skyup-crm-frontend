import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import {
  AlertTriangle, TrendingDown, Sparkles, Lightbulb,
  Users, Megaphone, Loader2, FileDown, Target,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Non-Conversion (Lost Lead) Analysis
// Admin report: why leads didn't convert + AI improvement suggestions.
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
  "#3B82F6", "#EF4444", "#14B8A6", "#A855F7", "#64748B",
];

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

const ACCT_STYLE = {
  "Agent follow-up gap": "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  "Awaiting next step":  "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "Lead not interested": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "Price/budget":        "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "Bad lead data":       "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  "Product/fit":         "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  "No data":             "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
function acctCls(label) { return ACCT_STYLE[label] || ACCT_STYLE["No data"]; }

export default function NonConversionReport() {
  const [from, setFrom]           = useState(isoDaysAgo(30));
  const [to, setTo]               = useState(isoDaysAgo(0));
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [error, setError]         = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async (withAI = false) => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/reports/non-conversion", {
        params: { from, to, ai: withAI ? "true" : "false" },
      });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const generateAI = useCallback(async () => {
    setAiLoading(true);
    try {
      const { data } = await api.get("/reports/non-conversion", {
        params: { from, to, ai: "true" },
      });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "AI report failed.");
    } finally {
      setAiLoading(false);
    }
  }, [from, to]);

  // Auto-reload whenever dates change (and on mount). No manual Run Report needed.
  useEffect(() => { load(false); }, [from, to]); // eslint-disable-line

  const exportPDF = () => window.print();
  const maxCount = data?.reasonBreakdown?.[0]?.count || 1;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14] print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white; } .no-print { display: none !important; } }`}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] no-print">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Non-Conversion Analysis</h1>
              <p className="text-[12px] text-[#8B92A9]">Why leads didn't convert — with AI-powered improvement suggestions</p>
            </div>
          </div>

          {/* Controls */}
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
              {loading && <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin ml-1" />}
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

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-[13px] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl h-24 animate-pulse" />
            <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl h-48 animate-pulse" />
          </div>
        )}

        {data && (
          <>
            {/* ── Summary hero card ──────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                <Target className="w-7 h-7 text-rose-500" />
              </div>
              <div>
                <p className="text-[36px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">{data.totalLost}</p>
                <p className="text-[13px] text-[#8B92A9] mt-1">non-converted leads in this period</p>
              </div>
            </div>

            {data.totalLost === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl">
                <span className="text-3xl">🎉</span>
                <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No lost leads this period!</p>
                <p className="text-[12px] text-[#8B92A9]">Every lead in this range has converted.</p>
              </div>
            ) : (
              <>
                {/* ── Where the issue lies ───────────────────────────────── */}
                {Array.isArray(data.accountabilityBreakdown) && data.accountabilityBreakdown.length > 0 && (
                  <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-4">Where the issue lies</h2>
                    <div className="flex flex-wrap gap-2">
                      {data.accountabilityBreakdown.map((a) => (
                        <div key={a.label} className={`flex items-baseline gap-1.5 px-3 py-2 rounded-xl ${acctCls(a.label)}`}>
                          <span className="text-[17px] font-bold">{a.count}</span>
                          <span className="text-[11px] font-semibold">{a.label}</span>
                          <span className="text-[10px] opacity-60">({a.percent}%)</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#C4C9DA] mt-3 italic leading-relaxed">
                      "Agent follow-up gap" = a lead the team should have acted on. AI inference from logged notes — not a definitive verdict.
                    </p>
                  </div>
                )}

                {/* ── Reason breakdown ──────────────────────────────────── */}
                <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-4">Reason Breakdown</h2>
                  <div className="space-y-3">
                    {data.reasonBreakdown.map((r, i) => (
                      <div key={r.reason}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{r.reason}</span>
                          <span className="text-[11px] text-[#8B92A9] font-semibold">{r.count} · {r.percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F0F2FA] dark:bg-[#1E2133] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${(r.count / maxCount) * 100}%`,
                            background: BAR_COLORS[i % BAR_COLORS.length],
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── AI analysis panel ─────────────────────────────────── */}
                <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Analysis & Improvement Suggestions</span>
                  </div>
                  <div className="p-5">
                    {data.aiAnalysisError ? (
                      <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {data.aiAnalysisError}
                      </div>
                    ) : data.aiAnalysis ? (
                      <div className="space-y-4">
                        {data.aiAnalysis.summary && (
                          <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed border-l-2 border-indigo-400 pl-3">
                            {data.aiAnalysis.summary}
                          </p>
                        )}
                        {Array.isArray(data.aiAnalysis.topReasons) && data.aiAnalysis.topReasons.length > 0 && (
                          <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3">Key Patterns</p>
                            <ul className="space-y-2">
                              {data.aiAnalysis.topReasons.map((t, i) => (
                                <li key={i} className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                                  <span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{t.reason}:</span> {t.insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(data.aiAnalysis.suggestions) && data.aiAnalysis.suggestions.length > 0 && (
                          <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-4">
                            <div className="flex items-center gap-1.5 mb-3">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">Suggestions</span>
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
                        {data.aiAnalysis.dataQualityNote && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">{data.aiAnalysis.dataQualityNote}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                        <Sparkles className="w-7 h-7 text-[#C4C9DA]" />
                        <p className="text-[13px] text-[#8B92A9]">No AI analysis yet.</p>
                        <p className="text-[12px] text-[#C4C9DA]">Click "Generate AI Report" above to run it.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── By Source + By Agent ──────────────────────────────── */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Megaphone className="w-3.5 h-3.5 text-[#8B92A9]" />
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">Lost by Source</h3>
                    </div>
                    <div className="space-y-0 divide-y divide-[#F0F2FA] dark:divide-[#1E2133]">
                      {Object.entries(data.bySource || {}).map(([src, reasons]) => {
                        const totalSrc = Object.values(reasons).reduce((a, b) => a + b, 0);
                        return (
                          <div key={src} className="flex items-center justify-between py-2.5">
                            <span className="text-[12px] font-medium text-[#0F1117] dark:text-[#DDE1F5]">{src}</span>
                            <span className="text-[12px] font-bold text-[#8B92A9]">{totalSrc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-3.5 h-3.5 text-[#8B92A9]" />
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">Lost by Agent</h3>
                    </div>
                    <div className="space-y-0 divide-y divide-[#F0F2FA] dark:divide-[#1E2133]">
                      {(data.byAgent || []).map((a) => (
                        <div key={a.agent} className="flex items-center justify-between py-2.5">
                          <span className="text-[12px] font-medium text-[#0F1117] dark:text-[#DDE1F5]">{a.agent}</span>
                          <span className="text-[12px] font-bold text-[#8B92A9]">{a.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Lead details table ────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">
                      Lead Details
                    </h2>
                    <span className="text-[11px] font-semibold text-[#8B92A9] px-2.5 py-1 rounded-full bg-[#F0F2FA] dark:bg-[#1E2133]">
                      {data.leadDetails?.length || 0} leads
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                      <table className="w-full text-sm table-fixed min-w-[760px]">
                        <colgroup>
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "9%"  }} />
                          <col style={{ width: "9%"  }} />
                          <col style={{ width: "12%" }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-[#F8F9FC] dark:bg-[#0D0F14] border-b border-[#E4E7EF] dark:border-[#1E2133] sticky top-0 z-10">
                            {["Lead", "Status", "Reason", "Accountability", "Improvement", "Source", "Agent", "Detail"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2133]">
                          {(data.leadDetails || []).map((l) => (
                            <tr key={l.leadId} className="hover:bg-[#F8F9FC] dark:hover:bg-[#0D0F14] transition align-top">
                              <td className="px-4 py-3 font-semibold text-[12px] text-[#0F1117] dark:text-[#DDE1F5] break-words">{l.name}</td>
                              <td className="px-4 py-3 break-words">
                                <span className="text-[11px] text-[#8B92A9]">{l.status}</span>
                                {l.temperature && (
                                  <span className={`ml-1 inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                    l.temperature === "Hot"  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" :
                                    l.temperature === "Warm" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" :
                                    "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                                  }`}>{l.temperature}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 break-words">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                                  {l.reason}
                                </span>
                              </td>
                              <td className="px-4 py-3 break-words">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${acctCls(l.accountability)}`}>
                                  {l.accountability || "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[11px] text-emerald-600 dark:text-emerald-400 break-words">
                                {l.improvement || <span className="italic text-[#C4C9DA]">—</span>}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-[#8B92A9] break-words">{l.source}</td>
                              <td className="px-4 py-3 text-[11px] text-[#8B92A9] break-words">{l.agent}</td>
                              <td className="px-4 py-3 text-[11px] text-[#8B92A9] break-words">
                                {l.detail || <span className="italic text-[#C4C9DA]">No remark</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
