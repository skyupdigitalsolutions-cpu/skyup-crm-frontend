// frontend/src/pages/Admin/NurtureSequenceBuilder.jsx — NEW FILE
// ─────────────────────────────────────────────────────────────────────────────
// Admin UI to build/manage NurtureRule documents for THIS company only.
// Route is wrapped in <FeatureGate featureKey="leadNurtureSequence"> in
// App.jsx, and the backend independently enforces the same entitlement on
// every /api/nurture/* call — so this page is inert (403) for any company
// that hasn't been explicitly enabled from Developer > Company Details.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import api from "../../data/axiosConfig";
import { ALL_STATUSES } from "../../utils/statusConfig";

const TEMPERATURES = ["Hot", "Warm", "Cold"];

const emptyDraft = {
  name: "",
  enabled: true,
  trigger: {
    statuses: [],
    temperatures: [],
    minDaysSinceLastTouch: 3,
    requirePendingFollowUp: false,
    sources: [],
    includeManualOrImported: false,
  },
  action: {
    whatsapp: { enabled: true, templateName: "", languageCode: "en" },
    email:    { enabled: false, subject: "", fromName: "", bodyTemplate: "" },
    notifyAgent: false,
    notifyAgentMessage: "",
  },
  repeatEveryDays: null,
};

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
      <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{label}</span>
    </label>
  );
}

function MultiChip({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition
            ${selected.includes(o)
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white dark:bg-[#161822] text-[#4B5168] dark:text-[#9DA3BB] border-[#E4E7EF] dark:border-[#262A38]"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function NurtureSequenceBuilder() {
  const [rules,   setRules]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [draft,   setDraft]   = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/nurture/rules");
      setRules(data.rules || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load nurture rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleArrayValue = (path, value) => {
    setDraft((d) => {
      const next = structuredClone(d);
      const arr = path === "statuses" ? next.trigger.statuses
                : path === "temperatures" ? next.trigger.temperatures
                : next.trigger.sources;
      const idx = arr.indexOf(value);
      if (idx === -1) arr.push(value); else arr.splice(idx, 1);
      return next;
    });
  };

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setDraft({
      name: rule.name,
      enabled: rule.enabled,
      trigger: { ...emptyDraft.trigger, ...rule.trigger },
      action: {
        whatsapp: { ...emptyDraft.action.whatsapp, ...(rule.action?.whatsapp || {}) },
        email:    { ...emptyDraft.action.email,    ...(rule.action?.email    || {}) },
        notifyAgent: !!rule.action?.notifyAgent,
        notifyAgentMessage: rule.action?.notifyAgentMessage || "",
      },
      repeatEveryDays: rule.repeatEveryDays || null,
    });
  };

  const resetDraft = () => { setEditingId(null); setDraft(emptyDraft); };

  const save = async () => {
    if (!draft.name.trim()) { setError("Rule name is required."); return; }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/nurture/rules/${editingId}`, draft);
      } else {
        await api.post("/nurture/rules", draft);
      }
      resetDraft();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this nurture rule?")) return;
    try {
      await api.delete(`/nurture/rules/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to delete rule.");
    }
  };

  const toggleEnabled = async (rule) => {
    try {
      await api.patch(`/nurture/rules/${rule._id}`, { enabled: !rule.enabled });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update rule.");
    }
  };

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8">
      <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Lead Nurture Sequence</h1>
      <p className="text-[13px] text-[#8B92A9] mb-6">
        Automated WhatsApp/Email nudges for leads that have gone quiet — separate from the per-outcome
        messages that already fire when an agent logs a call.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-[12px] font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Existing rules ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Active Rules</h2>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-[13px] text-[#8B92A9]">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-[13px] text-[#8B92A9]">No rules yet — build one below.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r._id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#161822]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{r.name}</div>
                    <div className="text-[11px] text-[#8B92A9]">
                      Fires after {r.trigger?.minDaysSinceLastTouch ?? "?"} day(s) idle
                      {r.trigger?.statuses?.length ? ` · status: ${r.trigger.statuses.join(", ")}` : ""}
                      {r.trigger?.temperatures?.length ? ` · temp: ${r.trigger.temperatures.join(", ")}` : ""}
                    </div>
                  </div>
                  <button onClick={() => toggleEnabled(r)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${r.enabled ? "bg-[#059669]/10 text-[#059669]" : "bg-[#8B92A9]/10 text-[#8B92A9]"}`}>
                    {r.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button onClick={() => startEdit(r)} className="text-[11px] font-semibold text-[#2563EB]">Edit</button>
                  <button onClick={() => remove(r._id)} className="text-[11px] font-semibold text-red-600">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Builder form ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{editingId ? "Edit Rule" : "New Rule"}</h2>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Rule name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder='e.g. "Cold lead re-engage — Day 3"'
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these statuses (empty = any)</label>
            <div className="mt-1"><MultiChip options={ALL_STATUSES} selected={draft.trigger.statuses} onToggle={(v) => toggleArrayValue("statuses", v)} /></div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these temperatures (empty = any)</label>
            <div className="mt-1"><MultiChip options={TEMPERATURES} selected={draft.trigger.temperatures} onToggle={(v) => toggleArrayValue("temperatures", v)} /></div>
          </div>

          <div className="flex items-end gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Days idle before firing</label>
              <input
                type="number" min="0"
                value={draft.trigger.minDaysSinceLastTouch}
                onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, minDaysSinceLastTouch: Number(e.target.value) } })}
                className="mt-1 w-24 px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Repeat every (days, blank = once)</label>
              <input
                type="number" min="1"
                value={draft.repeatEveryDays ?? ""}
                onChange={(e) => setDraft({ ...draft, repeatEveryDays: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 w-24 px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
              />
            </div>
            <Toggle
              checked={draft.trigger.requirePendingFollowUp}
              onChange={(v) => setDraft({ ...draft, trigger: { ...draft.trigger, requirePendingFollowUp: v } })}
              label="Only if a follow-up call is still pending"
            />
          </div>

          <Toggle
            checked={draft.trigger.includeManualOrImported}
            onChange={(v) => setDraft({ ...draft, trigger: { ...draft.trigger, includeManualOrImported: v } })}
            label="Also include manually added / CSV-imported leads (off by default)"
          />

          <hr className="border-[#E4E7EF] dark:border-[#262A38]" />

          <div>
            <Toggle
              checked={draft.action.whatsapp.enabled}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, enabled: v } } })}
              label="Send WhatsApp"
            />
            {draft.action.whatsapp.enabled && (
              <input
                value={draft.action.whatsapp.templateName}
                onChange={(e) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, templateName: e.target.value } } })}
                placeholder="MSG91 template name (must already be approved)"
                className="mt-2 w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
              />
            )}
          </div>

          <div>
            <Toggle
              checked={draft.action.email.enabled}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, enabled: v } } })}
              label="Send Email"
            />
            {draft.action.email.enabled && (
              <div className="mt-2 space-y-2">
                <input
                  value={draft.action.email.subject}
                  onChange={(e) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, subject: e.target.value } } })}
                  placeholder="Subject (supports {{name}})"
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                />
                <textarea
                  value={draft.action.email.bodyTemplate}
                  onChange={(e) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, bodyTemplate: e.target.value } } })}
                  placeholder="HTML body (supports {{name}})"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                />
              </div>
            )}
          </div>

          <div>
            <Toggle
              checked={draft.action.notifyAgent}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, notifyAgent: v } })}
              label="Also ping the assigned agent internally"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Rule"}
            </button>
            {editingId && (
              <button onClick={resetDraft} className="text-[13px] font-semibold text-[#8B92A9]">Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
