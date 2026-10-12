// src/marketing/mkt/CampaignFilter.jsx — NEW FILE
// "Which campaigns?" picker for the Meta Ads performance section: search, tick one or several, Apply.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { filterOptions, toggleId, MAX_SELECTED, fMoney0 } from "./metaPerfUtils";

const STATUS_DOT = { ACTIVE: "bg-emerald-500", PAUSED: "bg-amber-500" };

export default function CampaignFilter({ options, selected, names, onApply, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [query, setQuery] = useState("");
  const box = useRef(null);

  const toggleOpen = () => { if (!open) { setDraft(selected); setQuery(""); } setOpen(!open); };

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const shown = filterOptions(options, query);
  const label = !selected.length ? "All campaigns" : selected.length === 1 ? (names[selected[0]] || "1 campaign") : `${selected.length} campaigns`;
  const apply = () => { onApply(draft, Object.fromEntries(options.filter((o) => draft.includes(o.id)).map((o) => [o.id, o.name]))); setOpen(false); };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggleOpen} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label="Filter by campaign"
        className={`inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${selected.length ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-200 dark:hover:bg-white/5"}`}>
        <span className="truncate">{label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose campaigns" className="absolute right-0 z-30 mt-1.5 w-[340px] max-w-[92vw] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#262E40] dark:bg-[#171C28]">
          <div className="relative border-b border-slate-100 p-2 dark:border-[#1A2030]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns…" aria-label="Search campaigns"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-[12px] text-slate-800 outline-none focus:border-violet-400 dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100" />
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-[300px] overflow-auto py-1">
            {!shown.length && <li className="px-4 py-6 text-center text-[12px] text-slate-500">{options.length ? "No campaign matches." : "No campaigns with delivery in this period."}</li>}
            {shown.map((c) => {
              const on = draft.includes(c.id);
              return (
                <li key={c.id} role="option" aria-selected={on}>
                  <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12.5px] hover:bg-slate-50 dark:hover:bg-white/5 ${on ? "bg-violet-50/60 dark:bg-violet-950/20" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => setDraft((d) => toggleId(d, c.id))} className="h-3.5 w-3.5 accent-violet-600" />
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status] || "bg-slate-300"}`} title={c.status || ""} />
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100" title={c.name}>{c.name}</span>
                    <span className="shrink-0 tabular-nums text-[11.5px] text-slate-500">{fMoney0(c.spend)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 dark:border-[#1A2030]">
            <div className="flex gap-3 text-[12px]">
              <button type="button" onClick={() => setDraft(shown.slice(0, MAX_SELECTED).map((c) => c.id))} className="font-medium text-violet-700 hover:underline dark:text-violet-300">Select shown</button>
              <button type="button" onClick={() => setDraft([])} className="font-medium text-slate-500 hover:underline">Clear</button>
            </div>
            <button type="button" onClick={apply} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-700">
              <Check className="h-3.5 w-3.5" />{draft.length ? `Show ${draft.length} campaign${draft.length === 1 ? "" : "s"}` : "Show all campaigns"}
            </button>
          </div>
          {draft.length >= MAX_SELECTED && <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-amber-700 dark:border-[#1A2030] dark:text-amber-300">You can pick up to {MAX_SELECTED} campaigns.</p>}
        </div>
      )}
    </div>
  );
}

// The chips under the header: what is currently filtered, each removable.
export function FilterChips({ ids, names, onRemove, onClear }) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]" aria-label="Active campaign filter">
      <span className="text-slate-500">Showing only:</span>
      {ids.map((id) => (
        <span key={id} className="inline-flex max-w-[280px] items-center gap-1 rounded-full border border-violet-200 bg-violet-50 py-0.5 pl-2.5 pr-1 font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
          <span className="truncate" title={names[id] || id}>{names[id] || `Campaign ${id}`}</span>
          <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${names[id] || id}`} className="rounded-full p-0.5 hover:bg-violet-200/60 dark:hover:bg-violet-800/50"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="font-medium text-slate-500 underline-offset-2 hover:underline">Clear filter</button>
    </div>
  );
}
