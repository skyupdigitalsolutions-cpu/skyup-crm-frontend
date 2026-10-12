// src/marketing/mkt/metaPerfUtils.js — NEW FILE
// Pure helpers for the Overview's "Meta Ads performance" section: date-range choices, how each
// metric is formatted / coloured / ranked, and the table sort. (No React in here, so it is easy to test.)

// ── Dates (the dashboard works in IST, YYYY-MM-DD) ───────────────────────────
export const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const addDays = (d, k) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const validDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const MAX_DAYS = 400;

export const RANGE_OPTIONS = [["dash", "Dashboard range"], ["7d", "7D"], ["14d", "14D"], ["30d", "30D"], ["90d", "90D"], ["mtd", "This month"], ["lm", "Last month"], ["custom", "Custom"]];

// mode: one of RANGE_OPTIONS; custom: { from, to }; dash: the dashboard's own { from, to }
export function resolveRange(mode, custom, dash, today = istToday()) {
  let from, to;
  if (mode === "dash") { from = dash && dash.from; to = dash && dash.to; }
  else if (mode === "custom") { from = custom && custom.from; to = custom && custom.to; }
  else if (mode === "mtd") { from = monthStart(today); to = today; }
  else if (mode === "lm") { const first = monthStart(today); to = addDays(first, -1); from = monthStart(to); }
  else { const days = parseInt(mode, 10); if (!days) return { error: "Unknown range" }; to = today; from = addDays(today, -(days - 1)); }
  if (!validDay(from) || !validDay(to)) return { error: mode === "custom" ? "Pick both a start and an end date." : "Date range not available." };
  if (to > today) to = today;
  if (from > to) return { error: "“From” must be on or before “To”." };
  const days = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > MAX_DAYS) return { error: `Choose a range of ${MAX_DAYS} days or less.` };
  return { from, to, days };
}

