// src/components/lead-ai/LeadAIIntelligence.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Per-lead AI intelligence panel — shown inside LeadJourneyDrawer.
// Shows the stored AI outcome analysis for a single lead with:
//   • Lead health badge (HEALTHY / AT_RISK / CRITICAL / LOST)
//   • Conversion probability bar
//   • Primary reason for outcome
//   • Secondary reasons
//   • Explanation narrative
//   • Re-analyze / Analyze button
//
// API:
//   GET  /lead/:leadId/ai-analysis        → fetch stored analysis
//   POST /lead/:leadId/ai-analysis        → queue new analysis
//   POST /lead/:leadId/ai-analysis/reanalyze → force re-run
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { Brain, RefreshCw, Loader2, AlertTriangle, Zap } from "lucide-react";
import api from "../../data/axiosConfig";

// ── Config ────────────────────────────────────────────────────────────────────

const HEALTH_CFG = {
  HEALTHY:  { label: "Healthy",  bg: "bg-green-50 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-400",  border: "border-green-200 dark:border-green-800",  dot: "bg-green-500" },
  AT_RISK:  { label: "At Risk",  bg: "bg-amber-50 dark:bg-amber-950/40",  text: "text-amber-700 dark:text-amber-400",  border: "border-amber-200 dark:border-amber-800",  dot: "bg-amber-500" },
  CRITICAL: { label: "Critical", bg: "bg-red-50 dark:bg-red-950/40",      text: "text-red-700 dark:text-red-400",      border: "border-red-200 dark:border-red-800",      dot: "bg-red-500" },
  LOST:     { label: "Lost",     bg: "bg-rose-50 dark:bg-rose-950/40",    text: "text-rose-700 dark:text-rose-400",    border: "border-rose-200 dark:border-rose-800",    dot: "bg-rose-600" },
};

const REASON_LABELS = {
  POOR_FOLLOW_UP:              "Poor Follow-up",
  DELAYED_RESPONSE:            "Delayed Response",
  MISSED_FOLLOW_UP:            "Missed Follow-up",
  FAILED_TO_ADDRESS_OBJECTION: "Failed to Address Objection",
  POOR_COMMUNICATION:          "Poor Communication",
  FAILED_MEETING_FOLLOW_UP:    "Failed Meeting Follow-up",
  FAILED_NEXT_STEP:            "Failed Next Step",
  INCORRECT_INFORMATION:       "Incorrect Information",
  INSUFFICIENT_CONTACT:        "Insufficient Contact",
  EXCESSIVE_GENERIC_TEMPLATES: "Excessive Generic Templates",
  PRICE_OBJECTION:             "Price Objection",
  CUSTOMER_UNRESPONSIVE:       "Customer Unresponsive",
  NOT_INTERESTED:              "Not Interested",
  BUDGET_ISSUE:                "Budget Issue",
  COMPETITOR_SELECTED:         "Competitor Selected",
  REQUIREMENT_CHANGED:         "Requirement Changed",
  DECISION_DELAYED:            "Decision Delayed",
  DECISION_MAKER_UNAVAILABLE:  "Decision Maker Unavailable",
  TIMING_ISSUE:                "Timing Issue",
  PRODUCT_LIMITATION:          "Product Limitation",
  MISSING_FEATURE:             "Missing Feature",
  TECHNICAL_ISSUE:             "Technical Issue",
  PRICING_POLICY:              "Pricing Policy",
  SERVICE_ISSUE:               "Service Issue",
  IMPLEMENTATION_ISSUE:        "Implementation Issue",
  DUPLICATE_LEAD:              "Duplicate Lead",
  INVALID_LEAD:                "Invalid Lead",
  INSUFFICIENT_DATA:           "Insufficient Data",
  OTHER:                       "Other",
};

