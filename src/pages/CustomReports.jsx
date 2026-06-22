// src/pages/CustomReports.jsx
// Super-admin custom financial reports — redesigned.
// Per-company, type-tagged fields (revenue/cost/profit/other) → real computed
// metrics (net profit, margin, ROI, loss%) + verdict, trends, AI analysis with
// graceful rate-limit handling, and CSV / PDF export. Locked to the logged-in
// user's company (no picker). Visual language mirrors the CRM dashboard.
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../data/axiosConfig";

// Dark-mode aware type meta — bg/text as Tailwind classes instead of inline hex
const TYPES = [
  { key: "revenue", label: "Revenue", color: "#059669", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
  { key: "cost",    label: "Cost",    color: "#DC2626", cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"           },
  { key: "profit",  label: "Profit",  color: "#2563EB", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"           },
  { key: "other",   label: "Other",   color: "#64748B", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"         },
];
const typeMeta = (k) => TYPES.find(t => t.key === k) || TYPES[3];

const money  = (cur, n) => `${cur || "₹"}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pctTxt = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n}%`);
const today  = () => new Date().toISOString().slice(0, 10);
const emptyField = () => ({ name: "", value: "", type: "other", note: "" });

const INP = "px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] w-full";

function getCurrentCompany() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }
  if (!user) return { id: "", name: "" };
  let id = "", name = "";
  if (typeof user.companyId === "string") id = user.companyId;
  if (user.company) {
    if (typeof user.company === "string") id = id || user.company;
    else if (typeof user.company === "object") {
      id = id || (user.company._id ? String(user.company._id) : "");
      name = user.company.name || user.company.companyName || "";
    }
  }
  name = name || user.companyName || "";
  return { id, name };
}

export default function CustomReports() {
  const company   = getCurrentCompany();
  const companyId = company.id;

  const [reports, setReports]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [trends, setTrends]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [title, setTitle]             = useState("");
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd]     = useState(today());
  const [currency, setCurrency]       = useState("₹");
  const [fields, setFields]           = useState([emptyField()]);
  const [saving, setSaving]           = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState("");
  const printRef = useRef(null);

  const loadReports = useCallback(() => {
    if (!companyId) return;
    setLoading(true); setError("");
    api.get(`/superadmin/custom-reports?company=${companyId}`)
      .then(res => { setReports(Array.isArray(res.data) ? res.data : []); setSelected(null); setTrends(null); })
      .catch(() => setError("Could not load reports."))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const openReport = async (id) => {
    setError(""); setAiError("");
    try {
      const [r, t] = await Promise.all([
        api.get(`/superadmin/custom-reports/${id}`),
        api.get(`/superadmin/custom-reports/${id}/trends`),
      ]);
      setSelected(r.data); setTrends(t.data);
    } catch { setError("Could not open the report."); }
  };

  const resetForm = () => {
    setEditingId(null); setTitle(""); setPeriodStart(today()); setPeriodEnd(today());
    setCurrency("₹"); setFields([emptyField()]);
  };
  const startCreate = () => { resetForm(); setShowForm(true); };
  const startEdit = (r) => {
    setEditingId(r._id); setTitle(r.title || "");
    setPeriodStart((r.periodStart || "").slice(0, 10) || today());
    setPeriodEnd((r.periodEnd || "").slice(0, 10) || today());
    setCurrency(r.currency || "₹");
    setFields((r.fields || []).map(f => ({ name: f.name, value: String(f.value), type: f.type || "other", note: f.note || "" })));
    if (!r.fields?.length) setFields([emptyField()]);
    setShowForm(true);
  };
  const setField    = (i, key, val) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  const addField    = () => setFields(prev => [...prev, emptyField()]);
  const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i));

  const saveReport = async () => {
    setError("");
    const clean = fields
      .map(f => ({ name: f.name.trim(), value: Number(f.value) || 0, type: f.type || "other", note: (f.note || "").trim() }))
      .filter(f => f.name);
    if (!title.trim())     return setError("Enter a report title.");
    if (!clean.length)     return setError("Add at least one field with a name.");
    if (new Date(periodStart) > new Date(periodEnd)) return setError("Start date must be on or before end date.");
    setSaving(true);
    try {
      const payload = { company: companyId, title: title.trim(), periodStart, periodEnd, currency, fields: clean };
      if (editingId) await api.put(`/superadmin/custom-reports/${editingId}`, payload);
      else           await api.post("/superadmin/custom-reports", payload);
      setShowForm(false); resetForm(); loadReports();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save the report.");
    } finally { setSaving(false); }
  };

  const deleteReport = async (id) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await api.delete(`/superadmin/custom-reports/${id}`);
      if (selected?._id === id) { setSelected(null); setTrends(null); }
      loadReports();
    } catch { setError("Could not delete the report."); }
  };

  const runAI = async () => {
    if (!selected) return;
    setAiLoading(true); setAiError("");
    try {
      const res = await api.post(`/superadmin/custom-reports/${selected._id}/analyze`);
      setSelected(prev => ({ ...prev, ai: { ...res.data } }));
    } catch (e) {
      const status = e?.response?.status;
      setAiError(
        status === 429 ? "AI is busy right now (rate limited). Please try again in a moment."
        : status === 503 ? "AI isn't configured on the server."
        : e?.response?.data?.message || "AI analysis is unavailable right now."
      );
    } finally { setAiLoading(false); }
  };

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!selected) return;
    const a = selected.analytics || {};
    const rows = [
      ["Report", selected.title],
      ["Period", `${(selected.periodStart || "").slice(0, 10)} to ${(selected.periodEnd || "").slice(0, 10)}`],
      ["Currency", selected.currency || "₹"],
      [],
      ["Field", "Type", "Value", "Share %", "Note"],
      ...(selected.fields || []).map(f => [f.name, f.type || "other", f.value, "", (f.note || "").replace(/,/g, " ")]),
      [],
      ["Total Revenue", "", a.totalRevenue ?? 0],
      ["Total Cost",    "", a.totalCost    ?? 0],
      ["Net Profit",    "", a.netProfit    ?? 0],
      ["Margin %",      "", a.marginPct    ?? ""],
      ["ROI %",         "", a.roiPct       ?? ""],
      ["Verdict",       "", a.verdict      ?? ""],
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${selected.title.replace(/[^\w]+/g, "_")}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => { if (printRef.current) window.print(); };

  // ── Verdict badge — dark-mode aware Tailwind classes ────────────────────
  const verdictBadge = (v) => {
    const map = {
      profit:       { t: "Profitable",            cls: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
      loss:         { t: "Loss-making",            cls: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"           },
      breakeven:    { t: "Break-even",             cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"       },
      insufficient: { t: "Tag fields to see profit", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"       },
    };
    const m = map[v] || map.insufficient;
    return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${m.cls}`}>{m.t}</span>;
  };

  const maxSeriesTotal = trends?.series?.reduce((m, s) => Math.max(m, Math.abs(s.total || 0)), 0) || 0;

  if (!companyId) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14]">
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          <h1 className="text-lg font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Custom Reports</h1>
          <div className="rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#1E2130] p-8 text-center text-sm text-[#64748B] dark:text-[#8B92A9]">
            No company is associated with your account, so reports can't be shown.
          </div>
        </div>
      </div>
    );
  }

  const a = selected?.analytics || {};

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14]">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap no-print">
          <div>
            <h1 className="text-lg font-bold text-[#0F1117] dark:text-[#F0F2FA]">Custom Reports</h1>
            <p className="text-xs text-[#64748B] dark:text-[#8B92A9]">{company.name ? `${company.name} · ` : ""}Financial fields with analytics and AI insights.</p>
          </div>
          {!selected && (
            <button onClick={startCreate} className="px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition">+ New report</button>
          )}
        </div>

        {error && <p className="text-xs text-rose-500 dark:text-rose-400 mb-3 no-print">{error}</p>}

        {/* ── Report list ────────────────────────────────────────────────── */}
        {!selected && (
          <div className="space-y-2">
            {loading && <p className="text-xs text-[#64748B] dark:text-[#8B92A9]">Loading…</p>}
            {!loading && reports.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#1E2133] bg-white dark:bg-[#11131C] p-10 text-center">
                <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">No reports yet</p>
                <p className="text-xs text-[#64748B] dark:text-[#8B92A9] mb-4">Create your first financial report to see analytics and AI insights.</p>
                <button onClick={startCreate} className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition">+ New report</button>
              </div>
            )}
            {reports.map(r => {
              const ra = r.analytics || {};
              return (
                <div key={r._id} className="bg-white dark:bg-[#11131C] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2133] p-4 flex items-center justify-between gap-3 hover:border-[#2563EB] dark:hover:border-[#2563EB] transition">
                  <button onClick={() => openReport(r._id)} className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#0F1117] dark:text-[#DDE1F5]">{r.title}</span>
                      {verdictBadge(ra.verdict)}
                    </div>
                    <div className="text-xs text-[#64748B] dark:text-[#8B92A9] mt-0.5">
                      {(r.periodStart || "").slice(0, 10)} → {(r.periodEnd || "").slice(0, 10)} · Net {money(r.currency, ra.netProfit)} · {r.fields?.length || 0} fields
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(r)} className="text-xs px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E2133] text-[#475569] dark:text-[#94A3B8] hover:border-indigo-400 dark:hover:border-indigo-600 transition">Edit</button>
                    <button onClick={() => deleteReport(r._id)} className="text-xs px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800/50 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Report detail ──────────────────────────────────────────────── */}
        {selected && (
          <div className="space-y-4 print-area" ref={printRef}>

            {/* Back + actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap no-print">
              <button onClick={() => { setSelected(null); setTrends(null); }} className="text-xs text-[#2563EB] font-medium hover:underline">← Back to list</button>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} className="text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2133] text-[#475569] dark:text-[#94A3B8] hover:border-indigo-400 dark:hover:border-indigo-600 transition">Export CSV</button>
                <button onClick={exportPDF} className="text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2133] text-[#475569] dark:text-[#94A3B8] hover:border-indigo-400 dark:hover:border-indigo-600 transition">Export PDF</button>
                <button onClick={() => startEdit(selected)} className="text-xs px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition">Edit</button>
              </div>
            </div>

            {/* Title + verdict */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-bold text-[#0F1117] dark:text-[#DDE1F5]">{selected.title}</h2>
                {verdictBadge(a.verdict)}
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#8B92A9]">{(selected.periodStart || "").slice(0, 10)} → {(selected.periodEnd || "").slice(0, 10)}</p>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: "Revenue",    value: money(selected.currency, a.totalRevenue), color: "#059669" },
                { label: "Cost",       value: money(selected.currency, a.totalCost),    color: "#DC2626" },
                { label: "Net Profit", value: money(selected.currency, a.netProfit),    color: a.netProfit >= 0 ? "#059669" : "#DC2626" },
                { label: "Margin",     value: a.marginPct === null ? "—" : `${a.marginPct}%`, color: "#2563EB" },
                { label: "ROI",        value: a.roiPct    === null ? "—" : `${a.roiPct}%`,    color: "#2563EB" },
              ].map(c => (
                <div key={c.label} className="p-3 rounded-xl bg-white dark:bg-[#11131C] border border-[#E2E8F0] dark:border-[#1E2133]">
                  <div className="text-[10px] uppercase tracking-wide text-[#64748B] dark:text-[#8B92A9]">{c.label}</div>
                  <div className="text-sm font-bold mt-0.5" style={{ color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Fields breakdown */}
            <div className="bg-white dark:bg-[#11131C] rounded-xl border border-[#E2E8F0] dark:border-[#1E2133] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8F9FC] dark:bg-[#0D0F14] border-b border-[#E2E8F0] dark:border-[#1E2133] text-[11px] font-bold uppercase tracking-wide text-[#64748B] dark:text-[#8B92A9]">Fields</div>
              <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E2133]">
                {(a.breakdown || []).map((b, i) => {
                  const tm     = typeMeta(b.type);
                  const change = trends?.fieldChanges?.find(fc => fc.name === b.name);
                  return (
                    <div key={`${b.name}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#0F1117] dark:text-[#DDE1F5] truncate">{b.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tm.cls}`}>{tm.label}</span>
                        </div>
                        <div className="h-1.5 mt-1 rounded-full bg-[#EEF2F7] dark:bg-[#1E2133] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.sharePct)}%`, background: tm.color }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-[#0F1117] dark:text-[#DDE1F5]">{money(selected.currency, b.value)}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#8B92A9]">
                          {b.sharePct}%
                          {change && change.changePct !== null && (
                            <span className={change.changePct >= 0 ? " text-emerald-600 dark:text-emerald-400" : " text-rose-500 dark:text-rose-400"}> · {pctTxt(change.changePct)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend chart */}
            {trends?.series?.length > 1 && (
              <div className="bg-white dark:bg-[#11131C] rounded-xl border border-[#E2E8F0] dark:border-[#1E2133] p-4">
                <div className="text-xs font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Total over time</div>
                <div className="flex items-end gap-2 h-32">
                  {trends.series.map(s => (
                    <div key={s.id} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full rounded-t ${s.id === selected._id ? "bg-[#2563EB]" : "bg-[#93C5FD] dark:bg-[#1D4ED8]"}`}
                        style={{ height: `${maxSeriesTotal > 0 ? Math.max(4, (Math.abs(s.total) / maxSeriesTotal) * 100) : 4}%` }}
                        title={`${s.title}: ${money(selected.currency, s.total)}`}
                      />
                      <div className="text-[9px] text-[#64748B] dark:text-[#8B92A9] truncate w-full text-center">{(s.periodEnd || "").slice(0, 7)}</div>
                    </div>
                  ))}
                </div>
                {trends.totalChangePct !== null && (
                  <div className="text-xs text-[#64748B] dark:text-[#8B92A9] mt-2">
                    vs previous: <span className={trends.totalChangePct >= 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-500 dark:text-rose-400 font-bold"}>{pctTxt(trends.totalChangePct)}</span>
                  </div>
                )}
              </div>
            )}

            {/* AI Insights */}
            <div className="bg-white dark:bg-[#11131C] rounded-xl border border-[#E2E8F0] dark:border-[#1E2133] p-4">
              <div className="flex items-center justify-between mb-2 no-print">
                <div className="text-xs font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Insights</div>
                <button onClick={runAI} disabled={aiLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] font-bold disabled:opacity-50 transition">
                  {aiLoading ? "Generating…" : (selected.ai?.summary ? "Re-generate AI Report" : "Generate AI Report")}
                </button>
              </div>
              {aiError && <p className="text-xs text-amber-600 dark:text-amber-400">{aiError}</p>}
              {!aiError && selected.ai?.verdict && (
                <p className="text-sm font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">{selected.ai.verdict}</p>
              )}
              {!aiError && selected.ai?.summary && (
                <>
                  <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{selected.ai.summary}</p>
                  {selected.ai.suggestions?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {selected.ai.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-[#334155] dark:text-[#CBD5E1] flex gap-2">
                          <span className="text-[#2563EB] font-bold">→</span><span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.ai.generatedAt && (
                    <p className="text-[10px] text-[#94A3B8] dark:text-[#565C75] mt-2">Generated {new Date(selected.ai.generatedAt).toLocaleString()}</p>
                  )}
                </>
              )}
              {!aiError && !selected.ai?.summary && !aiLoading && (
                <p className="text-xs text-[#64748B] dark:text-[#8B92A9]">No analysis yet. Click Generate for an AI verdict and improvement suggestions.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Create / edit modal ────────────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
            <div className="bg-white dark:bg-[#1A1D27] border border-[#E2E8F0] dark:border-[#262A38] rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{editingId ? "Edit report" : "New report"}</h2>
                <button onClick={() => setShowForm(false)} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white text-lg leading-none transition">×</button>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[#64748B] dark:text-[#8B92A9] uppercase tracking-wide">Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q2 financials" className={INP} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[#64748B] dark:text-[#8B92A9] uppercase tracking-wide">From</label>
                    <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={INP} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[#64748B] dark:text-[#8B92A9] uppercase tracking-wide">To</label>
                    <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={INP} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[#64748B] dark:text-[#8B92A9] uppercase tracking-wide">Currency</label>
                    <input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="₹" className={INP} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#64748B] dark:text-[#8B92A9] uppercase tracking-wide">Fields</label>
                  <p className="text-[10px] text-[#94A3B8] dark:text-[#565C75] mb-1">Tag each as Revenue / Cost / Profit so margin &amp; ROI compute automatically.</p>
                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <input value={f.name}  onChange={e => setField(i, "name",  e.target.value)} placeholder="Field name" className={INP} />
                        <select value={f.type} onChange={e => setField(i, "type",  e.target.value)} className={`w-24 ${INP}`}>
                          {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                        <input value={f.value} onChange={e => setField(i, "value", e.target.value)} placeholder="Value" inputMode="decimal" className={`w-24 ${INP}`} />
                        <button onClick={() => removeField(i)} disabled={fields.length === 1} className="px-2 py-2 text-[#94A3B8] dark:text-[#565C75] disabled:opacity-30 hover:text-rose-500 transition">×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addField} className="mt-2 text-xs text-[#2563EB] font-medium hover:underline">+ Add field</button>
                </div>
                {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] text-xs text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
                  <button onClick={saveReport} disabled={saving} className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold disabled:opacity-50 transition">{saving ? "Saving…" : (editingId ? "Save changes" : "Create report")}</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
