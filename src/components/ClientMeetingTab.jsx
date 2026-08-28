// src/components/ClientMeetingTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT MEETING — history + full logging form
//
// Meetings still get logged automatically from the mobile app (Client Visit
// Log screen), but the web panel can now ALSO log a full meeting record
// directly — including proposal tracking (sent? when? which document?),
// multiple attachments, and free-form "anything else" notes — instead of
// only viewing what the mobile app captured.
//
// Also hosts the WhatsApp screenshot upload — proof of a manual (personal
// number) WhatsApp conversation with the lead, separate from the CRM's own
// WhatsApp integration.
//
// Shared by both the admin panel (AdminLeadsPage) and the employee panel
// (UserLeadsPage) — pass isAdmin to pick the right API base.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Handshake, MapPin, Monitor, Video, Phone, CalendarClock, CalendarDays,
  Paperclip, Mic, Map as MapIcon, NotebookPen, Plus, X, FileText,
  CheckCircle2, Image as ImageIcon, Upload, Loader2,
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

const MEETING_TYPE_ICON = {
  "In-Person":  Handshake,
  "Site Visit": MapPin,
  "Demo":       Monitor,
  "Video Call": Video,
  "Phone Call": Phone,
};

const MEETING_TYPES = ["In-Person", "Video Call", "Phone Call", "Site Visit", "Demo"];
const OUTCOMES = ["Interested", "Not Interested", "Converted", "Follow-Up Required", "Pending Decision", "No Show"];

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
  const docs   = Array.isArray(visit.documents) ? visit.documents : [];

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
        <div className="flex items-center gap-1.5 shrink-0">
          {visit.proposalSent ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-3 h-3" /> Proposal sent
            </span>
          ) : null}
          {visit.outcome ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${oStyle}`}>
              {visit.outcome}
            </span>
          ) : null}
        </div>
      </div>

      {visit.remark ? (
        <p className="mt-2 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{visit.remark}"</p>
      ) : null}

      {visit.additionalInfo ? (
        <p className="mt-1.5 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">
          <span className="font-semibold text-[#8B92A9]">Additional info: </span>{visit.additionalInfo}
        </p>
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

      {visit.proposalSentAt ? (
        <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 shrink-0" /><span>Proposal sent: {fmtDateTime(visit.proposalSentAt)}</span>
        </p>
      ) : null}

      {(visit.documentUrl || visit.recordingUrl || docs.length > 0) ? (
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
          {docs.map((d, i) => {
            const isProposal = d.type === "proposal";
            const cls = isProposal
              ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
              : "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20";
            return (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${cls}`}>
                <FileText className="w-3 h-3" />{isProposal ? `Proposal: ${d.name}` : d.name}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── WhatsApp screenshot card ───────────────────────────────────────────────────
function ScreenshotCard({ shot }) {
  return (
    <a href={shot.url} target="_blank" rel="noopener noreferrer" className="block group">
      <div className="rounded-lg overflow-hidden border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
        <img src={shot.url} alt={shot.name || "WhatsApp screenshot"} className="w-full h-28 object-cover group-hover:opacity-90 transition" />
      </div>
      <p className="mt-1 text-[10px] text-[#8B92A9] truncate">{fmtDateTime(shot.uploadedAt)}</p>
      {shot.note ? <p className="text-[10px] text-[#4B5168] dark:text-[#9DA3BB] truncate italic">"{shot.note}"</p> : null}
    </a>
  );
}

