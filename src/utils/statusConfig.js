// src/utils/statusConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for lead status / quality / outcome DISPLAY across
// the frontend — now driven by the company's customization (Customize CRM).
//
// Backward compatible: STATUS_CONFIG, ALL_STATUSES, STATUS_FILTER_CONFIG and
// getLeadDisplayStatus() keep their old shapes. They are rebuilt in place
// whenever the company's customization loads or changes, so existing imports
// automatically pick up renamed / recoloured / custom statuses.
//
// Virtual statuses:
//   "Merged" — lead was merged into another lead (mergedInto is set)
//   "Closed" — lead was closed as a wrong/invalid entry (isClosed=true, no mergedInto)
// ─────────────────────────────────────────────────────────────────────────────

import { getCustomization, subscribeCustomization, findStatus, findTemperature, findOutcome } from "../data/customizationStore";

// ── Colour palette → literal Tailwind classes (must stay literal so Tailwind
//    compiles them; keys match the backend palette in customizationDefaults) ──
export const PALETTE_CLASSES = {
  blue:    { bg: "bg-blue-100 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       soft: "bg-blue-50 dark:bg-blue-900/20",       dot: "#2563EB" },
  sky:     { bg: "bg-sky-100 dark:bg-sky-950/40",         text: "text-sky-600 dark:text-sky-400",         soft: "bg-sky-50 dark:bg-sky-900/20",         dot: "#0284C7" },
  cyan:    { bg: "bg-cyan-100 dark:bg-cyan-950/40",       text: "text-cyan-600 dark:text-cyan-400",       soft: "bg-cyan-50 dark:bg-cyan-900/20",       dot: "#0891B2" },
  teal:    { bg: "bg-teal-100 dark:bg-teal-950/40",       text: "text-teal-600 dark:text-teal-400",       soft: "bg-teal-50 dark:bg-teal-900/20",       dot: "#0D9488" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-900/20", dot: "#059669" },
  green:   { bg: "bg-green-100 dark:bg-green-950/40",     text: "text-green-600 dark:text-green-400",     soft: "bg-green-50 dark:bg-green-900/20",     dot: "#16A34A" },
  lime:    { bg: "bg-lime-100 dark:bg-lime-950/40",       text: "text-lime-700 dark:text-lime-400",       soft: "bg-lime-50 dark:bg-lime-900/20",       dot: "#65A30D" },
  yellow:  { bg: "bg-yellow-100 dark:bg-yellow-950/40",   text: "text-yellow-700 dark:text-yellow-400",   soft: "bg-yellow-50 dark:bg-yellow-900/20",   dot: "#CA8A04" },
  amber:   { bg: "bg-amber-100 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     soft: "bg-amber-50 dark:bg-amber-900/20",     dot: "#D97706" },
  orange:  { bg: "bg-orange-100 dark:bg-orange-950/40",   text: "text-orange-600 dark:text-orange-400",   soft: "bg-orange-50 dark:bg-orange-900/20",   dot: "#EA580C" },
  red:     { bg: "bg-red-100 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         soft: "bg-red-50 dark:bg-red-900/20",         dot: "#DC2626" },
  rose:    { bg: "bg-rose-100 dark:bg-rose-950/40",       text: "text-rose-600 dark:text-rose-400",       soft: "bg-rose-50 dark:bg-rose-900/20",       dot: "#E11D48" },
  pink:    { bg: "bg-pink-100 dark:bg-pink-950/40",       text: "text-pink-600 dark:text-pink-400",       soft: "bg-pink-50 dark:bg-pink-900/20",       dot: "#DB2777" },
  purple:  { bg: "bg-purple-100 dark:bg-purple-950/40",   text: "text-purple-600 dark:text-purple-400",   soft: "bg-purple-50 dark:bg-purple-900/20",   dot: "#7C3AED" },
  violet:  { bg: "bg-violet-100 dark:bg-violet-950/40",   text: "text-violet-600 dark:text-violet-400",   soft: "bg-violet-50 dark:bg-violet-900/20",   dot: "#8B5CF6" },
  indigo:  { bg: "bg-indigo-100 dark:bg-indigo-950/40",   text: "text-indigo-600 dark:text-indigo-400",   soft: "bg-indigo-50 dark:bg-indigo-900/20",   dot: "#4F46E5" },
  slate:   { bg: "bg-slate-100 dark:bg-slate-800/60",     text: "text-slate-600 dark:text-slate-300",     soft: "bg-slate-50 dark:bg-slate-800/40",     dot: "#475569" },
  gray:    { bg: "bg-gray-100 dark:bg-gray-800/60",       text: "text-gray-600 dark:text-gray-300",       soft: "bg-gray-50 dark:bg-gray-800/40",       dot: "#6B7280" },
};

export function paletteOf(color) {
  return PALETTE_CLASSES[color] || PALETTE_CLASSES.gray;
}

// Virtual statuses (not stored in DB, derived from lead flags).
const VIRTUAL = {
  /** MERGED — Yellow: lead merged into another (mergedInto !== null). */
  Merged: { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400", dot: "#D97706" },
  /** CLOSED — Red: closed as a wrong entry / invalid contact (isClosed=true, mergedInto=null). */
  Closed: { bg: "bg-red-100 dark:bg-red-950/40",       text: "text-red-700 dark:text-red-400",       dot: "#DC2626" },
};

/** Visual config for every status badge (real + virtual), keyed by key, label and alias. */
export const STATUS_CONFIG = {};

/** All status options for filter dropdowns (keys) — incl. virtual Merged + Closed. */
export const ALL_STATUSES = [];

/** STATUS_STYLE-compatible lookup (bg + text only). */
export const STATUS_FILTER_CONFIG = {};

function rebuild() {
  const c = getCustomization();
  for (const k of Object.keys(STATUS_CONFIG)) delete STATUS_CONFIG[k];
  for (const k of Object.keys(STATUS_FILTER_CONFIG)) delete STATUS_FILTER_CONFIG[k];
  ALL_STATUSES.length = 0;

  for (const s of c?.statuses || []) {
    const p = paletteOf(s.color);
    const cfg = { bg: p.bg, text: p.text, dot: p.dot, label: s.label, key: s.key, category: s.category };
    STATUS_CONFIG[s.key] = cfg;
    if (!STATUS_CONFIG[s.label]) STATUS_CONFIG[s.label] = cfg;
    for (const a of s.aliases || []) if (!STATUS_CONFIG[a]) STATUS_CONFIG[a] = cfg;
    if (s.active) ALL_STATUSES.push(s.key);
  }
  STATUS_CONFIG.Merged = { ...VIRTUAL.Merged, label: "Merged", key: "Merged", category: "virtual" };
  STATUS_CONFIG.Closed = { ...VIRTUAL.Closed, label: "Closed", key: "Closed", category: "virtual" };
  if (!STATUS_CONFIG.New) STATUS_CONFIG.New = STATUS_CONFIG[ALL_STATUSES[0]] || { ...PALETTE_CLASSES.blue, label: "New", key: "New" };
  ALL_STATUSES.push("Merged", "Closed");

  for (const [k, v] of Object.entries(STATUS_CONFIG)) STATUS_FILTER_CONFIG[k] = { bg: v.bg, text: v.text };
}
rebuild();
subscribeCustomization(rebuild);

/** Display label for any stored status key / alias. */
export function statusDisplayLabel(status) {
  if (status === "Merged" || status === "Closed") return status;
  return findStatus(status)?.label || status || "";
}

/** Badge config for any status (key, label or alias); falls back to the default status. */
export function statusConfigFor(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG[findStatus(status)?.key] || STATUS_CONFIG.New;
}

/**
 * getLeadDisplayStatus(lead)
 *
 * Priority:
 *   1. mergedInto is set  → "Merged"  (Yellow)
 *   2. isClosed is true   → "Closed"  (Red)
 *   3. Otherwise          → the status's (possibly renamed) label + colour
 *
 * @returns {{ label: string, config: object }}
 */
export function getLeadDisplayStatus(lead) {
  if (!lead) {
    return { label: statusDisplayLabel("New"), config: STATUS_CONFIG.New };
  }
  if (lead.mergedInto) return { label: "Merged", config: STATUS_CONFIG.Merged };
  if (lead.isClosed)   return { label: "Closed", config: STATUS_CONFIG.Closed };
  const status = lead.status || "New";
  return { label: statusDisplayLabel(status), config: statusConfigFor(status) };
}

// ── Lead quality (temperature) display ───────────────────────────────────────
export function temperatureStyle(temp) {
  const t = findTemperature(temp);
  const p = paletteOf(t?.color || (temp === "Hot" ? "red" : temp === "Warm" ? "amber" : temp === "Cold" ? "blue" : "gray"));
  return { ...p, label: t?.label || temp || "", key: t?.key || temp };
}

// ── Call outcome display ─────────────────────────────────────────────────────
export function outcomeStyle(outcome) {
  const o = findOutcome(outcome);
  const p = paletteOf(o?.color || "gray");
  return { ...p, label: o?.label || outcome || "", key: o?.key || outcome };
}
