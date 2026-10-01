// src/pages/developer/CustomizeCRM.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Customize CRM" — per-company configuration of everything that used to be
// hardcoded: modules, statuses, call outcomes, lead quality, dropdown lists,
// lead fields + custom fields, workflows, alerts, permissions, branding.
//
// DEVELOPER PANEL ONLY: Developer → Company Details → "Customize" tab
//   <CustomizeCRM companyId={id} embedded />
// Company admins / super admins / employees can NOT open or edit this; they
// only receive the resulting configuration (GET /api/customization).
//
// Every tab saves independently (PUT …/customization/:section) and can be
// reset to the CRM defaults. Defaults = the CRM's original behaviour.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import api, { clearCache } from "../../data/axiosConfig";
import { getCustomizationMeta } from "../../data/customizationStore";
import { PALETTE_CLASSES } from "../../utils/statusConfig";
import {
  Settings2, LayoutGrid, Tags, PhoneCall, Thermometer, ListChecks, FileText, Workflow,
  BellRing, ShieldCheck, Palette, Save, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Lock, X, ChevronRight, MessageSquare,
} from "lucide-react";

const META = getCustomizationMeta();

// ── UI atoms ─────────────────────────────────────────────────────────────────
const INPUT = "w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";
const SELECT = INPUT + " pr-8";
const CARD = "rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-[#8B92A9] mb-1";

function Toggle({ on, onChange, disabled, label, hint, small }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={!!on}
        disabled={disabled}
        onClick={() => !disabled && onChange(!on)}
        className={`relative shrink-0 ${small ? "w-8 h-[18px]" : "w-10 h-[22px]"} rounded-full transition ${on ? "bg-[#2563EB]" : "bg-[#CBD5E1] dark:bg-[#2D3242]"}`}
      >
        <span className={`absolute top-[2px] ${small ? "w-[14px] h-[14px]" : "w-[18px] h-[18px]"} rounded-full bg-white shadow transition-all ${on ? (small ? "left-[16px]" : "left-[20px]") : "left-[2px]"}`} />
      </button>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] font-medium text-[#0F1117] dark:text-white leading-5">{label}</span>}
          {hint && <span className="block text-[11px] text-[#8B92A9] leading-4 mt-0.5">{hint}</span>}
        </span>
      )}
    </label>
  );
}

