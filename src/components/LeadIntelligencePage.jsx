// components/LeadIntelligencePage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unified "Lead Intelligence" page with two sub-tabs:
//   1. Lead Insights   — existing LeadInsights.jsx (daily CRM lead activity)
//   2. AI Intelligence — AILeadReport.jsx (company-wide AI outcome analysis)
//
// Drop-in replacement: add one tab entry to ReportPage.jsx TABS array and
// render <LeadIntelligencePage /> for that tab. No router changes needed.
//
// Matches existing design tokens exactly:
//   bg-[#F8F9FC] dark:bg-[#0D0F14]    page background
//   bg-white dark:bg-[#1A1D27]         card surface
//   border-[#E4E7EF] dark:border-[#262A38]
//   text-[#0F1117] dark:text-[#F0F2FA] primary text
//   text-[#8B92A9]                     muted text
//   rounded-2xl                        card radius
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Brain, Sparkles, BarChart3, Users, RefreshCw, AlertTriangle,
  Loader2, CheckCircle2, XCircle, Activity, TrendingUp, Clock,
  Phone, MessageSquare, CalendarCheck, Zap, ChevronRight,
} from "lucide-react";
import api from "../data/axiosConfig";
import LeadInsights from "./LeadInsights"; // existing component — unchanged

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — AI Lead Report (company-wide)
// ─────────────────────────────────────────────────────────────────────────────

const REASON_LABELS = {
  POOR_FOLLOW_UP:              "Poor Follow-up",
  DELAYED_RESPONSE:            "Delayed Response",
  MISSED_FOLLOW_UP:            "Missed Follow-up",
  FAILED_TO_ADDRESS_OBJECTION: "Failed to Address Objection",
  POOR_COMMUNICATION:          "Poor Communication",
  FAILED_MEETING_FOLLOW_UP:    "Failed Meeting Follow-up",
  FAILED_NEXT_STEP:            "Failed Next Step",
  INSUFFICIENT_CONTACT:        "Insufficient Contact",
  EXCESSIVE_GENERIC_TEMPLATES: "Excessive Generic Templates",
  PRICE_OBJECTION:             "Price Objection",
  CUSTOMER_UNRESPONSIVE:       "Customer Unresponsive",
  BUDGET_ISSUE:                "Budget Issue",
  COMPETITOR_SELECTED:         "Competitor Selected",
  REQUIREMENT_CHANGED:         "Requirement Changed",
  DECISION_DELAYED:            "Decision Delayed",
  PRODUCT_LIMITATION:          "Product Limitation",
  MISSING_FEATURE:             "Missing Feature",
  TECHNICAL_ISSUE:             "Technical Issue",
  PRICING_POLICY:              "Pricing Policy",
  INSUFFICIENT_DATA:           "Insufficient Data",
  OTHER:                       "Other",
};

const HEALTH_CFG = {
  HEALTHY:  { label: "Healthy",  color: "#059669", bg: "#ECFDF5", darkBg: "#052E1C", dot: "#059669" },
  AT_RISK:  { label: "At Risk",  color: "#D97706", bg: "#FFFBEB", darkBg: "#2D1F00", dot: "#D97706" },
  CRITICAL: { label: "Critical", color: "#DC2626", bg: "#FEF2F2", darkBg: "#2D0A0A", dot: "#DC2626" },
  LOST:     { label: "Lost",     color: "#9F1239", bg: "#FFF1F2", darkBg: "#2D0A14", dot: "#9F1239" },
};

const RESP_CFG = {
  SALESPERSON:     { color: "#DC2626", label: "Salesperson"    },
  CUSTOMER:        { color: "#D97706", label: "Customer"       },
  COMPANY_PRODUCT: { color: "#2563EB", label: "Company/Product"},
  SHARED:          { color: "#7C3AED", label: "Shared"         },
  UNKNOWN:         { color: "#8B92A9", label: "Unknown"        },
};

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge, badgeColor, action }) {
  return (
    <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
      <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex-1">{title}</h3>
      {badge != null && (
        <span
          className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: (badgeColor || "#2563EB") + "20", color: badgeColor || "#2563EB" }}
        >
          {badge}
        </span>
      )}
      {action}
    </div>
  );
}

// ── Health summary cards ────────────────────────────────────────────────────────

function HealthCard({ cfg, value, pct, total }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: cfg.bg }}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
      <div className="text-[32px] font-bold leading-none mt-1" style={{ color: cfg.color }}>
        {value}
      </div>
      <div className="text-[11px] font-semibold" style={{ color: cfg.color, opacity: 0.7 }}>
        {total > 0 ? `${Math.round((value / total) * 100)}% of analyzed` : "—"}
      </div>
    </div>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────────────────────

function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] w-44 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-[#F0F2FA] dark:bg-[#1E2133] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] w-7 text-right">{value}</span>
      {sub && <span className="text-[11px] text-[#8B92A9] w-12 text-right">{sub}</span>}
    </div>
  );
}

// ── AI Report inner component ──────────────────────────────────────────────────

