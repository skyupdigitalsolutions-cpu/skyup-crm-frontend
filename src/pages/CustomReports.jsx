// src/pages/CustomReports.jsx
// Super-admin custom financial reports: pick a company, add free-form fields
// (name + value), see generic analytics (totals + share%), period-over-period
// trends, and on-demand AI suggestions. Visual language mirrors the existing
// dashboard (slate + blue) for consistency with the rest of the CRM.
import { useEffect, useState, useCallback } from "react";
import api from "../data/axiosConfig";

const money = (cur, n) =>
  `${cur || "₹"}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n}%`);
const today = () => new Date().toISOString().slice(0, 10);

const emptyField = () => ({ name: "", value: "", note: "" });

export default function CustomReports() {
  const [companies, setCompanies]   = useState([]);
  const [companyId, setCompanyId]   = useState("");
  const [reports, setReports]       = useState([]);
  const [selected, setSelected]     = useState(null);   // full report being viewed
  const [trends, setTrends]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  // Create/edit form state
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [title, setTitle]           = useState("");
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd]   = useState(today());
  const [currency, setCurrency]     = useState("₹");
  const [fields, setFields]         = useState([emptyField()]);
  const [saving, setSaving]         = useState(false);

  // AI state
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState("");

  // ── Load companies once ─────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/superadmin/companies")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCompanies(list);
        if (list.length && !companyId) setCompanyId(list[0]._id);
      })
      .catch(() => setError("Could not load companies."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load reports when company changes ───────────────────────────────────────
  const loadReports = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    api.get(`/superadmin/custom-reports?company=${companyId}`)
      .then((res) => {
        setReports(Array.isArray(res.data) ? res.data : []);
        setSelected(null);
        setTrends(null);
      })
      .catch(() => setError("Could not load reports."))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── Open a report (with trends) ─────────────────────────────────────────────
  const openReport = async (id) => {
    setError("");
    try {
      const [r, t] = await Promise.all([
        api.get(`/superadmin/custom-reports/${id}`),
        api.get(`/superadmin/custom-reports/${id}/trends`),
      ]);
      setSelected(r.data);
      setTrends(t.data);
    } catch {
      setError("Could not open the report.");
    }
  };

  // ── Form helpers ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingId(null); setTitle(""); setPeriodStart(today()); setPeriodEnd(today());
    setCurrency("₹"); setFields([emptyField()]);
  };
  const startCreate = () => { resetForm(); setShowForm(true); };
  const startEdit = (r) => {
    setEditingId(r._id);
    setTitle(r.title || "");
    setPeriodStart((r.periodStart || "").slice(0, 10) || today());
    setPeriodEnd((r.periodEnd || "").slice(0, 10) || today());
    setCurrency(r.currency || "₹");
    setFields((r.fields || []).map((f) => ({ name: f.name, value: String(f.value), note: f.note || "" })));
    if (!r.fields?.length) setFields([emptyField()]);
    setShowForm(true);
  };
  const setField = (i, key, val) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));
  const addField = () => setFields((prev) => [...prev, emptyField()]);
  const removeField = (i) => setFields((prev) => prev.filter((_, idx) => idx !== i));

  const saveReport = async () => {
    setError("");
    const cleanFields = fields
      .map((f) => ({ name: f.name.trim(), value: Number(f.value) || 0, note: (f.note || "").trim() }))
      .filter((f) => f.name);
    if (!title.trim())          return setError("Enter a report title.");
    if (!cleanFields.length)    return setError("Add at least one field with a name.");
    if (new Date(periodStart) > new Date(periodEnd))
      return setError("Start date must be on or before end date.");

    setSaving(true);
    try {
      const payload = { company: companyId, title: title.trim(), periodStart, periodEnd, currency, fields: cleanFields };
      if (editingId) await api.put(`/superadmin/custom-reports/${editingId}`, payload);
      else           await api.post("/superadmin/custom-reports", payload);
      setShowForm(false);
      resetForm();
      loadReports();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save the report.");
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (id) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await api.delete(`/superadmin/custom-reports/${id}`);
      if (selected?._id === id) { setSelected(null); setTrends(null); }
      loadReports();
    } catch {
      setError("Could not delete the report.");
    }
  };

  // ── AI analysis ─────────────────────────────────────────────────────────────
  const runAI = async () => {
    if (!selected) return;
    setAiLoading(true); setAiError("");
    try {
      const res = await api.post(`/superadmin/custom-reports/${selected._id}/analyze`);
      setSelected((prev) => ({ ...prev, ai: { ...res.data } }));
    } catch (e) {
      setAiError(e?.response?.data?.message || "AI analysis is unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  };

  const maxSeriesTotal = trends?.series?.reduce((m, s) => Math.max(m, Math.abs(s.total || 0)), 0) || 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[#0F1117] dark:text-[#F0F2FA]">Custom Reports</h1>
          <p className="text-xs text-[#64748B]">Per-company financial fields with analytics and AI suggestions.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]"
          >
            {companies.map((c) => <option key={c._id} value={c._id}>{c.name || c.companyName || c._id}</option>)}
          </select>
          <button
            onClick={startCreate}
            disabled={!companyId}
            className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold disabled:opacity-50"
          >
            + New report
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* ── Report list ── */}
      {!selected && (
        <div className="space-y-2">
          {loading && <p className="text-xs text-[#64748B]">Loading…</p>}
          {!loading && reports.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#1E2130] p-8 text-center text-sm text-[#64748B]">
              No reports yet for this company. Create one to get started.
            </div>
          )}
          {reports.map((r) => (
            <div key={r._id} className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] p-4 flex items-center justify-between gap-3">
              <button onClick={() => openReport(r._id)} className="text-left flex-1">
                <div className="font-bold text-sm text-[#0F1117] dark:text-[#F0F2FA]">{r.title}</div>
                <div className="text-xs text-[#64748B]">
                  {(r.periodStart || "").slice(0, 10)} → {(r.periodEnd || "").slice(0, 10)} · {r.fields?.length || 0} fields · Total {money(r.currency, r.analytics?.total)}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(r)} className="text-xs px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] text-[#475569] dark:text-[#94A3B8]">Edit</button>
                <button onClick={() => deleteReport(r._id)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Report detail ── */}
      {selected && (
        <div className="space-y-4">
          <button onClick={() => { setSelected(null); setTrends(null); }} className="text-xs text-[#2563EB] font-medium">← Back to list</button>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] overflow-hidden">
            <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-[#0D0F14] border-b border-[#E2E8F0] dark:border-[#1E2130] flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-[#0F1117] dark:text-[#F0F2FA]">{selected.title}</div>
                <div className="text-xs text-[#64748B]">{(selected.periodStart || "").slice(0, 10)} → {(selected.periodEnd || "").slice(0, 10)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-[#64748B]">Total</div>
                <div className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{money(selected.currency, selected.analytics?.total)}</div>
              </div>
            </div>

            {/* Fields + share% + trend change */}
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E2130]">
              {(selected.analytics?.breakdown || []).map((b, i) => {
                const change = trends?.fieldChanges?.find((fc) => fc.name === b.name);
                return (
                  <div key={`${b.name}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#0F1117] dark:text-[#F0F2FA] truncate">{b.name}</div>
                      <div className="h-1.5 mt-1 rounded-full bg-[#EEF2F7] dark:bg-[#1E2130] overflow-hidden">
                        <div className="h-full bg-[#2563EB]" style={{ width: `${Math.min(100, b.sharePct)}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{money(selected.currency, b.value)}</div>
                      <div className="text-[11px] text-[#64748B]">
                        {b.sharePct}% of total
                        {change && change.changePct !== null && (
                          <span className={change.changePct >= 0 ? " text-emerald-600" : " text-red-500"}> · {pct(change.changePct)} vs prev</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend over time (total) */}
          {trends?.series?.length > 1 && (
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] p-4">
              <div className="text-xs font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3">Total over time</div>
              <div className="flex items-end gap-2 h-32">
                {trends.series.map((s) => (
                  <div key={s.id} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div
                      className={`w-full rounded-t ${s.id === selected._id ? "bg-[#2563EB]" : "bg-[#93C5FD]"}`}
                      style={{ height: `${maxSeriesTotal > 0 ? Math.max(4, (Math.abs(s.total) / maxSeriesTotal) * 100) : 4}%` }}
                      title={`${s.title}: ${money(selected.currency, s.total)}`}
                    />
                    <div className="text-[9px] text-[#64748B] truncate w-full text-center">{(s.periodEnd || "").slice(0, 7)}</div>
                  </div>
                ))}
              </div>
              {trends.totalChangePct !== null && (
                <div className="text-xs text-[#64748B] mt-2">
                  Change vs previous report:{" "}
                  <span className={trends.totalChangePct >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{pct(trends.totalChangePct)}</span>
                </div>
              )}
            </div>
          )}

          {/* AI suggestions */}
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E2130] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-[#0F1117] dark:text-[#F0F2FA]">AI suggestions & improvement</div>
              <button onClick={runAI} disabled={aiLoading} className="text-xs px-3 py-1.5 rounded-lg bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] font-bold disabled:opacity-50">
                {aiLoading ? "Analyzing…" : (selected.ai?.summary ? "Re-analyze" : "Generate")}
              </button>
            </div>
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
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
              </>
            )}
            {!aiError && !selected.ai?.summary && !aiLoading && (
              <p className="text-xs text-[#64748B]">No analysis yet. Click Generate to get an AI assessment and improvement suggestions for these figures.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Create/edit modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E2E8F0] dark:border-[#262A38] rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{editingId ? "Edit report" : "New report"}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#8B92A9] text-lg leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q2 financials"
                  className="px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">From</label>
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                    className="px-2 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">To</label>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                    className="px-2 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Currency</label>
                  <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="₹"
                    className="px-2 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Fields</label>
                <div className="space-y-2 mt-1">
                  {fields.map((f, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input value={f.name} onChange={(e) => setField(i, "name", e.target.value)} placeholder="Field name (e.g. Revenue)"
                        className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
                      <input value={f.value} onChange={(e) => setField(i, "value", e.target.value)} placeholder="Value" inputMode="decimal"
                        className="w-28 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
                      <button onClick={() => removeField(i)} disabled={fields.length === 1}
                        className="px-2 py-2 text-[#94A3B8] disabled:opacity-30">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={addField} className="mt-2 text-xs text-[#2563EB] font-medium">+ Add field</button>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#262A38] text-xs text-[#475569] dark:text-[#94A3B8]">Cancel</button>
                <button onClick={saveReport} disabled={saving} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold disabled:opacity-50">
                  {saving ? "Saving…" : (editingId ? "Save changes" : "Create report")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
