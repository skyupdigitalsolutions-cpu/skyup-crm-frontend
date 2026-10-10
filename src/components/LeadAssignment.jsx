// src/components/LeadAssignment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lead assignment UI:
//   • ImportAssignmentChooser — Automatic (round robin) vs Manual (pick admins)
//     shown in the CSV import window.
//   • UnassignedLeadsModal    — leads with no employee; tick and assign.
//     Pool leads are shared: the first admin to assign one takes it.
//   • AssignmentSettingsModal — super admin: default for imports (Leads page).
//   • AdminGroupsModal        — super admin: admin groups (User Management).
// Backend: /api/lead/assignment/* (controllers/leadAssignmentController.js)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Check, Users, UserPlus, Trash2, Plus, Pencil, RefreshCw, AlertTriangle, Inbox, Search, Loader2 } from "lucide-react";
import api from "../data/axiosConfig";

const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

export const AUTO_LABELS = {
  round_robin:  "Round robin",
  least_loaded: "Least loaded",
  unassigned:   "Leave unassigned",
};

// ── Options loader (shared) ──────────────────────────────────────────────────
export function useAssignmentOptions() {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api.get("/lead/assignment/options")
      .then((r) => setOptions(r.data))
      .catch((e) => setError(errMsg(e, "Couldn't load assignment options.")));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { options, error, reload: load };
}

function Checkbox({ checked, onChange, label, sub }) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 accent-[#7C3AED] shrink-0" />
      <span className="min-w-0">
        <span className="block text-[14px] text-[#0F1117] dark:text-[#F0F2FA] truncate">{label}</span>
        {sub && <span className="block text-[12px] text-[#8B92A9] truncate">{sub}</span>}
      </span>
    </label>
  );
}

// ── Import: Automatic vs Manual ──────────────────────────────────────────────
// value: { mode: "auto" | "manual", admins: string[] }
export function ImportAssignmentChooser({ options, error, value, onChange }) {
  if (error) return <p className="text-[13px] text-red-600 mb-4">{error}</p>;
  if (!options) return <p className="text-[13px] text-[#8B92A9] mb-4">Loading assignment options…</p>;

  const def = options.importStrategy || "round_robin";
  const autoLabel = AUTO_LABELS[def === "manual" ? "round_robin" : def] || "Round robin";
  const admins = options.admins || [];
  const groups = options.groups || [];
  const picked = new Set(value.admins);

  const toggleAdmin = (id) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...value, admins: [...next] });
  };
  const toggleGroup = (g) => {
    const ids = (g.admins || []).map(String);
    const allIn = ids.every((id) => picked.has(id));
    const next = new Set(picked);
    ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
    onChange({ ...value, admins: [...next] });
  };

  const modeBtn = (mode, title, sub) => (
    <button
      type="button"
      onClick={() => onChange({ ...value, mode })}
      className={`flex-1 text-left px-3 py-2.5 rounded-xl border transition ${
        value.mode === mode
          ? "border-[#7C3AED] bg-purple-50 dark:bg-purple-950/30"
          : "border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
        {value.mode === mode && <Check className="w-3.5 h-3.5 text-[#7C3AED]" />} {title}
      </span>
      <span className="block text-[12px] text-[#8B92A9] mt-0.5">{sub}</span>
    </button>
  );

  return (
    <div className="mb-5">
      <p className="text-[13px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Assign imported leads</p>
      <div className="flex gap-2">
        {modeBtn("auto", `Automatic (${autoLabel})`, "Shared out to employees now")}
        {modeBtn("manual", "Manual: choose admins", "Admins assign them later")}
      </div>

      {value.mode === "manual" && (
        <div className="mt-3 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-2">
          <p className="px-3 pt-1 pb-2 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
            Leads arrive <b>unassigned</b>. Every ticked admin sees them, and the first to assign a lead to an employee takes it.
          </p>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {groups.map((g) => {
                const allIn = (g.admins || []).every((id) => picked.has(String(id)));
                return (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold border transition ${
                      allIn ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]"
                    }`}
                  >
                    <Users className="w-3 h-3" /> {g.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="max-h-44 overflow-y-auto">
            {admins.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-[#8B92A9]">No admins found. Create admins first.</p>
            ) : admins.map((a) => (
              <Checkbox key={a._id} checked={picked.has(String(a._id))} onChange={() => toggleAdmin(String(a._id))} label={a.name} sub={a.email} />
            ))}
          </div>
          <p className="px-3 pt-1 text-[12px] text-[#8B92A9]">{picked.size} admin{picked.size === 1 ? "" : "s"} selected</p>
        </div>
      )}
    </div>
  );
}


