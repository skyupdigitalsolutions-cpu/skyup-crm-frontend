// pages/UserTwilioPage.jsx
// Loop: List → [Start Calling] → Call Screen (auto-dial) → Status Update → Next Lead → repeat

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import { useTwilioCall } from "../hooks/useTwilioCall";
import { maskPhone } from "../utils/maskPhone";

// ── STEP CONSTANTS ────────────────────────────────────────────────────────────
const STEP = { LIST: "list", CALL: "call", STATUS: "status", DONE: "done" };

// ── Disposition options ───────────────────────────────────────────────────────
const DISPOSITIONS = [
  { value: "Interested",     label: "Interested",     color: "#059669", bg: "#ECFDF5", dot: "#059669" },
  { value: "Callback",       label: "Callback",       color: "#2563EB", bg: "#EEF3FF", dot: "#2563EB" },
  { value: "Not Interested", label: "Not Interested", color: "#DC2626", bg: "#FEF2F2", dot: "#DC2626" },
  { value: "No Answer",      label: "No Answer",      color: "#D97706", bg: "#FFFBEB", dot: "#D97706" },
  { value: "Wrong Number",   label: "Wrong Number",   color: "#7C3AED", bg: "#F5F3FF", dot: "#7C3AED" },
  { value: "Follow Up",      label: "Follow Up",      color: "#0891B2", bg: "#ECFEFF", dot: "#0891B2" },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function LeadAvatar({ name, size = 10, textSize = "text-[12px]" }) {
  const initials = (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center font-bold text-[#2563EB] shrink-0 ${textSize}`}>
      {initials}
    </div>
  );
}

// ── Progress stepper ──────────────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = [
    { key: STEP.CALL,   label: "Call"   },
    { key: STEP.STATUS, label: "Update" },
  ];
  const activeIdx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
              active ? "bg-[#2563EB] text-white" :
              done   ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]" :
                       "bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9]"
            }`}>
              {done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              {s.label}
            </div>
            {i < steps.length - 1 && <div className={`w-5 h-px ${done || active ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── CALL SCREEN ───────────────────────────────────────────────────────────────
// Renders the full-page call UI. Automatically initiates the call on mount.
function CallScreen({ lead, onCallEnded, onSkip }) {
  const { callStatus, makeCall, hangUp, mute, error } = useTwilioCall("crm_user");
  const [isMuted,  setIsMuted]  = useState(false);
  const [seconds,  setSeconds]  = useState(0);
  const timerRef = useRef(null);
  const calledRef = useRef(false);

  // Auto-dial on mount
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    // Small delay so Twilio Device has time to register
    const t = setTimeout(() => {
      makeCall(lead.phone, lead.id);
    }, 800);
    return () => clearTimeout(t);
  }, []);                   // intentionally empty — only run once on mount

  // Timer while active
  useEffect(() => {
    if (callStatus === "active") {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // When call ends (disconnect / error / no-answer) → move to status
  useEffect(() => {
    if (callStatus === "ended") {
      onCallEnded({ duration: seconds });
    }
  }, [callStatus]);

  const fmtTimer = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleHangUp = () => {
    hangUp();
    // onCallEnded will fire via useEffect when status becomes "ended"
  };

  const handleMute = () => { mute(!isMuted); setIsMuted(p => !p); };

  const isConnecting = callStatus === "idle" || callStatus === "connecting";
  const isActive     = callStatus === "active";

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl overflow-hidden shadow-xl">

        {/* Top — contact + status */}
        <div className="flex flex-col items-center pt-10 pb-6 px-6 gap-4"
          style={{ background: "linear-gradient(to bottom, #EEF3FF, #fff)" }}>
          <div className="w-20 h-20 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[28px] font-black shadow-lg">
            {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{lead.name}</p>
            <p className="text-[13px] text-[#8B92A9] font-mono mt-0.5">{maskPhone(lead.phone)}</p>
          </div>

          {/* Status pill */}
          {isConnecting && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[12px] font-semibold">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Dialing…
            </div>
          )}
          {isActive && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
              {fmtTimer(seconds)}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#DC2626] font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pb-8 flex flex-col gap-3">
          {isActive && (
            <div className="flex gap-3">
              {/* Mute */}
              <button onClick={handleMute}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-semibold transition ${
                  isMuted
                    ? "bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]"
                    : "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]"
                }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isMuted
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  }
                </svg>
                {isMuted ? "Unmute" : "Mute"}
              </button>

              {/* Hang up */}
              <button onClick={handleHangUp}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#DC2626] hover:bg-red-700 text-white text-[13px] font-semibold transition active:scale-[0.97]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                </svg>
                Hang Up
              </button>
            </div>
          )}

          {/* Skip (available at any point) */}
          <button onClick={onSkip}
            className="w-full py-2.5 rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Skip this lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATUS UPDATE SCREEN ──────────────────────────────────────────────────────
function StatusScreen({ lead, callData, onSaved, onSkip, onStop }) {
  const [selected, setSelected] = useState("");
  const [note,     setNote]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  const handleSave = async () => {
    if (!selected) { setErr("Please choose an outcome."); return; }
    setSaving(true); setErr("");
    try {
      await api.patch(`/lead/${lead.id}`, { status: selected, remark: note.trim() || undefined });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed — try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl overflow-hidden shadow-xl">

        {/* Lead header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[13px] font-bold text-[#2563EB]">
            {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{lead.name}</p>
            <p className="text-[11px] text-[#8B92A9] font-mono">{maskPhone(lead.phone)}</p>
          </div>
          {callData?.duration > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-[#F1F4FF] dark:bg-[#1E2130] text-[10px] font-semibold text-[#8B92A9]">
              ⏱ {callData.duration}s
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Disposition grid */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Call outcome</p>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => { setSelected(opt.value); setErr(""); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition active:scale-[0.97] ${
                    selected === opt.value
                      ? "shadow-sm border-transparent"
                      : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#4B5168] dark:text-[#9DA3BB]"
                  }`}
                  style={selected === opt.value ? { background: opt.bg, color: opt.color, borderColor: opt.dot + "50" } : {}}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.dot }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)…" rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] resize-none transition" />

          {err && <p className="text-[11px] text-[#DC2626] font-semibold">{err}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !selected}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] ${
                saving || !selected
                  ? "bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] cursor-not-allowed"
                  : "bg-[#2563EB] hover:bg-blue-700 text-white cursor-pointer"
              }`}>
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save &amp; Next</>
              }
            </button>
            <button onClick={onSkip}
              className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
              Skip
            </button>
            <button onClick={onStop}
              className="px-4 py-2.5 rounded-xl border border-[#FEE2E2] dark:border-[#7F1D1D] text-[13px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A] transition">
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DONE SCREEN ───────────────────────────────────────────────────────────────
function DoneScreen({ stats, onRestart }) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl p-10 flex flex-col items-center text-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center text-3xl mb-4">✅</div>
        <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Session complete</h2>
        <p className="text-[13px] text-[#8B92A9] mb-6">
          Called <span className="font-semibold text-[#2563EB]">{stats.called}</span> leads ·{" "}
          <span className="font-semibold text-[#059669]">{stats.updated}</span> updated
        </p>
        <button onClick={onRestart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[13px] font-semibold transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Start new session
        </button>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function UserTwilioPage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [leads,        setLeads]        = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadsError,   setLeadsError]   = useState("");
  const [search,       setSearch]       = useState("");

  // ── loop state ──────────────────────────────────────────────────────────────
  const [step,         setStep]         = useState(STEP.LIST);
  const [queue,        setQueue]        = useState([]);
  const [queueIndex,   setQueueIndex]   = useState(0);
  const [lastCallData, setLastCallData] = useState(null);
  const [stats,        setStats]        = useState({ called: 0, updated: 0 });

  const currentLead = queue[queueIndex] ?? null;

  // ── Fetch leads ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/lead/my-leads")
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setLeads(raw.map(l => ({
          id:       String(l._id),
          name:     l.name   || "Unknown",
          phone:    l.mobile || l.phone || "",
          status:   l.status || "New",
          campaign: l.campaign || "—",
        })));
      })
      .catch(err => {
        setLeadsError(err?.response?.status === 500
          ? "Server error loading leads — please contact your admin."
          : "");
      })
      .finally(() => setLoadingLeads(false));
  }, []);

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.phone.includes(q);
  });

  // ── Loop controls ────────────────────────────────────────────────────────────
  const startSession = useCallback((fromLead) => {
    const rest    = filteredLeads.filter(l => l.id !== fromLead.id);
    const ordered = [fromLead, ...rest];
    setQueue(ordered);
    setQueueIndex(0);
    setStats({ called: 0, updated: 0 });
    setLastCallData(null);
    setStep(STEP.CALL);
  }, [filteredLeads]);

  const advanceToNext = useCallback((nextQueueIndex) => {
    const idx = nextQueueIndex ?? queueIndex + 1;
    if (idx < queue.length) {
      setQueueIndex(idx);
      setLastCallData(null);
      setStep(STEP.CALL);
    } else {
      setStep(STEP.DONE);
    }
  }, [queueIndex, queue.length]);

  const handleCallEnded = useCallback((callInfo) => {
    setLastCallData(callInfo || null);
    setStats(s => ({ ...s, called: s.called + 1 }));
    setStep(STEP.STATUS);
  }, []);

  const handleStatusSaved = useCallback(() => {
    setStats(s => ({ ...s, updated: s.updated + 1 }));
    advanceToNext();
  }, [advanceToNext]);

  const handleSkip    = useCallback(() => advanceToNext(), [advanceToNext]);
  const handleStop    = useCallback(() => setStep(STEP.DONE), []);
  const handleRestart = useCallback(() => {
    setQueue([]); setQueueIndex(0); setLastCallData(null); setStep(STEP.LIST);
  }, []);

  // ── CALLING LOOP VIEW ──────────────────────────────────────────────────────
  if (step !== STEP.LIST) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] p-6">

        {/* Loop header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={handleRestart}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Calling session</h1>
              {step !== STEP.DONE && currentLead && (
                <p className="text-[12px] text-[#8B92A9]">
                  {queueIndex + 1} of {queue.length} · {currentLead.name}
                </p>
              )}
            </div>
          </div>
          {step !== STEP.DONE && <Stepper step={step} />}
        </div>

        {/* Progress bar */}
        {step !== STEP.DONE && queue.length > 0 && (
          <div className="w-full h-1.5 bg-[#E4E7EF] dark:bg-[#262A38] rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
              style={{ width: `${(queueIndex / queue.length) * 100}%` }} />
          </div>
        )}

        {/* ── CALL STEP: auto-dial CallScreen ── */}
        {step === STEP.CALL && currentLead && (
          // key={currentLead.id} forces a fresh mount (and fresh useTwilioCall) for each lead
          <CallScreen
            key={currentLead.id}
            lead={currentLead}
            onCallEnded={handleCallEnded}
            onSkip={handleSkip}
          />
        )}

        {/* ── STATUS STEP ── */}
        {step === STEP.STATUS && currentLead && (
          <StatusScreen
            lead={currentLead}
            callData={lastCallData}
            onSaved={handleStatusSaved}
            onSkip={handleSkip}
            onStop={handleStop}
          />
        )}

        {/* ── DONE ── */}
        {step === STEP.DONE && (
          <DoneScreen stats={stats} onRestart={handleRestart} />
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Calling Centre</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Hi <span className="font-semibold text-[#2563EB]">{user?.name || "Agent"}</span> — pick a lead to start your session
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#059669]">
          <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
          Twilio Ready
        </div>
      </div>

      {/* Backend error */}
      {leadsError && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[12px] font-medium">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          {leadsError}
        </div>
      )}

      {/* Lead list card */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden max-w-2xl">

        {/* Card header */}
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            My Leads
            <span className="ml-2 text-[11px] font-medium text-[#8B92A9]">{leads.length} total</span>
          </h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-36 transition" />
          </div>
        </div>

        {/* Start all button */}
        {filteredLeads.length > 0 && (
          <div className="px-5 py-3 border-b border-[#F0F2FA] dark:border-[#1E2130]">
            <button onClick={() => startSession(filteredLeads[0])}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[13px] font-semibold transition active:scale-[0.98]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/>
              </svg>
              Start Calling All ({filteredLeads.length} leads)
            </button>
          </div>
        )}

        {/* Lead rows */}
        <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130] max-h-[60vh] overflow-y-auto">
          {loadingLeads ? (
            <div className="flex items-center justify-center py-12 text-[#8B92A9] gap-2 text-[12px]">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Loading your leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-[#8B92A9]">
              {leadsError ? "Could not load leads." : "No leads found."}
            </div>
          ) : filteredLeads.map((lead, idx) => (
            <div key={lead.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition group">
              <span className="text-[10px] font-mono text-[#C4C9D9] dark:text-[#3A3F52] w-5 shrink-0 text-right">{idx + 1}</span>
              <div className="w-8 h-8 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{lead.name}</p>
                <p className="text-[11px] text-[#8B92A9] font-mono truncate">{maskPhone(lead.phone)}</p>
              </div>
              {/* Status chip */}
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9] dark:text-[#565C75] shrink-0">
                {lead.status}
              </span>
              {/* Start from this lead */}
              <button onClick={() => startSession(lead)}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11px] font-semibold transition active:scale-[0.97] shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/>
                </svg>
                Call
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}