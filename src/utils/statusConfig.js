// src/utils/statusConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for lead status display across the entire frontend.
// Both AdminLeadsPage and ReportPage import from here — no duplicate configs.
//
// Virtual statuses:
//   "Merged" — lead was merged into another lead (mergedInto is set)
//   "Closed" — lead was closed as a wrong/invalid entry (isClosed=true, no mergedInto)
//
// Usage:
//   import { STATUS_CONFIG, getLeadDisplayStatus, ALL_STATUSES } from '../utils/statusConfig';
//
//   const { label, config } = getLeadDisplayStatus(lead);
//   // label  → "Merged" | "Closed" | lead.status
//   // config → { bg, text, dot }
// ─────────────────────────────────────────────────────────────────────────────

/** Visual config for every status badge (real + virtual). */
export const STATUS_CONFIG = {
  // ── Real DB statuses ───────────────────────────────────────────────────────
  "New": {
    bg:   "bg-blue-100 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
    dot:  "#2563EB",
  },
  "In Progress": {
    bg:   "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
    dot:  "#D97706",
  },
  "Converted": {
    bg:   "bg-emerald-100 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
    dot:  "#059669",
  },
  "Not Interested": {
    bg:   "bg-red-100 dark:bg-red-950/40",
    text: "text-red-600 dark:text-red-400",
    dot:  "#DC2626",
  },

  // ── Virtual statuses (derived, not stored in DB) ───────────────────────────

  /**
   * MERGED — Yellow
   * The lead was merged into another lead (mergedInto !== null).
   * Must never be shown as Red "Closed" — they are distinct concepts.
   */
  "Merged": {
    bg:   "bg-yellow-100 dark:bg-yellow-950/40",
    text: "text-yellow-700 dark:text-yellow-400",
    dot:  "#D97706",
  },

  /**
   * CLOSED — Red
   * The lead was closed as a wrong entry / invalid contact (isClosed=true, mergedInto=null).
   * Wrong Number, Fake Lead, Invalid Contact, etc.
   */
  "Closed": {
    bg:   "bg-red-100 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-400",
    dot:  "#DC2626",
  },
};

/**
 * All status options available as filter choices.
 * Includes virtual statuses Merged + Closed so the filter dropdowns stay in sync.
 */
export const ALL_STATUSES = [
  "New",
  "In Progress",
  "Converted",
  "Not Interested",
  "Merged",
  "Closed",
];

/**
 * getLeadDisplayStatus(lead)
 *
 * Resolves the correct display label and badge config for any lead object,
 * including virtual statuses derived from isClosed / mergedInto fields.
 *
 * Priority:
 *   1. mergedInto is set  → "Merged"  (Yellow)
 *   2. isClosed is true   → "Closed"  (Red)
 *   3. Otherwise          → lead.status (using STATUS_CONFIG, falls back to "New")
 *
 * @param {object} lead - A lead object (from mapLead or raw API response)
 * @returns {{ label: string, config: object }}
 */
export function getLeadDisplayStatus(lead) {
  if (!lead) {
    return { label: "New", config: STATUS_CONFIG["New"] };
  }

  // Merged takes priority — duplicate lead absorbed into another
  if (lead.mergedInto) {
    return { label: "Merged", config: STATUS_CONFIG["Merged"] };
  }

  // Closed — wrong entry / invalid contact
  if (lead.isClosed) {
    return { label: "Closed", config: STATUS_CONFIG["Closed"] };
  }

  // Normal status
  const status = lead.status || "New";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
  return { label: status, config };
}

/**
 * STATUS_FILTER_CONFIG
 * Used by the STATUS_STYLE-compatible pattern in ReportPage (read-only lookup).
 * Maps every display label → { bg, text } (same as STATUS_CONFIG but without dot).
 */
export const STATUS_FILTER_CONFIG = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, { bg: v.bg, text: v.text }])
);
