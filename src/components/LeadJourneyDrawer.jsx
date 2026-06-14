import { useMemo } from "react";
import { X, Flame, Sun, Snowflake, CheckCircle2, AlertTriangle, Clock, Handshake, MapPin, Monitor, Video, Phone, CalendarClock, CalendarDays, Paperclip, Mic, User, RefreshCw, ClipboardList, Inbox, Map as MapIcon, Users, BarChart3, PartyPopper, XCircle, Zap, Sparkles } from "lucide-react";
import QualificationScore from "./QualificationScore";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return fmtDate(iso) + " · " + fmtTime(iso);
}
function daysSince(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const STATUS_COLOR = {
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",    text: "text-blue-600 dark:text-blue-400",    dot: "#2563EB" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",  text: "text-amber-600 dark:text-amber-400",  dot: "#D97706" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-600 dark:text-red-400",      dot: "#DC2626" },
};

const TEMP_ICON = { Hot: Flame, Warm: Sun, Cold: Snowflake };
const TEMP_STYLE = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400" },
};

const OUTCOME_STYLE = {
  "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",        text: "text-red-600 dark:text-red-400" },
  "Interested":     { bg: "bg-emerald-50 dark:bg-emerald-950/40",text: "text-emerald-600 dark:text-emerald-400" },
  "Converted":      { bg: "bg-emerald-50 dark:bg-emerald-950/40",text: "text-emerald-600 dark:text-emerald-400" },
  "Call Back":      { bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-600 dark:text-amber-400" },
  "No Answer":      { bg: "bg-gray-100 dark:bg-gray-900/40",     text: "text-gray-500 dark:text-gray-400" },
  "Not Reachable":  { bg: "bg-gray-100 dark:bg-gray-900/40",     text: "text-gray-500 dark:text-gray-400" },
};

function SectionLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[14px]">{icon}</span>
      <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">{label}</p>
      <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
    </div>
  );
}

