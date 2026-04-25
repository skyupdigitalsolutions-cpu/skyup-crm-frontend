import { useState } from "react";
import { updateAttendance, removeAttendance } from "../services/attendanceService";

const CRM_STATUS_STYLE = {
  present  : { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", label: "Present"  },
  absent   : { bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         label: "Absent"   },
  late     : { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     label: "Late"     },
  half_day : { bg: "bg-blue-50 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       label: "Half-Day" },
  leave    : { bg: "bg-purple-50 dark:bg-purple-950/40",   text: "text-purple-600 dark:text-purple-400",   label: "Leave"    },
};

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function toInputTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;
}
function combineDateTime(dateStr, timeStr) {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

const STATUS_ENUM = ["present","absent","late","half_day","leave"];

export default function AttendanceTable({ records, loading, onRefresh }) {
  const [editRec,     setEditRec]     = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [saving,      setSaving]      = useState(false);
  const [delId,       setDelId]       = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState("");

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEdit = (rec) => {
    setEditRec(rec);
    setEditForm({
      loginTime : toInputTime(rec.loginTime),
      logoutTime: toInputTime(rec.logoutTime),
      crmStatus : rec.derivedCrmStatus || rec.crmStatus || "",
      remarks   : rec.remarks || "",
    });
    setError("");
  };

  const handleSave = async () => {
    if (!editRec?._id) return;
    setSaving(true);
    try {
      await updateAttendance(editRec._id, {
        loginTime : combineDateTime(editRec.date, editForm.loginTime),
        logoutTime: combineDateTime(editRec.date, editForm.logoutTime),
        crmStatus : editForm.crmStatus || null,
        remarks   : editForm.remarks,
      });
      setEditRec(null);
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await removeAttendance(delId);
      setDelId(null);
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to delete.");
    }
    setDeleting(false);
  };

  const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap";
  const tdCls = "px-4 py-3 text-[12px] text-gray-700 dark:text-gray-300 whitespace-nowrap";

  return (
    <>
      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-[#E4E7EF] dark:border-[#262A38]">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/5">
            <tr>
              <th className={thCls}>Employee</th>
              <th className={thCls}>Date</th>
              <th className={thCls}>Check-In</th>
              <th className={thCls}>Check-Out</th>
              <th className={thCls}>Working Hours</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Remarks</th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-100 dark:bg-white/5 animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-gray-400">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              records.map((rec, i) => {
                const st = CRM_STATUS_STYLE[rec.derivedCrmStatus] || CRM_STATUS_STYLE["absent"];
                return (
                  <tr key={rec._id || i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                    {/* Employee */}
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {(rec.user?.name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <span className="font-medium">{rec.user?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td className={tdCls}>{rec.date}</td>
                    <td className={tdCls}>{fmtTime(rec.loginTime)}</td>
                    <td className={tdCls}>{fmtTime(rec.logoutTime)}</td>
                    <td className={tdCls}>
                      <span className="font-medium">{rec.workingHours || "0h 00m"}</span>
                    </td>
                    {/* CRM Status badge */}
                    <td className={tdCls}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span className="text-gray-400 dark:text-gray-500 italic">
                        {rec.remarks || "—"}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className={tdCls}>
                      <div className="flex items-center gap-1.5">
                        {rec._id && (
                          <>
                            <button
                              onClick={() => openEdit(rec)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                              title="Edit"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDelId(rec._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                              title="Delete"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1D27] border border-gray-100 dark:border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-1">Edit Attendance</h3>
            <p className="text-[12px] text-gray-400 mb-5">
              {editRec.user?.name} — {editRec.date}
            </p>

            {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Check-In</label>
                  <input type="time" value={editForm.loginTime} onChange={e => setEditForm(f => ({ ...f, loginTime: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Check-Out</label>
                  <input type="time" value={editForm.logoutTime} onChange={e => setEditForm(f => ({ ...f, logoutTime: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Status Override</label>
                <select value={editForm.crmStatus} onChange={e => setEditForm(f => ({ ...f, crmStatus: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300">
                  <option value="">Auto-detect</option>
                  {STATUS_ENUM.map(s => (
                    <option key={s} value={s}>{CRM_STATUS_STYLE[s]?.label || s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Remarks</label>
                <input type="text" value={editForm.remarks} placeholder="Optional note…"
                  onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditRec(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition disabled:opacity-60">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1D27] border border-gray-100 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-500">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-center text-gray-800 dark:text-gray-100 mb-1">Delete Record?</h3>
            <p className="text-[12px] text-center text-gray-400 mb-6">This action cannot be undone.</p>
            {error && <p className="text-[12px] text-red-500 mb-3 text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}