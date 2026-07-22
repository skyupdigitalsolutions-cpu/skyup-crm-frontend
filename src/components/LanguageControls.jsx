import { useState, useEffect, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import { Languages, Check, X, Plus, Pencil, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable language controls for lead handling by language.
//   <LanguageFilter value onChange />                       — leads-page filter
//   <LeadLanguageBadge lead onChange />                     — per-lead badge + editor
//   <EmployeeLanguages user onSaved />                      — per-employee editor
//   matchesLanguage(user, lang) / suggestAssignees(users, lang)  — helpers
// Endpoints: GET /admin/leads/languages · PATCH /admin/leads/:id/language · PUT /admin/users/:id/languages
// ─────────────────────────────────────────────────────────────────────────────

// Common languages offered as quick picks (users can type any other).
export const COMMON_LANGUAGES = [
  "English", "Hindi", "Arabic", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Gujarati", "Bengali", "Punjabi", "Urdu",
];

const chip = "text-[11px] font-semibold px-2 py-0.5 rounded-full";

// ── Helpers ───────────────────────────────────────────────────────────────────
export function matchesLanguage(user, lang) {
  if (!lang) return true;
  const langs = (user && Array.isArray(user.languages)) ? user.languages : [];
  return langs.some((l) => String(l).toLowerCase() === String(lang).toLowerCase());
}
export function suggestAssignees(users, lang) {
  const list = Array.isArray(users) ? users : [];
  if (!lang) return list;
  const match = list.filter((u) => matchesLanguage(u, lang));
  return match.length ? match : list; // fall back to everyone if none match
}

// ── Leads-page filter dropdown ────────────────────────────────────────────────
export function LanguageFilter({ value, onChange, className = "" }) {
  const [langs, setLangs] = useState([]);
  useEffect(() => {
    let ok = true;
    api.get("/admin/leads/languages").then(({ data }) => { if (ok) setLangs(data.languages || []); }).catch(() => {});
    return () => { ok = false; };
  }, []);
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Languages className="w-3.5 h-3.5 text-[#8B92A9]" />
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="text-[12px] font-semibold bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2.5 py-1.5 focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]">
        <option value="">All languages</option>
        {langs.map((l) => <option key={l} value={l}>{l}</option>)}
        <option value="none">— No language —</option>
      </select>
    </div>
  );
}

// ── Per-lead badge + quick editor ─────────────────────────────────────────────
export function LeadLanguageBadge({ lead, onChange, editable = true }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(lead?.language || "");
  const [saving, setSaving] = useState(false);
  const save = async (v) => {
    setSaving(true);
    try {
      await api.patch(`/admin/leads/${lead._id}/language`, { language: v });
      onChange && onChange(lead._id, v);
      setEditing(false);
    } catch (e) { /* keep open */ } finally { setSaving(false); }
  };
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input list="lang-suggestions" autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(val.trim()); if (e.key === "Escape") setEditing(false); }}
          placeholder="Language" className="w-24 text-[11px] px-2 py-0.5 rounded-md border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none" />
        <datalist id="lang-suggestions">{COMMON_LANGUAGES.map((l) => <option key={l} value={l} />)}</datalist>
        <button onClick={() => save(val.trim())} disabled={saving} className="text-emerald-600">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
        <button onClick={() => setEditing(false)} className="text-[#8B92A9]"><X className="w-3.5 h-3.5" /></button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {lead?.language
        ? <span className={`${chip} bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30`}>{lead.language}</span>
        : <span className={`${chip} bg-slate-100 text-slate-400 dark:bg-white/5`}>—</span>}
      {editable && <button onClick={() => { setVal(lead?.language || ""); setEditing(true); }} className="text-[#8B92A9] hover:text-indigo-600"><Pencil className="w-3 h-3" /></button>}
    </span>
  );
}

// ── Per-employee languages editor ─────────────────────────────────────────────
export function EmployeeLanguages({ user, onSaved, compact = false }) {
  const [langs, setLangs] = useState(Array.isArray(user?.languages) ? user.languages : []);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstRun = useRef(true);
  // Unique datalist ID per user so multiple rows don't share the same list
  const listId = `emp-lang-${user?._id || user?.id || Math.random().toString(36).slice(2)}`;

  useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } setDirty(true); }, [langs]);

  const add = (v) => { const t = String(v).trim(); if (t && !langs.some((l) => l.toLowerCase() === t.toLowerCase())) setLangs([...langs, t]); setInput(""); };
  const remove = (l) => setLangs(langs.filter((x) => x !== l));
  const save = async () => {
    setSaving(true);
    try { await api.put(`/admin/users/${user._id}/languages`, { languages: langs }); setDirty(false); onSaved && onSaved(user._id, langs); }
    catch (e) { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div className={compact ? "" : "space-y-2"}>
      <div className="flex flex-wrap gap-1.5 items-center">
        {langs.length === 0 && <span className="text-[11px] text-[#8B92A9]">No languages set</span>}
        {langs.map((l) => (
          <span key={l} className={`${chip} bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 inline-flex items-center gap-1`}>
            {l}<button onClick={() => remove(l)} className="hover:text-rose-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <select value={input} onChange={(e) => { if (e.target.value) { add(e.target.value); } }}
          className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]">
          <option value="">Add language + Enter</option>
          {COMMON_LANGUAGES.filter((l) => !langs.some((x) => x.toLowerCase() === l.toLowerCase())).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder="Or type custom…" className="w-24 text-[12px] px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none" />
        <button onClick={() => add(input)} className="p-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[#8B92A9] hover:text-indigo-600"><Plus className="w-3.5 h-3.5" /></button>
        {dirty && <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
        </button>}
      </div>
    </div>
  );
}
