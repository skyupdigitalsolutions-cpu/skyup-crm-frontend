// src/agent/dashboardStats.js — the Home screen's lead breakdowns (same groups as the mobile Dashboard).
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export function leadStats(leads, now = new Date()) {
  const today = startOfDay(now), weekStart = today - ((now.getDay() + 6) % 7) * 86400000;
  const by = (f) => leads.reduce((m, l) => { const k = f(l); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
  const created = (l) => new Date(l.date).getTime() || 0;
  return {
    total: leads.length,
    byStatus: by((l) => l.status || 'New'),
    byTemp: by((l) => l.temperature),
    newToday: leads.filter((l) => created(l) >= today).length,
    newThisWeek: leads.filter((l) => created(l) >= weekStart).length,
    converted: leads.filter((l) => l.status === 'Converted').length,
    inProgress: leads.filter((l) => l.status === 'In Progress').length,
    notInterested: leads.filter((l) => l.status === 'Not Interested').length,
  };
}