// ── Bulk assign: pick ONE employee → every selected lead goes to them ───────
// Used by the Leads page bulk bar and the Unassigned window. Clicking an
// employee assigns immediately (in chunks of 1,000 — the API limit).
export async function bulkAssignLeads(leadIds, userId) {
  const ids = [...new Set((leadIds || []).map(String))];
  let claimed = 0, skipped = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const { data } = await api.post("/lead/assignment/claim", { leadIds: ids.slice(i, i + 1000), userId });
    claimed += data.claimed || 0;
    skipped += data.skipped || 0;
  }
  return { claimed, skipped };
}

export function EmployeePickerModal({ leadIds, onClose, onDone }) {
  const { options, error } = useAssignmentOptions();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const count = (leadIds || []).length;

  const employees = useMemo(() => {
    const list = options?.employees || [];
    const t = q.trim().toLowerCase();
    return t ? list.filter((u) => `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(t)) : list;
  }, [options, q]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !busyId) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, busyId]);

  const pick = async (u) => {
    if (busyId) return;
    setBusyId(u._id); setErr("");
    try {
      const r = await bulkAssignLeads(leadIds, u._id);
      onDone?.({ ...r, employee: u });
    } catch (e) {
      setErr(errMsg(e, "Couldn't assign. Please try again."));
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !busyId && onClose()}>
      <div role="dialog" aria-label="Assign leads to an employee" onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Assign {count} lead{count === 1 ? "" : "s"}</h2>
            <p className="text-[13px] text-[#8B92A9]">Click an employee — all selected leads go to them.</p>
          </div>
          <button onClick={onClose} disabled={!!busyId} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-3">
          <label className="relative block">
            <Search className="w-4 h-4 text-[#8B92A9] absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#7C3AED]" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[120px]">
          {error && <p className="px-2 text-[13px] text-red-600">{error}</p>}
          {!options && !error && <p className="px-2 text-[13px] text-[#8B92A9]">Loading employees…</p>}
          {options && employees.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-[#8B92A9]">No employees match.</p>}
          <ul>
            {employees.map((u) => (
              <li key={u._id}>
                <button onClick={() => pick(u)} disabled={!!busyId}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-[#F5F3FF] dark:hover:bg-[#1E1B2E] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]">
                  <span className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#2A2340] text-[#6D28D9] dark:text-[#C4B5FD] text-[13px] font-bold flex items-center justify-center shrink-0">
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{u.name}</span>
                    {u.email && <span className="block text-[12px] text-[#8B92A9] truncate">{u.email}</span>}
                  </span>
                  {busyId === u._id ? <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" /> : <UserPlus className="w-4 h-4 text-[#8B92A9]" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {err && <p className="px-5 pb-4 text-[13px] text-red-600">{err}</p>}
      </div>
    </div>
  );
}

// ── Unassigned leads: tick and assign ────────────────────────────────────────
export function UnassignedLeadsModal({ onClose, onAssigned }) {
  const [leads, setLeads]     = useState(null);
  const [total, setTotal]     = useState(0);
  const [loadErr, setLoadErr] = useState("");
  const [picked, setPicked]   = useState(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice]   = useState("");
  const [query, setQuery]     = useState("");

  const load = useCallback(() => {
    setLoadErr("");
    api.get("/lead/assignment/unassigned")
      .then((r) => { setLeads(r.data.leads || []); setTotal(r.data.total || 0); setPicked(new Set()); })
      .catch((e) => setLoadErr(errMsg(e, "Couldn't load unassigned leads.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!leads) return [];
    return q ? leads.filter((l) => `${l.name} ${l.phone} ${l.source}`.toLowerCase().includes(q)) : leads;
  }, [leads, query]);

  const allShownPicked = shown.length > 0 && shown.every((l) => picked.has(String(l._id)));
  const toggleAll = () => {
    const next = new Set(picked);
    shown.forEach((l) => (allShownPicked ? next.delete(String(l._id)) : next.add(String(l._id))));
    setPicked(next);
  };
  const toggle = (id) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const afterAssign = ({ claimed, skipped, employee }) => {
    setPickerOpen(false);
    setNotice(skipped
      ? `${claimed} assigned to ${employee.name}. ${skipped} were already taken by someone else.`
      : `${claimed} lead${claimed === 1 ? "" : "s"} assigned to ${employee.name}.`);
    load();
    onAssigned?.();
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Unassigned leads</h2>
            <p className="text-[13px] text-[#8B92A9]">
              {leads ? `${total} lead${total === 1 ? "" : "s"} waiting for an employee` : "Loading…"}
              {total > 1000 ? " (showing the newest 1,000)" : ""}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-3 flex flex-col sm:flex-row gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone or source"
            className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#7C3AED]"
          />
          <button onClick={load} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 min-h-[160px]">
          {loadErr ? (
            <p className="flex items-center gap-2 text-[14px] text-red-600"><AlertTriangle className="w-4 h-4" /> {loadErr}</p>
          ) : !leads ? (
            <p className="text-[14px] text-[#8B92A9]">Loading…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="w-8 h-8 text-[#C4C9DA] mb-2" />
              <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Nothing to assign</p>
              <p className="text-[13px] text-[#8B92A9]">Every lead you can see already has an employee.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              <label className="flex items-center gap-3 px-3 py-2 bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] font-semibold text-[#8B92A9] uppercase tracking-wider cursor-pointer">
                <input type="checkbox" checked={allShownPicked} onChange={toggleAll} className="w-4 h-4 accent-[#7C3AED]" />
                Select all ({shown.length})
              </label>
              <ul className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {shown.map((l) => (
                  <li key={l._id}>
                    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAFBFD] dark:hover:bg-[#151821]">
                      <input type="checkbox" checked={picked.has(String(l._id))} onChange={() => toggle(String(l._id))} className="w-4 h-4 accent-[#7C3AED] shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{l.name}</span>
                        <span className="block text-[12px] text-[#8B92A9] truncate">
                          {[l.phone, l.source, fmt(l.createdAt)].filter(Boolean).join("  ·  ")}
                        </span>
                      </span>
                      {l.poolAdmins.length > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#7C3AED] bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full max-w-[40%] truncate" title={`Offered to: ${l.poolAdmins.join(", ")}`}>
                          <Users className="w-3 h-3 shrink-0" /> {l.poolAdmins.join(", ")}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#F0F2FA] dark:border-[#1E2130] space-y-2">
          {notice && <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB]">{notice}</p>}
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!picked.size}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[14px] font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <UserPlus className="w-4 h-4" /> {picked.size ? `Assign ${picked.size} lead${picked.size === 1 ? "" : "s"}` : "Select leads to assign"}
          </button>
        </div>
      </div>
      {pickerOpen && <EmployeePickerModal leadIds={[...picked]} onClose={() => setPickerOpen(false)} onDone={afterAssign} />}
    </div>
  );
}

// ── Shared modal frame ──────────────────────────────────────────────────────
function ModalFrame({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</h2>
            {subtitle && <p className="text-[13px] text-[#8B92A9] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ── Super admin: lead assignment default (Leads page) ───────────────────────
export function AssignmentSettingsModal({ onClose }) {
  const { options, reload } = useAssignmentOptions();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const saveMode = async (mode) => {
    setSaving(true); setErr(""); setMsg("");
    try {
      await api.put("/lead/assignment/settings", { importStrategy: mode });
      setMsg("Default saved.");
      reload();
    } catch (e) { setErr(errMsg(e, "Couldn't save the default.")); }
    finally { setSaving(false); }
  };

  const saveAutoLead = async (value) => {
    setSaving(true); setErr(""); setMsg("");
    try {
      await api.put("/lead/assignment/settings", { whatsappAutoLead: value });
      setMsg("Saved.");
      reload();
    } catch (e) { setErr(errMsg(e, "Couldn't save the setting.")); }
    finally { setSaving(false); }
  };

  const current = options?.importStrategy || "round_robin";
  const autoLead = options?.whatsappAutoLead === true;
  const modes = [
    ["round_robin", "Round robin", "Shared evenly across employees"],
    ["least_loaded", "Least loaded", "To whoever has the fewest open leads"],
    ["manual", "Manual", "Choose admins; they assign later"],
  ];

  return (
    <ModalFrame title="Lead assignment" subtitle="How new leads are assigned and created." onClose={onClose}>
      <p className="text-[13px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Default for imports</p>
      <p className="text-[13px] text-[#8B92A9] mb-3">Pre-selected in the import window. It can still be changed for each import.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        {modes.map(([key, title, sub]) => (
          <button
            key={key}
            type="button"
            disabled={saving || !options}
            onClick={() => saveMode(key)}
            className={`text-left px-3 py-2.5 rounded-xl border transition disabled:opacity-60 ${
              current === key ? "border-[#7C3AED] bg-purple-50 dark:bg-purple-950/30" : "border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {current === key && <Check className="w-3.5 h-3.5 text-[#7C3AED]" />} {title}
            </span>
            <span className="block text-[12px] text-[#8B92A9] mt-0.5">{sub}</span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-[13px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">New WhatsApp chats</p>
      <p className="text-[13px] text-[#8B92A9] mb-3">When someone new messages your WhatsApp number (not a reply to something you sent).</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {[
          [false, "Keep in inbox until saved", "Shows in Communications only. Becomes a lead (and gets nurture templates) only after someone uses Save as lead."],
          [true,  "Create a lead automatically", "Every new chat is added to the Leads page straight away."],
        ].map(([val, title, sub]) => (
          <button
            key={String(val)}
            type="button"
            disabled={saving || !options}
            onClick={() => saveAutoLead(val)}
            className={`text-left px-3 py-2.5 rounded-xl border transition disabled:opacity-60 ${
              autoLead === val ? "border-[#7C3AED] bg-purple-50 dark:bg-purple-950/30" : "border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {autoLead === val && <Check className="w-3.5 h-3.5 text-[#7C3AED]" />} {title}
            </span>
            <span className="block text-[12px] text-[#8B92A9] mt-0.5">{sub}</span>
          </button>
        ))}
      </div>

      {msg && <p className="mt-3 text-[13px] text-emerald-600">{msg}</p>}
      {err && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
    </ModalFrame>
  );
}

// ── Super admin: admin groups (User Management) ─────────────────────────────
export function AdminGroupsModal({ onClose }) {
  const [groups, setGroups] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [editing, setEditing] = useState(null); // { _id?, name, admins:Set }
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadGroups = useCallback(() => {
    api.get("/lead/assignment/groups")
      .then((r) => { setGroups(r.data.groups || []); setAdmins(r.data.admins || []); })
      .catch((e) => setErr(errMsg(e, "Couldn't load admin groups.")));
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const saveGroup = async () => {
    if (!editing) return;
    setErr(""); setMsg("");
    const body = { name: editing.name.trim(), admins: [...editing.admins] };
    try {
      if (editing._id) await api.put(`/lead/assignment/groups/${editing._id}`, body);
      else await api.post("/lead/assignment/groups", body);
      setEditing(null); setMsg("Group saved."); loadGroups();
    } catch (e) { setErr(errMsg(e, "Couldn't save the group.")); }
  };

  // Remove one admin from a group. A group needs at least two admins, so
  // removing from a two-person group offers to delete the group instead.
  const removeMember = async (g, admin) => {
    const remaining = (g.admins || []).filter((a) => String(a._id) !== String(admin._id));
    setErr(""); setMsg("");
    if (remaining.length < 2) {
      if (!window.confirm(`Removing ${admin.name} leaves only one admin in "${g.name}", and a group needs at least two. Delete the group instead?`)) return;
      try { await api.delete(`/lead/assignment/groups/${g._id}`); setMsg(`Group "${g.name}" deleted.`); loadGroups(); }
      catch (e) { setErr(errMsg(e, "Couldn't delete the group.")); }
      return;
    }
    if (!window.confirm(`Remove ${admin.name} from "${g.name}"? They will stop seeing the group's leads.`)) return;
    try {
      await api.put(`/lead/assignment/groups/${g._id}`, { name: g.name, admins: remaining.map((a) => String(a._id)) });
      setMsg(`${admin.name} removed from "${g.name}".`);
      loadGroups();
    } catch (e) { setErr(errMsg(e, "Couldn't remove the admin.")); }
  };

  const removeGroup = async (g) => {
    if (!window.confirm(`Delete the group "${g.name}"? Its admins will stop sharing leads.`)) return;
    setErr(""); setMsg("");
    try { await api.delete(`/lead/assignment/groups/${g._id}`); setMsg("Group deleted."); loadGroups(); }
    catch (e) { setErr(errMsg(e, "Couldn't delete the group.")); }
  };

  return (
    <ModalFrame
      title="Admin groups"
      subtitle="Admins in a group share their leads: each can see and assign the leads of every admin in the group and of their employees."
      onClose={onClose}
    >
      {!editing && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setEditing({ name: "", admins: new Set() })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-violet-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New group
          </button>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-[#7C3AED]/40 p-3 mb-3">
          <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-2">{editing._id ? "Edit group" : "New group"}</p>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Group name, e.g. North region"
            maxLength={80}
            className="w-full px-3 py-2 mb-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#7C3AED]"
          />
          {admins.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-[#8B92A9]">No admins yet. Add admins first.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {admins.map((a) => (
                <Checkbox
                  key={a._id}
                  checked={editing.admins.has(String(a._id))}
                  onChange={() => {
                    const next = new Set(editing.admins);
                    next.has(String(a._id)) ? next.delete(String(a._id)) : next.add(String(a._id));
                    setEditing({ ...editing, admins: next });
                  }}
                  label={a.name}
                  sub={a.email}
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[12px] text-[#8B92A9]">{editing.admins.size} selected · at least 2 needed</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Cancel</button>
              <button
                onClick={saveGroup}
                disabled={!editing.name.trim() || editing.admins.size < 2}
                className="px-3.5 py-2 rounded-lg bg-[#7C3AED] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                Save group
              </button>
            </div>
          </div>
        </div>
      )}

      {groups === null ? (
        <p className="text-[14px] text-[#8B92A9]">Loading…</p>
      ) : groups.length === 0 ? (
        !editing && (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
            <Users className="w-7 h-7 text-[#C4C9DA] mb-2" />
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">No groups yet</p>
            <p className="text-[13px] text-[#8B92A9]">Create one to let admins share leads.</p>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g._id} className="flex items-start gap-3 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2.5">
              <Users className="w-4 h-4 text-[#7C3AED] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{g.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(g.admins || []).map((a) => (
                    <span key={a._id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                      {a.name}
                      <button
                        onClick={() => removeMember(g, a)}
                        className="w-4 h-4 flex items-center justify-center rounded-full text-[#8B92A9] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
                        aria-label={`Remove ${a.name} from ${g.name}`}
                        title={`Remove ${a.name} from this group`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setEditing({ _id: g._id, name: g.name, admins: new Set((g.admins || []).map((a) => String(a._id))) })} className="p-1.5 rounded-lg text-[#8B92A9] hover:text-[#7C3AED]" aria-label={`Edit ${g.name}`}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeGroup(g)} className="p-1.5 rounded-lg text-[#8B92A9] hover:text-red-600" aria-label={`Delete ${g.name}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="mt-3 text-[13px] text-emerald-600">{msg}</p>}
      {err && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {err}</p>}
    </ModalFrame>
  );
}