// ── Number formats ───────────────────────────────────────────────────────────
const dash = "—";
export const fInt = (v) => (v == null ? dash : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }));
export const fMoney0 = (v) => (v == null ? dash : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
export const fMoney2 = (v) => (v == null ? dash : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fPct2 = (v) => (v == null ? dash : `${Number(v).toFixed(2)}%`);
export const fDec2 = (v) => (v == null ? dash : Number(v).toFixed(2));
const tickCount = (v) => (v >= 1e7 ? `${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : `${+Number(v).toFixed(2)}`);
const tickMoney = (v) => `₹${tickCount(v)}`;

// ── Metrics ──────────────────────────────────────────────────────────────────
// better: "lower" = a smaller number is good (costs, frequency), "higher" = bigger is good, null = neutral
export const METRICS = {
  spend:       { label: "Amount spent", short: "Spent",       color: "#6366F1", fmt: fMoney0, tick: tickMoney, better: null },
  leads:       { label: "Leads",        short: "Leads",       color: "#10B981", fmt: fInt,    tick: tickCount, better: "higher" },
  cpl:         { label: "Cost per lead", short: "Cost/lead",  color: "#F59E0B", fmt: fMoney2, tick: tickMoney, better: "lower" },
  impressions: { label: "Impressions",  short: "Impressions", color: "#3B82F6", fmt: fInt,    tick: tickCount, better: null },
  reach:       { label: "Reach",        short: "Reach",       color: "#06B6D4", fmt: fInt,    tick: tickCount, better: null },
  cpm:         { label: "CPM",          short: "CPM",         color: "#8B5CF6", fmt: fMoney2, tick: tickMoney, better: "lower" },
  linkCtr:     { label: "CTR (link)",   short: "CTR",         color: "#EC4899", fmt: fPct2,   tick: (v) => `${+Number(v).toFixed(2)}%`, better: "higher" },
  frequency:   { label: "Frequency",    short: "Frequency",   color: "#F97316", fmt: fDec2,   tick: (v) => `${+Number(v).toFixed(2)}`, better: "lower" },
};
export const METRIC_ORDER = ["spend", "leads", "cpl", "impressions", "reach", "cpm", "linkCtr", "frequency"];

// The trend chart can show ANY number of metrics at once (they are just lines). There is always at least one,
// so un-picking the last one does nothing. New picks keep the chips' normal order.
export function toggleMetric(selected, key) {
  if (selected.includes(key)) return selected.length > 1 ? selected.filter((k) => k !== key) : selected;
  return METRIC_ORDER.filter((k) => k === key || selected.includes(k));
}

// How the lines share the chart: one metric = real axis; two = left + right axes; three or more = each line is
// scaled to its own peak (different units can't share one axis) and the tooltip gives the real numbers.
export const trendScale = (count) => (count <= 1 ? "shared" : count === 2 ? "dual" : "own");

// ── Campaign-wise trend: one line per campaign ───────────────────────────────
export const CAMPAIGN_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6", "#F97316", "#3B82F6", "#84CC16", "#E11D48", "#14B8A6", "#A855F7"];
export const TOP_CAMPAIGNS = 5;

// Which campaigns are drawn at first: the ones you filtered to, otherwise the biggest spenders (32 lines is unreadable).
export function defaultVisible(campaigns, selectedIds) {
  if (selectedIds && selectedIds.length) return campaigns.filter((c) => selectedIds.includes(c.id)).map((c) => c.id);
  return campaigns.slice(0, TOP_CAMPAIGNS).map((c) => c.id);
}

// Chart rows: one per day, one column per visible campaign (keyed by campaign id) for the chosen metric.
export function campaignPoints(days, campaigns, visibleIds, metric) {
  const vis = campaigns.filter((c) => visibleIds.includes(c.id));
  return days.map((t, i) => { const row = { t }; vis.forEach((c) => { row[c.id] = c.points[i] ? c.points[i][metric] : null; }); return row; });
}

// ── Colour rules ─────────────────────────────────────────────────────────────
const GOOD = ["#10B981", "#34D399"], OK = ["#F59E0B", "#FBBF24"], BAD = ["#F43F5E", "#FB7185"], BRAND = ["#6366F1", "#A78BFA"];
// Gradient pair for a bar. Costs: the cheapest are green, the priciest red. Frequency: absolute (above ~3 means people
// see the ad too often). Everything else uses the brand colour.
export function barTone(metricKey, value, max) {
  if (value == null) return BRAND;
  if (metricKey === "frequency") return value <= 2.5 ? GOOD : value <= 3.5 ? OK : BAD;
  const better = METRICS[metricKey] && METRICS[metricKey].better;
  if (better === "lower" && max > 0) { const r = value / max; return r <= 0.5 ? GOOD : r <= 0.8 ? OK : BAD; }
  if (better === "higher" && metricKey === "linkCtr" && max > 0) { const r = value / max; return r >= 0.75 ? GOOD : r >= 0.4 ? BRAND : OK; }
  return BRAND;
}

// Table cell tint for cost-per-lead / frequency relative to the whole account.
export function cellTone(metricKey, value, totalValue) {
  if (value == null) return "";
  if (metricKey === "frequency") return value > 4 ? "text-rose-600 dark:text-rose-400" : value > 3 ? "text-amber-600 dark:text-amber-400" : "";
  if ((metricKey === "cpl" || metricKey === "costPerResult") && totalValue > 0) {
    const r = value / totalValue;
    return r <= 0.8 ? "text-emerald-600 dark:text-emerald-400" : r >= 1.3 ? "text-rose-600 dark:text-rose-400" : "";
  }
  return "";
}

// ── Ranking + sorting ────────────────────────────────────────────────────────
// "Best first": cheapest / least-saturated first for "lower is better" metrics, biggest first otherwise; no-data last.
export function rankCampaigns(campaigns, metricKey) {
  const lower = METRICS[metricKey] && METRICS[metricKey].better === "lower";
  return campaigns.slice().sort((a, b) => {
    const x = a[metricKey], y = b[metricKey];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return lower ? x - y : y - x;
  });
}

export function sortRows(rows, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string") return sign * x.localeCompare(y);
    return sign * (x - y);
  });
}

// Spend share: the biggest few campaigns, everything else folded into "Others".
export const DONUT_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6"];
export function spendShare(campaigns, top = 5) {
  const withSpend = campaigns.filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);
  const head = withSpend.slice(0, top).map((c, i) => ({ key: c.id, label: c.name, value: c.spend, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  const rest = withSpend.slice(top).reduce((t, c) => t + c.spend, 0);
  if (rest > 0) head.push({ key: "others", label: `Others (${withSpend.length - top})`, value: Math.round(rest * 100) / 100, color: "#94A3B8" });
  return head;
}

// ── Campaign filter ──────────────────────────────────────────────────────────
export const MAX_SELECTED = 50;

export function toggleId(list, id) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= MAX_SELECTED ? list : [...list, id];
}

// Campaign picker search: case-insensitive "contains", biggest spend first.
export function filterOptions(campaigns, query) {
  const q = String(query || "").trim().toLowerCase();
  return campaigns.filter((c) => !q || String(c.name).toLowerCase().includes(q)).slice().sort((a, b) => (b.spend || 0) - (a.spend || 0));
}

// What the donut / comparison / scorecard are built from:
//   nothing picked      → every campaign
//   several picked      → just those campaigns
//   exactly one picked  → that campaign's AD SETS (a single slice or bar would say nothing)
export function viewRows(data, selectedIds) {
  const campaigns = (data && data.campaigns) || [];
  const adsets = (data && data.adsets) || [];
  const ids = selectedIds || [];
  if (!ids.length) return { level: "campaign", rows: campaigns };
  if (ids.length === 1 && adsets.length) return { level: "adset", rows: adsets };
  const set = new Set(ids);
  return { level: "campaign", rows: campaigns.filter((c) => set.has(c.id)) };
}

export const LEVEL_WORD = { campaign: ["campaign", "campaigns", "Campaign"], adset: ["ad set", "ad sets", "Ad set"] };
export const pluralize = (level, n) => `${n} ${LEVEL_WORD[level][n === 1 ? 0 : 1]}`;