function AILeadReport() {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/lead/ai-report");
      if (res.data.success) setReport(res.data.report);
      else setError("Report returned no data");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load AI report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="animate-spin text-[#2563EB]" />
        <p className="text-[13px] text-[#8B92A9]">Loading AI analysis report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertTriangle size={22} className="text-red-500" />
        <p className="text-[13px] text-red-500">{error}</p>
        <button onClick={fetchReport} className="text-[12px] text-[#2563EB] font-semibold hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const s     = report?.summary || {};
  const total = s.total || 0;
  const top   = report?.topProblems || [];
  const rd    = report?.responsibilityDistribution || {};
  const emp   = (report?.employeeBreakdown || []).filter(e => e.userId !== "unknown");
  const maxProblem = top.length ? Math.max(...top.map(p => p.count)) : 1;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Brain size={36} className="text-[#C4C9DA] dark:text-[#3A3F55]" />
        <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">No analyses yet</p>
        <p className="text-[12px] text-[#8B92A9] max-w-xs">
          Open any lead and click "Analyze with AI" to start. Results will appear here once the first analysis completes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Health overview ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Lead health — {total} analyzed</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(HEALTH_CFG).map(([key, cfg]) => {
            const val = key === "AT_RISK" ? (s.atRisk || 0) : (s[key.toLowerCase()] || 0);
            return <HealthCard key={key} cfg={cfg} value={val} total={total} />;
          })}
        </div>
      </div>

      {/* ── Two-column: problems + responsibility ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top conversion problems */}
        <Card>
          <CardHeader title="Top Conversion Problems" badge={top.length} badgeColor="#DC2626" />
          <div className="p-5 space-y-3">
            {top.length === 0 && (
              <p className="text-[12px] text-[#8B92A9]">No data yet</p>
            )}
            {top.map((p, i) => (
              <HBar
                key={p.code}
                label={`${i + 1}. ${REASON_LABELS[p.code] || p.code}`}
                value={p.count}
                max={maxProblem}
                color="#DC2626"
                sub={`${Math.round((p.count / total) * 100)}%`}
              />
            ))}
          </div>
        </Card>

        {/* Responsibility distribution */}
        <Card>
          <CardHeader title="Responsibility Distribution" />
          <div className="p-5 space-y-3">
            {Object.entries(rd).map(([type, count]) => {
              const cfg = RESP_CFG[type] || RESP_CFG.UNKNOWN;
              return (
                <HBar
                  key={type}
                  label={cfg.label}
                  value={count}
                  max={total}
                  color={cfg.color}
                  sub={`${Math.round((count / total) * 100)}%`}
                />
              );
            })}
            {Object.keys(rd).length === 0 && (
              <p className="text-[12px] text-[#8B92A9]">No data yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Employee breakdown ──────────────────────────────────────────────── */}
      {emp.length > 0 && (
        <Card>
          <CardHeader
            title="Employee Analysis"
            badge={emp.length}
            badgeColor="#7C3AED"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] font-bold text-[#8B92A9] uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Employee</th>
                  <th className="text-center px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">
                    <span className="text-[#D97706]">At Risk</span>
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="text-[#DC2626]">Lost</span>
                  </th>
                  <th className="text-center px-4 py-3">Poor Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {emp
                  .sort((a, b) => (b.atRisk + b.lost) - (a.atRisk + a.lost))
                  .map((e, i) => (
                    <tr
                      key={i}
                      className="border-t border-[#F0F2FA] dark:border-[#1E2133] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
                    >
                      <td className="px-5 py-3 font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                        {e.name}
                      </td>
                      <td className="text-center px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB]">
                        {e.totalLeads}
                      </td>
                      <td className="text-center px-4 py-3">
                        {e.atRisk > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFFBEB] dark:bg-[#2D1F00] text-[#D97706]">
                            {e.atRisk}
                          </span>
                        ) : (
                          <span className="text-[#C4C9DA]">—</span>
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        {e.lost > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626]">
                            {e.lost}
                          </span>
                        ) : (
                          <span className="text-[#C4C9DA]">—</span>
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        {e.poorFollowUp > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626]">
                            {e.poorFollowUp}
                          </span>
                        ) : (
                          <span className="text-[#C4C9DA]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Main combined page
// ─────────────────────────────────────────────────────────────────────────────

const INNER_TABS = [
  {
    id:    "insights",
    label: "Lead Insights",
    icon:  <BarChart3 size={14} />,
    desc:  "Daily CRM lead activity — new leads, follow-ups, conversions",
  },
  {
    id:    "ai",
    label: "AI Intelligence",
    icon:  <Brain size={14} />,
    desc:  "AI-powered outcome analysis — health, responsibility, conversion probability",
  },
];

export default function LeadIntelligencePage() {
  const [activeTab, setActiveTab] = useState("insights");
  const [aiRefreshKey, setAiRefreshKey] = useState(0);

  const active = INNER_TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14]">

      {/* ── Page header + inner tab bar ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#11131C] border-b border-[#E4E7EF] dark:border-[#1E2133] sticky top-0 z-10">

        {/* Title row */}
        <div className="px-5 md:px-8 pt-5 pb-3 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
                <Sparkles size={14} className="text-[#2563EB]" />
              </div>
              <h1 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                Lead Intelligence
              </h1>
            </div>
            <p className="text-[12px] text-[#8B92A9] mt-0.5 ml-9">{active?.desc}</p>
          </div>

          {/* Re-fresh button shown only on AI tab */}
          {activeTab === "ai" && (
            <button
              onClick={() => setAiRefreshKey(k => k + 1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] dark:hover:border-[#2563EB] hover:text-[#2563EB] transition shrink-0"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex gap-0 px-5 md:px-8 overflow-x-auto">
          {INNER_TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
                  isActive
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-6">
        {activeTab === "insights" && (
          // LeadInsights is self-contained — renders its own date picker, KPI cards, table
          <LeadInsights />
        )}

        {activeTab === "ai" && (
          // key forces remount on refresh
          <AILeadReport key={aiRefreshKey} />
        )}
      </div>
    </div>
  );
}
