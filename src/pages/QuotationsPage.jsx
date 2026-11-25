// pages/QuotationsPage.jsx — /quotations
// Every quotation in one place (admins: the whole company; employees: theirs and
// those on their leads). New / edit / upload / template settings open on this
// page. A quotation is linked to its lead automatically from the client details
// (phone / email match), or by hand — and can be made without a lead and linked
// later. The "Quote" button on a lead opens this page with that lead linked.
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Plus, Upload, Settings2, Search, Printer, Pencil, Trash2, Loader2, Link2, ExternalLink, X } from "lucide-react";
import api from "../data/axiosConfig";
import { getRole } from "../data/dataService";
import QuotationModal from "../components/QuotationModal";
import { money, printQuotation } from "../components/quotation/quotationTemplate";

const STATUS_STYLE = {
  draft:    "bg-[#F0F2FA] text-[#4B5168] dark:bg-[#1E2130] dark:text-[#9DA3BB]",
  sent:     "bg-[#EEF3FF] text-[#2563EB] dark:bg-[#1A2540] dark:text-[#4F8EF7]",
  accepted: "bg-[#f0fdf4] text-[#16A34A] dark:bg-[#052e1c] dark:text-[#4ADE80]",
  rejected: "bg-[#FEF2F2] text-[#DC2626] dark:bg-[#2D0A0A] dark:text-[#F87171]",
};
const inp = "px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#B0B6C6] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";
const btnGhost = "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12.5px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]";
const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function QuotationsPage() {
  const role = getRole();
  const isSuperAdmin = role === "superadmin";
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [allItems, setAllItems] = useState(null);   // unfiltered — for the summary cards
  const [settings, setSettings] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", linked: "", from: "", to: "" });
  const [editor, setEditor] = useState(null);   // null | { start, quotation?, lead? }
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get("/quotations", { params: p });
      setItems(r.data?.quotations || []);
    } catch (e) { setItems([]); showToast(e?.response?.data?.message || "Couldn't load quotations.", "error"); }
  }, [filters, showToast]);

  const loadAll = useCallback(() => {
    api.get("/quotations").then((r) => setAllItems(r.data?.quotations || [])).catch(() => {});
  }, []);
  const refresh = useCallback(() => { load(); loadAll(); }, [load, loadAll]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.status, filters.linked, filters.from, filters.to]);
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.search]);
  useEffect(() => {
    api.get("/quotations/settings").then((r) => { setSettings(r.data?.settings || {}); setCanEdit(!!r.data?.canEdit); }).catch(() => setSettings({}));
  }, []);

  // Coming from a lead's "Quote" button: /quotations?lead=<id>&name=<name>
  useEffect(() => {
    const id = params.get("lead");
    if (!id) return;
    setEditor({ start: "new", lead: { _id: id, id, name: params.get("name") || "" } });
    setParams({}, { replace: true });
  }, [params, setParams]);

  const counts = useMemo(() => {
    const list = allItems || [];
    const valueOf = (arr) => arr.filter((q) => q.showTotals !== false).reduce((a, q) => a + (Number(q.grandTotal) || 0), 0);
    const by = (st) => list.filter((q) => q.status === st);
    return {
      total: list.length, unlinked: list.filter((q) => !q.lead).length, accepted: by("accepted").length,
      quoted: valueOf(list), acceptedValue: valueOf(by("accepted")), sent: by("sent").length, sentValue: valueOf(by("sent")),
      drafts: by("draft").length,
    };
  }, [allItems]);

  const remove = async (q) => {
    if (!window.confirm(`Delete quotation ${q.number}? Its number won't be reused.`)) return;
    try { await api.delete(`/quotations/${q._id}`); showToast(`Quotation ${q.number} deleted`); refresh(); }
    catch (e) { showToast(e?.response?.data?.message || "Couldn't delete the quotation.", "error"); }
  };

  const toastEl = toast && (
    <div className={`fixed bottom-5 right-5 z-[1100] px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium text-white ${toast.type === "error" ? "bg-[#DC2626]" : "bg-[#16A34A]"}`}>{toast.message}</div>
  );

  // ── editor on the page ──
  if (editor) {
    return (
      <div className="p-4 sm:p-6">
        <QuotationModal
          key={`${editor.start}-${editor.quotation?._id || editor.lead?.id || "new"}`}
          mode="page" start={editor.start} startQuotation={editor.quotation || null}
          lead={editor.lead || null} isSuperAdmin={isSuperAdmin}
          onClose={() => setEditor(null)} onToast={showToast} onChanged={refresh} />
        {toastEl}
      </div>
    );
  }

  // ── list ──
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FileText className="w-6 h-6 text-[#2563EB]" />
        <div className="mr-auto">
          <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Quotations</h1>
          <p className="text-[12px] text-[#8B92A9]">Each quotation links to its lead automatically from the client's phone or email — or link it yourself.</p>
        </div>
        {canEdit && <button className={btnGhost} onClick={() => setEditor({ start: "settings" })}><Settings2 className="w-4 h-4" />Template settings</button>}
        <button className={btnGhost} onClick={() => setEditor({ start: "upload" })}><Upload className="w-4 h-4" />Upload PDF</button>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[13px] font-semibold" onClick={() => setEditor({ start: "new" })}>
          <Plus className="w-4 h-4" />New quotation
        </button>
      </div>

      {allItems && allItems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Quoted", value: money(counts.quoted), sub: `${counts.total} quotation${counts.total === 1 ? "" : "s"}${counts.drafts ? ` · ${counts.drafts} draft` : ""}`, on: () => setFilters((f) => ({ ...f, status: "" })), active: !filters.status && !filters.linked, tone: "text-[#0F1117] dark:text-[#F0F2FA]" },
            { label: "Accepted", value: money(counts.acceptedValue), sub: `${counts.accepted} won`, on: () => setFilters((f) => ({ ...f, status: "accepted", linked: "" })), active: filters.status === "accepted", tone: "text-[#16A34A]" },
            { label: "Awaiting reply", value: money(counts.sentValue), sub: `${counts.sent} sent`, on: () => setFilters((f) => ({ ...f, status: "sent", linked: "" })), active: filters.status === "sent", tone: "text-[#2563EB]" },
            { label: "Not linked to a lead", value: String(counts.unlinked), sub: counts.unlinked ? "open one to link it" : "all linked", on: () => setFilters((f) => ({ ...f, linked: "no", status: "" })), active: filters.linked === "no", tone: counts.unlinked ? "text-[#D97706]" : "text-[#16A34A]" },
          ].map((c) => (
            <button key={c.label} onClick={c.on}
                    className={`text-left rounded-2xl border bg-white dark:bg-[#1A1D27] p-4 shadow-sm transition hover:shadow ${c.active ? "border-[#2563EB] ring-2 ring-[#2563EB]/15" : "border-[#E4E7EF] dark:border-[#262A38]"}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#8B92A9]">{c.label}</div>
              <div className={`text-[20px] font-extrabold mt-0.5 ${c.tone}`}>{c.value.replace(/\.00$/, "")}</div>
              <div className="text-[11.5px] text-[#8B92A9]">{c.sub}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input className={`${inp} pl-8 w-72`} value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search number, client, company, subject…" />
        </div>
        <select className={inp} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option>
        </select>
        <select className={inp} value={filters.linked} onChange={(e) => setFilters((f) => ({ ...f, linked: e.target.value }))}>
          <option value="">Linked and not linked</option><option value="no">Not linked to a lead</option>
        </select>
        <input type="date" className={inp} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} title="From" />
        <input type="date" className={inp} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} title="To" />
        {(filters.search || filters.status || filters.linked || filters.from || filters.to) && (
          <button className="flex items-center gap-1 text-[12px] font-semibold text-[#8B92A9] hover:text-[#0F1117]" onClick={() => setFilters({ search: "", status: "", linked: "", from: "", to: "" })}><X className="w-3.5 h-3.5" />Clear</button>
        )}
        {items && (
          <span className="ml-auto text-[12px] text-[#8B92A9]">
            Showing {items.length} of {counts.total}
          </span>
        )}
      </div>

      {!items ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9D4EE] dark:border-[#2A3550] py-14 text-center">
          <FileText className="w-8 h-8 mx-auto text-[#B0B6C6] mb-2" />
          <div className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">No quotations {Object.values(filters).some(Boolean) ? "match these filters" : "yet"}</div>
          <div className="text-[12px] text-[#8B92A9] mt-1">Click "New quotation" — it links to the lead once you enter the client's phone or email.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#F8F9FC] dark:bg-[#13161E] text-left text-[11px] uppercase tracking-wide text-[#8B92A9]">
              <tr><th className="px-4 py-2.5">Quotation</th><th className="px-4 py-2.5">Client</th><th className="px-4 py-2.5">Lead</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q._id} className={`border-t border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#FAFBFD] dark:hover:bg-[#161922] ${q.source !== "uploaded" ? "cursor-pointer" : ""}`}
                    onClick={(e) => { if (q.source !== "uploaded" && !e.target.closest("button")) setEditor({ start: "edit", quotation: q }); }}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">{q.number}</div>
                    <div className="text-[11px] text-[#8B92A9]">{fmtDay(q.createdAt)}{q.createdByName ? ` · ${q.createdByName}` : ""}{q.source === "uploaded" ? " · uploaded PDF" : ""}</div>
                  </td>
                  <td className="px-4 py-2.5 max-w-[260px]">
                    <div className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{q.clientCompany || q.clientName || "—"}</div>
                    <div className="text-[11px] text-[#8B92A9] truncate">{q.clientCompany && q.clientName ? `${q.clientName} · ` : ""}{q.title}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {q.leadInfo ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-[#16A34A] font-medium"><Link2 className="w-3.5 h-3.5" />{q.leadInfo.name}</span>
                    ) : q.source === "uploaded" ? (
                      <span className="text-[12px] text-[#8B92A9]">Not linked</span>
                    ) : (
                      <button className="text-[12px] font-semibold text-[#D97706] hover:underline" onClick={() => setEditor({ start: "edit", quotation: q })} title="Open it — it matches the lead from the client details, or find it yourself">Not linked — link</button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                    {q.showTotals === false ? "Rate card" : q.source === "uploaded" && !q.grandTotal ? "—" : money(q.grandTotal, q.currency)}
                    {q.recurringSubtotal > 0 && <div className="text-[10.5px] font-normal text-[#8B92A9]">+ {money(q.recurringSubtotal, q.currency)} recurring</div>}
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold capitalize ${STATUS_STYLE[q.status] || STATUS_STYLE.draft}`}>{q.status}</span></td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title={q.source === "uploaded" ? "Open file" : "Print / save as PDF"} onClick={() => printQuotation(q, null, { settings })}>
                      {q.source === "uploaded" ? <ExternalLink className="w-4 h-4 text-[#4B5168]" /> : <Printer className="w-4 h-4 text-[#4B5168]" />}
                    </button>
                    {q.source !== "uploaded" && (
                      <button className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Edit" onClick={() => setEditor({ start: "edit", quotation: q })}><Pencil className="w-4 h-4 text-[#4B5168]" /></button>
                    )}
                    <button className="p-1.5 rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A]" title="Delete" onClick={() => remove(q)}><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toastEl}
    </div>
  );
}
