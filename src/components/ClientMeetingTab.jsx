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

import { useState, useEffect } from "react";
import {
  Handshake, MapPin, Monitor, Video, Phone, CalendarClock, CalendarDays,
  Paperclip, Mic, Map as MapIcon, NotebookPen, Plus, X, FileText,
  CheckCircle2, Image as ImageIcon, Upload, Loader2,
} from "lucide-react";
import api from "../data/axiosConfig";
import { list as custList } from "../data/customizationStore";
import useCustomization from "../hooks/useCustomization";

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

// Meeting types & outcomes come from Customize CRM → Dropdown Lists.
const meetingTypes    = () => custList("meetingTypes");
const meetingOutcomes = () => custList("meetingOutcomes");

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
  useCustomization(); // re-render when the company lists load
  const [meetingType, setMeetingType]     = useState(() => meetingTypes()[0] || "In-Person");
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
            {meetingTypes().map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Outcome *</label>
          <select className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Select outcome...</option>
            {meetingOutcomes().map((o) => <option key={o} value={o}>{o}</option>)}
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
// Several screenshots can be picked at once. The server takes one image per
// request, so they upload one after another; the note applies to all of them.
const SHOT_MAX_MB = 15;   // server limit (meetingRemarkController screenshotUpload)
const SHOT_MAX_FILES = 20;

function ScreenshotUploadForm({ leadId, isAdmin, onSaved, onClose }) {
  const [items, setItems]   = useState([]);   // [{ id, file, preview, error }]
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [error, setError]   = useState("");

  const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;

  // Free thumbnail URLs when the form closes.
  useEffect(() => () => items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const notes = [];
    const ok = [];
    for (const f of picked) {
      if (!f.type.startsWith("image/")) { notes.push(`${f.name} is not an image`); continue; }
      if (f.size > SHOT_MAX_MB * 1024 * 1024) { notes.push(`${f.name} is over ${SHOT_MAX_MB}MB`); continue; }
      ok.push(f);
    }
    setItems((prev) => {
      const room = Math.max(0, SHOT_MAX_FILES - prev.length);
      if (ok.length > room) notes.push(`only ${SHOT_MAX_FILES} screenshots can be uploaded at once`);
      const added = ok.slice(0, room).map((file) => ({
        id: `${file.name}_${file.size}_${Math.random().toString(36).slice(2, 7)}`,
        file, preview: URL.createObjectURL(file), error: "",
      }));
      return [...prev, ...added];
    });
    setError(notes.length ? `Skipped: ${notes.join("; ")}.` : "");
  };

  const removeItem = (id) => setItems((prev) => {
    const it = prev.find((x) => x.id === id);
    if (it?.preview) URL.revokeObjectURL(it.preview);
    return prev.filter((x) => x.id !== id);
  });

  const handleSubmit = async () => {
    setError("");
    if (!items.length) return setError("Choose at least one screenshot image.");
    setSaving(true);
    const saved = [];
    const failed = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setProgress({ done: i, total: items.length });
      try {
        const fd = new FormData();
        fd.append("screenshot", it.file);
        if (note.trim()) fd.append("note", note.trim());
        const { data } = await api.post(`${base}/whatsapp-screenshot`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        saved.push(data.screenshot);
        if (it.preview) URL.revokeObjectURL(it.preview);
      } catch (e) {
        failed.push({ ...it, error: e?.response?.data?.message || "Upload failed" });
      }
    }
    setProgress(null);
    setSaving(false);
    if (saved.length) onSaved(saved);
    if (!failed.length) { onClose(); return; }
    // Keep only the ones that failed so they can be retried.
    setItems(failed);
    setError(`${saved.length} uploaded, ${failed.length} failed. Fix or remove them and press Upload again.`);
  };

  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Upload WhatsApp screenshots</p>
        <button onClick={onClose} disabled={saving} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E4E7EF] dark:border-[#262A38] transition ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[#2563EB]/40"}`}>
        <ImageIcon className="w-3.5 h-3.5 text-[#8B92A9]" />
        <span className="text-[11px] text-[#8B92A9] truncate">
          {items.length ? `${items.length} selected · add more` : "Choose images (you can select several)"}
        </span>
        <input type="file" multiple className="hidden" accept="image/*" disabled={saving}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </label>

      {items.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {items.map((it) => (
            <div key={it.id} className={`relative rounded-lg overflow-hidden border ${it.error ? "border-red-400" : "border-[#E4E7EF] dark:border-[#262A38]"}`} title={it.error || it.file.name}>
              <img src={it.preview} alt={it.file.name} className="w-full h-16 object-cover" />
              {!saving && (
                <button onClick={() => removeItem(it.id)} aria-label={`Remove ${it.file.name}`}
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              )}
              {it.error && <span className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-[9px] px-1 truncate">{it.error}</span>}
            </div>
          ))}
        </div>
      )}

      <input
        className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
        placeholder="Note (optional, added to every screenshot) — e.g. confirmed pricing over WhatsApp"
        value={note} onChange={(e) => setNote(e.target.value)} disabled={saving}
      />
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving || !items.length}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition disabled:opacity-50">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading {progress ? `${progress.done + 1} of ${progress.total}` : ""}…</>
            : items.length > 1 ? `Upload ${items.length}` : "Upload"}
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError]     = useState("");

  // Load the full meeting history + screenshots when the tab opens.
  // The admin Leads list leaves these out to stay fast, so without this the
  // tab was always empty for admins / super admins even though employees had
  // logged meetings. Employees get fresh data too (another device may have
  // added entries since their list loaded).
  const leadId = lead?._id || lead?.id;
  useEffect(() => {
    if (!leadId) return undefined;
    let cancelled = false;
    const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;
    setLoadingHistory(true);
    setHistoryError("");
    Promise.allSettled([
      api.get(`${base}/meeting-remarks`),
      api.get(`${base}/whatsapp-screenshots`),
    ]).then(([remarksRes, shotsRes]) => {
      if (cancelled) return;
      if (remarksRes.status === "fulfilled") setLocalRemarks(remarksRes.value.data?.meetingRemarks || []);
      if (shotsRes.status === "fulfilled") setLocalShots(shotsRes.value.data?.screenshots || []);
      if (remarksRes.status === "rejected" || shotsRes.status === "rejected") {
        setHistoryError("Couldn't load the full meeting history. Showing what's available.");
      }
    }).finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [leadId, isAdmin]);

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

  // Accepts one screenshot or several (multi-upload).
  const handleShotSaved = (savedShots) => {
    const added = Array.isArray(savedShots) ? savedShots : [savedShots];
    const next = [...(localShots || lead?.whatsappScreenshots || []), ...added.filter(Boolean)];
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

      {historyError && <p className="text-[11px] text-amber-600 mb-2">{historyError}</p>}
      {visits.length > 0 ? (
        visits.map((v, i) => <MeetingCard key={v._id || i} visit={v} />)
      ) : loadingHistory ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-[#8B92A9]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading meeting history…
        </div>
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
