// src/pages/TeamLead/MyTeam.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Team Lead → "My Team". Only for employees the admin marked as Team Lead.
//   Overview   — per-member stats (calls, conversions, follow-ups, untouched, clock-in)
//   Leads      — every lead of the team, filters, bulk reassign within the team
//   Attendance — who clocked in today / any day
//   Calls      — team call logs
// All data is scoped server-side to the Team Lead's own team (/api/team/*).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../data/axiosConfig";
import useTeamInfo from "../../hooks/useTeamInfo";
import useCustomization from "../../hooks/useCustomization";
import { statusConfigFor, statusDisplayLabel } from "../../utils/statusConfig";
import { Users, Phone, CheckCircle2, CalendarClock, AlertTriangle, Clock, RefreshCw, Loader2, ArrowRightLeft } from "lucide-react";
import RecordingAudio from "../../components/RecordingAudio";

const CARD = "bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl";
const SELECT = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]";
const TH = "text-left text-[11px] font-bold text-[#8B92A9] uppercase tracking-wider px-3 py-2.5 whitespace-nowrap";
const TD = "px-3 py-2.5 text-[13px] text-[#0F1117] dark:text-[#E5E7EB] whitespace-nowrap";

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");
const fmtDur = (s) => { const n = Number(s) || 0; return n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`; };
const todayStr = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

const RANGES = {
  today: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  week:  () => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; },
  month: () => { const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d; },
};

function Stat({ icon, label, value, tone = "blue", onClick }) {
  const tones = {
    blue: "text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]", green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10", red: "text-red-600 bg-red-50 dark:bg-red-500/10",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-500/10",
  };
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`${CARD} p-4 text-left ${onClick ? "hover:border-[#2563EB] transition" : "cursor-default"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-[22px] font-bold text-[#0F1117] dark:text-white tabular-nums leading-none">{value}</p>
      <p className="text-[12px] text-[#8B92A9] mt-1">{label}</p>
    </button>
  );
}

export default function MyTeam() {
  const team = useTeamInfo();
  const cz = useCustomization();
  const [tab, setTab] = useState("overview");
  const [leadView, setLeadView] = useState({ member: "", view: "", status: "", search: "" });

  if (team.loaded && !team.isTeamLead) return <Navigate to="/user/dashboard" replace />;
  if (!cz.isModuleOn("teamLeads")) {
    return <div className="p-6 text-[14px] text-[#8B92A9]">Team Leads are switched off for your company.</div>;
  }

  const openLeads = (patch) => { setLeadView((v) => ({ ...v, ...patch })); setTab("leads"); };

  const tabs = [
    { id: "overview", label: "Overview" },
    cz.can("canViewTeamLeads", "teamLead") && { id: "leads", label: cz.term("leads", "Leads") },
    cz.can("canViewTeamAttendance", "teamLead") && { id: "attendance", label: "Attendance" },
    cz.can("canViewTeamCalls", "teamLead") && { id: "calls", label: "Calls" },
  ].filter(Boolean);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex items-center gap-2"><Users className="w-6 h-6 text-[#2563EB]" /> My Team</h1>
        <p className="text-[13px] text-[#8B92A9]">{team.members.length} member{team.members.length === 1 ? "" : "s"} report to you.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition ${tab === t.id ? "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]" : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] dark:text-[#9DA3BB]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onOpenLeads={openLeads} />}
      {tab === "leads" && (
        <LeadsTab
          members={team.members} initial={leadView} statuses={cz.activeStatuses()}
          canReassign={cz.can("canReassignLeads", "teamLead")}
          canCall={cz.can("canCallTeamLeads", "teamLead")}
          canLog={cz.can("canEditTeamLeads", "teamLead")}
          outcomes={cz.activeOutcomes()}
          remarkRequired={cz.c?.workflows?.leadUpdate?.remarkRequired !== false}
        />
      )}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "calls" && <CallsTab members={team.members} />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ onOpenLeads }) {
  const [range, setRange] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const { data: d } = await api.get("/team/dashboard", { params: { from: RANGES[range]().toISOString(), to: new Date().toISOString() } });
      setData(d);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load team stats.");
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {[["today", "Today"], ["week", "7 days"], ["month", "30 days"]].map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${range === k ? "border-[#2563EB] text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]" : "border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280]"}`}>{l}</button>
        ))}
        <button onClick={load} className="ml-auto p-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280]" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {err && <p className="text-[13px] text-red-500 mb-3">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Stat icon={<Users className="w-[18px] h-[18px]" />} label={`Clocked in (of ${t.members ?? 0})`} value={t.clockedIn ?? "—"} />
        <Stat icon={<Phone className="w-[18px] h-[18px]" />} label="Calls logged" value={t.callsInRange ?? "—"} tone="purple" />
        <Stat icon={<CheckCircle2 className="w-[18px] h-[18px]" />} label="Converted" value={t.convertedInRange ?? "—"} tone="green" />
        <Stat icon={<CalendarClock className="w-[18px] h-[18px]" />} label="Follow-ups today" value={t.followUpsToday ?? "—"} tone="blue" onClick={() => onOpenLeads({ view: "today", member: "" })} />
        <Stat icon={<Clock className="w-[18px] h-[18px]" />} label="Overdue follow-ups" value={t.overdueFollowUps ?? "—"} tone="amber" onClick={() => onOpenLeads({ view: "overdue", member: "" })} />
        <Stat icon={<AlertTriangle className="w-[18px] h-[18px]" />} label="Never called" value={t.untouched ?? "—"} tone="red" onClick={() => onOpenLeads({ view: "untouched", member: "" })} />
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full">
          <thead className="border-b border-[#F1F2F6] dark:border-[#262A38]">
            <tr>
              <th className={TH}>Member</th><th className={TH}>Today</th><th className={TH}>Open leads</th>
              <th className={TH}>New</th><th className={TH}>Calls</th><th className={TH}>Converted</th>
              <th className={TH}>F/U today</th><th className={TH}>Overdue</th><th className={TH}>Never called</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
            {(data?.members || []).map((m) => (
              <tr key={m._id} className="hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                <td className={TD}>
                  <button className="font-semibold hover:text-[#2563EB]" onClick={() => onOpenLeads({ member: String(m._id), view: "" })}>{m.name}{m.isMe ? " (you)" : ""}</button>
                </td>
                <td className={TD}>
                  {m.attendance?.clockedIn
                    ? <span className="text-emerald-600 text-[12px] font-semibold">In {fmtTime(m.attendance.loginTime)}{m.attendance.logoutTime ? ` · out ${fmtTime(m.attendance.logoutTime)}` : ""}</span>
                    : <span className="text-[#8B92A9] text-[12px]">Not clocked in</span>}
                </td>
                <td className={TD}>{m.assignedOpen}</td>
                <td className={TD}>{m.newInRange}</td>
                <td className={TD}>{m.callsInRange}</td>
                <td className={TD}>{m.convertedInRange}</td>
                <td className={TD}>{m.followUpsToday}</td>
                <td className={`${TD} ${m.overdueFollowUps ? "text-amber-600 font-semibold" : ""}`}>{m.overdueFollowUps}</td>
                <td className={`${TD} ${m.untouched ? "text-red-600 font-semibold" : ""}`}>{m.untouched}</td>
              </tr>
            ))}
            {!loading && !(data?.members || []).length && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">No team members yet. Ask your admin to add people to your team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Leads ────────────────────────────────────────────────────────────────────
function LeadsTab({ members, initial, canReassign, canCall, canLog, outcomes, remarkRequired, statuses }) {
  const [logFor, setLogFor] = useState(null);   // lead being logged
  const [calling, setCalling] = useState(null); // lead id being dialled
  const [f, setF] = useState(initial);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      for (const k of ["member", "view", "status", "search"]) if (f[k]) params[k] = f[k];
      const { data } = await api.get("/team/leads", { params });
      setRows(data.leads || []); setTotal(data.total || 0); setPages(data.pages || 1);
    } catch (e) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Could not load leads." });
    } finally {
      setLoading(false);
    }
  }, [f, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSel(new Set()); }, [f, page]);

  const set = (k) => (e) => { setPage(1); setF((v) => ({ ...v, [k]: e.target.value })); };
  const allOn = rows.length > 0 && rows.every((r) => sel.has(String(r._id)));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => String(r._id))));
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const reassign = async () => {
    if (!to || !sel.size) return;
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.post("/team/reassign", { leadIds: [...sel], toUserId: to, reason });
      setMsg({ type: "ok", text: data.message });
      setSel(new Set()); setReason("");
      load();
    } catch (e) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Reassign failed." });
    } finally {
      setBusy(false);
    }
  };

  // Call: fetch the real number for this one call (lists stay masked), dial,
  // then open the "log this call" form.
  const startCall = async (l) => {
    setCalling(String(l._id)); setMsg(null);
    try {
      const { data } = await api.post(`/team/leads/${l._id}/call`);
      window.location.href = `tel:${String(data.phone).replace(/[^\d+]/g, "")}`;
      if (canLog) setTimeout(() => setLogFor({ ...l, phone: data.phone }), 600);
    } catch (e) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Could not start the call." });
    } finally {
      setCalling(null);
    }
  };

  const people = useMemo(() => [{ _id: "__me", name: "Me" }, ...members], [members]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={f.member} onChange={set("member")} className={SELECT}>
          <option value="">Whole team</option>
          {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <select value={f.view} onChange={set("view")} className={SELECT}>
          <option value="">All open leads</option>
          <option value="today">Follow-ups today</option>
          <option value="overdue">Overdue follow-ups</option>
          <option value="untouched">Never called</option>
        </select>
        <select value={f.status} onChange={set("status")} className={SELECT}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input value={f.search} onChange={set("search")} placeholder="Search name / phone / campaign" className={`${SELECT} flex-1 min-w-[180px]`} />
      </div>

      {msg && <div className={`mb-3 px-4 py-2 rounded-xl text-[13px] ${msg.type === "ok" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700" : "bg-red-50 dark:bg-red-500/10 text-red-600"}`}>{msg.text}</div>}

      {canReassign && sel.size > 0 && (
        <div className={`${CARD} p-3 mb-3 flex flex-col md:flex-row md:items-center gap-2`}>
          <span className="text-[13px] font-semibold text-[#0F1117] dark:text-white flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-[#2563EB]" /> Move {sel.size} lead{sel.size === 1 ? "" : "s"} to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={SELECT}>
            <option value="">— Team member —</option>
            {people.filter((p) => p._id !== "__me").map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${SELECT} flex-1`} />
          <button onClick={reassign} disabled={!to || busy} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Reassign
          </button>
        </div>
      )}

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full">
          <thead className="border-b border-[#F1F2F6] dark:border-[#262A38]">
            <tr>
              {canReassign && <th className={TH}><input type="checkbox" checked={allOn} onChange={toggleAll} className="accent-[#2563EB]" /></th>}
              <th className={TH}>Lead</th><th className={TH}>Phone</th><th className={TH}>Status</th><th className={TH}>Owner</th>
              <th className={TH}>Follow-up</th><th className={TH}>Last call</th><th className={TH}>Updated</th>
              {(canCall || canLog) && <th className={TH}></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
            {rows.map((l) => {
              const sc = statusConfigFor(l.status);
              const last = Array.isArray(l.callHistory) ? l.callHistory[l.callHistory.length - 1] : null;
              const overdue = l.followUpDate && new Date(l.followUpDate) < new Date();
              return (
                <tr key={l._id} className="hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                  {canReassign && <td className={TD}><input type="checkbox" checked={sel.has(String(l._id))} onChange={() => toggle(String(l._id))} className="accent-[#2563EB]" /></td>}
                  <td className={TD}><p className="font-semibold">{l.name}</p><p className="text-[11px] text-[#8B92A9]">{l.campaign || l.source || ""}</p></td>
                  <td className={TD}>{l.mobile || "—"}</td>
                  <td className={TD}><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc?.bg || ""} ${sc?.text || ""}`}>{statusDisplayLabel(l.status)}</span></td>
                  <td className={TD}>{l.user?.name || "—"}</td>
                  <td className={`${TD} ${overdue ? "text-amber-600 font-semibold" : ""}`}>{fmtDate(l.followUpDate)}</td>
                  <td className={TD} title={last?.remark || ""}>{last ? `${fmtDate(last.calledAt)} · ${last.outcome || "call"}` : <span className="text-red-500 text-[12px] font-semibold">Never</span>}</td>
                  <td className={TD}>{fmtDate(l.updatedAt)}</td>
                  {(canCall || canLog) && (
                    <td className={TD}>
                      <div className="flex gap-1.5">
                        {canCall && (
                          <button onClick={() => startCall(l)} disabled={calling === String(l._id)} title="Call this lead"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-60">
                            {calling === String(l._id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />} Call
                          </button>
                        )}
                        {canLog && (
                          <button onClick={() => setLogFor(l)} title="Log a call / follow-up"
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB]">
                            Log
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">No leads match.</td></tr>}
            {loading && <tr><td colSpan={9} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-[12px] text-[#8B92A9]">
        <span>{total} lead{total === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40">Prev</button>
          <span className="px-2 py-1.5">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40">Next</button>
        </div>
      </div>
      {logFor && (
        <LogCallModal
          lead={logFor} outcomes={outcomes} remarkRequired={remarkRequired}
          onClose={() => setLogFor(null)}
          onSaved={(text) => { setLogFor(null); setMsg({ type: "ok", text }); load(); }}
        />
      )}
    </>
  );
}

// ── Log a call on a team member's lead ───────────────────────────────────────
function LogCallModal({ lead, outcomes, remarkRequired, onClose, onSaved }) {
  const [outcome, setOutcome] = useState("");
  const [remark, setRemark] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (remarkRequired && !remark.trim()) { setErr("Please add a remark."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post(`/team/leads/${lead._id}/log-call`, {
        outcome: outcome || undefined, remark, followUpDate: followUp ? new Date(followUp).toISOString() : undefined,
      });
      onSaved(data.message || "Call logged.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${CARD} w-full max-w-md p-5`} onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-bold text-[#0F1117] dark:text-white">Log call — {lead.name}</p>
        <p className="text-[12px] text-[#8B92A9] mb-4">Owner: {lead.user?.name || "—"}{lead.phone ? ` · ${lead.phone}` : ""}. Lead stays with its owner.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${SELECT} w-full`}>
              <option value="">— Select —</option>
              {outcomes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Remark{remarkRequired && <span className="text-red-500"> *</span>}</label>
            <textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} className={`${SELECT} w-full resize-y`} placeholder="What happened on the call?" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Next follow-up (optional)</label>
            <input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={`${SELECT} w-full`} />
          </div>
          {err && <p className="text-[12px] text-red-500">{err}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Cancel</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Attendance ───────────────────────────────────────────────────────────────
function AttendanceTab() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    setLoading(true); setErr("");
    api.get("/team/attendance", { params: { date } })
      .then(({ data }) => { if (!off) setRows(data.rows || []); })
      .catch((e) => { if (!off) setErr(e?.response?.data?.message || "Could not load attendance."); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [date]);

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={SELECT} />
        <span className="text-[12px] text-[#8B92A9]">{rows.filter((r) => r.clockedIn).length} of {rows.length} clocked in</span>
      </div>
      {err && <p className="text-[13px] text-red-500 mb-3">{err}</p>}
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full">
          <thead className="border-b border-[#F1F2F6] dark:border-[#262A38]">
            <tr><th className={TH}>Member</th><th className={TH}>Status</th><th className={TH}>In</th><th className={TH}>Out</th><th className={TH}>Now</th><th className={TH}>Breaks</th><th className={TH}>Remarks</th></tr>
          </thead>
          <tbody className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
            {rows.map((r) => (
              <tr key={r._id}>
                <td className={TD}><p className="font-semibold">{r.name}</p><p className="text-[11px] text-[#8B92A9]">{r.email}</p></td>
                <td className={TD}><span className={`text-[12px] font-semibold capitalize ${r.clockedIn ? "text-emerald-600" : "text-red-500"}`}>{String(r.attendanceStatus || "").replace("_", " ")}</span></td>
                <td className={TD}>{fmtTime(r.loginTime)}</td>
                <td className={TD}>{fmtTime(r.logoutTime)}</td>
                <td className={TD}>{r.liveStatus ? String(r.liveStatus).replace("_", " ") : "—"}</td>
                <td className={TD}>{r.breaks}</td>
                <td className={`${TD} max-w-[240px] truncate`}>{r.remarks || "—"}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">No team members.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Calls ────────────────────────────────────────────────────────────────────
function CallsTab({ members }) {
  const [member, setMember] = useState("");
  const [range, setRange] = useState("today");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    setLoading(true); setErr("");
    const params = { page, limit: 50, from: RANGES[range]().toISOString(), to: new Date().toISOString() };
    if (member) params.member = member;
    api.get("/team/calls", { params })
      .then(({ data }) => { if (!off) { setRows(data.calls || []); setTotal(data.total || 0); setPages(data.pages || 1); } })
      .catch((e) => { if (!off) setErr(e?.response?.data?.message || "Could not load calls."); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [member, range, page]);

  const typeTone = { outgoing: "text-[#2563EB]", incoming: "text-emerald-600", missed: "text-red-500", rejected: "text-red-500" };
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={member} onChange={(e) => { setPage(1); setMember(e.target.value); }} className={SELECT}>
          <option value="">Whole team</option>
          {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <select value={range} onChange={(e) => { setPage(1); setRange(e.target.value); }} className={SELECT}>
          <option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option>
        </select>
        <span className="self-center text-[12px] text-[#8B92A9]">{total} call{total === 1 ? "" : "s"}</span>
      </div>
      {err && <p className="text-[13px] text-red-500 mb-3">{err}</p>}
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full">
          <thead className="border-b border-[#F1F2F6] dark:border-[#262A38]">
            <tr><th className={TH}>When</th><th className={TH}>Member</th><th className={TH}>Number</th><th className={TH}>Type</th><th className={TH}>Duration</th><th className={TH}>Recording</th></tr>
          </thead>
          <tbody className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
            {rows.map((c) => {
              const rec = Array.isArray(c.recordings) ? c.recordings[0] : null;
              return (
                <tr key={c._id}>
                  <td className={TD}>{fmtDate(c.timestamp)} {fmtTime(c.timestamp)}</td>
                  <td className={TD}>{c.user?.name || "—"}</td>
                  <td className={TD}>{c.name ? `${c.name} · ` : ""}{c.phoneNumber}</td>
                  <td className={`${TD} capitalize font-semibold ${typeTone[c.callType] || ""}`}>{c.callType}</td>
                  <td className={TD}>{fmtDur(c.duration)}</td>
                  <td className={TD}>{rec?.url ? <RecordingAudio src={rec.url} className="h-8 max-w-[220px]" /> : "—"}</td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">No calls in this period.</td></tr>}
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-[13px] text-[#8B92A9]">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 mt-3 text-[12px] text-[#8B92A9]">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40">Prev</button>
        <span className="px-2 py-1.5">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40">Next</button>
      </div>
    </>
  );
}
