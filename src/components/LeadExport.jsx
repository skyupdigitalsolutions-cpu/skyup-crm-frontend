// src/components/LeadExport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lead export with super-admin approval.
//   • AdminExportButton   — admin: request approval → export once.
//   • ExportRequestsModal — super admin: approve / reject requests.
//   • usePendingExportCount — super admin: badge count.
// Backend: /api/lead/export-requests*, POST /api/lead/admin/export
// (controllers/exportRequestController.js). The server enforces everything;
// these components only reflect its state.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { Download, Clock, Lock, X, Check, AlertTriangle, RefreshCw } from "lucide-react";
import api from "../data/axiosConfig";

const errMsg = (e, fb) => e?.response?.data?.message || fb;
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "");

// Read a JSON error message out of a blob response (exports use responseType "blob").
async function blobError(e, fallback) {
  try {
    const data = e?.response?.data;
    if (data instanceof Blob) return JSON.parse(await data.text()).message || fallback;
  } catch { /* not JSON */ }
  return errMsg(e, fallback);
}

const btnBase = "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[14px] font-semibold transition disabled:cursor-not-allowed";

// ── Admin: request → export once ─────────────────────────────────────────────
export function AdminExportButton() {
  const [state, setState] = useState(null);   // { request } from /mine
  const [showAsk, setShowAsk] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    api.get("/lead/export-requests/mine")
      .then((r) => setState(r.data))
      .catch(() => setState({ request: null }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const status = state?.request?.status || "none";
  // While waiting, check again every 30s and whenever the tab regains focus.
  useEffect(() => {
    if (status !== "pending") return undefined;
    const t = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => { clearInterval(t); window.removeEventListener("focus", load); };
  }, [status, load]);
  // The bell's "decided" event refreshes immediately.
  useEffect(() => {
    window.addEventListener("export-request-decided", load);
    return () => window.removeEventListener("export-request-decided", load);
  }, [load]);

  const ask = async () => {
    setBusy(true); setNote("");
    try {
      await api.post("/lead/export-requests", { reason: reason.trim() });
      setShowAsk(false); setReason(""); load();
    } catch (e) {
      setNote(errMsg(e, "Couldn't send the request.")); load();
    } finally { setBusy(false); }
  };

  const doExport = async () => {
    setBusy(true); setNote("");
    try {
      const res = await api.post("/lead/admin/export", {}, { responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(res.headers?.["content-disposition"] || "")?.[1] || "leads.csv";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(res.data);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setNote(await blobError(e, "Export failed."));
    } finally { setBusy(false); load(); }
  };

  if (!state) return null;

  if (status === "approved") {
    return (
      <span className="flex flex-col items-start">
        <button onClick={doExport} disabled={busy}
          title={`One export, valid until ${fmtTime(state.request.expiresAt)} today`}
          className={`${btnBase} border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 disabled:opacity-60`}>
          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export CSV (approved)
        </button>
        {note && <span className="text-[12px] text-red-600 mt-1">{note}</span>}
      </span>
    );
  }

  if (status === "pending") {
    return (
      <button disabled title="A super admin needs to approve your request"
        className={`${btnBase} border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>
        <Clock className="w-3.5 h-3.5" /> Export: awaiting approval
      </button>
    );
  }

  // none / rejected / expired / used → ask for approval
  return (
    <>
      <button onClick={() => { setShowAsk(true); setNote(""); }}
        className={`${btnBase} border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]`}>
        <Lock className="w-3.5 h-3.5" /> Export CSV
      </button>
      {showAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Request export approval</h2>
              <button onClick={() => setShowAsk(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] mb-3">
              Exporting leads needs a super admin's approval. Once approved, you can export <b>once</b>, until midnight today.
            </p>
            {status === "rejected" && (
              <p className="text-[12px] text-red-600 mb-3">
                Your last request was rejected{state.request.decidedByName ? ` by ${state.request.decidedByName}` : ""}
                {state.request.rejectReason ? `: ${state.request.rejectReason}` : "."}
              </p>
            )}
            {status === "expired" && (
              <p className="text-[12px] text-amber-700 mb-3">Your last approval expired unused at midnight.</p>
            )}
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3}
              placeholder="e.g. Monthly review with the sales team"
              className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#7C3AED]" />
            {note && <p className="text-[12px] text-red-600 mt-2">{note}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAsk(false)} className="px-4 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Cancel</button>
              <button onClick={ask} disabled={busy} className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-60">
                {busy ? "Sending…" : "Request approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Super admin: pending count for the badge ────────────────────────────────
export function usePendingExportCount(enabled = true) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    api.get("/lead/export-requests").then((r) => setCount((r.data?.pending || []).length)).catch(() => {});
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    window.addEventListener("export-request-new", refresh);
    return () => window.removeEventListener("export-request-new", refresh);
  }, [refresh]);
  return { count, refresh };
}

const STATUS_STYLE = {
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  used:     "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  expired:  "bg-gray-100 text-gray-600 dark:bg-[#262A38] dark:text-[#9DA3BB]",
};

// ── Super admin: approve / reject ───────────────────────────────────────────
export function ExportRequestsModal({ onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // { id, reason }

  const load = useCallback(() => {
    setErr("");
    api.get("/lead/export-requests")
      .then((r) => setData(r.data))
      .catch((e) => setErr(errMsg(e, "Couldn't load export requests.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id, action, body) => {
    setBusyId(id); setErr("");
    try {
      await api.post(`/lead/export-requests/${id}/${action}`, body || {});
      setRejecting(null); load(); onChanged?.();
    } catch (e) { setErr(errMsg(e, "Couldn't update the request.")); load(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Export requests</h2>
            <p className="text-[13px] text-[#8B92A9] mt-0.5">An approval lets the admin export all their leads once, until midnight today.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {err && <p className="flex items-center gap-1.5 text-[13px] text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
          {!data ? (
            <p className="text-[14px] text-[#8B92A9]">Loading…</p>
          ) : (
            <>
              <section>
                <p className="text-[13px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Waiting for you ({data.pending.length})</p>
                {data.pending.length === 0 ? (
                  <p className="text-[14px] text-[#8B92A9]">No pending requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.pending.map((r) => (
                      <li key={r._id} className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{r.adminName || "Admin"}</p>
                            <p className="text-[12px] text-[#8B92A9]">Requested {fmtDateTime(r.createdAt)}</p>
                            {r.reason && <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] mt-1">“{r.reason}”</p>}
                          </div>
                          {rejecting?.id !== r._id && (
                            <div className="flex gap-2">
                              <button onClick={() => setRejecting({ id: r._id, reason: "" })} disabled={busyId === r._id}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[13px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30">Reject</button>
                              <button onClick={() => act(r._id, "approve")} disabled={busyId === r._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 disabled:opacity-60">
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                            </div>
                          )}
                        </div>
                        {rejecting?.id === r._id && (
                          <div className="mt-2 flex flex-col sm:flex-row gap-2">
                            <input value={rejecting.reason} onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
                              placeholder="Reason (optional)" maxLength={300}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-red-400" />
                            <button onClick={() => setRejecting(null)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Cancel</button>
                            <button onClick={() => act(r._id, "reject", { reason: rejecting.reason })} disabled={busyId === r._id}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60">Reject request</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="text-[13px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Last 30 days</p>
                {data.recent.length === 0 ? (
                  <p className="text-[14px] text-[#8B92A9]">No history yet.</p>
                ) : (
                  <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] uppercase tracking-wider text-[#8B92A9]">
                        <tr><th className="text-left px-3 py-2">Admin</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Decided</th><th className="text-right px-3 py-2">Leads</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                        {data.recent.map((r) => (
                          <tr key={r._id}>
                            <td className="px-3 py-2 text-[#0F1117] dark:text-[#F0F2FA]">{r.adminName}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLE[r.status] || ""}`}>
                                {r.status === "used" ? "exported" : r.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[#8B92A9]">{fmtDateTime(r.decidedAt)}{r.decidedByName ? ` · ${r.decidedByName}` : ""}</td>
                            <td className="px-3 py-2 text-right text-[#4B5168] dark:text-[#9DA3BB]">{r.rowCount ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
