// src/components/ClientMeetingTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT MEETING HISTORY (read-only)
//
// Displays the client-visit / field-meeting history for a lead. Meetings are
// logged exclusively from the mobile app (Client Visit Log screen); the web
// admin and employee panels only VIEW that history — the old "Schedule Meeting"
// form has been removed so both panels stay a faithful record of what reps
// captured in the field.
//
// Shared by both the admin panel (AdminLeadsPage) and the employee panel
// (UserLeadsPage), so a single change here updates both.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Handshake, MapPin, Monitor, Video, Phone, CalendarClock, CalendarDays,
  Paperclip, Mic, Map as MapIcon, NotebookPen,
} from "lucide-react";

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

// ── Main component (history only) ─────────────────────────────────────────────
export default function ClientMeetingTab({ lead }) {
  const visits = [...(lead?.meetingRemarks || [])].sort(
    (a, b) => new Date(b.metAt) - new Date(a.metAt)
  );

  return (
    <div className="px-6 py-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#8B92A9]"><MapIcon className="w-3.5 h-3.5" /></span>
        <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">
          Client Meeting History ({visits.length})
        </p>
        <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
      </div>

      {/* ── Visit history ──────────────────────────────────────────────────── */}
      {visits.length > 0 ? (
        visits.map((v, i) => <MeetingCard key={v._id || i} visit={v} />)
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
          <span className="text-[#8B92A9]"><NotebookPen className="w-7 h-7" strokeWidth={1.5} /></span>
          <p className="text-[12px] text-[#8B92A9]">No client meetings logged yet</p>
          <p className="text-[10px] text-[#8B92A9]">Meetings logged from the mobile app will appear here.</p>
        </div>
      )}
    </div>
  );
}
