// pages/UserTwilioPage.jsx
// Flow: List → Call Screen (auto-dial) → Status Update → back to List

import { useState, useEffect, useRef } from "react";
import api from "../data/axiosConfig";
import { useTwilioCall } from "../hooks/useTwilioCall";
import { maskPhone } from "../utils/maskPhone";

// ── STEP CONSTANTS ────────────────────────────────────────────────────────────
const STEP = { LIST: "list", CALL: "call", STATUS: "status" };

// ── Disposition options ───────────────────────────────────────────────────────
const DISPOSITIONS = [
  { value: "Interested",     label: "Interested",     color: "#059669", bg: "#ECFDF5", dot: "#059669" },
  { value: "Callback",       label: "Callback",       color: "#2563EB", bg: "#EEF3FF", dot: "#2563EB" },
  { value: "Not Interested", label: "Not Interested", color: "#DC2626", bg: "#FEF2F2", dot: "#DC2626" },
  { value: "No Answer",      label: "No Answer",      color: "#D97706", bg: "#FFFBEB", dot: "#D97706" },
  { value: "Wrong Number",   label: "Wrong Number",   color: "#7C3AED", bg: "#F5F3FF", dot: "#7C3AED" },
  { value: "Follow Up",      label: "Follow Up",      color: "#0891B2", bg: "#ECFEFF", dot: "#0891B2" },
];

