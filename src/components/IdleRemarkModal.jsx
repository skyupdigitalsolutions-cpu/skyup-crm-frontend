import { useState, useEffect } from "react";
import { Moon, X } from "lucide-react";
import { formatTime } from "../utils/dateUtils";

// ── Pre-filled quick-select remark chips ───────────────────────────────────────
const QUICK_REMARKS = [
  "Lunch break",
  "On a call",
  "Team meeting",
  "Technical issue",
  "Personal break",
  "Power cut",
  "Client meeting",
];

// ── Idle remark popup ─────────────────────────────────────────────────────────
// Shown:
//   1. Every 5 minutes while the employee stays idle (mode="recurring") —
//      dismissing (save or skip) just closes the popup, they're still idle.
//   2. The instant they move/interact again while idle (mode="resume") —
//      dismissing (save or skip) resumes the session right away.
// Skipping never blocks anything — an empty remark just stays "pending" and
// carries forward, listed below the input, until the employee fills it in on
// a later prompt.
export default function IdleRemarkModal({
  open,
  mode,               // "recurring" | "resume"
  idleSince,          // Date the CURRENT idle period started
  pendingBreaks,      // [{ index, startTime, endTime }] — earlier skipped periods today
  onSave,             // (remark) => void — save remark for the current idle period
  onSkip,             // () => void — explicit skip, stays pending
  onClose,            // () => void — X button: close without any action (same as skip for UX)
  onSavePending,      // (index, remark) => void — fill in an earlier pending one
}) {
  const [text, setText]              = useState("");
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [pendingText, setPendingText] = useState("");

  useEffect(() => {
    if (open) { setText(""); setExpandedIdx(null); setPendingText(""); }
  }, [open]);

  if (!open) return null;

  // X closes without saving — behaves like skip
  const handleClose = () => {
    if (onClose) onClose();
    else if (onSkip) onSkip();
  };

  const handleQuickSelect = (chip) => {
    setText(chip);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-5 shadow-xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-red-500" />
            <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {mode === "resume" ? "Welcome back" : "Still idle"}
            </h3>
          </div>
          {/* X button — closes modal, treated as skip */}
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[12px] text-[#8B92A9] mb-3">
          {mode === "resume"
            ? "You were idle — what were you doing?"
            : `Idle since ${idleSince ? formatTime(idleSince) : "—"}. What's going on?`}
        </p>

        {/* ── Quick-select chips ── */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_REMARKS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleQuickSelect(chip)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                text === chip
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-[#F8F9FC] dark:bg-[#13161E] text-[#4B5168] dark:text-[#9DA3BB] border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] dark:hover:text-[#2563EB]"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* ── Free-text area ── */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Or type your own reason…"
          rows={2}
          autoFocus
          className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] resize-none mb-3"
        />

        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:text-[#4B5168] transition"
          >
            {mode === "resume" ? "Skip" : "Continue Idle"}
          </button>
          <button
            onClick={() => onSave(text)}
            disabled={!text.trim()}
            className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[12px] font-bold disabled:opacity-40 transition"
          >
            {mode === "resume" ? "Save & Resume" : "Save"}
          </button>
        </div>

        {pendingBreaks?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
              {pendingBreaks.length} earlier idle period{pendingBreaks.length > 1 ? "s" : ""} still need a reason
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {pendingBreaks.map((b) => (
                <div key={b.index}>
                  <button
                    onClick={() => { setExpandedIdx(expandedIdx === b.index ? null : b.index); setPendingText(""); }}
                    className="w-full flex items-center justify-between text-[11px] text-[#8B92A9] hover:text-[#2563EB] transition py-0.5"
                  >
                    <span>{formatTime(b.startTime)}{b.endTime ? ` – ${formatTime(b.endTime)}` : " – ongoing"}</span>
                    <span className="text-[10px] font-semibold">{expandedIdx === b.index ? "Cancel" : "Fill in"}</span>
                  </button>
                  {expandedIdx === b.index && (
                    <div className="flex gap-1.5 mt-1 mb-1">
                      <input
                        type="text"
                        value={pendingText}
                        onChange={(e) => setPendingText(e.target.value)}
                        placeholder="What were you doing then?"
                        autoFocus
                        className="flex-1 px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]"
                      />
                      <button
                        onClick={() => { onSavePending(b.index, pendingText); setExpandedIdx(null); setPendingText(""); }}
                        disabled={!pendingText.trim()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-[10px] font-bold disabled:opacity-40 transition"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