// ── Log Meeting form ───────────────────────────────────────────────────────────
function LogMeetingForm({ leadId, isAdmin, onSaved, onClose }) {
  const [meetingType, setMeetingType]     = useState("In-Person");
  const [outcome, setOutcome]             = useState("");
  const [remark, setRemark]               = useState("");
  const [followUpDate, setFollowUpDate]   = useState("");
  const [proposalSent, setProposalSent]   = useState(false);
  const [proposalFile, setProposalFile]   = useState(null);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [recordingFile, setRecordingFile] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");

  const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;

  const handleSubmit = async () => {
    setError("");
    if (!remark.trim()) return setError("Meeting remark / notes are required.");
    if (!outcome.trim()) return setError("Meeting outcome is required.");

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("meetingType", meetingType);
      fd.append("outcome", outcome);
      fd.append("remark", remark.trim());
      if (followUpDate) fd.append("followUpDate", new Date(followUpDate).toISOString());
      fd.append("proposalSent", proposalSent ? "true" : "false");
      if (additionalInfo.trim()) fd.append("additionalInfo", additionalInfo.trim());
      if (proposalFile) fd.append("proposalDocument", proposalFile);
      documentFiles.forEach((f) => fd.append("documents", f));
      if (recordingFile) fd.append("recording", recordingFile);

      const { data } = await api.post(`${base}/meeting-remark`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onSaved(data.meetingRemark);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save meeting. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30";
  const labelCls = "text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1 block";

  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Log a meeting</p>
        <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Meeting type</label>
          <select className={inputCls} value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
            {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Outcome *</label>
          <select className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Select outcome...</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Meeting notes *</label>
        <textarea className={inputCls} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder="What was discussed, decided, next steps..." />
      </div>

      <div>
        <label className={labelCls}>Follow-up date &amp; time</label>
        <input type="datetime-local" className={inputCls} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
      </div>

      <div className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={proposalSent} onChange={(e) => setProposalSent(e.target.checked)}
            className="w-4 h-4 rounded accent-[#2563EB]" />
          <span className="text-[11.5px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Proposal sent to client</span>
        </label>
        <div>
          <label className={labelCls}>Proposal document (optional)</label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E4E7EF] dark:border-[#262A38] cursor-pointer hover:border-[#2563EB]/40 transition">
            <Upload className="w-3.5 h-3.5 text-[#8B92A9]" />
            <span className="text-[11px] text-[#8B92A9] truncate">{proposalFile ? proposalFile.name : "Attach proposal (PDF, DOC, image)"}</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setProposalFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      </div>

      <div>
        <label className={labelCls}>Other documents (contracts, notes, photos — any number)</label>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E4E7EF] dark:border-[#262A38] cursor-pointer hover:border-[#2563EB]/40 transition">
          <Upload className="w-3.5 h-3.5 text-[#8B92A9]" />
          <span className="text-[11px] text-[#8B92A9]">
            {documentFiles.length ? `${documentFiles.length} file(s) selected` : "Attach document(s)"}
          </span>
          <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
            onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))} />
        </label>
      </div>

      <div>
        <label className={labelCls}>Recording (optional)</label>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E4E7EF] dark:border-[#262A38] cursor-pointer hover:border-[#2563EB]/40 transition">
          <Mic className="w-3.5 h-3.5 text-[#8B92A9]" />
          <span className="text-[11px] text-[#8B92A9] truncate">{recordingFile ? recordingFile.name : "Attach audio recording"}</span>
          <input type="file" className="hidden" accept="audio/*"
            onChange={(e) => setRecordingFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div>
        <label className={labelCls}>Additional information</label>
        <textarea className={inputCls} rows={2} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="Anything else worth noting — budget discussed, competitors mentioned, objections raised..." />
      </div>

      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition disabled:opacity-50">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : "Save meeting"}
        </button>
      </div>
    </div>
  );
}