function JourneyProgressBar({ lead, totalCalls, scheduledCalls }) {
  const sc = STATUS_COLOR[lead.status] || STATUS_COLOR["New"];
  const stages = [
    { key: "created",   label: "Lead In",   done: true },
    { key: "assigned",  label: "Assigned",  done: !!lead.agent },
    { key: "contacted", label: "Contacted", done: totalCalls > 0 },
    { key: "followup",  label: "Follow-up", done: scheduledCalls.some(c => c.done) },
    { key: "converted", label: "Converted", done: lead.status === "Converted" },
  ];
  const doneCount = stages.filter(s => s.done).length;
  const pct = Math.round((doneCount / stages.length) * 100);

  return (
    <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-widest">Journey Progress</p>
        <span className="text-[12px] font-black" style={{ color: sc.dot }}>{pct}%</span>
      </div>
      <div className="flex items-center gap-1 mb-2">
        {stages.map(s => (
          <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#F1F4FF] dark:bg-[#262A38]">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: s.done ? "100%" : "0%", background: sc.dot }} />
            </div>
            <span
              className="text-[9px] font-semibold whitespace-nowrap"
              style={s.done ? { color: sc.dot } : { color: "#C4C9D9" }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallCard({ call, displayIndex }) {
  const outcome = call.outcome || "No Answer";
  const os = OUTCOME_STYLE[outcome] || OUTCOME_STYLE["No Answer"];
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 mb-2">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center text-[10px] font-black text-cyan-600 dark:text-cyan-400 shrink-0">
            #{displayIndex}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {call.userName || "Employee"}
            </p>
            <p className="text-[10px] text-[#8B92A9]">{fmtDateTime(call.calledAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${os.bg} ${os.text}`}>
            {outcome}
          </span>
          {call.calledAt && (
            <span className="text-[9px] text-[#8B92A9] bg-[#F0F2FA] dark:bg-[#1E2130] px-1.5 py-0.5 rounded-md font-medium">
              {daysSince(call.calledAt)}
            </span>
          )}
        </div>
      </div>
      {call.remark && (
        <div className="ml-8 mt-1">
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-[#8B92A9] shrink-0 mt-0.5">Remark:</span>
            <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed italic">"{call.remark}"</p>
          </div>
        </div>
      )}
      {call.numberType && (
        <div className="ml-8 mt-1 flex items-center gap-1.5">
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              call.numberType === "Primary"
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-blue-500/15 text-blue-500"
            }`}
          >
            {call.numberType}
            {call.calledNumber ? ` · ${call.calledNumber.slice(-4).padStart(call.calledNumber.length, "•")}` : ""}
          </span>
        </div>
      )}
      {call.duration && (
        <div className="ml-8 mt-1">
          <span className="text-[9px] text-[#8B92A9]">Duration: {call.duration}</span>
        </div>
      )}
    </div>
  );
}

function ScheduledCard({ sc: call }) {
  const isPast = new Date(call.scheduledAt) < new Date();
  const isOverdue = !call.done && isPast;
  const statusLabel = call.done ? "Completed" : isOverdue ? "Overdue" : "Pending";
  const statusStyle = call.done
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
    : isOverdue
    ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400";
  const Icon = call.done ? CheckCircle2 : isOverdue ? AlertTriangle : Clock;

  return (
    <div className={`rounded-xl border p-3 mb-2 ${
      call.done
        ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20"
        : isOverdue
        ? "border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20"
        : "border-amber-100 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[#8B92A9]"><Icon className="w-3.5 h-3.5" /></span>
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {call.type === "follow-up" ? "Follow-up Call" : "Verification Call"}
            </p>
            <p className="text-[10px] text-[#8B92A9]">Scheduled: {fmtDate(call.scheduledAt)}</p>
            {call.done && call.doneAt && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                Completed: {fmtDateTime(call.doneAt)}
              </p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>
      {call.note && (
        <div className="mt-2 ml-6">
          <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{call.note}"</p>
        </div>
      )}
    </div>
  );
}

// ── Client visit / meeting card ───────────────────────────────────────────────
const MEETING_TYPE_ICON = {
  "In-Person":  Handshake,
  "Site Visit": MapPin,
  "Demo":       Monitor,
  "Video Call": Video,
  "Phone Call": Phone,
};

function MeetingCard({ visit }) {
  const MIcon = MEETING_TYPE_ICON[visit.meetingType] || CalendarClock;
  const oStyle = OUTCOME_STYLE[visit.outcome] || { bg: "bg-gray-100 dark:bg-gray-900/40", text: "text-gray-500 dark:text-gray-400" };
  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] p-3 mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#2563EB]"><MIcon className="w-3.5 h-3.5" /></span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {visit.meetingType || "Visit"}
              {visit.userName ? <span className="font-normal text-[#8B92A9]"> · {visit.userName}</span> : null}
            </p>
            <p className="text-[10px] text-[#8B92A9]">{fmtDateTime(visit.metAt)}</p>
          </div>
        </div>
        {visit.outcome ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${oStyle.bg} ${oStyle.text}`}>
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
            <a
              href={visit.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition"
            >
              <Paperclip className="w-3 h-3" />{visit.documentName || "View attachment"}
            </a>
          ) : null}
          {visit.recordingUrl ? (
            <a
              href={visit.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition"
            >
              <Mic className="w-3 h-3" />{visit.recordingName || "Play recording"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmployeeCard({ agent, isCurrent }) {
  const name = typeof agent === "string" ? agent : agent.name || "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const assignedAt = typeof agent === "object" ? agent.assignedAt : null;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#F0F2FA] dark:border-[#1E2130] last:border-0">
      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[11px] font-black text-purple-600 dark:text-purple-400 shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{name}</p>
        {assignedAt && (
          <p className="text-[10px] text-[#8B92A9]">{fmtDate(assignedAt)}</p>
        )}
      </div>
      {isCurrent
        ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">Current</span>
        : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 shrink-0">Previous</span>
      }
    </div>
  );
}

// ── Default fallback masker ───────────────────────────────────────────────────
function defaultMaskPhone(phone, isSuperAdmin) {
  if (!phone) return "—";
  if (isSuperAdmin) return phone;
  const str = String(phone);
  if (str.length <= 2) return "••••••••";
  return "•".repeat(str.length - 2) + str.slice(-2);
}

// ── Default email masker ──────────────────────────────────────────────────────
function defaultMaskEmail(email, isSuperAdmin) {
  if (!email) return null;
  if (isSuperAdmin) return email;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "•".repeat(8);
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  let maskedLocal;
  if (local.length <= 2) {
    maskedLocal = "•".repeat(local.length);
  } else {
    const mid = Math.max(1, local.length - 4);
    maskedLocal = local.slice(0, 2) + "•".repeat(mid) + local.slice(-2);
  }
  const dotIdx = domain.lastIndexOf(".");
  const maskedDomain = dotIdx > 0
    ? "•".repeat(dotIdx) + domain.slice(dotIdx)
    : "•".repeat(domain.length);
  return `${maskedLocal}@${maskedDomain}`;
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function LeadJourneyDrawer({ lead, onClose, isSuperAdmin = false, maskPhone, maskEmail }) {
  // Hooks below must run unconditionally — keep the null check AFTER them.
  const safeLead = lead || {};

  const masker      = maskPhone  || defaultMaskPhone;
  const emailMasker = maskEmail  || defaultMaskEmail;

  const displayPhone          = masker(safeLead.primaryPhone || safeLead.phone || safeLead.mobile, isSuperAdmin);
  const displaySecondaryPhone = safeLead.secondaryPhone ? masker(safeLead.secondaryPhone, isSuperAdmin) : null;
  const displayEmail          = emailMasker(safeLead.email, isSuperAdmin);

  // Raw (unmasked) numbers for tel: / WhatsApp actions. The number stays
  // visually masked for non-superadmins, but the action still needs to dial.
  const rawPrimary   = safeLead.primaryPhone || safeLead.phone || safeLead.mobile || "";
  const rawSecondary = safeLead.secondaryPhone || "";
  // WhatsApp needs international format with no "+". Default missing country
  // code to 91 for bare 10-digit Indian numbers.
  const toWaNumber = (raw) => {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) return "";
    // Already has country code (12-digit Indian: 91XXXXXXXXXX) — return as-is
    if (d.length === 12 && d.startsWith("91")) return d;
    // Bare 10-digit number — prepend India country code
    if (d.length === 10) return `91${d}`;
    return d;
  };
  const telHref = (raw) => `tel:${String(raw || "").replace(/[^\d+]/g, "")}`;

  const sc = STATUS_COLOR[safeLead.status] || STATUS_COLOR["New"];
  const name = safeLead.name || "Unknown";
  const callHistory    = safeLead.callHistory    || [];
  const scheduledCalls = safeLead.scheduledCalls || [];
  const previousAgents = safeLead.previousAgents || [];
  const meetingRemarks = safeLead.meetingRemarks || [];

  const sortedCalls = useMemo(() =>
    [...callHistory].sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt)),
  [callHistory]);

  const sortedSched = useMemo(() =>
    [...scheduledCalls].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)),
  [scheduledCalls]);

  const sortedVisits = useMemo(() =>
    [...meetingRemarks].sort((a, b) => new Date(b.metAt) - new Date(a.metAt)),
  [meetingRemarks]);

  const totalCalls   = callHistory.length;
  const lastCallAt   = sortedCalls[0]?.calledAt || null;
  const overdueCalls = scheduledCalls.filter(c => !c.done && new Date(c.scheduledAt) < new Date()).length;

  const allAgents = useMemo(() => {
    const currentAgentName = safeLead.agent;
    const prevNames = new Set(previousAgents.map(a => (typeof a === "string" ? a : a.name)));
    const list = previousAgents.map(a => ({
      ...(typeof a === "object" ? a : { name: a }),
      _isCurrent: (typeof a === "string" ? a : a.name) === currentAgentName,
    }));
    if (currentAgentName && !prevNames.has(currentAgentName)) {
      list.push({ name: currentAgentName, _isCurrent: true });
    }
    return list;
  }, [safeLead.agent, previousAgents]);

  // Render gate — after all hooks so hook order stays stable.
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-[540px] bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black shrink-0"
                style={{ background: (sc.dot || "#2563EB") + "18", color: sc.dot || "#2563EB" }}
              >
                {name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{name}</h2>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {displayPhone && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">PRIMARY</span>
                      <span className="text-[11px] font-mono text-[#8B92A9]">{displayPhone}</span>
                    </span>
                  )}
                  {displaySecondaryPhone && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">SECONDARY</span>
                      <span className="text-[11px] font-mono text-[#8B92A9]">{displaySecondaryPhone}</span>
                    </span>
                  )}
                  {displayEmail && (
                    <span className="text-[11px] text-[#8B92A9] font-mono">{displayEmail}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
              {lead.status}
            </span>
            {lead.Quality && TEMP_STYLE[lead.Quality] && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${TEMP_STYLE[lead.Quality].bg} ${TEMP_STYLE[lead.Quality].text}`}>
                {(() => { const I = TEMP_ICON[lead.Quality]; return I ? <I className="w-3 h-3" /> : null; })()} {lead.Quality}
              </span>
            )}
            {lead.agent && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                <User className="w-3 h-3" /> {lead.agent}
              </span>
            )}
            {lead.reassignCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                <RefreshCw className="w-3 h-3" /> Reassigned {lead.reassignCount}×
              </span>
            )}
          </div>
          {lead.leadScore != null && (
            <div className="mt-2">
              <QualificationScore lead={lead} size="md" />
            </div>
          )}
        </div>

        {/* ── Quick stats ── */}
        <div className="px-6 py-4 grid grid-cols-2 gap-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[
            { label: "Calls Made",    value: totalCalls,                               color: "#0891B2" },
            { label: "Last Activity", value: lastCallAt ? daysSince(lastCallAt) : "—", color: "#7C3AED" },
          ].map(item => (
            <div key={item.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-2.5 text-center">
              <p className="text-[9px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-[14px] font-black" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 flex-1 space-y-6">

          {/* ── Contact Numbers ── */}
          <div>
            <SectionLabel icon={<Phone className="w-3.5 h-3.5" />} label="Contact Numbers" />
            <div className="space-y-2">

              {/* Primary Number */}
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 shrink-0">PRIMARY</span>
                  <span className="text-[13px] font-mono font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{displayPhone}</span>
                </div>
              </div>

              {/* Secondary Number */}
              {lead.secondaryPhone ? (
                <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 shrink-0">SECONDARY</span>
                    <span className="text-[13px] font-mono font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{displaySecondaryPhone}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F0F2FA] dark:bg-[#262A38] text-[#8B92A9]">ADDITIONAL</span>
                  <span className="text-[12px] text-[#8B92A9] italic">Not set</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Lead Details ── */}
          <div>
            <SectionLabel icon={<ClipboardList className="w-3.5 h-3.5" />} label="Lead Details" />
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              {[
                { label: "Source",           value: lead.source || "—" },
                { label: "Campaign",         value: lead.campaign && lead.campaign !== "—" ? lead.campaign : "—" },
                { label: "Ad Set",           value: lead.adSetName || "—" },
                { label: "Primary Number",   value: displayPhone },
                ...(displaySecondaryPhone ? [{ label: "Secondary Number", value: displaySecondaryPhone }] : []),
                { label: "Created",          value: fmtDateTime(lead._raw_date || lead.createdAt) },
                { label: "Lead Date",        value: lead.date || "—" },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-[#F0F2FA] dark:border-[#1E2130]" : ""}`}
                >
                  <span className="text-[11px] text-[#8B92A9]">{row.label}</span>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] text-right max-w-[220px] truncate">
                    {row.value}
                  </span>
                </div>
              ))}

              {lead.projects && lead.projects.length > 0 && (
                <div className="border-t border-[#F0F2FA] dark:border-[#1E2130] px-4 py-2.5">
                  <span className="text-[11px] text-[#8B92A9] block mb-1.5">Projects</span>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.projects.map((p, i) => {
                      const pName  = p?.name  || "Project";
                      const pColor = p?.color || "#2563EB";
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: pColor + "18", color: pColor }}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pColor }} />
                          {pName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {lead.remark && (
                <div className="border-t border-[#F0F2FA] dark:border-[#1E2130] px-4 py-2.5">
                  <span className="text-[11px] text-[#8B92A9] block mb-1">Latest Remark</span>
                  <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{lead.remark}"</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Call History ── */}
          <div>
            <SectionLabel icon={<Phone className="w-3.5 h-3.5" />} label={`Call History (${sortedCalls.length})`} />
            {sortedCalls.length > 0 ? (
              sortedCalls.map((call, i) => (
                <CallCard key={i} call={call} displayIndex={i + 1} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
                <span className="text-[#8B92A9]"><Inbox className="w-7 h-7" strokeWidth={1.5} /></span>
                <p className="text-[12px] text-[#8B92A9]">No calls recorded yet</p>
              </div>
            )}
          </div>

          {/* ── Client Visits (field meetings logged from mobile) ── */}
          {sortedVisits.length > 0 && (
            <div>
              <SectionLabel icon={<MapIcon className="w-3.5 h-3.5" />} label={`Client Visits (${sortedVisits.length})`} />
              {sortedVisits.map((v, i) => (
                <MeetingCard key={v._id || i} visit={v} />
              ))}
            </div>
          )}

          {/* ── Scheduled / Follow-up Calls ── */}
          {sortedSched.length > 0 && (
            <div>
              <SectionLabel icon={<CalendarDays className="w-3.5 h-3.5" />} label={`Follow-ups & Scheduled Calls (${sortedSched.length})`} />
              {sortedSched.map((s, i) => (
                <ScheduledCard key={i} sc={s} />
              ))}
            </div>
          )}

          {/* ── Employee History ── */}
          {allAgents.length > 0 && (
            <div>
              <SectionLabel icon={<Users className="w-3.5 h-3.5" />} label={`Employee History (${allAgents.length})`} />
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-4 py-2">
                {allAgents.map((ag, i) => (
                  <EmployeeCard key={i} agent={ag} isCurrent={ag._isCurrent} />
                ))}
              </div>
            </div>
          )}

          {/* ── Current Status Summary ── */}
          <div>
            <SectionLabel icon={<BarChart3 className="w-3.5 h-3.5" />} label="Current Status Summary" />
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: sc.dot + "40", background: sc.dot + "08" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]"
                  style={{ background: sc.dot + "15" }}
                >
                  {lead.status === "Converted"        ? <PartyPopper className="w-5 h-5" />
                   : lead.status === "Not Interested" ? <XCircle className="w-5 h-5" />
                   : lead.status === "In Progress"    ? <Zap className="w-5 h-5" />
                   : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: sc.dot }}>{lead.status}</p>
                  <p className="text-[10px] text-[#8B92A9]">
                    {lead.status === "Converted"      ? "Successfully converted to customer" :
                     lead.status === "Not Interested" ? "Lead declined the offer" :
                     lead.status === "In Progress"    ? `Active — ${totalCalls} call${totalCalls !== 1 ? "s" : ""} made` :
                     "Newly added, awaiting first contact"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/60 dark:bg-black/20 rounded-lg p-2.5">
                  <p className="text-[9px] text-[#8B92A9] uppercase tracking-wide mb-1">Total Interactions</p>
                  <p className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                    {totalCalls} call{totalCalls !== 1 ? "s" : ""} + {scheduledCalls.length} scheduled
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-black/20 rounded-lg p-2.5">
                  <p className="text-[9px] text-[#8B92A9] uppercase tracking-wide mb-1">Lead Age</p>
                  <p className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                    {lead._raw_date || lead.createdAt ? daysSince(lead._raw_date || lead.createdAt) : "—"}
                  </p>
                </div>
              </div>

              {overdueCalls > 0 && (
                <div className="mt-2.5 flex items-center gap-2 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
                  <span className="text-red-500"><AlertTriangle className="w-3.5 h-3.5" /></span>
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                    {overdueCalls} overdue follow-up{overdueCalls > 1 ? "s" : ""} — action needed
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
