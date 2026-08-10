// src/pages/UserSheetIntegration.jsx — NEW
// ─────────────────────────────────────────────────────────────────────────────
// Employee panel: Excel / Google Sheet integration.
//
// COMPLETELY SEPARATE from Daily Report / Telegram. Route: /user/sheet-integration
// (guarded by UserRoute + FeatureGate featureKey="googleSheetIntegrationEnabled").
//
// Flow (matches spec §3–§7):
//   Connect Google Sheet  → Sheet Name / Sheet ID / Apps Script URL / Secret Key
//   Test Connection       → fetch headers + preview rows
//   Map Columns           → sheet header → CRM field
//   Sync Now              → pull rows → dedup → create leads assigned to me
//   Edit / Disconnect
//
// All state lives in component memory (no localStorage — per artifact rules and
// the CRM's own axios in-memory cache handles GET dedup).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import api, { clearCache } from "../data/axiosConfig";
import {
  Sheet, Plus, Link2, CheckCircle2, AlertCircle, Loader2, RefreshCw,
  Trash2, Save, Eye, EyeOff, PlugZap, Columns, X,
} from "lucide-react";

const INPUT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white placeholder-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";
const LABEL_CLS =
  "block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide";

function Feedback({ msg }) {
  if (!msg?.text) return null;
  const ok = msg.type === "ok";
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium border ${
        ok
          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
      }`}
    >
      {ok ? <CheckCircle2 className="w-4 h-4 mt-px shrink-0" /> : <AlertCircle className="w-4 h-4 mt-px shrink-0" />}
      <span className="break-words">{msg.text}</span>
    </div>
  );
}

export default function UserSheetIntegration() {
  const [loading, setLoading]   = useState(true);
  const [conn, setConn]         = useState(null);          // existing connection (or null)
  const [perms, setPerms]       = useState({ allowConnect: true, allowEdit: true, allowDisconnect: true, allowManualSync: true });
  const [crmFields, setCrmFields] = useState([]);

  // form state
  const [form, setForm] = useState({ sheetName: "", googleSheetId: "", appsScriptUrl: "", secretKey: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [showForm, setShowForm] = useState(false);         // connect/edit form visible

  // test / mapping state
  const [headers, setHeaders]   = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [mapping, setMapping]   = useState({});            // { header: crmFieldKey }

  // async flags
  const [testing, setTesting]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [savingMap, setSavingMap] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [msg, setMsg] = useState(null);
  const flash = (type, text) => { setMsg({ type, text }); if (type === "ok") setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 6000); };

  // ── Load existing connection ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/sheet-integration/me");
      setCrmFields(data.crmFields || []);
      setPerms(data.permissions || perms);
      if (data.connection) {
        setConn(data.connection);
        setForm({
          sheetName:     data.connection.sheetName || "",
          googleSheetId: data.connection.googleSheetId || "",
          appsScriptUrl: data.connection.appsScriptUrl || "",
          secretKey:     "", // never returned — blank means "keep existing"
        });
        // seed mapping from stored connection
        const seeded = {};
        (data.connection.columnMapping || []).forEach((m) => { seeded[m.sheetColumn] = m.crmField; });
        setMapping(seeded);
      } else {
        setConn(null);
      }
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to load connection.");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Auto-fetch current headers once an existing connection is loaded (uses stored secret)
  useEffect(() => {
    if (conn && headers.length === 0) { runTest(true); }
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [conn]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Test Connection ─────────────────────────────────────────────────────────
  async function runTest(silent = false) {
    if (!form.appsScriptUrl && !conn?.appsScriptUrl) { flash("err", "Enter the Apps Script Web App URL first."); return; }
    setTesting(true);
    if (!silent) setMsg(null);
    try {
      const { data } = await api.post("/sheet-integration/test", {
        sheetName:     form.sheetName || conn?.sheetName || "",
        googleSheetId: form.googleSheetId || conn?.googleSheetId || "",
        appsScriptUrl: form.appsScriptUrl || conn?.appsScriptUrl || "",
        secretKey:     form.secretKey || "", // blank → server reuses stored secret
      });
      setHeaders(data.headers || []);
      setSampleRows(data.sampleRows || []);
      // merge suggested mapping only for columns we don't already map
      setMapping((prev) => {
        const next = { ...prev };
        (data.suggestedMapping || []).forEach((m) => {
          if (!next[m.sheetColumn]) next[m.sheetColumn] = m.crmField;
        });
        return next;
      });
      if (!silent) flash("ok", data.message || "Connection successful.");
    } catch (e) {
      if (!silent) flash("err", e.response?.data?.message || "Test failed.");
    } finally {
      setTesting(false);
    }
  }

  // ── Connect / Save ──────────────────────────────────────────────────────────
  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body = {
        sheetName:     form.sheetName,
        googleSheetId: form.googleSheetId,
        appsScriptUrl: form.appsScriptUrl,
        ...(form.secretKey ? { secretKey: form.secretKey } : {}),
      };
      const url = conn ? "/sheet-integration/connection" : "/sheet-integration/connect";
      const method = conn ? "put" : "post";
      const { data } = await api[method](url, body);
      clearCache("/sheet-integration");
      setConn(data.connection);
      setForm((f) => ({ ...f, secretKey: "" }));
      setShowForm(false);
      flash("ok", data.message || "Saved.");
      // fetch headers so mapping UI is ready
      runTest(true);
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Save column mapping ─────────────────────────────────────────────────────
  async function saveMapping() {
    const columnMapping = Object.entries(mapping)
      .filter(([, v]) => v)
      .map(([sheetColumn, crmField]) => ({ sheetColumn, crmField }));
    if (columnMapping.length === 0) { flash("err", "Map at least one column."); return; }
    setSavingMap(true); setMsg(null);
    try {
      const { data } = await api.put("/sheet-integration/mapping", { columnMapping });
      clearCache("/sheet-integration");
      setConn(data.connection);
      flash("ok", "Column mapping saved.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Could not save mapping.");
    } finally {
      setSavingMap(false);
    }
  }

  // ── Sync Now ──────────────────────────────────────────────────────────────────
  async function syncNow() {
    setSyncing(true); setMsg(null);
    try {
      const { data } = await api.post("/sheet-integration/sync", {});
      clearCache("/sheet-integration");
      flash("ok", data.message || "Sync complete.");
      load();
    } catch (e) {
      flash("err", e.response?.data?.message || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────────
  async function disconnect() {
    if (!window.confirm("Disconnect this Google Sheet? Already-synced leads are kept.")) return;
    setDisconnecting(true); setMsg(null);
    try {
      await api.delete("/sheet-integration/connection");
      clearCache("/sheet-integration");
      setConn(null); setHeaders([]); setSampleRows([]); setMapping({});
      setForm({ sheetName: "", googleSheetId: "", appsScriptUrl: "", secretKey: "" });
      flash("ok", "Disconnected.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Disconnect failed.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
      </div>
    );
  }

  const showConnectForm = !conn || showForm;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
          <Sheet className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-white">Google Sheet Integration</h1>
          <p className="text-[12px] text-[#8B92A9]">Sync leads from your own Google Sheet into the CRM.</p>
        </div>
      </div>

      <Feedback msg={msg} />

      {/* Empty state */}
      {!conn && !showForm && (
        <div className="rounded-2xl border border-dashed border-[#C7D2E5] dark:border-[#2A3350] bg-white dark:bg-[#1A1D27] p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[#2563EB] dark:text-[#4F8EF7] mb-4">
            <Link2 className="w-6 h-6" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-white mb-1">No sheet connected yet</p>
          <p className="text-[12px] text-[#8B92A9] max-w-sm mb-5">
            Connect your Google Sheet through an Apps Script Web App to import leads into your CRM pipeline.
          </p>
          {perms.allowConnect ? (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> Connect Google Sheet
            </button>
          ) : (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 font-medium">
              Connecting sheets is disabled by your admin.
            </p>
          )}
        </div>
      )}

      {/* Connect / Edit form */}
      {showConnectForm && (perms.allowConnect || (conn && perms.allowEdit)) && (
        <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-white flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-[#2563EB]" /> {conn ? "Edit Connection" : "Connect Google Sheet"}
            </h2>
            {conn && (
              <button onClick={() => { setShowForm(false); setForm((f) => ({ ...f, secretKey: "" })); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Sheet Name</label>
              <input className={INPUT_CLS} placeholder="Leads" value={form.sheetName} onChange={(e) => setField("sheetName", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLS}>Google Sheet ID</label>
              <input className={INPUT_CLS} placeholder="1AbC…xyz (from the sheet URL)" value={form.googleSheetId} onChange={(e) => setField("googleSheetId", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Apps Script Web App URL</label>
            <input className={INPUT_CLS} placeholder="https://script.google.com/macros/s/…/exec" value={form.appsScriptUrl} onChange={(e) => setField("appsScriptUrl", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Secret Key {conn && <span className="normal-case text-[#8B92A9]">(leave blank to keep current)</span>}</label>
            <div className="relative">
              <input className={INPUT_CLS + " pr-10"} type={showSecret ? "text" : "password"} placeholder="Shared secret set in your Apps Script"
                value={form.secretKey} onChange={(e) => setField("secretKey", e.target.value)} />
              <button type="button" onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#2563EB]">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={() => runTest(false)} disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] transition disabled:opacity-60">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Test Connection
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {conn ? "Save Changes" : "Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Connected card + mapping + sync */}
      {conn && !showForm && (
        <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-[14px] font-bold text-[#0F1117] dark:text-white truncate">{conn.sheetName || "Connected Sheet"}</p>
              </div>
              <p className="text-[11px] text-[#8B92A9] mt-0.5 break-all">{conn.googleSheetId || "—"}</p>
              {conn.lastSyncAt && (
                <p className="text-[11px] text-[#8B92A9] mt-1">
                  Last sync: {new Date(conn.lastSyncAt).toLocaleString()} · {conn.lastSyncMessage || conn.lastSyncStatus}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {perms.allowManualSync && (
                <button onClick={syncNow} disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync Now
                </button>
              )}
              {perms.allowEdit && (
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] transition">
                  Edit
                </button>
              )}
              {perms.allowDisconnect && (
                <button onClick={disconnect} disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-[12px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-60">
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Column mapping */}
          <div className="pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-white flex items-center gap-2">
                <Columns className="w-4 h-4 text-[#2563EB]" /> Column Mapping
              </h3>
              <button onClick={() => runTest(false)} disabled={testing}
                className="text-[11px] font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1 disabled:opacity-60">
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh columns
              </button>
            </div>

            {headers.length === 0 ? (
              <p className="text-[12px] text-[#8B92A9]">Run “Test Connection” to load your sheet columns.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-3">
                      <span className="flex-1 min-w-0 text-[13px] text-[#0F1117] dark:text-white truncate px-3 py-2 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">{h}</span>
                      <span className="text-[#8B92A9]">→</span>
                      <select value={mapping[h] || ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                        className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]">
                        <option value="">— Ignore —</option>
                        {crmFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3">
                  <button onClick={saveMapping} disabled={savingMap}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                    {savingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Mapping
                  </button>
                </div>
              </>
            )}

            {/* Preview */}
            {sampleRows.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-2">Preview (first {sampleRows.length} rows)</p>
                <div className="overflow-x-auto rounded-xl border border-[#E4E7EF] dark:border-[#262A38]">
                  <table className="min-w-full text-[12px]">
                    <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
                      <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((r, i) => (
                        <tr key={i} className="border-t border-[#E4E7EF] dark:border-[#262A38]">
                          {headers.map((h) => <td key={h} className="px-3 py-2 text-[#0F1117] dark:text-white whitespace-nowrap">{String(r[h] ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