function Field({ label, hint, children, className = "" }) {
  return (
    <div className={className}>
      {label && <span className={LABEL}>{label}</span>}
      {children}
      {hint && <p className="text-[11px] text-[#8B92A9] mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, desc, children, right }) {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-white">{title}</h3>
          {desc && <p className="text-[12px] text-[#8B92A9] mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = PALETTE_CLASSES[value] || PALETTE_CLASSES.gray;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center"
        title={value}>
        <span className="w-4 h-4 rounded-full" style={{ background: cur.dot }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`${CARD} absolute z-50 mt-1 p-2 grid grid-cols-6 gap-1.5 w-[188px] shadow-xl`}>
            {Object.entries(PALETTE_CLASSES).map(([k, p]) => (
              <button key={k} type="button" title={k}
                onClick={() => { onChange(k); setOpen(false); }}
                className={`w-6 h-6 rounded-full border-2 ${value === k ? "border-[#0F1117] dark:border-white" : "border-transparent"}`}
                style={{ background: p.dot }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ color, children }) {
  const p = PALETTE_CLASSES[color] || PALETTE_CLASSES.gray;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold ${p.bg} ${p.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.dot }} />
      {children}
    </span>
  );
}

function OrderButtons({ index, length, onMove }) {
  return (
    <div className="flex flex-col">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)}
        className="p-0.5 text-[#8B92A9] hover:text-[#2563EB] disabled:opacity-30" title="Move up">
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" disabled={index === length - 1} onClick={() => onMove(index, 1)}
        className="p-0.5 text-[#8B92A9] hover:text-[#2563EB] disabled:opacity-30" title="Move down">
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TagEditor({ items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...items];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };
  const move = (i, d) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.length === 0 && <span className="text-[12px] text-[#8B92A9] italic">No items — add some below.</span>}
        {items.map((it, i) => (
          <span key={it + i} className="group inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-[#F1F4FA] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#0F1117] dark:text-white">
            <button type="button" onClick={() => move(i, -1)} className="text-[#8B92A9] hover:text-[#2563EB] opacity-0 group-hover:opacity-100" title="Move left">‹</button>
            {it}
            <button type="button" onClick={() => move(i, 1)} className="text-[#8B92A9] hover:text-[#2563EB] opacity-0 group-hover:opacity-100" title="Move right">›</button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="ml-0.5 p-0.5 rounded text-[#8B92A9] hover:text-red-500" title="Remove">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder || "Type and press Enter (comma for many)"}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={INPUT} />
        <button type="button" onClick={add} className="px-3 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function Pill({ children, tone = "gray" }) {
  const p = PALETTE_CLASSES[tone] || PALETTE_CLASSES.gray;
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.bg} ${p.text}`}>{children}</span>;
}

const moveItem = (arr, i, d) => {
  const next = [...arr];
  const j = i + d;
  if (j < 0 || j >= next.length) return arr;
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((x, k) => ({ ...x, order: k + 1 }));
};

const CATEGORY_LABEL = {
  new: "New (entry)", open: "Open / working", interested: "Interested", verification: "Verification",
  won: "Won / converted", lost: "Lost / closed",
};
const BEHAVIOUR_LABEL = {
  none: "Just log the call", interested: "Fire Interested blast", notInterested: "Run Not-Interested flow",
  invalid: "Run Invalid flow", cold: "Run Cold flow", clientMeeting: "Open client meeting",
};
const FOLLOWUP_LABEL = { none: "Never", optional: "Optional", required: "Required", auto: "Automatic" };
const GROUP_LABEL = { answered: "Answered", notAnswered: "Not answered", other: "Other" };
const FIELD_TYPE_LABEL = {
  text: "Text", textarea: "Long text", number: "Number", date: "Date", datetime: "Date & time",
  select: "Dropdown", multiselect: "Multi-select", checkbox: "Yes / No", email: "Email", phone: "Phone", url: "Link",
};

const TABS = [
  { id: "modules",      label: "Modules",         icon: LayoutGrid },
  { id: "statuses",     label: "Lead Statuses",   icon: Tags },
  { id: "outcomes",     label: "Call Outcomes",   icon: PhoneCall },
  { id: "temperatures", label: "Lead Quality",    icon: Thermometer },
  { id: "lists",        label: "Dropdown Lists",  icon: ListChecks },
  { id: "fields",       label: "Lead Fields",     icon: FileText },
  { id: "workflows",    label: "Workflows",       icon: Workflow },
  { id: "alerts",       label: "Alerts & Reminders", icon: BellRing },
  { id: "permissions",  label: "Permissions",     icon: ShieldCheck },
  { id: "general",      label: "Branding & General", icon: Palette },
];

// Which stored sections each tab saves.
const TAB_SECTIONS = {
  modules: ["modules"], statuses: ["statuses"], outcomes: ["outcomes"], temperatures: ["temperatures"],
  lists: ["lists"], fields: ["leadFields", "customFields"], workflows: ["workflows"], alerts: ["alerts"],
  permissions: ["permissions"], general: ["general", "messaging", "dashboard"],
};

const clone = (v) => JSON.parse(JSON.stringify(v));

// ─────────────────────────────────────────────────────────────────────────────
export default function CustomizeCRM({ companyId, embedded = false }) {
  const base = `/developer/companies/${companyId}/customization`;
  const [saved, setSaved]   = useState(null);   // last saved config from server
  const [draft, setDraft]   = useState(null);   // edited copy
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab]       = useState("modules");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [automations, setAutomations] = useState(null); // built-in outcome + follow-up reminder automation

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      clearCache("customization");
      const { data } = await api.get(base);
      setSaved(data.customization);
      setDraft(clone(data.customization));
      setCanEdit(!!data.canEdit);
    } catch (e) {
      setMsg({ type: "err", text: e.response?.data?.message || "Could not load customization." });
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    api.get(`${base}/automations`).then(({ data }) => setAutomations(data)).catch(() => setAutomations(null));
  }, [base, canEdit]);

  const dirtySections = useMemo(() => {
    if (!saved || !draft) return new Set();
    const out = new Set();
    for (const s of Object.values(TAB_SECTIONS).flat()) {
      if (JSON.stringify(saved[s]) !== JSON.stringify(draft[s])) out.add(s);
    }
    return out;
  }, [saved, draft]);
  const tabDirty = (id) => TAB_SECTIONS[id].some((s) => dirtySections.has(s));

  const set = (section, value) => setDraft((d) => ({ ...d, [section]: value }));
  const patch = (section, path, value) => setDraft((d) => {
    const next = clone(d[section]);
    let o = next;
    const keys = path.split(".");
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    return { ...d, [section]: next };
  });

  const afterSave = (cust) => {
    setSaved(cust);
    setDraft(clone(cust));
    clearCache("customization");
  };

  async function saveTab() {
    if (!canEdit) return;
    setSaving(true); setMsg(null);
    try {
      let cust = saved;
      for (const section of TAB_SECTIONS[tab]) {
        if (!dirtySections.has(section)) continue;
        const { data } = await api.put(`${base}/${section}`, { value: draft[section] });
        cust = data.customization;
      }
      afterSave(cust);
      setMsg({ type: "ok", text: "Saved — changes are live for everyone in the company." });
    } catch (e) {
      setMsg({ type: "err", text: e.response?.data?.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function resetTab() {
    if (!canEdit) return;
    if (!window.confirm("Reset this tab to the CRM defaults? Your changes on this tab will be lost.")) return;
    setSaving(true); setMsg(null);
    try {
      let cust = saved;
      for (const section of TAB_SECTIONS[tab]) {
        const { data } = await api.post(`${base}/${section}/reset`);
        cust = data.customization;
      }
      afterSave(cust);
      setMsg({ type: "ok", text: "Reset to defaults." });
    } catch (e) {
      setMsg({ type: "err", text: e.response?.data?.message || "Reset failed." });
    } finally {
      setSaving(false);
    }
  }

  async function saveAutomation(kind, key, value) {
    const url = kind === "followUp"
      ? `${base}/automations/follow-up-reminder`
      : `${base}/automations/outcome/${encodeURIComponent(key)}`;
    const { data } = await api.put(url, { value });
    setAutomations((a) => ({
      ...(a || {}),
      ...(data.followUpReminder ? { followUpReminder: data.followUpReminder } : {}),
      ...(data.outcomeAutomation ? { outcomeAutomation: data.outcomeAutomation } : {}),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8B92A9] gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading customization…
      </div>
    );
  }
  if (!draft) {
    return <div className="p-6 text-[13px] text-red-500">{msg?.text || "Customization unavailable."}</div>;
  }

  const ro = !canEdit;
  const props = { draft, set, patch, ro, saved };

  return (
    <div className={embedded ? "" : "p-4 sm:p-6 max-w-[1400px] mx-auto"}>
      {!embedded && (
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[#2563EB]" /> Customize CRM
            </h1>
            <p className="text-[13px] text-[#8B92A9] mt-0.5">
              Shape the CRM around how your company works. Nothing here is fixed — every list, flow and module can be changed.
            </p>
          </div>
          {ro && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
              <Lock className="w-3.5 h-3.5" /> View only — ask your Super Admin to make changes
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Tab rail */}
        <nav className={`${CARD} p-2 lg:w-[230px] shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:self-start lg:sticky lg:top-16`}>
          {TABS.map((t) => { const { id, label } = t; return (
            <button key={id} type="button" onClick={() => { setTab(id); setMsg(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition
                ${tab === id ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FA] dark:hover:bg-white/5"}`}>
              <t.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {tabDirty(id) && <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />}
            </button>
          ); })}
        </nav>

        {/* Tab body */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Action bar */}
          <div className={`${CARD} px-4 py-3 flex items-center justify-between gap-3 flex-wrap sticky top-14 z-20`}>
            <div className="flex items-center gap-2 min-w-0">
              {msg ? (
                <span className={`flex items-center gap-1.5 text-[12px] font-medium ${msg.type === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {msg.text}
                </span>
              ) : tabDirty(tab) ? (
                <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400">Unsaved changes on this tab</span>
              ) : (
                <span className="text-[12px] text-[#8B92A9]">All changes saved</span>
              )}
            </div>
            {!ro && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDraft((d) => {
                  const n = { ...d };
                  for (const s of TAB_SECTIONS[tab]) n[s] = clone(saved[s]);
                  return n;
                })} disabled={!tabDirty(tab) || saving}
                  className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] disabled:opacity-40">
                  Discard
                </button>
                <button type="button" onClick={resetTab} disabled={saving}
                  className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] flex items-center gap-1.5 disabled:opacity-40">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
                </button>
                <button type="button" onClick={saveTab} disabled={!tabDirty(tab) || saving}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-40">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
              </div>
            )}
          </div>

          {tab === "modules"      && <ModulesTab {...props} />}
          {tab === "statuses"     && <StatusesTab {...props} />}
          {tab === "outcomes"     && <OutcomesTab {...props} automations={automations} saveAutomation={saveAutomation} />}
          {tab === "temperatures" && <TemperaturesTab {...props} />}
          {tab === "lists"        && <ListsTab {...props} />}
          {tab === "fields"       && <FieldsTab {...props} />}
          {tab === "workflows"    && <WorkflowsTab {...props} />}
          {tab === "alerts"       && <AlertsTab {...props} automations={automations} saveAutomation={saveAutomation} />}
          {tab === "permissions"  && <PermissionsTab {...props} />}
          {tab === "general"      && <GeneralTab {...props} />}
        </div>
      </div>
    </div>
  );
}

// ── MODULES ──────────────────────────────────────────────────────────────────
function ModulesTab({ draft, patch, ro }) {
  const groups = useMemo(() => {
    const g = {};
    for (const m of META.modules) (g[m.group] = g[m.group] || []).push(m);
    return g;
  }, []);
  return (
    <>
      <div className="text-[12px] text-[#8B92A9] px-1">
        Switch any feature on or off for your whole company, rename it in the menu, and choose who sees it.
        Features your plan doesn't include stay hidden even when switched on.
      </div>
      {Object.entries(groups).map(([group, mods]) => (
        <Section key={group} title={group}>
          <div className="divide-y divide-[#E4E7EF] dark:divide-[#262A38]">
            {mods.map((m) => {
              const cfg = draft.modules[m.key] || { enabled: true, admin: true, employee: true, label: "" };
              return (
                <div key={m.key} className="py-3 grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-center">
                  <Toggle on={cfg.enabled} disabled={ro} onChange={(v) => patch("modules", `${m.key}.enabled`, v)}
                    label={m.label} hint={m.navOnly ? "Company switch" : "Plan feature + company switch"} />
                  <input value={cfg.label} disabled={ro || !cfg.enabled} placeholder={`Menu name (default: ${m.label})`}
                    onChange={(e) => patch("modules", `${m.key}.label`, e.target.value)} className={INPUT} />
                  <div className="flex items-center gap-4">
                    <Toggle small on={cfg.admin} disabled={ro || !cfg.enabled} onChange={(v) => patch("modules", `${m.key}.admin`, v)} label="Admins" />
                    <Toggle small on={cfg.employee} disabled={ro || !cfg.enabled} onChange={(v) => patch("modules", `${m.key}.employee`, v)} label="Employees" />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}

// ── STATUSES ─────────────────────────────────────────────────────────────────
function StatusesTab({ draft, set, ro }) {
  const list = draft.statuses;
  const upd = (i, k, v) => set("statuses", list.map((s, j) => {
    if (k === "isDefault") return { ...s, isDefault: j === i };
    return j === i ? { ...s, [k]: v } : s;
  }));
  const add = () => set("statuses", [...list, {
    key: "", label: "", color: "slate", category: "open", order: list.length + 1, active: true,
    isDefault: false, employeeSelectable: true, showInPipeline: true, metaEvent: "", aliases: [], system: false, _new: true,
  }]);
  return (
    <Section title="Lead statuses"
      desc="Rename, recolour, reorder or add statuses. The type tells the CRM what a status means (e.g. every “Won” status counts as a conversion in reports). Built-in statuses can be renamed or hidden but not deleted, so old leads always stay readable."
      right={!ro && <button type="button" onClick={add} className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Add status</button>}>
      <div className="space-y-2">
        {list.map((s, i) => (
          <div key={s.key || `new-${i}`} className={`rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 ${!s.active ? "opacity-60" : ""}`}>
            <div className="grid grid-cols-[auto_auto_1fr] md:grid-cols-[auto_auto_1.2fr_1fr_150px_auto] gap-2 items-center">
              <OrderButtons index={i} length={list.length} onMove={(a, d) => !ro && set("statuses", moveItem(list, a, d))} />
              <ColorPicker value={s.color} onChange={(v) => !ro && upd(i, "color", v)} />
              <input value={s.label} disabled={ro} placeholder="Status name"
                onChange={(e) => {
                  const v = e.target.value;
                  set("statuses", list.map((x, j) => j === i ? { ...x, label: v, ...(x._new ? { key: v } : {}) } : x));
                }} className={INPUT} />
              <select value={s.category} disabled={ro || s.system} onChange={(e) => upd(i, "category", e.target.value)} className={SELECT}
                title={s.system ? "Built-in status — type is fixed because workflows depend on it" : ""}>
                {META.statusCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
              </select>
              <select value={s.metaEvent || ""} disabled={ro} onChange={(e) => upd(i, "metaEvent", e.target.value)} className={SELECT} title="Event sent to Meta when a lead moves to this status (Meta Conversion Sync)">
                <option value="">No Meta event</option>
                {["Lead", "Contact", "Schedule", "SubmitApplication", "CompleteRegistration", "Purchase"].map((e) => <option key={e} value={e}>Meta: {e}</option>)}
              </select>
              <div className="flex items-center gap-1 justify-end">
                {s.system ? <Pill tone="indigo">Built-in</Pill> : (!ro && (
                  <button type="button" onClick={() => set("statuses", list.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg text-[#8B92A9] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete status">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 pl-1">
              <Toggle small on={s.active} disabled={ro || s.isDefault} onChange={(v) => upd(i, "active", v)} label="Active" />
              <Toggle small on={s.employeeSelectable} disabled={ro} onChange={(v) => upd(i, "employeeSelectable", v)} label="Employees can pick it" />
              <Toggle small on={s.showInPipeline} disabled={ro} onChange={(v) => upd(i, "showInPipeline", v)} label="Show on pipeline board" />
              {s.category === "new" && (
                <Toggle small on={s.isDefault} disabled={ro || !s.active} onChange={() => upd(i, "isDefault", true)} label="Default for new leads" />
              )}
              {s.key && s.key !== s.label && <span className="text-[11px] text-[#8B92A9]">Stored as “{s.key}”</span>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── OUTCOMES ─────────────────────────────────────────────────────────────────
function AutomationEditor({ value, onChange, disabled }) {
  const v = value || { whatsapp: { enabled: false, templateName: "", languageCode: "en" }, email: { enabled: false, subject: "", fromName: "", bodyTemplate: "" } };
  const up = (ch, k, val) => onChange({ ...v, [ch]: { ...v[ch], [k]: val } });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 space-y-2">
        <Toggle small on={v.whatsapp.enabled} disabled={disabled} onChange={(x) => up("whatsapp", "enabled", x)} label="WhatsApp template to the lead" />
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <input value={v.whatsapp.templateName} disabled={disabled} placeholder="Approved template name" onChange={(e) => up("whatsapp", "templateName", e.target.value)} className={INPUT} />
          <input value={v.whatsapp.languageCode} disabled={disabled} placeholder="en" onChange={(e) => up("whatsapp", "languageCode", e.target.value)} className={INPUT} />
        </div>
      </div>
      <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 space-y-2">
        <Toggle small on={v.email.enabled} disabled={disabled} onChange={(x) => up("email", "enabled", x)} label="Email to the lead" />
        <input value={v.email.subject} disabled={disabled} placeholder="Subject — {{name}} works" onChange={(e) => up("email", "subject", e.target.value)} className={INPUT} />
        <input value={v.email.fromName} disabled={disabled} placeholder="From name (optional)" onChange={(e) => up("email", "fromName", e.target.value)} className={INPUT} />
        <textarea rows={3} value={v.email.bodyTemplate} disabled={disabled} placeholder="<p>Hi {{name}}, …</p>" onChange={(e) => up("email", "bodyTemplate", e.target.value)} className={INPUT + " resize-y font-mono text-[12px]"} />
      </div>
    </div>
  );
}

function OutcomesTab({ draft, set, ro, automations, saveAutomation }) {
  const list = draft.outcomes;
  const [open, setOpen] = useState(null);
  const [autoMsg, setAutoMsg] = useState(null);
  const [builtInDraft, setBuiltInDraft] = useState({});
  const upd = (i, k, v) => set("outcomes", list.map((o, j) => j === i ? { ...o, [k]: v } : o));
  const add = () => {
    set("outcomes", [...list, {
      key: "", label: "", color: "slate", group: "answered", order: list.length + 1, active: true, system: false,
      behavior: "none", followUp: "optional", autoFollowUpDays: 1, autoStatus: "", automationKey: "",
      allowForManualLeads: false, countsAsConnected: true, automation: null, _new: true,
    }]);
    setOpen(list.length);
  };
  const statusOpts = draft.statuses.filter((s) => s.active);

  return (
    <Section title="Call outcomes"
      desc="What agents can pick after a call (web and mobile app), and what each choice does: schedule a follow-up, move the lead’s status, run a workflow, or message the lead."
      right={!ro && <button type="button" onClick={add} className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Add outcome</button>}>
      <div className="space-y-2">
        {list.map((o, i) => {
          const isOpen = open === i;
          const builtIn = o.automationKey && automations?.outcomeAutomation?.[o.automationKey];
          return (
            <div key={o.key || `new-${i}`} className={`rounded-xl border border-[#E4E7EF] dark:border-[#262A38] ${!o.active ? "opacity-60" : ""}`}>
              <div className="p-3 grid grid-cols-[auto_auto_1fr_auto] md:grid-cols-[auto_auto_1.2fr_140px_170px_auto] gap-2 items-center">
                <OrderButtons index={i} length={list.length} onMove={(a, d) => !ro && set("outcomes", moveItem(list, a, d))} />
                <ColorPicker value={o.color} onChange={(v) => !ro && upd(i, "color", v)} />
                <input value={o.label} disabled={ro} placeholder="Outcome name"
                  onChange={(e) => {
                    const v = e.target.value;
                    set("outcomes", list.map((x, j) => j === i ? { ...x, label: v, ...(x._new ? { key: v } : {}) } : x));
                  }} className={INPUT} />
                <select value={o.group} disabled={ro} onChange={(e) => upd(i, "group", e.target.value)} className={SELECT + " hidden md:block"} title="Answered / not answered — used in reports and the mobile picker">
                  {META.outcomeGroups.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
                </select>
                <select value={o.behavior} disabled={ro || o.system} onChange={(e) => upd(i, "behavior", e.target.value)} className={SELECT + " hidden md:block"}
                  title={o.system ? "Built-in outcome — action is fixed" : "What happens when this outcome is picked"}>
                  {META.outcomeBehaviours.map((b) => <option key={b} value={b}>{BEHAVIOUR_LABEL[b]}</option>)}
                </select>
                <div className="flex items-center gap-1 justify-end">
                  {o.system && <Pill tone="indigo">Built-in</Pill>}
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="p-2 rounded-lg text-[#8B92A9] hover:text-[#2563EB]" title="More settings">
                    <ChevronRight className={`w-4 h-4 transition ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {!o.system && !ro && (
                    <button type="button" onClick={() => set("outcomes", list.filter((_, j) => j !== i))}
                      className="p-2 rounded-lg text-[#8B92A9] hover:text-red-500" title="Delete outcome">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-[#E4E7EF] dark:border-[#262A38] p-3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Group (mobile)" className="md:hidden">
                      <select value={o.group} disabled={ro} onChange={(e) => upd(i, "group", e.target.value)} className={SELECT}>
                        {META.outcomeGroups.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
                      </select>
                    </Field>
                    <Field label="Action" className="md:hidden">
                      <select value={o.behavior} disabled={ro || o.system} onChange={(e) => upd(i, "behavior", e.target.value)} className={SELECT}>
                        {META.outcomeBehaviours.map((b) => <option key={b} value={b}>{BEHAVIOUR_LABEL[b]}</option>)}
                      </select>
                    </Field>
                    <Field label="Follow-up date" hint="Automatic = scheduled even if the agent picks no date">
                      <select value={o.followUp} disabled={ro} onChange={(e) => upd(i, "followUp", e.target.value)} className={SELECT}>
                        {META.followUpRules.map((r) => <option key={r} value={r}>{FOLLOWUP_LABEL[r]}</option>)}
                      </select>
                    </Field>
                    <Field label="Auto follow-up after (days)">
                      <input type="number" min={0} max={365} value={o.autoFollowUpDays} disabled={ro || o.followUp !== "auto"}
                        onChange={(e) => upd(i, "autoFollowUpDays", Number(e.target.value))} className={INPUT} />
                    </Field>
                    <Field label="Move lead to status" hint="Only moves forward, never back">
                      <select value={o.autoStatus || ""} disabled={ro} onChange={(e) => upd(i, "autoStatus", e.target.value)} className={SELECT}>
                        <option value="">Don’t change status</option>
                        {statusOpts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <Toggle small on={o.active} disabled={ro} onChange={(v) => upd(i, "active", v)} label="Active (shown to agents)" />
                    <Toggle small on={o.countsAsConnected} disabled={ro} onChange={(v) => upd(i, "countsAsConnected", v)} label="Counts as a connected call" />
                    <Toggle small on={o.allowForManualLeads} disabled={ro} onChange={(v) => upd(i, "allowForManualLeads", v)} label="Message manually-added / imported leads too" />
                  </div>
                  {!["interested", "clientMeeting", "invalid"].includes(o.behavior) && (
                    <div>
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white mb-2 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" /> Message the lead when this outcome is logged
                        <span className="font-normal text-[#8B92A9]">— max once per lead per day</span>
                      </p>
                      {builtIn ? (
                        <>
                          <AutomationEditor
                            value={builtInDraft[o.automationKey] || builtIn}
                            disabled={ro}
                            onChange={(val) => setBuiltInDraft((d) => ({ ...d, [o.automationKey]: val }))} />
                          {!ro && (
                            <div className="flex items-center gap-2 mt-2">
                              <button type="button"
                                disabled={!builtInDraft[o.automationKey]}
                                onClick={async () => {
                                  try {
                                    await saveAutomation("outcome", o.automationKey, builtInDraft[o.automationKey]);
                                    setBuiltInDraft((d) => { const n = { ...d }; delete n[o.automationKey]; return n; });
                                    setAutoMsg({ i, ok: true, text: "Message settings saved." });
                                  } catch (e) {
                                    setAutoMsg({ i, ok: false, text: e.response?.data?.message || "Save failed." });
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[12px] font-semibold disabled:opacity-40">Save message settings</button>
                              {autoMsg?.i === i && <span className={`text-[12px] ${autoMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{autoMsg.text}</span>}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <AutomationEditor value={o.automation} disabled={ro} onChange={(val) => upd(i, "automation", val)} />
                          <p className="text-[11px] text-[#8B92A9] mt-1">Saved together with the outcome list (Save button above).</p>
                        </>
                      )}
                    </div>
                  )}
                  {o.key && o.key !== o.label && <p className="text-[11px] text-[#8B92A9]">Stored as “{o.key}”.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── TEMPERATURES ─────────────────────────────────────────────────────────────
function TemperaturesTab({ draft, set, ro }) {
  const list = draft.temperatures;
  const upd = (i, k, v) => set("temperatures", list.map((t, j) => j === i ? { ...t, [k]: v } : t));
  return (
    <Section title="Lead quality"
      desc="The quality buttons agents see (default Hot / Warm / Cold). A quality marked “Runs cold flow” sends the lead to the Cold verification workflow."
      right={!ro && <button type="button" onClick={() => set("temperatures", [...list, { key: "", label: "", color: "slate", order: list.length + 1, active: true, system: false, triggersColdFlow: false, _new: true }])}
        className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Add quality</button>}>
      <div className="space-y-2">
        {list.map((t, i) => (
          <div key={t.key || `new-${i}`} className={`rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 grid grid-cols-[auto_auto_1fr_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center ${!t.active ? "opacity-60" : ""}`}>
            <OrderButtons index={i} length={list.length} onMove={(a, d) => !ro && set("temperatures", moveItem(list, a, d))} />
            <ColorPicker value={t.color} onChange={(v) => !ro && upd(i, "color", v)} />
            <input value={t.label} disabled={ro} placeholder="Quality name"
              onChange={(e) => { const v = e.target.value; set("temperatures", list.map((x, j) => j === i ? { ...x, label: v, ...(x._new ? { key: v } : {}) } : x)); }} className={INPUT} />
            <Toggle small on={t.active} disabled={ro} onChange={(v) => upd(i, "active", v)} label="Active" />
            <Toggle small on={t.triggersColdFlow} disabled={ro} onChange={(v) => upd(i, "triggersColdFlow", v)} label="Runs cold flow" />
            <div className="flex justify-end">
              {t.system ? <Pill tone="indigo">Built-in</Pill> : (!ro && (
                <button type="button" onClick={() => set("temperatures", list.filter((_, j) => j !== i))} className="p-2 text-[#8B92A9] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── LISTS ────────────────────────────────────────────────────────────────────
const LIST_INFO = {
  sources:              ["Lead sources", "Shown when adding leads and in source filters. Integrations (Meta, Google, Website, WhatsApp) still tag their own source."],
  meetingTypes:         ["Client meeting types", "Options when logging a client meeting (web + app)."],
  meetingOutcomes:      ["Client meeting outcomes", "Result options for a logged meeting."],
  closeReasons:         ["Close reasons", "Quick reasons when a lead is closed as a wrong entry."],
  notInterestedReasons: ["Not-interested reasons", "Quick reasons offered when marking a lead Not Interested."],
  industries:           ["Industries", "Industry dropdown on leads (also drives industry-specific nurture templates)."],
  services:             ["Services / products", "What the lead is interested in."],
  languages:            ["Languages", "Lead language options for routing to agents who speak it."],
};
function ListsTab({ draft, patch, ro }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {Object.keys(LIST_INFO).map((k) => (
        <Section key={k} title={LIST_INFO[k][0]} desc={LIST_INFO[k][1]}>
          {ro
            ? <div className="flex flex-wrap gap-1.5">{(draft.lists[k] || []).map((x) => <span key={x} className="px-2 py-1 rounded-lg bg-[#F1F4FA] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-white">{x}</span>)}</div>
            : <TagEditor items={draft.lists[k] || []} onChange={(v) => patch("lists", k, v)} />}
        </Section>
      ))}
    </div>
  );
}

// ── LEAD FIELDS + CUSTOM FIELDS ─────────────────────────────────────────────
function FieldsTab({ draft, set, patch, ro }) {
  const lf = draft.leadFields;
  const cf = draft.customFields;
  const updCf = (i, k, v) => set("customFields", cf.map((f, j) => j === i ? { ...f, [k]: v } : f));
  return (
    <>
      <Section title="Built-in lead fields" desc="Rename, hide or make required. Name and primary phone are always required.">
        <div className="divide-y divide-[#E4E7EF] dark:divide-[#262A38]">
          {Object.entries(lf).map(([k, f]) => (
            <div key={k} className="py-2.5 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
              <input value={f.label} disabled={ro} onChange={(e) => patch("leadFields", `${k}.label`, e.target.value)} className={INPUT} />
              <Toggle small on={f.visible} disabled={ro || k === "remark"} onChange={(v) => patch("leadFields", `${k}.visible`, v)} label="Visible" />
              <Toggle small on={f.required} disabled={ro || !f.visible} onChange={(v) => patch("leadFields", `${k}.required`, v)} label="Required" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Custom fields"
        desc="Add your own fields to every lead — budget, property type, course, vehicle model… They appear in add/edit forms and the lead details, and can be filled from CSV imports by matching the column name."
        right={!ro && <button type="button" onClick={() => set("customFields", [...cf, { key: "", label: "", type: "text", options: [], required: false, active: true, showInList: false, showInForm: true, employeeVisible: true, employeeEditable: true, placeholder: "", helpText: "", order: cf.length + 1 }])}
          className="px-3 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Add field</button>}>
        {cf.length === 0 && <p className="text-[12px] text-[#8B92A9] italic">No custom fields yet.</p>}
        <div className="space-y-2">
          {cf.map((f, i) => (
            <div key={f.key || `cf-${i}`} className={`rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3 space-y-3 ${!f.active ? "opacity-60" : ""}`}>
              <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_170px_1fr_auto] gap-2 items-center">
                <OrderButtons index={i} length={cf.length} onMove={(a, d) => !ro && set("customFields", moveItem(cf, a, d))} />
                <input value={f.label} disabled={ro} placeholder="Field label (e.g. Budget)" onChange={(e) => updCf(i, "label", e.target.value)} className={INPUT} />
                <select value={f.type} disabled={ro} onChange={(e) => updCf(i, "type", e.target.value)} className={SELECT + " hidden md:block"}>
                  {META.customFieldTypes.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t] || t}</option>)}
                </select>
                <input value={f.placeholder} disabled={ro} placeholder="Placeholder (optional)" onChange={(e) => updCf(i, "placeholder", e.target.value)} className={INPUT + " hidden md:block"} />
                {!ro && <button type="button" onClick={() => set("customFields", cf.filter((_, j) => j !== i))} className="p-2 text-[#8B92A9] hover:text-red-500" title="Delete field"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="md:hidden">
                <select value={f.type} disabled={ro} onChange={(e) => updCf(i, "type", e.target.value)} className={SELECT}>
                  {META.customFieldTypes.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t] || t}</option>)}
                </select>
              </div>
              {(f.type === "select" || f.type === "multiselect") && (
                <Field label="Options">
                  {ro ? <p className="text-[12px]">{f.options.join(", ")}</p> : (
                    <TagEditor items={f.options} onChange={(v) => updCf(i, "options", v)} placeholder="Add an option" />
                  )}
                </Field>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Toggle small on={f.active} disabled={ro} onChange={(v) => updCf(i, "active", v)} label="Active" />
                <Toggle small on={f.required} disabled={ro} onChange={(v) => updCf(i, "required", v)} label="Required" />
                <Toggle small on={f.showInForm} disabled={ro} onChange={(v) => updCf(i, "showInForm", v)} label="Show in add-lead form" />
                <Toggle small on={f.showInList} disabled={ro} onChange={(v) => updCf(i, "showInList", v)} label="Show as a column" />
                <Toggle small on={f.employeeVisible} disabled={ro} onChange={(v) => updCf(i, "employeeVisible", v)} label="Employees can see" />
                <Toggle small on={f.employeeEditable} disabled={ro || !f.employeeVisible} onChange={(v) => updCf(i, "employeeEditable", v)} label="Employees can edit" />
                {f.key && <span className="text-[11px] text-[#8B92A9]">CSV column: “{f.label}” or “{f.key}”</span>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ── WORKFLOWS ────────────────────────────────────────────────────────────────
function StatusSelect({ draft, value, onChange, disabled, cats }) {
  const opts = draft.statuses.filter((s) => !cats || cats.includes(s.category));
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={SELECT}>
      {opts.map((s) => <option key={s.key} value={s.key}>{s.label}{!s.active ? " (inactive)" : ""}</option>)}
    </select>
  );
}

function FollowUpScheduleEditor({ items, onChange, disabled }) {
  return (
    <div className="space-y-2">
      {items.map((f, i) => (
        <div key={i} className="grid grid-cols-[150px_100px_1fr_auto] gap-2 items-center">
          <select value={f.type} disabled={disabled} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className={SELECT}>
            <option value="follow-up">Follow-up call</option>
            <option value="verification">Verification call</option>
          </select>
          <div className="relative">
            <input type="number" min={0} max={365} value={f.days} disabled={disabled} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, days: Number(e.target.value) } : x))} className={INPUT + " pr-10"} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8B92A9]">days</span>
          </div>
          <input value={f.note} disabled={disabled} placeholder="Note shown to the agent" onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} className={INPUT} />
          {!disabled && <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-2 text-[#8B92A9] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
        </div>
      ))}
      {!disabled && items.length < 10 && (
        <button type="button" onClick={() => onChange([...items, { type: "follow-up", days: 3, note: "" }])}
          className="text-[12px] font-semibold text-[#2563EB] flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add scheduled call</button>
      )}
    </div>
  );
}

function WorkflowsTab({ draft, patch, ro }) {
  const w = draft.workflows;
  const P = (path) => (v) => patch("workflows", path, v);
  return (
    <>
      <Section title="Updating a lead">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle on={w.leadUpdate.remarkRequired} disabled={ro} onChange={P("leadUpdate.remarkRequired")} label="Remark is required" hint="Agents must write a remark when logging a call." />
          <Toggle on={w.leadUpdate.preventPastFollowUp} disabled={ro} onChange={P("leadUpdate.preventPastFollowUp")} label="Block follow-up dates in the past" />
          <Toggle on={w.leadUpdate.autoAdvanceStatusFromOutcome} disabled={ro} onChange={P("leadUpdate.autoAdvanceStatusFromOutcome")} label="Move status from the outcome" hint="Uses each outcome’s “Move lead to status”. Never moves a lead backwards." />
          <Toggle on={w.leadUpdate.hideInterestedOnceInterested} disabled={ro} onChange={P("leadUpdate.hideInterestedOnceInterested")} label="Hide “Interested” once a lead is interested" />
          <Toggle on={w.leadUpdate.completeOldestPendingOnUpdate} disabled={ro} onChange={P("leadUpdate.completeOldestPendingOnUpdate")} label="Each update completes the oldest pending follow-up" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Automatic follow-up after (days)">
              <input type="number" min={0} max={365} value={w.leadUpdate.defaultFollowUpDays} disabled={ro} onChange={(e) => P("leadUpdate.defaultFollowUpDays")(Number(e.target.value))} className={INPUT} />
            </Field>
            <Field label="…at hour (0-23)">
              <input type="number" min={0} max={23} value={w.leadUpdate.defaultFollowUpHour} disabled={ro} onChange={(e) => P("leadUpdate.defaultFollowUpHour")(Number(e.target.value))} className={INPUT} />
            </Field>
          </div>
          <Field label="Outcome stored when none is picked">
            <input value={w.leadUpdate.defaultOutcomeWhenMissing} disabled={ro} onChange={(e) => P("leadUpdate.defaultOutcomeWhenMissing")(e.target.value)} className={INPUT} />
          </Field>
        </div>
      </Section>

      <Section title="New leads & assignment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Assign new leads by" hint="Least loaded = employee with the fewest open leads.">
            <select value={w.assignment.strategy} disabled={ro} onChange={(e) => P("assignment.strategy")(e.target.value)} className={SELECT}>
              <option value="least_loaded">Least loaded employee</option>
              <option value="round_robin">Round robin (in turn)</option>
              <option value="manual">Manual — leave unassigned</option>
            </select>
          </Field>
          <Field label="Admin imports (CSV / Excel)">
            <select value={w.assignment.importStrategy} disabled={ro} onChange={(e) => P("assignment.importStrategy")(e.target.value)} className={SELECT}>
              <option value="round_robin">Round robin</option>
              <option value="least_loaded">Least loaded</option>
              <option value="unassigned">Leave unassigned</option>
            </select>
          </Field>
          <Field label="Default source (manual leads)"><input value={w.leadCreation.defaultSource} disabled={ro} onChange={(e) => P("leadCreation.defaultSource")(e.target.value)} className={INPUT} /></Field>
          <Field label="Default source (imports)"><input value={w.leadCreation.defaultImportSource} disabled={ro} onChange={(e) => P("leadCreation.defaultImportSource")(e.target.value)} className={INPUT} /></Field>
          <Field label="Default remark (manual leads)"><input value={w.leadCreation.defaultRemark} disabled={ro} onChange={(e) => P("leadCreation.defaultRemark")(e.target.value)} className={INPUT} /></Field>
          <Field label="Default remark (imports)"><input value={w.leadCreation.defaultImportRemark} disabled={ro} onChange={(e) => P("leadCreation.defaultImportRemark")(e.target.value)} className={INPUT} /></Field>
          <Toggle on={w.leadCreation.autoTemperature} disabled={ro} onChange={P("leadCreation.autoTemperature")} label="Auto-grade lead quality" hint="Guess Hot / Warm / Cold from how complete the enquiry is." />
        </div>
      </Section>

      <Section title="Not Interested flow" desc="What happens when an agent marks a lead Not Interested.">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <Toggle on={w.notInterested.enabled} disabled={ro} onChange={P("notInterested.enabled")} label="Use this workflow" hint="Off = just set the lost status, nothing else." />
            <Toggle on={w.notInterested.verification} disabled={ro || !w.notInterested.enabled} onChange={P("notInterested.verification")} label="Second-agent verification" hint="Send to another agent to double-check first." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="While verifying"><StatusSelect draft={draft} value={w.notInterested.verificationStatus} disabled={ro} onChange={P("notInterested.verificationStatus")} /></Field>
            <Field label="Confirmed not interested"><StatusSelect draft={draft} value={w.notInterested.finalStatus} disabled={ro} onChange={P("notInterested.finalStatus")} /></Field>
            <Field label="If marked again later"><StatusSelect draft={draft} value={w.notInterested.resetStatus} disabled={ro} onChange={P("notInterested.resetStatus")} /></Field>
          </div>
          <Field label="Calls scheduled automatically">
            <FollowUpScheduleEditor items={w.notInterested.followUps} disabled={ro || !w.notInterested.enabled} onChange={P("notInterested.followUps")} />
          </Field>
        </div>
      </Section>

      <Section title="Cold lead flow" desc="Runs when an agent picks a quality marked “Runs cold flow”.">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <Toggle on={w.cold.enabled} disabled={ro} onChange={P("cold.enabled")} label="Use this workflow" />
            <Toggle on={w.cold.verification} disabled={ro || !w.cold.enabled} onChange={P("cold.verification")} label="Second-agent verification" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="While verifying"><StatusSelect draft={draft} value={w.cold.verificationStatus} disabled={ro} onChange={P("cold.verificationStatus")} /></Field>
            <Field label="When returned"><StatusSelect draft={draft} value={w.cold.returnStatus} disabled={ro} onChange={P("cold.returnStatus")} /></Field>
          </div>
          <Field label="Calls scheduled automatically">
            <FollowUpScheduleEditor items={w.cold.followUps} disabled={ro || !w.cold.enabled} onChange={P("cold.followUps")} />
          </Field>
        </div>
      </Section>

      <Section title="Invalid lead flow" desc="Wrong / junk numbers.">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <Toggle on={w.invalid.enabled} disabled={ro} onChange={P("invalid.enabled")} label="Allow marking leads invalid" />
            <Toggle on={w.invalid.verification} disabled={ro || !w.invalid.enabled} onChange={P("invalid.verification")} label="Second-agent verification" hint="Off = close immediately." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="While verifying"><StatusSelect draft={draft} value={w.invalid.verificationStatus} disabled={ro} onChange={P("invalid.verificationStatus")} /></Field>
            <Field label="Closed invalid leads get"><StatusSelect draft={draft} value={w.invalid.closedStatus} disabled={ro} onChange={P("invalid.closedStatus")} /></Field>
            <Field label="If the verifier disagrees"><StatusSelect draft={draft} value={w.invalid.resetStatus} disabled={ro} onChange={P("invalid.resetStatus")} /></Field>
          </div>
        </div>
      </Section>

      <Section title="Employees closing leads">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <Toggle on={w.closeByEmployee.enabled} disabled={ro} onChange={P("closeByEmployee.enabled")} label="Allowed" />
          <Toggle on={w.closeByEmployee.requirePhone} disabled={ro || !w.closeByEmployee.enabled} onChange={P("closeByEmployee.requirePhone")} label="Require the dialled number" />
          <Field label="Closed leads get"><StatusSelect draft={draft} value={w.closeByEmployee.closedStatus} disabled={ro} onChange={P("closeByEmployee.closedStatus")} /></Field>
        </div>
      </Section>
    </>
  );
}

// ── ALERTS ───────────────────────────────────────────────────────────────────
function AlertsTab({ draft, patch, ro, automations, saveAutomation }) {
  const a = draft.alerts;
  const P = (path) => (v) => patch("alerts", path, v);
  const num = (path, v, min = 0) => P(path)(Math.max(min, Number(v)));
  const [fu, setFu] = useState(null);
  const [fuMsg, setFuMsg] = useState(null);
  const fuValue = fu || automations?.followUpReminder;
  return (
    <>
      <Section title="No-action alerts" desc="Warn admins when a newly assigned lead hasn’t been called, then escalate to the super admin.">
        <div className="space-y-4">
          <Toggle on={a.noAction.enabled} disabled={ro} onChange={P("noAction.enabled")} label="Enabled" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="First alert after (hours)"><input type="number" step="0.25" min={0.25} value={a.noAction.firstAlertHours} disabled={ro || !a.noAction.enabled} onChange={(e) => num("noAction.firstAlertHours", e.target.value, 0.25)} className={INPUT} /></Field>
            <Field label="Second alert after (hours)"><input type="number" step="0.25" min={0.25} value={a.noAction.secondAlertHours} disabled={ro || !a.noAction.enabled} onChange={(e) => num("noAction.secondAlertHours", e.target.value, 0.25)} className={INPUT} /></Field>
            <Field label="Escalate after (hours)"><input type="number" step="0.25" min={0.25} value={a.noAction.escalationHours} disabled={ro || !a.noAction.enabled || !a.noAction.escalationEnabled} onChange={(e) => num("noAction.escalationHours", e.target.value, 0.25)} className={INPUT} /></Field>
          </div>
          <Toggle on={a.noAction.escalationEnabled} disabled={ro || !a.noAction.enabled} onChange={P("noAction.escalationEnabled")} label="Escalate to super admin" />
        </div>
      </Section>

      <Section title="Missing follow-up date" desc="Nudge the employee when a lead has no follow-up scheduled.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Toggle on={a.noFollowUpDate.enabled} disabled={ro} onChange={P("noFollowUpDate.enabled")} label="Enabled" />
          <Field label="After lead is (hours) old"><input type="number" min={1} value={a.noFollowUpDate.afterHours} disabled={ro || !a.noFollowUpDate.enabled} onChange={(e) => num("noFollowUpDate.afterHours", e.target.value, 1)} className={INPUT} /></Field>
          <Field label="Repeat every (hours)"><input type="number" min={1} value={a.noFollowUpDate.repeatEveryHours} disabled={ro || !a.noFollowUpDate.enabled} onChange={(e) => num("noFollowUpDate.repeatEveryHours", e.target.value, 1)} className={INPUT} /></Field>
        </div>
      </Section>

      <Section title="Follow-up reminders to your team">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Toggle on={a.followUpDigest.enabled} disabled={ro} onChange={P("followUpDigest.enabled")} label="Daily “due today / overdue” digest" />
            <Field label="Send at (company time)"><input type="time" value={a.followUpDigest.time} disabled={ro || !a.followUpDigest.enabled} onChange={(e) => P("followUpDigest.time")(e.target.value)} className={INPUT} /></Field>
          </div>
          <div className="space-y-3">
            <Toggle on={a.callReminder.enabled} disabled={ro} onChange={P("callReminder.enabled")} label="Remind before each scheduled call" />
            <Field label="Minutes before"><input type="number" min={5} max={240} value={a.callReminder.minutesBefore} disabled={ro || !a.callReminder.enabled} onChange={(e) => num("callReminder.minutesBefore", e.target.value, 5)} className={INPUT} /></Field>
          </div>
        </div>
      </Section>

      <Section title="Follow-up reminders to the lead" desc="WhatsApp / email nudges sent to leads with a due follow-up.">
        <div className="space-y-4">
          <Toggle on={a.leadFollowUpReminder.enabled} disabled={ro} onChange={P("leadFollowUpReminder.enabled")} label="Enabled" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Field label="Every (days)"><input type="number" min={1} max={60} value={a.leadFollowUpReminder.intervalDays} disabled={ro || !a.leadFollowUpReminder.enabled} onChange={(e) => num("leadFollowUpReminder.intervalDays", e.target.value, 1)} className={INPUT} /></Field>
            <Field label="Morning at"><input type="time" value={a.leadFollowUpReminder.morningTime} disabled={ro || !a.leadFollowUpReminder.enabled} onChange={(e) => P("leadFollowUpReminder.morningTime")(e.target.value)} className={INPUT} /></Field>
            <Field label="Evening at"><input type="time" value={a.leadFollowUpReminder.eveningTime} disabled={ro || !a.leadFollowUpReminder.enabled || !a.leadFollowUpReminder.eveningEnabled} onChange={(e) => P("leadFollowUpReminder.eveningTime")(e.target.value)} className={INPUT} /></Field>
            <Toggle on={a.leadFollowUpReminder.eveningEnabled} disabled={ro || !a.leadFollowUpReminder.enabled} onChange={P("leadFollowUpReminder.eveningEnabled")} label="Evening send" />
          </div>
          {fuValue && (
            <div>
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white mb-2">Message content</p>
              <AutomationEditor value={fuValue} disabled={ro} onChange={setFu} />
              {!ro && (
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" disabled={!fu} onClick={async () => {
                    try { await saveAutomation("followUp", null, fu); setFu(null); setFuMsg({ ok: true, text: "Message saved." }); }
                    catch (e) { setFuMsg({ ok: false, text: e.response?.data?.message || "Save failed." }); }
                  }} className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[12px] font-semibold disabled:opacity-40">Save message</button>
                  {fuMsg && <span className={`text-[12px] ${fuMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{fuMsg.text}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

// ── PERMISSIONS ──────────────────────────────────────────────────────────────
const PERM_LABELS = {
  employee: {
    canAddLeads: "Add leads", canImportLeads: "Import leads (CSV / Excel)", canEditLeadDetails: "Edit lead details",
    canEditPhoneNumbers: "Edit phone numbers", canDeleteLeads: "Delete leads", canCloseLeads: "Close leads",
    canMarkInvalid: "Mark leads invalid", canMarkNotInterested: "Mark leads not interested", canMarkCold: "Mark leads cold",
    canMergeLeads: "Merge duplicate leads", canRevealContact: "Reveal masked phone / email",
    canChangeTemperature: "Change lead quality", canScheduleFollowUps: "Schedule follow-ups",
    canExportLeads: "Export leads", canLogClientMeetings: "Log client meetings",
  },
  admin: {
    canDeleteLeads: "Delete leads", canImportLeads: "Import leads",
    canExportLeads: "Export leads", canReassignLeads: "Reassign leads",
  },
};
function PermissionsTab({ draft, patch, ro }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {["employee", "admin"].map((role) => (
        <Section key={role} title={role === "employee" ? "Employees can…" : "Admins can…"}
          desc={role === "admin" ? "The company super admin can always do everything." : "Enforced on the server for web and the mobile app."}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(PERM_LABELS[role]).map(([k, label]) => (
              <Toggle key={k} on={draft.permissions[role][k]} disabled={ro} onChange={(v) => patch("permissions", `${role}.${k}`, v)} label={label} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

// ── GENERAL ──────────────────────────────────────────────────────────────────
const TZ = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Colombo", "Asia/Riyadh", "Asia/Qatar", "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "Africa/Nairobi", "UTC"];
const WIDGET_LABELS = {
  kpis: "KPI cards", pipeline: "Pipeline", sources: "Lead sources", temperature: "Lead quality",
  followUps: "Follow-ups", employeePerformance: "Employee performance", recentLeads: "Recent leads", campaigns: "Campaigns",
};
function GeneralTab({ draft, patch, ro }) {
  const g = draft.general;
  const tzList = TZ.includes(g.timezone) ? TZ : [g.timezone, ...TZ];
  return (
    <>
      <Section title="Branding & region">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="App name (sidebar & header)" hint="Blank = your company brand name."><input value={g.appName} disabled={ro} placeholder="e.g. Acme Sales" onChange={(e) => patch("general", "appName", e.target.value)} className={INPUT} /></Field>
          <Field label="Timezone" hint="Alerts, reminders and “today” follow this.">
            <select value={g.timezone} disabled={ro} onChange={(e) => patch("general", "timezone", e.target.value)} className={SELECT}>
              {tzList.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Currency"><input value={g.currency} maxLength={3} disabled={ro} onChange={(e) => patch("general", "currency", e.target.value.toUpperCase())} className={INPUT} /></Field>
          <Field label="Default country calling code" hint="Used for 10-digit numbers (e.g. Meta conversion matching)."><input value={g.defaultCountryCode} disabled={ro} onChange={(e) => patch("general", "defaultCountryCode", e.target.value.replace(/\D/g, ""))} className={INPUT} /></Field>
        </div>
      </Section>

      <Section title="Terminology" desc="Call things what your team calls them — e.g. “Enquiry” instead of “Lead”, “Counsellor” instead of “Employee”.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(g.terminology).map(([k, v]) => (
            <Field key={k} label={k}><input value={v} disabled={ro} onChange={(e) => patch("general", `terminology.${k}`, e.target.value)} className={INPUT} /></Field>
          ))}
        </div>
      </Section>

      <Section title="Messaging" desc="{{company}} and {{name}} are filled in automatically.">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Default SMS greeting" hint="Used when an SMS automation has no message of its own, and for SMS history.">
            <textarea rows={3} value={draft.messaging.smsGreeting} disabled={ro} onChange={(e) => patch("messaging", "smsGreeting", e.target.value)} className={INPUT + " resize-y"} />
          </Field>
          <Field label="Daily Telegram report title">
            <input value={draft.messaging.dailyReportTitle} disabled={ro} onChange={(e) => patch("messaging", "dailyReportTitle", e.target.value)} className={INPUT} />
          </Field>
        </div>
      </Section>

      <Section title="Dashboard sections" desc="Hide dashboard sections your team doesn’t use.">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(draft.dashboard.widgets).map(([k, v]) => (
            <Toggle key={k} on={v} disabled={ro} onChange={(x) => patch("dashboard", `widgets.${k}`, x)} label={WIDGET_LABELS[k] || k} />
          ))}
        </div>
      </Section>
    </>
  );
}
