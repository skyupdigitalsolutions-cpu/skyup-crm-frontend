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
// Statuses relevant to nurture — deliberately NOT the same as the app-wide
// ALL_STATUSES constant. "Not Interested", "Merged", and "Closed" leads are
// dead ends (no nurture makes sense there), and "Interested" is a real
// lead.status value in this CRM that the global constant doesn't list.
const NURTURE_STATUSES = ["New", "In Progress", "Interested", "Verification", "Converted"];

// Suggested industries — matches the tags agents pick from the mobile app's
// remark-section "Industry" dropdown. Kept as a free-form field on the Lead
// (like MetaConfig.category), so this is a starting list, not a hard enum —
// an admin can still type a custom one if a rule needs it (handled as a
// plain chip toggle, same widget as statuses/temperatures).
const INDUSTRIES = ["Real Estate", "Healthcare", "Education", "E-commerce", "Finance", "Manufacturing", "Hospitality", "Other"];

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
    industries: [],
    includeManualOrImported: false,
  },
  action: {
    whatsapp: {
      enabled: true,
      languageCode: "en",
      // Default/fallback template — used when trigger.statuses is empty (rule
      // matches "any" status) or a selected status has no override below.
      templateName: "",
      // Per-status overrides — only shown/used for statuses currently
      // selected in trigger.statuses, so a "Cold lead re-engage" rule can
      // send a different WhatsApp template depending on whether the lead is
      // still "New" vs already "In Progress" vs "Interested", etc.
      templatesByStatus: {},
    },
    email: { enabled: false, subject: "", fromName: "", bodyTemplate: "" },
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
      // NOTE: structuredClone() isn't available on Safari <15.4 or some
      // embedded WebViews, and nothing else in this codebase relies on it.
      // JSON round-trip is a safe deep-clone here since `draft` only ever
      // holds plain JSON-serializable values (no Dates/Maps/functions).
      const next = JSON.parse(JSON.stringify(d));
      const arr = path === "statuses" ? next.trigger.statuses
                : path === "temperatures" ? next.trigger.temperatures
                : path === "industries" ? next.trigger.industries
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
                      {r.trigger?.industries?.length ? ` · industry: ${r.trigger.industries.join(", ")}` : ""}
                      {(() => {
                        const tbs = r.action?.whatsapp?.templatesByStatus || {};
                        const total = Object.values(tbs).reduce((sum, pool) => sum + (Array.isArray(pool) ? pool.filter((t) => t && t.trim()).length : (pool ? 1 : 0)), 0);
                        return total > 0 ? ` · ${total} template(s)` : "";
                      })()}
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
            <div className="mt-1"><MultiChip options={NURTURE_STATUSES} selected={draft.trigger.statuses} onToggle={(v) => toggleArrayValue("statuses", v)} /></div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these temperatures (empty = any)</label>
            <div className="mt-1"><MultiChip options={TEMPERATURES} selected={draft.trigger.temperatures} onToggle={(v) => toggleArrayValue("temperatures", v)} /></div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these industries (empty = any/untagged) — "domain-wise" filter</label>
            <p className="text-[10px] text-[#8B92A9] mb-1">Matches the Industry tag agents set from the mobile app's remark section. Lets this rule send an industry-specific template (see Per-status template above).</p>
            <div className="mt-1"><MultiChip options={INDUSTRIES} selected={draft.trigger.industries} onToggle={(v) => toggleArrayValue("industries", v)} /></div>
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
              <div className="mt-2 space-y-2">
                <div>
                  <input
                    value={draft.action.whatsapp.templateName}
                    onChange={(e) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, templateName: e.target.value } } })}
                    placeholder='Default template (used for "any status", or a status with no override below)'
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                  />
                </div>

                {/* Template POOL per currently-selected status — add 5-6
                    variants per status so the same message isn't sent
                    verbatim every time (one is picked at random when the
                    rule fires). With 4 core statuses (New/In Progress/
                    Interested/Converted) at ~5-6 each, that's ~20+ templates
                    for one industry-scoped rule. Only shows for statuses
                    actually picked above; a status with zero templates
                    falls back to the default template. */}
                {draft.trigger.statuses.length > 0 && (
                  <div className="pl-3 border-l-2 border-[#E4E7EF] dark:border-[#262A38] space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-[#8B92A9] uppercase">
                        Template pool per status (5-6 recommended each — one is picked at random per send)
                      </p>
                      {(() => {
                        const total = draft.trigger.statuses.reduce(
                          (sum, st) => sum + (draft.action.whatsapp.templatesByStatus?.[st]?.filter((t) => t && t.trim()).length || 0),
                          0
                        );
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${total >= 20 ? "bg-[#059669]/10 text-[#059669]" : "bg-[#F59E0B]/10 text-[#F59E0B]"}`}>
                            {total} template{total === 1 ? "" : "s"} total
                          </span>
                        );
                      })()}
                    </div>

                    {draft.trigger.statuses.map((st) => {
                      const pool = draft.action.whatsapp.templatesByStatus?.[st] || [];

                      const setPool = (nextPool) => setDraft({
                        ...draft,
                        action: {
                          ...draft.action,
                          whatsapp: {
                            ...draft.action.whatsapp,
                            templatesByStatus: { ...draft.action.whatsapp.templatesByStatus, [st]: nextPool },
                          },
                        },
                      });

                      const updateSlot = (idx, value) => {
                        const next = [...pool];
                        next[idx] = value;
                        setPool(next);
                      };
                      const addSlot = () => { if (pool.length < 6) setPool([...pool, ""]); };
                      const removeSlot = (idx) => setPool(pool.filter((_, i) => i !== idx));

                      return (
                        <div key={st}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">{st}</span>
                            <span className="text-[10px] text-[#8B92A9]">{pool.filter((t) => t && t.trim()).length}/6</span>
                          </div>
                          <div className="space-y-1.5">
                            {pool.map((tmpl, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  value={tmpl}
                                  onChange={(e) => updateSlot(idx, e.target.value)}
                                  placeholder={`Template ${idx + 1} for "${st}"`}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[12px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSlot(idx)}
                                  className="text-[11px] text-red-500 font-semibold px-1.5"
                                  title="Remove this template"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            {pool.length < 6 && (
                              <button
                                type="button"
                                onClick={addSlot}
                                className="text-[11px] font-semibold text-[#2563EB]"
                              >
                                + Add template{pool.length === 0 ? "" : ` (${pool.length}/6)`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
