// components/QualificationScore.jsx
// Shared display for Meta lead-qualification scoring.
// Shows: Lead Score, Maximum Score, Qualification Percentage, Lead Category.
//
// Scoring model (kept in sync with backend utils/qualificationScorer.js):
//   • Each question's answer options total exactly 100 points.
//   • Maximum Score = number of questions × 100.
//   • Percentage = (leadScore / maxScore) × 100.
import { Flame, Thermometer, Snowflake } from "lucide-react";

const CAT_COLOR = {
  Hot:  "#DC2626",
  Warm: "#D97706",
  Cold: "#2563EB",
};
const CAT_ICON = { Hot: Flame, Warm: Thermometer, Cold: Snowflake };

/**
 * Derive the four display values from a lead object, tolerant of older leads
 * that may be missing maxScore / qualificationPercentage.
 */
export function deriveQualification(lead = {}) {
  if (lead.leadScore == null) return null;
  const leadScore = Number(lead.leadScore) || 0;
  const maxScore =
    lead.maxScore != null ? Number(lead.maxScore) || 0 : null;
  let percentage =
    lead.qualificationPercentage != null
      ? Number(lead.qualificationPercentage)
      : maxScore && maxScore > 0
      ? Math.round((leadScore / maxScore) * 10000) / 100
      : null;
  const category = lead.leadCategory || lead.temperature || lead.Quality || null;
  return { leadScore, maxScore, percentage, category };
}

/**
 * Inline / compact qualification summary.
 * Props:
 *   lead    – lead object (reads leadScore, maxScore, qualificationPercentage, leadCategory)
 *   size    – "sm" (default) | "md"
 *   showCategory – include the Hot/Warm/Cold label (default true)
 */
export default function QualificationScore({ lead, size = "sm", showCategory = true }) {
  const q = deriveQualification(lead);
  if (!q) return null;

  const color = CAT_COLOR[q.category] || "#2563EB";
  const Icon = CAT_ICON[q.category];
  const numCls = size === "md" ? "text-[13px]" : "text-[11px]";
  const lblCls = size === "md" ? "text-[11px]" : "text-[10px]";

  return (
    <div className="inline-flex items-center flex-wrap gap-x-2.5 gap-y-1">
      <span className={`${lblCls} text-[#8B92A9]`}>
        Score:{" "}
        <span className={`${numCls} font-bold`} style={{ color }}>
          {q.leadScore}
        </span>
        {q.maxScore != null && (
          <span className={`${lblCls} text-[#8B92A9] font-medium`}> / {q.maxScore}</span>
        )}
      </span>
      {q.percentage != null && (
        <span className={`${lblCls} text-[#8B92A9]`}>
          (
          <span className={`${numCls} font-bold`} style={{ color }}>
            {q.percentage}%
          </span>
          )
        </span>
      )}
      {showCategory && q.category && (
        <span
          className={`${lblCls} font-semibold inline-flex items-center gap-1`}
          style={{ color }}
        >
          {Icon ? <Icon className="w-3 h-3" /> : null}
          {q.category} Lead
        </span>
      )}
    </div>
  );
}
