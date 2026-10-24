// src/agent/leadFilters.js — the lead list's filters and sorting (same choices as the mobile Leads screen).
export const DATE_PRESETS = [
  { id: 'all', label: 'All time' }, { id: 'today', label: 'Today' }, { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }, { id: 'custom', label: 'Custom range' },
];
export const SORTS = [
  { id: 'recent', label: 'Recent activity' }, { id: 'newest', label: 'Newest first' }, { id: 'oldest', label: 'Oldest first' },
  { id: 'name', label: 'Name A–Z' }, { id: 'status', label: 'By status' },
];
const STATUS_ORDER = ['New', 'In Progress', 'Interested', 'Converted', 'Not Interested'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/** [from, to] in ms for a preset (week starts Monday), or null for "all time". Custom: from/to are yyyy-mm-dd strings. */
export function dateRange(preset, custom = {}, now = new Date()) {
  const today = startOfDay(now);
  if (preset === 'today') return [today.getTime(), today.getTime() + 86400000 - 1];
  if (preset === 'week') { const day = (today.getDay() + 6) % 7; const from = new Date(today); from.setDate(from.getDate() - day); return [from.getTime(), from.getTime() + 7 * 86400000 - 1]; }
  if (preset === 'month') { const from = new Date(today.getFullYear(), today.getMonth(), 1); const to = new Date(today.getFullYear(), today.getMonth() + 1, 1); return [from.getTime(), to.getTime() - 1]; }
  if (preset === 'custom') {
    const f = custom.from ? startOfDay(`${custom.from}T00:00`).getTime() : -Infinity;
    const t = custom.to ? startOfDay(`${custom.to}T00:00`).getTime() + 86400000 - 1 : Infinity;
    return Number.isFinite(f) || Number.isFinite(t) ? [f, t] : null;
  }
  return null;
}

/** Distinct, non-empty values of a lead field for a picker. */
export const distinct = (leads, field) => [...new Set(leads.map((l) => String(l[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function applyLeadFilters(leads, f = {}, now = new Date()) {
  const needle = String(f.q || '').trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  const range = dateRange(f.date || 'all', { from: f.from, to: f.to }, now);
  return leads.filter((l) => {
    if (f.status && f.status !== 'All' && l.status !== f.status) return false;
    if (f.temp && l.temperature !== f.temp) return false;
    if (f.industry && String(l.industry || '') !== f.industry) return false;
    if (f.source && String(l.source || '') !== f.source) return false;
    if (f.custom) {
      for (const [key, want] of Object.entries(f.custom)) {
        if (!want) continue;
        const cf = l.customFields || {};
        const have = cf instanceof Map ? cf.get(key) : cf[key];
        const hay = Array.isArray(have) ? have.map(String) : [String(have ?? '')];
        if (!hay.some((v) => v === String(want))) return false;
      }
    }
    if (range) { const t = new Date(l.date).getTime(); if (!(t >= range[0] && t <= range[1])) return false; }
    if (needle) {
      const hit = String(l.name || '').toLowerCase().includes(needle) || String(l.email || '').toLowerCase().includes(needle)
        || String(l.source || '').toLowerCase().includes(needle) || String(l.campaign || '').toLowerCase().includes(needle)
        || (digits.length >= 3 && String(l.phone || '').replace(/\D/g, '').includes(digits));
      if (!hit) return false;
    }
    return true;
  });
}

export function sortLeads(leads, sort = 'recent') {
  const list = [...leads];
  const t = (l) => new Date(l.date).getTime() || 0;
  if (sort === 'newest') return list.sort((a, b) => t(b) - t(a));
  if (sort === 'oldest') return list.sort((a, b) => t(a) - t(b));
  if (sort === 'name') return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  if (sort === 'status') return list.sort((a, b) => (STATUS_ORDER.indexOf(a.status) + 1 || 99) - (STATUS_ORDER.indexOf(b.status) + 1 || 99) || t(b) - t(a));
  return list.sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0));      // recent activity (the order the app already uses)
}

/** How many filters are switched on (for the badge on the Filter button). */
export const activeFilterCount = (f = {}) => ['temp', 'industry', 'source'].filter((k) => f[k]).length + (f.date && f.date !== 'all' ? 1 : 0) + (f.status && f.status !== 'All' ? 1 : 0);