const RESP_LABELS = {
  SALESPERSON:      "Salesperson",
  CUSTOMER:         "Customer",
  COMPANY_PRODUCT:  "Product/Company",
  SHARED:           "Shared",
  UNKNOWN:          "Unknown",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function probColor(p) {
  if (p >= 70) return "bg-green-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-red-500";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBadge({ health }) {
  const cfg = HEALTH_CFG[health] || HEALTH_CFG.AT_RISK;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProbBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#E4E7EF] dark:bg-[#262A38] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${probColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] w-8 text-right">{value}%</span>
    </div>
  );
}

function ReasonChip({ code, responsible, confidence, impact }) {
  const label = REASON_LABELS[code] || code;
  const respLabel = RESP_LABELS[responsible] || responsible || "";
  const impactColor =
    impact === "HIGH"   ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
    impact === "MEDIUM" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-[#F0F2FA] dark:border-[#1E2130] last:border-0">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{label}</p>
        {respLabel && (
          <p className="text-[11px] text-[#8B92A9]">Responsible: {respLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {impact && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${impactColor}`}>
            {impact}
          </span>
        )}
        {confidence > 0 && (
          <span className="text-[10px] text-[#8B92A9]">{confidence}%</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeadAIIntelligence({ leadId, isAdmin }) {
  const [analysis, setAnalysis] = useState(null);
  const [status,   setStatus]   = useState(null); // null | "pending" | "processing" | "done" | "failed"
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false); // analyze / re-analyze in flight
  const [error,    setError]    = useState("");

  // ── Fetch stored analysis ───────────────────────────────────────────────────
  const fetchAnalysis = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const endpoint = isAdmin
        ? `/lead/admin/${leadId}/ai-analysis`
        : `/lead/${leadId}/ai-analysis`;
      const res = await api.get(endpoint);
      if (res.data.hasAnalysis) {
        setAnalysis(res.data.analysis);
        setStatus(res.data.analysis.status);
      } else {
        setAnalysis(null);
        setStatus(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setAnalysis(null);
        setStatus(null);
      } else {
        setError(err.response?.data?.message || "Failed to load AI analysis");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [leadId, isAdmin]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  // ── Poll while pending/processing ──────────────────────────────────────────
  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;
    const id = setInterval(() => fetchAnalysis(true), 4000);
    return () => clearInterval(id);
  }, [status, fetchAnalysis]);

  // ── Trigger analysis ────────────────────────────────────────────────────────
  const handleAnalyze = async (reanalyze = false) => {
    setActing(true);
    setError("");
    try {
      const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;
      const url  = reanalyze
        ? `${base}/ai-analysis/reanalyze`
        : `${base}/ai-analysis`;
      await api.post(url, { triggeredBy: "manual" });
      setStatus("pending");
      await fetchAnalysis(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start analysis");
    } finally {
      setActing(false);
    }
  };

  // ── Render: loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 gap-2 text-[#8B92A9]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[12px]">Loading AI analysis…</span>
      </div>
    );
  }

  // ── Render: error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => fetchAnalysis()} className="text-[11px] text-red-500 underline mt-0.5">Retry</button>
        </div>
      </div>
    );
  }

  // ── Render: pending / processing ────────────────────────────────────────────
  if (status === "pending" || status === "processing") {
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-blue-700 dark:text-blue-300">Analysis in progress…</p>
          <p className="text-[11px] text-blue-500 dark:text-blue-400">Usually takes 10–30 seconds. This panel updates automatically.</p>
        </div>
      </div>
    );
  }

  // ── Render: no analysis yet ─────────────────────────────────────────────────
  if (!analysis || status === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-10 h-10 rounded-2xl bg-[#F0F2FA] dark:bg-[#1E2130] flex items-center justify-center">
          <Brain className="w-5 h-5 text-[#8B92A9]" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">No AI analysis yet</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Click below to analyse this lead's outcome with AI</p>
        </div>
        <button
          onClick={() => handleAnalyze(false)}
          disabled={acting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-[12px] font-semibold transition"
        >
          {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {acting ? "Starting…" : "Analyse with AI"}
        </button>
      </div>
    );
  }

  // ── Render: done ────────────────────────────────────────────────────────────
  const a = analysis;
  const secondaryReasons = (a.secondaryReasons || []).filter(r => r?.code);

  return (
    <div className="space-y-3">

      {/* Header row — health + prob + re-analyze */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <HealthBadge health={a.leadHealth} />
          {a.outcome && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0F2FA] dark:bg-[#1E2130] text-[#6B7280] dark:text-[#9DA3BB] uppercase tracking-wide">
              {a.outcome.replace("_", " ")}
            </span>
          )}
        </div>
        <button
          onClick={() => handleAnalyze(true)}
          disabled={acting}
          title="Re-analyse"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130] disabled:opacity-50 transition"
        >
          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {acting ? "…" : "Re-analyse"}
        </button>
      </div>

      {/* Conversion probability */}
      {typeof a.conversionProbability === "number" && (
        <div>
          <p className="text-[11px] font-semibold text-[#8B92A9] mb-1">Conversion Probability</p>
          <ProbBar value={a.conversionProbability} />
        </div>
      )}

      {/* Primary reason */}
      {a.primaryReason?.code && (
        <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
          <div className="px-3 py-2 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-wide">Primary Reason</p>
          </div>
          <div className="px-3">
            <ReasonChip
              code={a.primaryReason.code}
              responsible={a.primaryReason.responsibleType}
              confidence={a.primaryReason.confidence}
              impact={a.primaryReason.impact}
            />
          </div>
        </div>
      )}

      {/* Secondary reasons */}
      {secondaryReasons.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
          <div className="px-3 py-2 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-wide">Contributing Factors</p>
          </div>
          <div className="px-3">
            {secondaryReasons.slice(0, 3).map((r, i) => (
              <ReasonChip
                key={i}
                code={r.code}
                responsible={r.responsibleType}
                confidence={r.confidence}
                impact={r.impact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {a.explanation && (
        <div className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
          <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-wide mb-1">AI Explanation</p>
          <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{a.explanation}</p>
        </div>
      )}

      {/* Footer — last analysed */}
      {a.generatedAt && (
        <p className="text-[10px] text-[#8B92A9] text-right">
          Last analysed: {fmtDate(a.generatedAt)}
          {a.model && <span className="ml-1 opacity-60">· {a.model}</span>}
        </p>
      )}
    </div>
  );
}
