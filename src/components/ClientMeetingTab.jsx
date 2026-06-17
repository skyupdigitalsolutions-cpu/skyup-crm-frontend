// src/components/ClientMeetingTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shows the client-visit / field-meeting history for a lead.
// Now includes a "Schedule Meeting" form that:
//   1. Logs the meeting remark to the lead
//   2. Sends a WhatsApp confirmation to the client via the
//      MSG91 `client_meeting_reminder` approved template
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Handshake, MapPin, Monitor, Video, Phone, CalendarClock, CalendarDays,
  Paperclip, Mic, Map as MapIcon, NotebookPen, Send, Loader2, CheckCircle2,
  AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
} from "lucide-react";
import api from "../data/axiosConfig";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

const MEETING_TYPES = ["In-Person", "Site Visit", "Demo", "Video Call", "Phone Call"];

const MEETING_TYPE_ICON = {
  "In-Person":  Handshake,
  "Site Visit": MapPin,
  "Demo":       Monitor,
  "Video Call": Video,
  "Phone Call": Phone,
};

const OUTCOME_STYLE = {
  "Not Interested":    "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  "Interested":        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  "Converted":         "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  "Follow-Up Required":"bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  "Pending Decision":  "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  "No Show":           "bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400",
};

// ── Meeting history card ──────────────────────────────────────────────────────
function MeetingCard({ visit }) {
  const Icon   = MEETING_TYPE_ICON[visit.meetingType] || CalendarClock;
  const oStyle = OUTCOME_STYLE[visit.outcome] || "bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400";
  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] p-3 mb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#2563EB]"><Icon className="w-4 h-4" /></span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {visit.meetingType || "Visit"}
              {visit.userName ? <span className="font-normal text-[#8B92A9]"> · {visit.userName}</span> : null}
            </p>
            <p className="text-[10px] text-[#8B92A9]">{fmtDateTime(visit.metAt)}</p>
          </div>
        </div>
        {visit.outcome ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${oStyle}`}>
            {visit.outcome}
          </span>
        ) : null}
      </div>

      {visit.remark ? (
        <p className="mt-2 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{visit.remark}"</p>
      ) : null}

      {visit.location ? (
        <p className="mt-1.5 text-[10px] text-[#8B92A9] flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{visit.location}</span>
        </p>
      ) : null}

      {visit.followUpDate ? (
        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <CalendarDays className="w-3 h-3 shrink-0" /><span>Follow-up: {fmtDateTime(visit.followUpDate)}</span>
        </p>
      ) : null}

      {(visit.documentUrl || visit.recordingUrl) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {visit.documentUrl ? (
            <a href={visit.documentUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition">
              <Paperclip className="w-3 h-3" />{visit.documentName || "View attachment"}
            </a>
          ) : null}
          {visit.recordingUrl ? (
            <a href={visit.recordingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition">
              <Mic className="w-3 h-3" />{visit.recordingName || "Play recording"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClientMeetingTab({ lead, onRemarkAdded }) {
  const visits = [...(lead?.meetingRemarks || [])].sort(
    (a, b) => new Date(b.metAt) - new Date(a.metAt)
  );

  // Schedule form state
  const [showForm, setShowForm]       = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingMode, setMeetingMode] = useState("In-Person");
  const [notes, setNotes]             = useState("");
  const [sendWA, setSendWA]           = useState(true);

  // Status state
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [waStatus, setWaStatus]       = useState(""); // "sent" | "failed" | ""
  const [waError, setWaError]         = useState("");

  const resetForm = () => {
    setMeetingDate(""); setMeetingTime(""); setMeetingMode("In-Person");
    setNotes(""); setSendWA(true); setError(""); setWaStatus(""); setWaError("");
  };

  const handleSubmit = async () => {
    if (!meetingDate) { setError("Please select a meeting date."); return; }
    if (!meetingTime) { setError("Please select a meeting time."); return; }
    if (!notes.trim()) { setError("Please add meeting notes."); return; }

    setSaving(true); setError(""); setWaStatus(""); setWaError("");

    // Combine date + time into ISO
    const meetingISO = new Date(`${meetingDate}T${meetingTime}`).toISOString();

    try {
      // Step 1 — Log meeting remark
      await api.post(`/lead/${lead._id}/meeting-remark`, {
        meetingType:  meetingMode,
        outcome:      "Pending Decision",
        remark:       notes.trim(),
        followUpDate: meetingISO,
      });

      // Step 2 — Send WhatsApp (if opted in)
      if (sendWA) {
        try {
          await api.post(`/lead/${lead._id}/meeting-whatsapp`, {
            meetingDate: meetingISO,
            meetingTime: meetingISO,
            meetingMode,
            agentName:   "", // backend fills from req.user.name
          });
          setWaStatus("sent");
        } catch (waErr) {
          setWaStatus("failed");
          setWaError(waErr?.response?.data?.message || "WhatsApp could not be sent.");
        }
      }

      // Notify parent to refresh lead
      if (onRemarkAdded) onRemarkAdded();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save meeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-4">
      {/* ── Header + toggle button ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#8B92A9]"><MapIcon className="w-3.5 h-3.5" /></span>
        <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">
          Client Visits ({visits.length})
        </p>
        <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
        <button
          onClick={() => { setShowForm(v => !v); setError(""); }}
          className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-blue-700 transition"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Schedule Meeting
          {showForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Schedule Meeting Form ──────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-[#2563EB]/30 bg-[#EEF3FF] dark:bg-[#1A2540] p-4">
          <p className="text-[12px] font-bold text-[#2563EB] mb-3 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> New Meeting
          </p>

          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Date */}
            <div>
              <label className="text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1 block">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            {/* Time */}
            <div>
              <label className="text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1 block">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)}
                className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          {/* Mode */}
          <div className="mb-2">
            <label className="text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1 block">
              Meeting Mode
            </label>
            <select
              value={meetingMode}
              onChange={e => setMeetingMode(e.target.value)}
              className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]"
            >
              {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1 block">
              Notes / Agenda <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Brief agenda or notes for this meeting…"
              className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] resize-none"
            />
          </div>

          {/* WhatsApp toggle */}
          <div
            onClick={() => setSendWA(v => !v)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition mb-3 ${
              sendWA
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E]"
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
              sendWA ? "border-emerald-500 bg-emerald-500" : "border-[#C4C9D8]"
            }`}>
              {sendWA && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${sendWA ? "text-emerald-600" : "text-[#8B92A9]"}`} />
            <div>
              <p className={`text-[11px] font-semibold ${sendWA ? "text-emerald-700 dark:text-emerald-400" : "text-[#4B5168] dark:text-[#9DA3BB]"}`}>
                Send WhatsApp confirmation to client
              </p>
              <p className="text-[10px] text-[#8B92A9]">
                Uses the approved MSG91 meeting template
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* WhatsApp status */}
          {waStatus === "sent" && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> WhatsApp confirmation sent successfully!
            </div>
          )}
          {waStatus === "failed" && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Meeting saved but WhatsApp failed: {waError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2563EB] text-white text-[12px] font-bold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : sendWA ? "Save & Send WhatsApp" : "Save Meeting"}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#1A2540] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Visit history ──────────────────────────────────────────────────── */}
      {visits.length > 0 ? (
        visits.map((v, i) => <MeetingCard key={v._id || i} visit={v} />)
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
          <span className="text-[#8B92A9]"><NotebookPen className="w-7 h-7" strokeWidth={1.5} /></span>
          <p className="text-[12px] text-[#8B92A9]">No client visits logged yet</p>
          <p className="text-[10px] text-[#8B92A9]">Schedule a meeting above or log from the mobile app.</p>
        </div>
      )}
    </div>
  );
}