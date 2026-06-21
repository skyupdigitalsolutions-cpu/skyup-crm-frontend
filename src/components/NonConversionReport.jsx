import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import {
  AlertTriangle, TrendingDown, Sparkles, RefreshCw, Lightbulb, Users, Megaphone,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Non-Conversion (Lost Lead) Analysis
// Admin report: why leads didn't convert + AI improvement suggestions.
// Reads GET /reports/non-conversion?from=&to=&ai= — reasons are derived on the
// server from lead status + remarks + call summaries (no agent form needed).
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
  "#3B82F6", "#EF4444", "#14B8A6", "#A855F7", "#64748B",
];

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Accountability tag → color. "Agent follow-up gap" is the one to act on.
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
  const [from, setFrom]       = useState(isoDaysAgo(30));
  const [to, setTo]           = useState(isoDaysAgo(0));
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState("");

  const load = useCallback(async (withAI = false) => {
    setLoading(true);
    setError("");
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

  // On-demand AI generation (separate from loading the data) so the AI only
  // runs when the user asks — this avoids hitting rate limits on every view.
  const [aiLoading, setAiLoading] = useState(false);
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

  // Load DATA ONLY on mount (no AI) — AI is generated on demand via the button.
  useEffect(() => { load(false); /* initial, no AI */ }, []); // eslint-disable-line

  // Export the current report (data + any AI result) to PDF via print view.
  const exportPDF = () => window.print();

  const maxCount = data?.reasonBreakdown?.[0]?.count || 1;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <TrendingDown className="w-5 h-5 text-rose-500" />
        <h1 className="text-xl font-bold text-[#0F1117] dark:text-[#F0F2FA]">Non-Conversion Analysis</h1>
      </div>
      <p className="text-sm text-[#64748B] mb-5">
        Every lead that hasn't converted (all statuses except Converted) — with its reason, derived from status, remarks and call summaries, plus AI suggestions.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6 no-print">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-sm text-[#0F1117] dark:text-[#F0F2FA]" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-sm text-[#0F1117] dark:text-[#F0F2FA]" />
        </div>
        <button onClick={() => load(false)} disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#6366F1] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Loading…" : "Run Report"}
        </button>
        <button onClick={generateAI} disabled={aiLoading || loading}
          className="px-4 py-2 rounded-lg bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {aiLoading ? "Generating…" : (data?.aiAnalysis ? "Re-generate AI Report" : "Generate AI Report")}
        </button>
        <button onClick={exportPDF} disabled={!data}
          className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] text-[#475569] dark:text-[#94A3B8] text-sm font-semibold disabled:opacity-50 no-print">
          Export PDF
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary stat */}
          <div className="mb-6 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D0F14] border border-[#E2E8F0] dark:border-[#1E2130]">
            <div className="text-3xl font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{data.totalLost}</div>
            <div className="text-sm text-[#64748B]">non-converted leads in this range (all except Converted)</div>
          </div>

          {data.totalLost === 0 ? (
            <div className="text-sm text-[#64748B]">No lost leads found in this period. 🎉</div>
          ) : (
            <>
              {/* Accountability summary — is it the employee or something else? */}
              {Array.isArray(data.accountabilityBreakdown) && data.accountabilityBreakdown.length > 0 && (
                <div className="mb-7">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748B] mb-3">Where the issue lies</h2>
                  <div className="flex flex-wrap gap-2">
                    {data.accountabilityBreakdown.map((a) => (
                      <div key={a.label} className={`px-3 py-2 rounded-xl ${acctCls(a.label)}`}>
                        <span className="text-lg font-extrabold">{a.count}</span>
                        <span className="text-xs font-semibold ml-1.5">{a.label}</span>
                        <span className="text-[11px] opacity-70 ml-1">({a.percent}%)</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-2 italic">
                    "Agent follow-up gap" = a lead the team should have acted on. Others are lead-side or external reasons. This is an AI inference from logged notes, not a verdict.
                  </p>
                </div>
              )}

              {/* Reason breakdown */}
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748B] mb-3">Reason Breakdown</h2>
              <div className="space-y-2 mb-7">
                {data.reasonBreakdown.map((r, i) => (
                  <div key={r.reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{r.reason}</span>
                      <span className="text-[#64748B]">{r.count} · {r.percent}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#E2E8F0] dark:bg-[#1E2130] overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${(r.count / maxCount) * 100}%`,
                        background: BAR_COLORS[i % BAR_COLORS.length],
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI analysis */}
              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] overflow-hidden mb-6">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#6366F1]/10 to-[#8B5CF6]/10 border-b border-[#E2E8F0] dark:border-[#1E2130]">
                  <Sparkles className="w-4 h-4 text-[#6366F1]" />
                  <span className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">AI Analysis & Improvement Suggestions</span>
                </div>
                <div className="p-4">
                  {data.aiAnalysisError ? (
                    <div className="text-sm text-amber-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> {data.aiAnalysisError}
                    </div>
                  ) : data.aiAnalysis ? (
                    <div className="space-y-4">
                      {data.aiAnalysis.summary && (
                        <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{data.aiAnalysis.summary}</p>
                      )}

                      {Array.isArray(data.aiAnalysis.topReasons) && data.aiAnalysis.topReasons.length > 0 && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Key Patterns</div>
                          <ul className="space-y-2">
                            {data.aiAnalysis.topReasons.map((t, i) => (
                              <li key={i} className="text-sm text-[#334155] dark:text-[#CBD5E1]">
                                <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{t.reason}:</span> {t.insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {Array.isArray(data.aiAnalysis.suggestions) && data.aiAnalysis.suggestions.length > 0 && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-1">
                            <Lightbulb className="w-3.5 h-3.5" /> Suggestions
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

                      {data.aiAnalysis.dataQualityNote && (
                        <p className="text-xs text-amber-600 italic">{data.aiAnalysis.dataQualityNote}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[#64748B]">AI analysis not generated yet. Click "Generate AI Report" above to run it.</div>
                  )}
                </div>
              </div>

              {/* By source + by agent */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-3 flex items-center gap-1">
                    <Megaphone className="w-3.5 h-3.5" /> Lost by Source
                  </div>
                  {Object.entries(data.bySource || {}).map(([src, reasons]) => {
                    const totalSrc = Object.values(reasons).reduce((a, b) => a + b, 0);
                    return (
                      <div key={src} className="flex justify-between text-sm py-1 border-b border-[#F1F5F9] dark:border-[#1E2130] last:border-0">
                        <span className="text-[#0F1117] dark:text-[#F0F2FA]">{src}</span>
                        <span className="text-[#64748B] font-semibold">{totalSrc}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-3 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Lost by Agent
                  </div>
                  {(data.byAgent || []).map((a) => (
                    <div key={a.agent} className="flex justify-between text-sm py-1 border-b border-[#F1F5F9] dark:border-[#1E2130] last:border-0">
                      <span className="text-[#0F1117] dark:text-[#F0F2FA]">{a.agent}</span>
                      <span className="text-[#64748B] font-semibold">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-lead detail — every non-converted lead with its reason */}
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748B] mb-3">
                  Lead Details ({data.leadDetails?.length || 0})
                </h2>
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "15%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#F8FAFC] dark:bg-[#0D0F14] text-left">
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Lead</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Status</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Reason (why not converted)</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Accountability</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Improvement</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Source</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Agent</th>
                        <th className="px-3 py-2 font-semibold text-[#64748B]">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.leadDetails || []).map((l) => (
                        <tr key={l.leadId} className="border-t border-[#F1F5F9] dark:border-[#1E2130] align-top">
                          <td className="px-3 py-2 font-semibold text-[#0F1117] dark:text-[#F0F2FA] break-words">{l.name}</td>
                          <td className="px-3 py-2 break-words">
                            <span className="text-[#64748B]">{l.status}</span>
                            {l.temperature && (
                              <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                l.temperature === "Hot"  ? "bg-rose-100 text-rose-600" :
                                l.temperature === "Warm" ? "bg-amber-100 text-amber-600" :
                                "bg-sky-100 text-sky-600"
                              }`}>{l.temperature}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 break-words">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                              {l.reason}
                            </span>
                          </td>
                          <td className="px-3 py-2 break-words">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${acctCls(l.accountability)}`}>
                              {l.accountability || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#0F6E56] dark:text-emerald-400 break-words">
                            {l.improvement || <span className="italic text-[#94A3B8]">—</span>}
                          </td>
                          <td className="px-3 py-2 text-[#64748B] break-words">{l.source}</td>
                          <td className="px-3 py-2 text-[#64748B] break-words">{l.agent}</td>
                          <td className="px-3 py-2 text-[#64748B] break-words">{l.detail || <span className="italic text-[#94A3B8]">No remark / summary</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
