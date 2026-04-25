import { useMemo } from "react";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
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
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",    text: "text-blue-600 dark:text-blue-400",    dot: "#2563EB", light: "#EFF6FF" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",  text: "text-amber-600 dark:text-amber-400",  dot: "#D97706", light: "#FFFBEB" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669", light: "#ECFDF5" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-600 dark:text-red-400",      dot: "#DC2626", light: "#FEF2F2" },
};
const TEMP_ICON = { Hot: "", Warm: "", Cold: "" };
const TEMP_STYLE = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400" },
};

const OUTCOME_STYLE = {
  "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",   text: "text-red-600 dark:text-red-400" },
  "Interested":     { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  "Call Back":      { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  "No Answer":      { bg: "bg-gray-100 dark:bg-gray-900/40", text: "text-gray-500 dark:text-gray-400" },
};

function Badge({ label, bg, text, size = "sm" }) {
  const sz = size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.5";
  return <span className={`inline-flex items-center rounded-full font-semibold ${sz} ${bg} ${text}`}>{label}</span>;
}

function SectionLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[14px]">{icon}</span>
      <p className="text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">{label}</p>
      <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
    </div>
  );
}

// ── Journey progress bar ─────────────────────────────────────────────────────
function JourneyProgressBar({ lead }) {
  const sc = STATUS_COLOR[lead.status] || STATUS_COLOR["New"];
  const stages = [
    { key: "created",    label: "Lead In",     done: true },
    { key: "assigned",   label: "Assigned",    done: !!lead.agent },
    { key: "contacted",  label: "Contacted",   done: (lead.callHistory || []).length > 0 },
    { key: "followup",   label: "Follow-up",   done: (lead.scheduledCalls || []).some(c => c.done) },
    { key: "converted",  label: "Converted",   done: lead.status === "Converted" },
  ];
  const doneCount = stages.filter(s => s.done).length;
  const pct = Math.round((doneCount / stages.length) * 100);

  return (
    <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-widest">Journey Progress</p>
        <span className="text-[12px] font-black" style={{ color: sc.dot }}>{pct}%</span>
      </div>
      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-2">
        {stages.map((s, i) => (
          <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#F1F4FF] dark:bg-[#262A38]">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: s.done ? "100%" : "0%", background: sc.dot }} />
            </div>
            <span className={`text-[9px] font-semibold whitespace-nowrap ${s.done ? "" : "text-[#C4C9D9] dark:text-[#3E4257]"}`}
              style={s.done ? { color: sc.dot } : {}}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Call card ────────────────────────────────────────────────────────────────
function CallCard({ call, index }) {
  const outcome = call.outcome || "No Answer";
  const os = OUTCOME_STYLE[outcome] || OUTCOME_STYLE["No Answer"];
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 mb-2">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center text-[10px] font-black text-cyan-600 dark:text-cyan-400 shrink-0">
            {index + 1}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {call.userName || "Agent"}
            </p>
            <p className="text-[10px] text-[#8B92A9]">{fmtDateTime(call.calledAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${os.bg} ${os.text}`}>{outcome}</span>
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
      {call.duration && (
        <div className="ml-8 mt-1">
          <span className="text-[9px] text-[#8B92A9]">Duration: {call.duration}</span>
        </div>
      )}
    </div>
  );
}

// ── Scheduled call card ──────────────────────────────────────────────────────
function ScheduledCard({ sc: call }) {
  const isPast = new Date(call.scheduledAt) < new Date();
  const statusLabel = call.done ? "Completed" : isPast ? "Overdue" : "Pending";
  const statusStyle = call.done
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
    : isPast
    ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400";
  const icon = call.done ? "✅" : isPast ? "⏰" : "📅";

  return (
    <div className={`rounded-xl border p-3 mb-2 ${call.done ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20" : isPast ? "border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20" : "border-amber-100 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{icon}</span>
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {call.type === "follow-up" ? "Follow-up Call" : "Verification Call"}
            </p>
            <p className="text-[10px] text-[#8B92A9]">Scheduled: {fmtDate(call.scheduledAt)}</p>
            {call.done && call.doneAt && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Completed: {fmtDateTime(call.doneAt)}</p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>{statusLabel}</span>
      </div>
      {call.note && (
        <div className="mt-2 ml-6">
          <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{call.note}"</p>
        </div>
      )}
    </div>
  );
}

// ── Agent assignment card ────────────────────────────────────────────────────
function AgentCard({ agent, isCurrent }) {
  const name = agent.name || agent;
  const initial = (typeof name === "string" ? name : "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#F0F2FA] dark:border-[#1E2130] last:border-0">
      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[11px] font-black text-purple-600 dark:text-purple-400 shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{name}</p>
        {agent.assignedAt && (
          <p className="text-[10px] text-[#8B92A9]">{fmtDate(agent.assignedAt)}</p>
        )}
      </div>
      {isCurrent
        ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">Current</span>
        : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 shrink-0">Previous</span>
      }
    </div>
  );
}

// ── Main drawer ──────────────────────────────────────────────────────────────
export default function LeadJourneyDrawer({ lead, onClose }) {
  if (!lead) return null;

  const sc = STATUS_COLOR[lead.status] || STATUS_COLOR["New"];
  const name = lead.name || "Unknown";
  const callHistory    = lead.callHistory    || [];
  const scheduledCalls = lead.scheduledCalls || [];
  const previousAgents = lead.previousAgents || [];

  const totalCalls    = callHistory.length;
  const pendingCalls  = scheduledCalls.filter(c => !c.done).length;
  const doneSched     = scheduledCalls.filter(c => c.done).length;
  const overdueCalls  = scheduledCalls.filter(c => !c.done && new Date(c.scheduledAt) < new Date()).length;

  // Last activity
  const lastCallAt = callHistory.length
    ? callHistory.slice().sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))[0]?.calledAt
    : null;

  // All agents (previous + current, deduped)
  const allAgents = useMemo(() => {
    const list = [...previousAgents];
    if (lead.agent && !previousAgents.some(a => (a.name || a) === lead.agent)) {
      list.push({ name: lead.agent, _isCurrent: true });
    }
    return list;
  }, [lead, previousAgents]);

  const sortedCalls = useMemo(() =>
    [...callHistory].sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt)),
  [callHistory]);

  const sortedSched = useMemo(() =>
    [...scheduledCalls].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)),
  [scheduledCalls]);

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
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black shrink-0"
                style={{ background: (sc.dot || "#2563EB") + "18", color: sc.dot || "#2563EB" }}>
                {name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{name}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {lead.phone && <span className="text-[11px] font-mono text-[#8B92A9]">{lead.phone}</span>}
                  {lead.email && <span className="text-[11px] text-[#8B92A9]">{lead.email}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Status & quality badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
              {lead.status}
            </span>
            {lead.Quality && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${TEMP_STYLE[lead.Quality]?.bg} ${TEMP_STYLE[lead.Quality]?.text}`}>
                {TEMP_ICON[lead.Quality]} {lead.Quality}
              </span>
            )}
            {lead.agent && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                👤 {lead.agent}
              </span>
            )}
            {lead.reassignCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                🔄 Reassigned {lead.reassignCount}×
              </span>
            )}
          </div>
        </div>

        {/* ── Journey progress bar ── */}
        <JourneyProgressBar lead={lead} />

        {/* ── Quick stats ── */}
        <div className="px-6 py-4 grid grid-cols-4 gap-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[
            { label: "Calls Made", value: totalCalls, color: "#0891B2" },
            { label: "Pending", value: pendingCalls, color: overdueCalls > 0 ? "#DC2626" : "#D97706" },
            { label: "Completed", value: doneSched, color: "#059669" },
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

          {/* Lead info */}
          <div>
            <SectionLabel icon="📋" label="Lead Details" />
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              {[
                { label: "Source",   value: lead.source   || "—" },
                { label: "Campaign", value: lead.campaign !== "—" ? lead.campaign : "—" },
                { label: "Created",  value: fmtDateTime(lead._raw_date || lead.createdAt || lead.date) },
                { label: "Lead Date",value: lead.date || "—" },
              ].map((row, i) => (
                <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-[#F0F2FA] dark:border-[#1E2130]" : ""}`}>
                  <span className="text-[11px] text-[#8B92A9]">{row.label}</span>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] text-right max-w-[220px] truncate">{row.value}</span>
                </div>
              ))}
              {lead.remark && (
                <div className="border-t border-[#F0F2FA] dark:border-[#1E2130] px-4 py-2.5">
                  <span className="text-[11px] text-[#8B92A9] block mb-1">Latest Remark</span>
                  <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">"{lead.remark}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Call history */}
          {sortedCalls.length > 0 && (
            <div>
              <SectionLabel icon="📞" label={`Call History (${sortedCalls.length})`} />
              <div>
                {sortedCalls.map((call, i) => (
                  <CallCard key={i} call={call} index={sortedCalls.length - 1 - i} />
                ))}
              </div>
            </div>
          )}

          {/* No calls yet */}
          {sortedCalls.length === 0 && (
            <div>
              <SectionLabel icon="📞" label="Call History" />
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
                <span className="text-[28px]">📵</span>
                <p className="text-[12px] text-[#8B92A9]">No calls recorded yet</p>
              </div>
            </div>
          )}

          {/* Scheduled / follow-up calls */}
          {sortedSched.length > 0 && (
            <div>
              <SectionLabel icon="📅" label={`Follow-ups & Scheduled Calls (${sortedSched.length})`} />
              <div>
                {sortedSched.map((sc, i) => (
                  <ScheduledCard key={i} sc={sc} />
                ))}
              </div>
            </div>
          )}

          {/* Agent history */}
          {allAgents.length > 0 && (
            <div>
              <SectionLabel icon="👥" label={`Agent History (${allAgents.length})`} />
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-4 py-2">
                {allAgents.map((ag, i) => (
                  <AgentCard key={i} agent={ag}
                    isCurrent={ag._isCurrent || (ag.name || ag) === lead.agent} />
                ))}
              </div>
            </div>
          )}

          {/* Current status summary */}
          <div>
            <SectionLabel icon="🏁" label="Current Status Summary" />
            <div className="rounded-xl border p-4"
              style={{ borderColor: sc.dot + "40", background: sc.dot + "08" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]"
                  style={{ background: sc.dot + "15" }}>
                  {lead.status === "Converted" ? "🏆" : lead.status === "Not Interested" ? "❌" : lead.status === "In Progress" ? "⏳" : "🔵"}
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: sc.dot }}>{lead.status}</p>
                  <p className="text-[10px] text-[#8B92A9]">
                    {lead.status === "Converted" ? "Successfully converted to customer" :
                     lead.status === "Not Interested" ? "Lead declined the offer" :
                     lead.status === "In Progress" ? `Active — ${totalCalls} call${totalCalls !== 1 ? "s" : ""} made` :
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
                  <span className="text-[13px]">⚠️</span>
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