// ── CALL SCREEN ───────────────────────────────────────────────────────────────
function CallScreen({ lead, onCallEnded, onCancel }) {
  const { callStatus, makeCall, hangUp, mute, error } = useTwilioCall("crm_user");
  const [isMuted,  setIsMuted]  = useState(false);
  const [seconds,  setSeconds]  = useState(0);
  const timerRef  = useRef(null);
  const calledRef = useRef(false);

  // Auto-dial on mount
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    const t = setTimeout(() => makeCall(lead.phone, lead.id), 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer while active
  useEffect(() => {
    if (callStatus === "active") {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // When call ends → move to status update
  useEffect(() => {
    if (callStatus === "ended") {
      onCallEnded({ duration: seconds });
    }
  }, [callStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtTimer = s =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleHangUp = () => hangUp(); // onCallEnded fires via useEffect
  const handleMute   = () => { mute(!isMuted); setIsMuted(p => !p); };

  const isConnecting = callStatus === "idle" || callStatus === "connecting";
  const isActive     = callStatus === "active";

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl overflow-hidden shadow-xl">

        {/* Contact + status */}
        <div
          className="flex flex-col items-center pt-10 pb-6 px-6 gap-4"
          style={{ background: "linear-gradient(to bottom, #EEF3FF, #fff)" }}
        >
          <div className="w-20 h-20 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[28px] font-black shadow-lg">
            {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{lead.name}</p>
            <p className="text-[13px] text-[#8B92A9] font-mono mt-0.5">{maskPhone(lead.phone)}</p>
          </div>

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
              <button
                onClick={handleMute}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-semibold transition ${
                  isMuted
                    ? "bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]"
                    : "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isMuted
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  }
                </svg>
                {isMuted ? "Unmute" : "Mute"}
              </button>

              <button
                onClick={handleHangUp}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#DC2626] hover:bg-red-700 text-white text-[13px] font-semibold transition active:scale-[0.97]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                </svg>
                Hang Up
              </button>
            </div>
          )}

          {/* Cancel — returns to list without logging status */}
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel — back to list
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATUS UPDATE SCREEN ──────────────────────────────────────────────────────
// ── Helper: get tomorrow's date string for min/default in date input ──────────
function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function StatusScreen({ lead, callData, onSaved, onSkip }) {
  const [selected,    setSelected]    = useState("");
  const [note,        setNote]        = useState("");
  const [followUpDate, setFollowUpDate] = useState(getTomorrowStr());
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  const showDatePicker = selected && selected !== "Not Interested";

  const handleSave = async () => {
    if (!selected) { setErr("Please choose an outcome."); return; }
    setSaving(true); setErr("");
    try {
      const body = { status: selected, remark: note.trim() || undefined };
      // Attach follow-up date for all statuses except Not Interested
      if (selected !== "Not Interested") {
        body.followUpDate = followUpDate || getTomorrowStr();
      }
      await api.patch(`/lead/${lead.id}`, body);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed — try again.");
    } finally {
      setSaving(false);
    }
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
                <button
                  key={opt.value}
                  onClick={() => { setSelected(opt.value); setErr(""); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition active:scale-[0.97] ${
                    selected === opt.value
                      ? "shadow-sm border-transparent"
                      : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#4B5168] dark:text-[#9DA3BB]"
                  }`}
                  style={selected === opt.value ? { background: opt.bg, color: opt.color, borderColor: opt.dot + "50" } : {}}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.dot }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] resize-none transition"
          />

          {/* Follow-up date — shown for all statuses except Not Interested */}
          {showDatePicker && (
            <div>
              <label className="block text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1.5">
                📅 Follow-up Date
              </label>
              <input
                type="date"
                value={followUpDate}
                min={getTodayStr()}
                onChange={e => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition"
              />
              <p className="text-[10px] text-[#8B92A9] mt-1">
                Leave blank or choose tomorrow+ — past dates are not allowed.
              </p>
            </div>
          )}

          {err && <p className="text-[11px] text-[#DC2626] font-semibold">{err}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !selected}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] ${
                saving || !selected
                  ? "bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] cursor-not-allowed"
                  : "bg-[#2563EB] hover:bg-blue-700 text-white cursor-pointer"
              }`}
            >
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save &amp; back to list</>
              }
            </button>

            {/* Skip without saving — just go back */}
            <button
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
            >
              Skip
            </button>
          </div>
        </div>
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

  const [step,         setStep]         = useState(STEP.LIST);
  const [activeLead,   setActiveLead]   = useState(null);
  const [lastCallData, setLastCallData] = useState(null);

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
        setLeadsError(
          err?.response?.status === 500
            ? "Server error loading leads — please contact your admin."
            : ""
        );
      })
      .finally(() => setLoadingLeads(false));
  }, []);

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.phone.includes(q);
  });

  // ── Start a call ────────────────────────────────────────────────────────────
  const startCall = (lead) => {
    setActiveLead(lead);
    setLastCallData(null);
    setStep(STEP.CALL);
  };

  // ── Call ended (hang up / disconnect / no-answer) → show status screen ──────
  const handleCallEnded = (callInfo) => {
    setLastCallData(callInfo || null);
    setStep(STEP.STATUS);
  };

  // ── Status saved → back to list, update local status optimistically ─────────
  const handleSaved = () => {
    // Refresh leads list from server so status chip is accurate
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
      .catch(() => {/* silent — stale list is fine */});
    backToList();
  };

  const backToList = () => {
    setStep(STEP.LIST);
    setActiveLead(null);
    setLastCallData(null);
  };

  // ── CALL / STATUS VIEWS ──────────────────────────────────────────────────────
  if (step !== STEP.LIST) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={backToList}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {step === STEP.CALL ? "Calling" : "Update outcome"}
            </h1>
            {activeLead && (
              <p className="text-[12px] text-[#8B92A9]">{activeLead.name}</p>
            )}
          </div>
        </div>

        {step === STEP.CALL && activeLead && (
          <CallScreen
            key={activeLead.id}
            lead={activeLead}
            onCallEnded={handleCallEnded}
            onCancel={backToList}
          />
        )}

        {step === STEP.STATUS && activeLead && (
          <StatusScreen
            lead={activeLead}
            callData={lastCallData}
            onSaved={handleSaved}
            onSkip={backToList}
          />
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
            Hi <span className="font-semibold text-[#2563EB]">{user?.name || "Agent"}</span> — pick a lead to call
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
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-36 transition"
            />
          </div>
        </div>

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
            <div
              key={lead.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition group"
            >
              <span className="text-[10px] font-mono text-[#C4C9D9] dark:text-[#3A3F52] w-5 shrink-0 text-right">
                {idx + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{lead.name}</p>
                <p className="text-[11px] text-[#8B92A9] font-mono truncate">{maskPhone(lead.phone)}</p>
              </div>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9] dark:text-[#565C75] shrink-0">
                {lead.status}
              </span>
              <button
                onClick={() => startCall(lead)}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11px] font-semibold transition active:scale-[0.97] shrink-0"
              >
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