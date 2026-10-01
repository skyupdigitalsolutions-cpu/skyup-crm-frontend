// src/pages/Admin/TeamsManager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin → Teams. Promote employees to Team Lead and decide who reports to whom.
//
//   Admin → Team Lead → Employees
//
// A Team Lead is still an employee (same login, mobile app, attendance) who
// additionally gets the "My Team" pages for their own members.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../data/axiosConfig";
import { Users, UserPlus, Crown, X, Loader2, RefreshCw } from "lucide-react";

const CARD = "bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5";
const SELECT = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]";
const BTN = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition disabled:opacity-50";

export default function TeamsManager() {
  const [data, setData] = useState({ teams: [], unassigned: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [promoteId, setPromoteId] = useState("");
  const [addPick, setAddPick] = useState({}); // tlId → userId

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get("/team/admin/overview");
      setData({ teams: d.teams || [], unassigned: d.unassigned || [] });
    } catch (e) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Could not load teams." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("team_updated", h);
    return () => window.removeEventListener("team_updated", h);
  }, [load]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMsg({ type: "ok", text: r?.data?.message || okText });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e?.response?.data?.message || "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  const promote = () => promoteId && run(() => api.put(`/team/admin/users/${promoteId}/role`, { isTeamLead: true }), "Team Lead added.").then(() => setPromoteId(""));
  const demote = (tl) => {
    if (!window.confirm(`Remove Team Lead role from ${tl.name}? Their members will report to you directly.`)) return;
    run(() => api.put(`/team/admin/users/${tl._id}/role`, { isTeamLead: false }), "Team Lead removed.");
  };
  const addMember = (tlId) => {
    const uid = addPick[tlId];
    if (!uid) return;
    run(() => api.put(`/team/admin/users/${uid}/team-lead`, { teamLeadId: tlId }), "Member added.")
      .then(() => setAddPick((p) => ({ ...p, [tlId]: "" })));
  };
  const removeMember = (uid) => run(() => api.put(`/team/admin/users/${uid}/team-lead`, { teamLeadId: null }), "Member removed.");
  const moveTo = (uid, tlId) => run(() => api.put(`/team/admin/users/${uid}/team-lead`, { teamLeadId: tlId || null }), "Updated.");

  // Anyone who isn't a Team Lead can be promoted (members included).
  const promotable = useMemo(() => {
    const members = data.teams.flatMap((t) => t.members);
    return [...data.unassigned, ...members].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return (
    <div className="p-4 sm:p-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex items-center gap-2"><Users className="w-6 h-6 text-[#2563EB]" /> Teams</h1>
          <p className="text-[13px] text-[#8B92A9] max-w-2xl">
            Make an employee a <strong>Team Lead</strong> and choose who reports to them. Team Leads keep working their own leads and also get a
            <strong> My Team</strong> page to monitor, reassign and follow up on their members.
          </p>
        </div>
        <button onClick={load} disabled={loading} className={`${BTN} border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]`}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-[13px] font-medium ${msg.type === "ok" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {msg.text}
        </div>
      )}

      <div className={`${CARD} mb-5`}>
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-white mb-2 flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-500" /> Add a Team Lead</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={promoteId} onChange={(e) => setPromoteId(e.target.value)} className={`${SELECT} sm:w-[360px]`} disabled={busy || loading}>
            <option value="">— Choose an employee —</option>
            {promotable.map((u) => <option key={u._id} value={u._id}>{u.name}{u.email ? ` (${u.email})` : ""}</option>)}
          </select>
          <button onClick={promote} disabled={!promoteId || busy} className={`${BTN} bg-[#2563EB] text-white hover:bg-[#1D4ED8]`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Make Team Lead
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#8B92A9]">Loading teams…</p>
      ) : (
        <>
          {data.teams.length === 0 && (
            <div className={`${CARD} mb-5 text-[13px] text-[#8B92A9]`}>No Team Leads yet. Pick an employee above to create the first team.</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {data.teams.map(({ teamLead: tl, members }) => (
              <div key={tl._id} className={CARD}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[#0F1117] dark:text-white truncate flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-500 shrink-0" /> {tl.name}</p>
                    <p className="text-[12px] text-[#8B92A9] truncate">{tl.email} · {members.length} member{members.length === 1 ? "" : "s"}</p>
                  </div>
                  <button onClick={() => demote(tl)} disabled={busy} className="text-[12px] font-semibold text-red-500 hover:text-red-600 shrink-0">Remove role</button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {members.length === 0 && <span className="text-[12px] text-[#8B92A9]">No members yet.</span>}
                  {members.map((m) => (
                    <span key={m._id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                      {m.name}
                      <button onClick={() => removeMember(m._id)} disabled={busy} title="Remove from team" className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-white/10"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select value={addPick[tl._id] || ""} onChange={(e) => setAddPick((p) => ({ ...p, [tl._id]: e.target.value }))} className={`${SELECT} flex-1 min-w-0`} disabled={busy}>
                    <option value="">+ Add member…</option>
                    {data.unassigned.length > 0 && (
                      <optgroup label="Not in a team">
                        {data.unassigned.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </optgroup>
                    )}
                    {data.teams.filter((t) => t.teamLead._id !== tl._id && t.members.length).map((t) => (
                      <optgroup key={t.teamLead._id} label={`Move from ${t.teamLead.name}'s team`}>
                        {t.members.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => addMember(tl._id)} disabled={!addPick[tl._id] || busy} className={`${BTN} bg-[#2563EB] text-white hover:bg-[#1D4ED8]`}>Add</button>
                </div>
              </div>
            ))}
          </div>

          <div className={CARD}>
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-white mb-1">Not in any team ({data.unassigned.length})</p>
            <p className="text-[12px] text-[#8B92A9] mb-3">These employees report to the admin directly.</p>
            {data.unassigned.length === 0 ? (
              <p className="text-[12px] text-[#8B92A9]">Everyone is in a team.</p>
            ) : (
              <div className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
                {data.unassigned.map((u) => (
                  <div key={u._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F1117] dark:text-white truncate">{u.name}</p>
                      <p className="text-[12px] text-[#8B92A9] truncate">{u.email}</p>
                    </div>
                    <select value="" onChange={(e) => e.target.value && moveTo(u._id, e.target.value)} disabled={busy || data.teams.length === 0} className={`${SELECT} sm:w-[240px]`}>
                      <option value="">{data.teams.length ? "Assign to team…" : "Create a Team Lead first"}</option>
                      {data.teams.map((t) => <option key={t.teamLead._id} value={t.teamLead._id}>{t.teamLead.name}'s team</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