// ── WhatsApp screenshot upload form ────────────────────────────────────────────
function ScreenshotUploadForm({ leadId, isAdmin, onSaved, onClose }) {
  const [file, setFile]     = useState(null);
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;

  const handleSubmit = async () => {
    setError("");
    if (!file) return setError("Choose a screenshot image first.");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      if (note.trim()) fd.append("note", note.trim());
      const { data } = await api.post(`${base}/whatsapp-screenshot`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved(data.screenshot);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not upload screenshot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Upload WhatsApp screenshot</p>
        <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E4E7EF] dark:border-[#262A38] cursor-pointer hover:border-[#2563EB]/40 transition">
        <ImageIcon className="w-3.5 h-3.5 text-[#8B92A9]" />
        <span className="text-[11px] text-[#8B92A9] truncate">{file ? file.name : "Choose an image"}</span>
        <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <input
        className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
        placeholder="Note (optional) — e.g. confirmed pricing over WhatsApp"
        value={note} onChange={(e) => setNote(e.target.value)}
      />
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition disabled:opacity-50">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</> : "Upload"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClientMeetingTab({ lead, isAdmin = false, onSaved }) {
  const [showLogForm, setShowLogForm]   = useState(false);
  const [showShotForm, setShowShotForm] = useState(false);
  const [localRemarks, setLocalRemarks] = useState(null);
  const [localShots, setLocalShots]     = useState(null);

  const visits = [...(localRemarks || lead?.meetingRemarks || [])].sort(
    (a, b) => new Date(b.metAt) - new Date(a.metAt)
  );
  const shots = [...(localShots || lead?.whatsappScreenshots || [])].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  const handleMeetingSaved = (savedRemark) => {
    const next = [...(localRemarks || lead?.meetingRemarks || []), savedRemark];
    setLocalRemarks(next);
    onSaved?.({ ...lead, meetingRemarks: next });
  };

  const handleShotSaved = (savedShot) => {
    const next = [...(localShots || lead?.whatsappScreenshots || []), savedShot];
    setLocalShots(next);
    onSaved?.({ ...lead, whatsappScreenshots: next });
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#8B92A9]"><MapIcon className="w-3.5 h-3.5" /></span>
        <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">
          Client Meeting History ({visits.length})
        </p>
        <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
        {!showLogForm && (
          <button onClick={() => setShowLogForm(true)}
            className="flex items-center gap-1 text-[10.5px] font-semibold text-[#2563EB] hover:underline shrink-0">
            <Plus className="w-3 h-3" /> Log meeting
          </button>
        )}
      </div>

      {showLogForm && (
        <LogMeetingForm
          leadId={lead._id || lead.id}
          isAdmin={isAdmin}
          onSaved={handleMeetingSaved}
          onClose={() => setShowLogForm(false)}
        />
      )}

      {visits.length > 0 ? (
        visits.map((v, i) => <MeetingCard key={v._id || i} visit={v} />)
      ) : !showLogForm ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
          <span className="text-[#8B92A9]"><NotebookPen className="w-7 h-7" strokeWidth={1.5} /></span>
          <p className="text-[12px] text-[#8B92A9]">No client meetings logged yet</p>
          <p className="text-[10px] text-[#8B92A9]">Log one above, or it'll appear here automatically from the mobile app.</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 mt-6 mb-3">
        <span className="text-[#8B92A9]"><ImageIcon className="w-3.5 h-3.5" /></span>
        <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">
          WhatsApp Screenshots ({shots.length})
        </p>
        <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
        {!showShotForm && (
          <button onClick={() => setShowShotForm(true)}
            className="flex items-center gap-1 text-[10.5px] font-semibold text-[#2563EB] hover:underline shrink-0">
            <Plus className="w-3 h-3" /> Upload
          </button>
        )}
      </div>

      {showShotForm && (
        <ScreenshotUploadForm
          leadId={lead._id || lead.id}
          isAdmin={isAdmin}
          onSaved={handleShotSaved}
          onClose={() => setShowShotForm(false)}
        />
      )}

      {shots.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {shots.map((s, i) => <ScreenshotCard key={s._id || i} shot={s} />)}
        </div>
      ) : !showShotForm ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
          <span className="text-[#8B92A9]"><ImageIcon className="w-6 h-6" strokeWidth={1.5} /></span>
          <p className="text-[11.5px] text-[#8B92A9]">No WhatsApp screenshots uploaded</p>
          <p className="text-[10px] text-[#8B92A9]">Proof of a manual WhatsApp chat with this lead.</p>
        </div>
      ) : null}
    </div>
  );
}
