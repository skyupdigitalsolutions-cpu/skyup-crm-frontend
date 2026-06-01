import { useState } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";

/**
 * ColdReassignModal
 * Triggered when an employee marks a lead as Cold.
 * Same reassignment flow as Not Interested:
 *   - Requires a remark/reason
 *   - Auto-reassigns to next available agent (round-robin, any admin)
 *   - Schedules 3 follow-up calls (+3d, +7d, +30d)
 *   - 2nd cold: status reset to New, no further reassignment
 *
 * Props:
 *   lead      – full lead object (must have ._id or .id, .name, .mobile/.phone, .callHistory)
 *   onClose   – fn() close modal
 *   onSuccess – fn(updatedLead) called after successful API response
 */
export default function ColdReassignModal({ lead, onClose, onSuccess }) {
  const [remark,  setRemark]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  if (!lead) return null;

  const leadId  = lead._id || lead.id;
  const history = lead.callHistory || [];

  const now = Date.now();
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const handleConfirm = async () => {
    if (!remark.trim()) {
      setError("Please provide a reason / remark before confirming.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.patch(`/lead/${leadId}/cold-reassign`, {
        remark: remark.trim(),
      });
      setResult(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update lead. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  const successContent = result && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#13161E] rounded-3xl shadow-2xl border border-[#E4E7EF] dark:border-[#1E2130] overflow-hidden">
        <div className="px-6 py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            {result.isSecondCold ? "Follow-up Calls Scheduled" : "Cold Lead Reassigned Successfully"}
          </h2>

          {result.reassignedTo && (
            <p className="text-[13px] text-[#8B92A9]">
              Reassigned to{" "}
              <strong className="text-[#0F1117] dark:text-[#F0F2FA]">
                {result.reassignedTo.name}
              </strong>
            </p>
          )}

          {result.isSecondCold && (
            <p className="text-[12px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-4 py-2">
              Lead status reset to <strong>New</strong> — will re-enter the pipeline after follow-up calls.
            </p>
          )}

          <div className="text-left space-y-2 bg-[#F8F9FC] dark:bg-[#0D0F14] rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-2">
              Scheduled Calls
            </p>
            {(result.scheduledCalls || []).map((sc, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    sc.type === "follow-up" ? "bg-blue-500" : "bg-purple-500"
                  }`}
                />
                <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] capitalize">
                  {sc.type}
                </span>
                <span className="ml-auto text-[11px] text-[#8B92A9]">
                  {fmt(sc.scheduledAt)}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { onSuccess(result.lead || lead); onClose(); }}
            className="w-full py-3 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (result) return createPortal(successContent, document.body);

  // ── Main modal ────────────────────────────────────────────────────────────────
  const mainContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#13161E] rounded-3xl shadow-2xl border border-[#E4E7EF] dark:border-[#1E2130] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#1E2130] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              {/* Snowflake / cold icon */}
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
              </svg>
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                Mark as Cold &amp; Reassign
              </h2>
              <p className="text-[12px] text-[#8B92A9]">
                {lead.name} · {lead.mobile || lead.phone || ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Info banner */}
          <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[12px] text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold">What happens next:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>Lead temperature set to <strong>Cold</strong></li>
              <li>Lead will be <strong>auto-reassigned</strong> to another available agent (same or different admin)</li>
              <li>Follow-up call in <strong>3 days</strong> ({fmt(now + 3 * 86400000)})</li>
              <li>Verification call in <strong>7 days</strong> ({fmt(now + 7 * 86400000)})</li>
              <li>Verification call in <strong>30 days</strong> ({fmt(now + 30 * 86400000)})</li>
              <li>Full call history passed to new agent</li>
            </ul>
          </div>

          {/* Previous call history */}
          {history.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-2">
                Previous Call History ({history.length})
              </p>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2130]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                        {h.userName || "Unknown"}
                      </span>
                      <span className="text-[10px] text-[#8B92A9]">{fmt(h.calledAt)}</span>
                    </div>
                    <p className="text-[11px] text-[#565C75] dark:text-[#8B92A9]">{h.remark}</p>
                    {h.outcome && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {h.outcome}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remark input */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">
              Reason / Remark <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => { setRemark(e.target.value); if (error) setError(""); }}
              placeholder="Explain why this lead is cold and should be reassigned…"
              className={`w-full px-4 py-3 rounded-xl border text-[13px] text-[#0F1117] dark:text-[#F0F2FA] bg-[#F8F9FC] dark:bg-[#0D0F14] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] resize-none focus:outline-none transition ${
                error
                  ? "border-red-400 dark:border-red-600 focus:border-red-400"
                  : "border-[#E4E7EF] dark:border-[#1E2130] focus:border-blue-400 dark:focus:border-blue-500"
              }`}
            />
            {error && (
              <p className="text-[12px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#1E2130] flex gap-3 justify-end bg-[#F8F9FC] dark:bg-[#0D0F14]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#565C75] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !remark.trim()}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {loading ? "Processing…" : "Confirm & Reassign"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(mainContent, document.body);
}
