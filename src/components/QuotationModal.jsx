// components/QuotationModal.jsx
// Quotations for one lead (Lead Management, employee Leads, agent app).
//   list     → this lead's quotations (print / edit / delete), New, Upload PDF, Template settings (admins)
//   edit     → items (with details + module), saved-service picker, discount, GST, live totals,
//              and the extra sections: scope, optional add-ons, payment schedule (module-wise),
//              timeline, service info, suggestions, additional info, payment terms, T&C, notes
//   upload   → a ready-made PDF / image, still gets the next number
//   settings → company template (quotation/QuotationSettingsPanel.jsx), admins only
// The look comes from the company's settings (quotation/quotationTemplate.js).
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { getUser } from "../data/sessionStore";
import { X, Plus, Trash2, Printer, Pencil, FileText, Loader2, ArrowLeft, Upload, ExternalLink, Eye, Settings2, ChevronDown, ChevronRight, ChevronUp, Split, Minus, Search, BookmarkPlus, Check, Package } from "lucide-react";
import {
  BILLING, TABLE_PRESETS, SUBJECT_PRESETS, r2, money, fmtDate, resolveTemplate, computeTotals, buildModuleSchedule, scheduleAmount, printQuotation,
  itemFromCatalog, groupCatalog,
} from "./quotation/quotationTemplate";
import QuotationSettingsPanel from "./quotation/QuotationSettingsPanel";

const STATUS = ["draft", "sent", "accepted", "rejected"];
const STATUS_STYLE = {
  draft:    "bg-[#F0F2FA] text-[#4B5168] dark:bg-[#1E2130] dark:text-[#9DA3BB]",
  sent:     "bg-[#EEF3FF] text-[#2563EB] dark:bg-[#1A2540] dark:text-[#4F8EF7]",
  accepted: "bg-[#f0fdf4] text-[#16A34A] dark:bg-[#052e1c] dark:text-[#4ADE80]",
  rejected: "bg-[#FEF2F2] text-[#DC2626] dark:bg-[#2D0A0A] dark:text-[#F87171]",
};

const emptyItem = (description = "") => ({ description, details: "", module: "", priceLabel: "", chargeNote: "", quantity: 1, unitPrice: 0, billing: "one_time" });
const tableRows = (t) => (t.rows || []).map((r) => (Array.isArray(r) ? r : r.cells || []));
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toDateInput(d); };

function blankForm(lead, isSuperAdmin, st = {}) {
  const services = [...new Set([...(lead.services || []), lead.service].filter(Boolean))];
  const cat = st.catalog || [];
  const fromCatalog = (name) => {
    const c = cat.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    return c ? itemFromCatalog(c) : emptyItem(name);
  };
  return {
    title: services.length ? `${st.documentTitle || "Quotation"} for ${services.join(", ")}` : "",
    clientName: lead.name && lead.name !== "Unknown" ? lead.name : "",
    clientCompany: "", clientGSTIN: "", clientAddress: "",
    // Admins only see masked contact details in the CRM, so don't prefill them —
    // super admins (who see full details) get them.
    clientPhone: isSuperAdmin && lead.phone ? lead.phone : "",
    clientEmail: isSuperAdmin && lead.email ? lead.email : "",
    lineItems: services.length ? services.map(fromCatalog) : [emptyItem()],
    optedServices: services,
    currency: st.currency || "INR",
    discountType: "none", discountValue: 0, discountedBy: "",
    gstPercent: st.defaultGstPercent ?? 18,
    status: "draft", remark: "",
    handledBy: (lead.agent && lead.agent !== "Unassigned" ? lead.agent : "") || getUser()?.name || "",
    validUntil: (st.validityDays ?? 15) > 0 ? addDays(st.validityDays ?? 15) : "",
    optionalItems: [], scopeOfWork: "", timeline: [], paymentSchedule: [],
    serviceInfo: st.defaultServiceInfo || "", suggestions: "", customBlocks: [],
    paymentTerms: st.defaultPaymentTerms || "", terms: st.defaultTerms || "",
    introduction: "", aboutUs: st.defaultAboutUs || "", highlights: [], customTables: [],
    coverPage: !!st.coverPageDefault, coverSubtitle: "", showTotals: true,
  };
}

function formFrom(q) {
  const items = (list) => (list || []).map((li) => ({ description: li.description, details: li.details || "", module: li.module || "", priceLabel: li.priceLabel || "", chargeNote: li.chargeNote || "", quantity: li.quantity, unitPrice: li.unitPrice, billing: li.billing || "one_time" }));
  return {
    title: q.title || "", clientName: q.clientName || "", clientCompany: q.clientCompany || "",
    clientGSTIN: q.clientGSTIN || "", clientAddress: q.clientAddress || "",
    clientPhone: q.clientPhone || "", clientEmail: q.clientEmail || "",
    lineItems: items(q.lineItems), optionalItems: items(q.optionalItems),
    optedServices: q.optedServices || [], currency: q.currency || "INR",
    discountType: q.discountType || "none", discountValue: q.discountValue || 0, discountedBy: q.discountedBy || "",
    gstPercent: q.gstPercent ?? 0, status: q.status || "draft", remark: q.remark || "", handledBy: q.handledBy || "",
    validUntil: toDateInput(q.validUntil),
    scopeOfWork: q.scopeOfWork || "", serviceInfo: q.serviceInfo || "", suggestions: q.suggestions || "",
    paymentTerms: q.paymentTerms || "", terms: q.terms || "",
    timeline: (q.timeline || []).map((t) => ({ phase: t.phase, duration: t.duration || "", details: t.details || "" })),
    paymentSchedule: (q.paymentSchedule || []).map((p) => ({ label: p.label, percent: p.percent || 0, amount: p.amount || 0, due: p.due || "" })),
    customBlocks: (q.customBlocks || []).map((c) => ({ title: c.title, body: c.body || "" })),
    introduction: q.introduction || "", aboutUs: q.aboutUs || "",
    highlights: (q.highlights || []).map((h) => ({ label: h.label, value: h.value || "", note: h.note || "" })),
    customTables: (q.customTables || []).map((t) => ({ title: t.title || "", note: t.note || "", columns: [...(t.columns || [])], rows: tableRows(t).map((r) => [...r]) })),
    coverPage: !!q.coverPage, coverSubtitle: q.coverSubtitle || "", showTotals: q.showTotals !== false,
  };
}

// The saved quotation as it will look, from the form (for Preview).
function draftQuotation(form, totals, extra = {}) {
  const withTotal = (list) => (list || []).filter((li) => String(li.description || "").trim())
    .map((li) => ({ ...li, quantity: Number(li.quantity) || 0, unitPrice: Number(li.unitPrice) || 0, lineTotal: r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)) }));
  return {
    ...form, source: "created", lineItems: withTotal(form.lineItems), optionalItems: withTotal(form.optionalItems),
    discountValue: Number(form.discountValue) || 0, gstPercent: Number(form.gstPercent) || 0,
    oneTimeSubtotal: totals.oneTime, recurringSubtotal: totals.recurring, discountAmount: totals.disc, gstAmount: totals.gst, grandTotal: totals.grand,
    ...extra,
  };
}

// ── small UI pieces ─────────────────────────────────────────────────────────
const inp = "w-full px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]";
const lbl = "block text-[11px] font-semibold text-[#8B92A9] mb-1";
const btnGhost = "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60";
const linkBtn = "flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:underline";
const iconDel = "flex justify-center items-center p-1.5 rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A]";

function Fold({ title, hint, hidden, count, open, onToggle, children }) {
  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38]">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-[#8B92A9]" /> : <ChevronRight className="w-4 h-4 text-[#8B92A9]" />}
        <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{title}</span>
        {count ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] font-semibold">{count}</span> : null}
        {hidden && <span className="text-[10px] text-[#D97706] font-semibold" title="Turned off in Template settings">hidden on print</span>}
        {hint && <span className="ml-auto text-[11px] text-[#8B92A9] hidden sm:inline">{hint}</span>}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function QuotationModal({ lead, isSuperAdmin = false, onClose, onToast }) {
  const [view, setView]       = useState("list");   // list | edit | upload | settings
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState(null);
  const [settings, setSettings] = useState(null);
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [form, setForm]       = useState(() => blankForm(lead, isSuperAdmin));
  const [open, setOpen]       = useState({});        // which extra sections are expanded
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [upFile, setUpFile]   = useState(null);
  const [prefill, setPrefill] = useState(null);       // { from: {field: source}, lastQuotation } for the hints
  const [prefilling, setPrefilling] = useState(false);
  const [libOpen, setLibOpen]   = useState(false);     // service library panel
  const [libSearch, setLibSearch] = useState("");
  const [upForm, setUpForm]   = useState({ title: "", amount: "", status: "sent", remark: "" });

  const toast = (m, t = "success") => (onToast ? onToast(m, t) : null);
  const tpl = useMemo(() => resolveTemplate(settings || {}), [settings]);
  const sec = (key) => tpl.sections.find((s) => s.key === key) || { label: key, show: true };

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/quotations", { params: { leadId: lead._id || lead.id } });
      setItems(r.data?.quotations || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't load quotations.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);
  useEffect(() => {
    api.get("/quotations/settings")
      .then((r) => { setSettings(r.data?.settings || {}); setCanEditSettings(!!r.data?.canEdit); })
      .catch(() => setSettings({}));   // still works with built-in defaults
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = useMemo(() => computeTotals(form), [form]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addRow = (list, row) => setForm((f) => ({ ...f, [list]: [...(f[list] || []), row] }));
  const delRow = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }));
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const CLIENT_FIELDS = ["clientName", "clientCompany", "clientGSTIN", "clientAddress", "clientPhone", "clientEmail"];

  // Pull the best-known client details for this lead (latest quotation >
  // finance invoice > lead > lead custom fields). `force` = the "Fill again"
  // button: overwrite the client fields; otherwise only fill fields that are
  // still as they started, so nothing typed meanwhile is lost.
  const loadPrefill = async (base, { force = false } = {}) => {
    setPrefilling(true);
    try {
      const r = await api.get(`/quotations/lead/${lead._id || lead.id}/prefill`);
      const { details = {}, from = {}, services = [], lastQuotation = null } = r.data || {};
      setPrefill({ from, lastQuotation, details });
      setForm((f) => {
        const next = { ...f };
        for (const k of CLIENT_FIELDS) {
          if (!details[k]) continue;
          if (force || !String(f[k] || "").trim() || f[k] === base?.[k]) next[k] = details[k];
        }
        // Lead objects on some screens carry no services — use the server's list.
        const untouchedItems = f.lineItems.length === 1 && !String(f.lineItems[0].description).trim() && !Number(f.lineItems[0].unitPrice);
        if (!force && untouchedItems && services.length) {
          const withServices = blankForm({ ...lead, services, service: "" }, isSuperAdmin, settings || {});
          next.lineItems = withServices.lineItems; next.optedServices = services;
          if (!String(f.title || "").trim()) next.title = withServices.title;
        }
        return next;
      });
    } catch (e) {
      if (force) setErr(e?.response?.data?.message || "Couldn't load the lead's details.");
    } finally { setPrefilling(false); }
  };

  const startNew = () => {
    const f = blankForm(lead, isSuperAdmin, settings || {});
    setForm(f); setEditId(null); setErr(""); setPrefill(null);
    setOpen({ cover: f.coverPage });
    setView("edit");
    loadPrefill(f);
  };
  const startEdit = (q) => {
    const f = formFrom(q);
    setForm(f); setEditId(q._id); setErr(""); setPrefill(null);
    // open every section that already has content
    setOpen({ scope: !!f.scopeOfWork, optionalItems: f.optionalItems.length > 0, paymentSchedule: f.paymentSchedule.length > 0,
      timeline: f.timeline.length > 0, suggestions: !!f.suggestions, customBlocks: f.customBlocks.length > 0,
      cover: f.coverPage, introduction: !!f.introduction, customTables: f.customTables.length > 0 });
    setView("edit");
  };

  // Add services from the library. Replaces the single empty starter row.
  const addServices = (list) => {
    if (!list.length) return;
    setForm((f) => {
      const rows = list.map(itemFromCatalog);
      const onlyBlank = f.lineItems.length === 1 && !String(f.lineItems[0].description).trim() && !Number(f.lineItems[0].unitPrice);
      return { ...f, lineItems: onlyBlank ? rows : [...f.lineItems, ...rows] };
    });
    toast(list.length === 1 ? `Added ${list[0].name}` : `Added ${list.length} services`);
  };
  const moveItem = (list, i, dir) => setForm((f) => {
    const arr = [...f[list]]; const j = i + dir;
    if (j < 0 || j >= arr.length) return f;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...f, [list]: arr };
  });
  // Admins: keep an item for next time in Template settings → Saved services.
  const saveToLibrary = async (li) => {
    if (!String(li.description || "").trim()) return setErr("Give the item a description first.");
    const cat = settings?.catalog || [];
    const existing = cat.findIndex((c) => c.name.trim().toLowerCase() === li.description.trim().toLowerCase());
    const categories = [...new Set(cat.map((c) => c.category).filter(Boolean))];
    const category = window.prompt(`Category for "${li.description}"${categories.length ? ` (e.g. ${categories.slice(0, 3).join(", ")})` : ""}:`,
      existing >= 0 ? cat[existing].category || "" : (li.module || categories[0] || ""));
    if (category === null) return;
    const entry = { name: li.description.trim(), details: li.details || "", unitPrice: Number(li.unitPrice) || 0, billing: li.billing || "one_time",
      module: li.module || "", category: category.trim(), note: li.priceLabel || li.chargeNote || "" };
    const next = existing >= 0 ? cat.map((c, j) => (j === existing ? entry : c)) : [...cat, entry];
    try {
      const r = await api.put("/quotations/settings", { catalog: next });
      setSettings(r.data.settings);
      toast(existing >= 0 ? `Updated "${entry.name}" in saved services` : `Saved "${entry.name}" to services`);
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't save the service."); }
  };

  const splitByModule = () => {
    const rows = buildModuleSchedule(form.lineItems).map((r) => ({ ...r, due: "On delivery" }));
    if (!rows.length) return setErr("Add one-time items (with a module name) to split the payment by module.");
    setErr(""); set("paymentSchedule", rows); setOpen((o) => ({ ...o, paymentSchedule: true }));
  };

  // ── tables section helpers ──
  const setTable = (ti, patch) => setForm((f) => ({ ...f, customTables: f.customTables.map((t, j) => (j === ti ? { ...t, ...patch } : t)) }));
  const addTable = (presetIdx) => {
    const p = TABLE_PRESETS[presetIdx]; if (!p) return;
    setForm((f) => ({ ...f, customTables: [...f.customTables, { title: p.title, note: p.note || "", columns: [...p.columns], rows: p.rows.map((r) => [...r]) }] }));
    setOpen((o) => ({ ...o, customTables: true }));
  };
  const setCell = (ti, ri, ci, v) => setTable(ti, { rows: form.customTables[ti].rows.map((r, j) => (j === ri ? r.map((c, k) => (k === ci ? v : c)) : r)) });
  const addColumn = (ti) => { const t = form.customTables[ti]; if (t.columns.length >= 6) return; setTable(ti, { columns: [...t.columns, `Column ${t.columns.length + 1}`], rows: t.rows.map((r) => [...r, ""]) }); };
  const delColumn = (ti) => { const t = form.customTables[ti]; if (t.columns.length <= 1) return; setTable(ti, { columns: t.columns.slice(0, -1), rows: t.rows.map((r) => r.slice(0, t.columns.length - 1)) }); };

  const scheduleSum = r2((form.paymentSchedule || []).filter((p) => String(p.label || "").trim()).reduce((a, p) => a + scheduleAmount(p, totals.grand), 0));
  const schedulePct = r2((form.paymentSchedule || []).reduce((a, p) => a + (Number(p.percent) || 0), 0));

  const cleanBody = () => {
    const keep = (list) => (list || []).filter((li) => String(li.description || "").trim())
      .map((li) => ({ ...li, description: li.description.trim(), quantity: Number(li.quantity) || 0, unitPrice: Number(li.unitPrice) || 0 }));
    return {
      ...form,
      lineItems: keep(form.lineItems), optionalItems: keep(form.optionalItems),
      timeline: (form.timeline || []).filter((t) => String(t.phase || "").trim()),
      paymentSchedule: (form.paymentSchedule || []).filter((p) => String(p.label || "").trim()).map((p) => ({ ...p, percent: Number(p.percent) || 0, amount: Number(p.amount) || 0 })),
      customBlocks: (form.customBlocks || []).filter((c) => String(c.title || "").trim()),
      highlights: (form.highlights || []).filter((h) => String(h.label || "").trim()),
      customTables: (form.customTables || []).map((t) => ({ ...t, rows: t.rows.filter((r) => r.some((c) => String(c || "").trim())).map((cells) => ({ cells })) }))
        .filter((t) => String(t.title || "").trim() || t.rows.length),
      discountValue: Number(form.discountValue) || 0, gstPercent: Number(form.gstPercent) || 0,
      validUntil: form.validUntil || null,
      leadId: lead._id || lead.id,
    };
  };

  const previewDraft = () => {
    const body = cleanBody();
    if (!body.lineItems.length) return setErr("Add at least one item with a description to preview.");
    setErr("");
    const existing = editId ? items.find((x) => x._id === editId) : null;
    printQuotation(draftQuotation(body, totals, {
      number: existing?.number || "Number assigned on save",
      createdAt: existing?.createdAt || new Date().toISOString(),
    }), null, { preview: true, settings });
  };

  const save = async (andPrint = false) => {
    const body = cleanBody();
    if (!form.clientName.trim()) return setErr("Enter the client's name.");
    if (!body.lineItems.length) return setErr("Add at least one item with a description.");
    if (form.discountType !== "none" && Number(form.discountValue) > 0 && !form.discountedBy.trim())
      return setErr("Enter who approved the discount.");
    if (body.paymentSchedule.length && schedulePct > 100.001) return setErr(`The payment schedule adds up to ${schedulePct}% — it can't be more than 100%.`);

    const printWin = andPrint ? window.open("", "_blank") : null;
    setSaving(true); setErr("");
    try {
      const r = editId ? await api.put(`/quotations/${editId}`, body) : await api.post("/quotations", body);
      const q = r.data?.quotation;
      toast(editId ? `Quotation ${q?.number || ""} updated` : `Quotation ${q?.number || ""} created`);
      if (andPrint && q) printQuotation(q, printWin, { settings });
      await load();
      setView("list");
    } catch (e) {
      printWin?.close();
      setErr(e?.response?.data?.message || "Couldn't save the quotation.");
    } finally { setSaving(false); }
  };

  const startUpload = () => {
    setUpFile(null);
    setUpForm({ title: blankForm(lead, isSuperAdmin, settings || {}).title, amount: "", status: "sent", remark: "" });
    setErr(""); setView("upload");
  };
  const submitUpload = async () => {
    if (!upFile) return setErr("Choose a PDF or image of the quotation.");
    if (upFile.size > 15 * 1024 * 1024) return setErr("The file is larger than 15 MB.");
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.append("file", upFile);
    fd.append("leadId", lead._id || lead.id);
    fd.append("clientName", lead.name && lead.name !== "Unknown" ? lead.name : "");
    fd.append("title", upForm.title.trim());
    fd.append("amount", String(Number(upForm.amount) || 0));
    fd.append("status", upForm.status);
    fd.append("remark", upForm.remark.trim());
    const handledBy = (lead.agent && lead.agent !== "Unassigned" ? lead.agent : "") || getUser()?.name || "";
    if (handledBy) fd.append("handledBy", handledBy);
    try {
      const r = await api.post("/quotations/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      toast(`Quotation ${r.data?.quotation?.number || ""} uploaded`);
      await load(); setView("list");
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't upload the quotation.");
    } finally { setSaving(false); }
  };

  const remove = async (q) => {
    if (!window.confirm(`Delete quotation ${q.number}? Its number won't be reused.`)) return;
    try { await api.delete(`/quotations/${q._id}`); toast(`Quotation ${q.number} deleted`); load(); }
    catch (e) { toast(e?.response?.data?.message || "Couldn't delete the quotation.", "error"); }
  };

  const cur = form.currency || settings?.currency || "INR";
  const catalog = settings?.catalog || [];
  const title = view === "list" ? "Quotations" : view === "upload" ? "Upload quotation" : view === "settings" ? "Quotation template" : editId ? "Edit quotation" : "New quotation";

  // ── service library panel (plain function, see note below) ──
  const renderLibrary = () => {
    const q = libSearch.trim().toLowerCase();
    const added = new Set(form.lineItems.map((li) => String(li.description || "").trim().toLowerCase()));
    const groups = groupCatalog(catalog)
      .map(([cat, list]) => [cat, list.filter((c) => !q || `${c.name} ${c.category} ${c.details}`.toLowerCase().includes(q))])
      .filter(([, list]) => list.length);
    const priceText = (c) => (Number(c.unitPrice) > 0 ? `${money(c.unitPrice, cur).replace(/\.00$/, "")}${BILLING.find((b) => b.value === c.billing)?.short || ""}` : (c.note || "As per requirement"));
    return (
      <div className="mb-3 rounded-xl border border-[#C9D4EE] dark:border-[#2A3550] bg-[#F8FAFF] dark:bg-[#141A2A] p-3">
        {catalog.length === 0 ? (
          <div className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
            No saved services yet.{canEditSettings
              ? <> Open <button className="font-semibold text-[#2563EB] hover:underline" onClick={() => { setErr(""); setView("settings"); }}>Template settings → Saved services</button> and click "Load Skyup standard packages", or save any item with the <BookmarkPlus className="inline w-3.5 h-3.5 text-[#2563EB]" /> button.</>
              : " Ask an admin to add them in Template settings."}
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input className={`${inp} pl-8`} value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search services…" autoFocus />
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
              {groups.length === 0 && <div className="text-[12px] text-[#8B92A9] py-3 text-center">No service matches "{libSearch}".</div>}
              {groups.map(([cat, list]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#4B5168] dark:text-[#9DA3BB]">{cat}</span>
                    <span className="text-[10px] text-[#8B92A9]">{list.length}</span>
                    <button className="ml-auto text-[11px] font-semibold text-[#2563EB] hover:underline" onClick={() => addServices(list.filter((c) => !added.has(c.name.trim().toLowerCase())))}
                            disabled={list.every((c) => added.has(c.name.trim().toLowerCase()))}>
                      {list.every((c) => added.has(c.name.trim().toLowerCase())) ? "All added" : "Add all"}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {list.map((c) => {
                      const isAdded = added.has(c.name.trim().toLowerCase());
                      const preview = String(c.details || "").split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter((l) => l && !/:$/.test(l)).slice(0, 3).join(" · ");
                      return (
                        <div key={c.index} className="flex items-start gap-2 rounded-lg bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] px-2.5 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{c.name}</span>
                              <span className="text-[12px] font-semibold text-[#E07B12] whitespace-nowrap">{priceText(c)}</span>
                            </div>
                            {preview && <div className="text-[11px] text-[#8B92A9] truncate">{preview}</div>}
                          </div>
                          <button onClick={() => addServices([c])}
                                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${isAdded ? "text-[#16A34A] bg-[#f0fdf4] dark:bg-[#052e1c]" : "text-white bg-[#2563EB] hover:bg-[#1d4fd8]"}`}
                                  title={isAdded ? "Already in this quotation — click to add another" : "Add to this quotation"}>
                            {isAdded ? <><Check className="w-3.5 h-3.5" /> Added</> : <><Plus className="w-3.5 h-3.5" /> Add</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── reusable row editor (a plain function, NOT a component: a component
  // defined in render would remount on every keystroke and drop focus) ──
  const renderItemRows = (list, withModule) => (
    <div className="space-y-2">
      {form[list].map((li, i) => (
        <div key={i} className="rounded-lg border border-[#F0F2FA] dark:border-[#1E2130] p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inp} col-span-12 sm:col-span-5`} value={li.description} onChange={(e) => setRow(list, i, { description: e.target.value })} placeholder="Description" />
            <select className={`${inp} col-span-4 sm:col-span-2`} value={li.billing} onChange={(e) => setRow(list, i, { billing: e.target.value })}>
              {BILLING.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <input type="number" min="0" className={`${inp} col-span-3 sm:col-span-1 text-right`} value={li.quantity} onChange={(e) => setRow(list, i, { quantity: e.target.value })} title="Quantity" />
            <input type="number" min="0" className={`${inp} col-span-5 sm:col-span-2 text-right`} value={li.unitPrice} onChange={(e) => setRow(list, i, { unitPrice: e.target.value })} title="Unit price" />
            <div className="col-span-10 sm:col-span-1 text-right text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">
              {money(r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)), cur).replace(/\.00$/, "")}
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
              <div className="flex flex-col">
                <button className="p-0.5 disabled:opacity-25" disabled={i === 0} onClick={() => moveItem(list, i, -1)} title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button className="p-0.5 disabled:opacity-25" disabled={i === form[list].length - 1} onClick={() => moveItem(list, i, 1)} title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <button className={`${iconDel} disabled:opacity-30`} disabled={list === "lineItems" && form.lineItems.length === 1}
                      onClick={() => delRow(list, i)} title="Remove"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
            </div>
          </div>
          <textarea rows={Math.min(8, Math.max(1, String(li.details || "").split("\n").length))} className={`${inp} text-[12px]`} value={li.details}
                    onChange={(e) => setRow(list, i, { details: e.target.value })} placeholder={"Key deliverables (optional) — one per line\n• or - at the start makes a bullet; a line ending in : is a heading"} />
          <div className="grid grid-cols-12 gap-2 items-center">
            {withModule && <input className={`${inp} col-span-6 sm:col-span-3 text-[12px]`} value={li.module} list="q-modules"
                                  onChange={(e) => setRow(list, i, { module: e.target.value })} placeholder="Module (optional)" />}
            <input className={`${inp} col-span-6 ${withModule ? "sm:col-span-3" : "sm:col-span-5"} text-[12px]`} value={li.priceLabel || ""} maxLength={80}
                   onChange={(e) => setRow(list, i, { priceLabel: e.target.value })} placeholder="Price text instead of amount" title='Shown instead of the amount, e.g. "Included", "Custom Pricing", "₹199 per product"' />
            <input className={`${inp} col-span-10 ${withModule ? "sm:col-span-5" : "sm:col-span-6"} text-[12px]`} value={li.chargeNote || ""} maxLength={120}
                   onChange={(e) => setRow(list, i, { chargeNote: e.target.value })} placeholder="Note under the price, e.g. (5 - 6 pages)" />
            {canEditSettings && list === "lineItems" ? (
              <button className="col-span-2 sm:col-span-1 flex justify-center p-1.5 rounded-lg hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540]" onClick={() => saveToLibrary(li)} title="Save to saved services (for next time)">
                <BookmarkPlus className="w-4 h-4 text-[#2563EB]" />
              </button>
            ) : <span className="col-span-2 sm:col-span-1" />}
          </div>
        </div>
      ))}
    </div>
  );

  const modules = [...new Set([...(form.lineItems || []).map((l) => l.module), ...catalog.map((c) => c.module)].filter(Boolean))];

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {view !== "list" && (
            <button onClick={() => { setErr(""); setView("list"); }} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Back to list">
              <ArrowLeft className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" />
            </button>
          )}
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</div>
            <div className="text-[11px] text-[#8B92A9] truncate">{view === "settings" ? "Applies to every quotation in your company" : lead.name}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Close">
            <X className="w-4 h-4 text-[#8B92A9]" />
          </button>
        </div>

        {view === "settings" ? (
          <QuotationSettingsPanel api={api} settings={settings || {}} toast={toast}
            onClose={() => setView("list")}
            onSaved={(st, opts) => { setSettings(st); if (!opts?.keepOpen) setView("list"); }} />
        ) : (
        <>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" /></div>
          ) : view === "list" ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={startNew} disabled={!settings} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60">
                  <Plus className="w-4 h-4" /> New {tpl.title.toLowerCase()}
                </button>
                <button onClick={startUpload} className={btnGhost}><Upload className="w-4 h-4" /> Upload PDF</button>
                {canEditSettings && (
                  <button onClick={() => { setErr(""); setView("settings"); }} className={`${btnGhost} ml-auto`} title="Look, columns, sections, defaults and saved services for every quotation">
                    <Settings2 className="w-4 h-4" /> Template settings
                  </button>
                )}
              </div>
              {err && <div className="mb-2 text-[12px] text-[#DC2626]">{err}</div>}
              {items.length === 0 && (
                <div className="text-center py-8 text-[12px] text-[#8B92A9]">
                  No quotations for this lead yet. Build one, or upload a PDF you already have.
                </div>
              )}
              {items.length > 0 && <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl">
                {items.map((q) => (
                  <div key={q._id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{q.number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize ${STATUS_STYLE[q.status] || STATUS_STYLE.draft}`}>{q.status}</span>
                        {q.source === "uploaded" && <span className="text-[10px] text-[#8B92A9]">uploaded PDF</span>}
                      </div>
                      <div className="text-[11px] text-[#8B92A9] truncate">
                        {fmtDate(q.createdAt)} · {q.title || q.clientName} {q.createdByName ? `· by ${q.createdByName}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{q.showTotals === false ? "Rate card" : q.source === "uploaded" && !q.grandTotal ? "—" : money(q.grandTotal, q.currency)}</div>
                      {q.recurringSubtotal > 0 && <div className="text-[10px] text-[#8B92A9]">+ {money(q.recurringSubtotal, q.currency)} recurring</div>}
                    </div>
                    <div className="flex gap-1">
                      <button title={q.source === "uploaded" ? "Open file" : "Print / save as PDF"} onClick={() => printQuotation(q, null, { settings })} className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]">
                        {q.source === "uploaded" ? <ExternalLink className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" /> : <Printer className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" />}
                      </button>
                      {q.source !== "uploaded" && (
                        <button title="Edit" onClick={() => startEdit(q)} className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]"><Pencil className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" /></button>
                      )}
                      <button title="Delete" onClick={() => remove(q)} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A]"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                    </div>
                  </div>
                ))}
              </div>}
            </>
          ) : view === "upload" ? (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-[#C9D4EE] dark:border-[#2A3550] bg-[#F8FAFF] dark:bg-[#141A2A] cursor-pointer hover:border-[#2563EB] transition text-center">
                <Upload className="w-6 h-6 text-[#2563EB]" />
                {upFile ? (
                  <>
                    <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] break-all">{upFile.name}</span>
                    <span className="text-[11px] text-[#8B92A9]">{(upFile.size / 1024 / 1024).toFixed(2)} MB · click to choose a different file</span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Choose the quotation file</span>
                    <span className="text-[11px] text-[#8B92A9]">PDF, JPG, PNG or WEBP, up to 15 MB</span>
                  </>
                )}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" className="hidden"
                       onChange={(e) => { setUpFile(e.target.files?.[0] || null); setErr(""); }} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className={lbl}>Subject</label><input className={inp} value={upForm.title} onChange={(e) => setUpForm((f) => ({ ...f, title: e.target.value }))} /></div>
                <div><label className={lbl}>Quotation total (for reports)</label><input type="number" min="0" className={inp} value={upForm.amount} onChange={(e) => setUpForm((f) => ({ ...f, amount: e.target.value }))} placeholder="47790" /></div>
                <div><label className={lbl}>Status</label>
                  <select className={inp} value={upForm.status} onChange={(e) => setUpForm((f) => ({ ...f, status: e.target.value }))}>
                    {STATUS.map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2"><label className={lbl}>Note</label><input className={inp} value={upForm.remark} onChange={(e) => setUpForm((f) => ({ ...f, remark: e.target.value }))} placeholder="Sent on WhatsApp after the meeting" /></div>
              </div>
              <p className="text-[11px] text-[#8B92A9]">The file gets the next quotation number, the same as a built quotation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <datalist id="q-modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
              <datalist id="q-subjects">{SUBJECT_PRESETS.map((t) => <option key={t} value={t} />)}</datalist>

              {/* Client — filled from the lead, all editable */}
              <div className="flex flex-wrap items-center gap-2 -mb-1">
                <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Client</span>
                <span className="text-[11px] text-[#8B92A9]">
                  {prefilling ? "Fetching the lead's details…"
                    : prefill ? `Filled from the lead${prefill.lastQuotation ? `, its last quotation ${prefill.lastQuotation}` : ""} and finance records — change anything below.`
                    : "Type the client's details, or fetch them from the lead."}
                </span>
                <button type="button" onClick={() => loadPrefill(null, { force: true })} disabled={prefilling}
                        className={`${linkBtn} ml-auto disabled:opacity-50`} title="Replace the client fields with the lead's saved details">
                  {prefilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5 rotate-180" />} Fill again from lead
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["clientName", "Client name *", ""],
                  ["clientCompany", "Client company", "Business / company name"],
                  ["clientPhone", "Phone", "+91 98765 43210"],
                  ["clientEmail", "Email", "client@company.com"],
                  ["clientGSTIN", "GSTIN", "29ABCDE1234F1Z5"],
                  ["clientAddress", "Address", "Street, area, city"],
                ].map(([k, label, ph]) => (
                  <div key={k}>
                    <label className={lbl}>{label}{prefill?.from?.[k] && form[k] && form[k] === prefill.details?.[k] ? <span className="font-normal normal-case text-[#16A34A]"> · from {prefill.from[k]}</span> : null}</label>
                    <input className={inp} value={form[k]} placeholder={ph}
                           onChange={(e) => set(k, k === "clientGSTIN" ? e.target.value.toUpperCase() : e.target.value)} />
                  </div>
                ))}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
                  <div><label className={lbl}>{sec("subject").label}</label><input className={inp} list="q-subjects" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Proposal for … Services-reg (pick a suggestion or type)" /></div>
                  <div><label className={lbl}>Valid until</label><input type="date" className={inp} value={form.validUntil || ""} onChange={(e) => set("validUntil", e.target.value)} /></div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex flex-wrap items-end gap-2 mb-1.5">
                  <label className={`${lbl} mb-0`}>{sec("items").label}</label>
                  <button onClick={() => { setLibOpen((o) => !o); setLibSearch(""); }}
                          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${libOpen ? "bg-[#2563EB] text-white border-[#2563EB]" : "border-[#C9D4EE] dark:border-[#2A3550] text-[#2563EB] hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540]"}`}>
                    <Package className="w-4 h-4" /> Add services{catalog.length ? ` (${catalog.length})` : ""}
                  </button>
                </div>
                {libOpen && renderLibrary()}
                {renderItemRows("lineItems", true)}
                <button onClick={() => addRow("lineItems", emptyItem())} className={`${linkBtn} mt-2`}><Plus className="w-3.5 h-3.5" /> Add item</button>
              </div>

              {/* Discount / GST / totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Discount</label>
                      <select className={inp} value={form.discountType} onChange={(e) => set("discountType", e.target.value)}>
                        <option value="none">None</option><option value="percent">Percent (%)</option><option value="amount">Amount</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Value</label>
                      <input type="number" min="0" className={inp} value={form.discountValue} disabled={form.discountType === "none"} onChange={(e) => set("discountValue", e.target.value)} />
                    </div>
                  </div>
                  {form.discountType !== "none" && (
                    <div><label className={lbl}>Discount approved by</label><input className={inp} value={form.discountedBy} onChange={(e) => set("discountedBy", e.target.value)} /></div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>GST %</label>
                      <select className={inp} value={form.gstPercent} onChange={(e) => set("gstPercent", Number(e.target.value))}>
                        {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>Status</label>
                      <select className={inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
                        {STATUS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className={lbl}>Prepared by</label><input className={inp} value={form.handledBy} onChange={(e) => set("handledBy", e.target.value)} /></div>
                </div>

                <div className="rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] p-3 text-[13px] space-y-1.5 self-start">
                  <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">One-time subtotal</span><span>{money(totals.oneTime, cur)}</span></div>
                  {totals.disc > 0 && <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">Discount</span><span className="text-[#DC2626]">− {money(totals.disc, cur)}</span></div>}
                  {Number(form.gstPercent) > 0 && <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">GST ({form.gstPercent}%)</span><span>{money(totals.gst, cur)}</span></div>}
                  <div className="flex justify-between pt-1.5 border-t border-[#E4E7EF] dark:border-[#262A38] font-bold text-[15px] text-[#0F1117] dark:text-[#F0F2FA]"><span>Total</span><span>{money(totals.grand, cur)}</span></div>
                  {totals.recurringByPeriod.map((p) => (
                    <div key={p.billing} className="pt-1.5 border-t border-dashed border-[#E4E7EF] dark:border-[#262A38] text-[12px]">
                      <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">{p.period} subtotal</span><span>{money(p.subtotal, cur)}</span></div>
                      {Number(form.gstPercent) > 0 && <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">GST</span><span>{money(p.gst, cur)}</span></div>}
                      <div className="flex justify-between font-semibold"><span>{p.period} total</span><span>{money(p.total, cur)}</span></div>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 pt-1.5 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
                    <input type="checkbox" checked={form.showTotals !== false} onChange={(e) => set("showTotals", e.target.checked)} />
                    Print totals (untick for a rate card)
                  </label>
                </div>
              </div>

              {/* Extra sections */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">More sections <span className="normal-case font-normal">— fill only what you need; empty sections are left out</span></div>

                <Fold title="Cover page and highlights" hint="big title page + boxes like ₹7,08,000 · 10–14 weeks" open={open.cover} onToggle={() => toggle("cover")} count={form.coverPage ? "on" : form.highlights.length}>
                  <label className="flex items-center gap-2 text-[12px] text-[#0F1117] dark:text-[#F0F2FA]">
                    <input type="checkbox" checked={form.coverPage} onChange={(e) => set("coverPage", e.target.checked)} /> Start with a cover page
                  </label>
                  {form.coverPage && <input className={inp} value={form.coverSubtitle} maxLength={300} onChange={(e) => set("coverSubtitle", e.target.value)} placeholder="Subtitle under the title, e.g. AI-Powered Business Intelligence & Automation Platform" />}
                  <p className="text-[11px] text-[#8B92A9]">Highlights (up to 4) show on the cover, or as a section when there's no cover.</p>
                  {form.highlights.map((h, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className={`${inp} col-span-4`} value={h.label} maxLength={40} onChange={(e) => setRow("highlights", i, { label: e.target.value })} placeholder="Project investment" />
                      <input className={`${inp} col-span-3`} value={h.value} maxLength={40} onChange={(e) => setRow("highlights", i, { value: e.target.value })} placeholder="₹7,08,000" />
                      <input className={`${inp} col-span-4`} value={h.note} maxLength={60} onChange={(e) => setRow("highlights", i, { note: e.target.value })} placeholder="Incl. 18% GST" />
                      <button className={`${iconDel} col-span-1`} onClick={() => delRow("highlights", i)} title="Remove"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3">
                    {form.highlights.length < 4 && <button onClick={() => addRow("highlights", { label: "", value: "", note: "" })} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add highlight</button>}
                    {form.highlights.length === 0 && (
                      <button className={linkBtn} onClick={() => set("highlights", [
                        { label: "Project investment", value: money(totals.grand, cur).replace(/\.00$/, ""), note: Number(form.gstPercent) ? `Incl. ${form.gstPercent}% GST` : "" },
                        ...(totals.recurringByPeriod[0] ? [{ label: `${totals.recurringByPeriod[0].period} retainer`, value: money(totals.recurringByPeriod[0].total, cur).replace(/\.00$/, ""), note: Number(form.gstPercent) ? "Incl. GST" : "" }] : []),
                        { label: "Delivery timeline", value: "", note: "" },
                      ])}>Fill from totals</button>
                    )}
                  </div>
                </Fold>

                <Fold title={sec("introduction").label} hidden={!sec("introduction").show} open={open.introduction} onToggle={() => toggle("introduction")} count={form.introduction ? "✓" : 0}>
                  <textarea rows={4} className={inp} value={form.introduction} onChange={(e) => set("introduction", e.target.value)} placeholder={"What the client needs and what you propose.\n- Lines starting with - become bullets\n## A line starting with ## becomes a sub-heading"} />
                </Fold>

                <Fold title={sec("aboutUs").label} hidden={!sec("aboutUs").show} open={open.aboutUs} onToggle={() => toggle("aboutUs")} count={form.aboutUs ? "✓" : 0}>
                  <textarea rows={3} className={inp} value={form.aboutUs} onChange={(e) => set("aboutUs", e.target.value)} placeholder="Who you are — filled from Template settings" />
                </Fold>

                <Fold title={sec("scope").label} hidden={!sec("scope").show} open={open.scope} onToggle={() => toggle("scope")} count={form.scopeOfWork ? "✓" : 0}>
                  <textarea rows={4} className={inp} value={form.scopeOfWork} onChange={(e) => set("scopeOfWork", e.target.value)} placeholder="What's included, deliverables, number of revisions…" />
                </Fold>

                <Fold title={sec("optionalItems").label} hint="shown, not added to the total" hidden={!sec("optionalItems").show} open={open.optionalItems} onToggle={() => toggle("optionalItems")} count={form.optionalItems.length}>
                  {renderItemRows("optionalItems", false)}
                  <button onClick={() => addRow("optionalItems", emptyItem())} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add optional item</button>
                </Fold>

                <Fold title={sec("customTables").label} hint="running costs, rate cards, comparisons, fees" hidden={!sec("customTables").show} open={open.customTables} onToggle={() => toggle("customTables")} count={form.customTables.length}>
                  {form.customTables.map((t, ti) => (
                    <div key={ti} className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] p-2 space-y-2">
                      <div className="flex gap-2">
                        <input className={inp} value={t.title} maxLength={120} onChange={(e) => setTable(ti, { title: e.target.value })} placeholder="Table heading, e.g. Monthly infrastructure & running costs" />
                        <button className={iconDel} onClick={() => delRow("customTables", ti)} title="Remove table"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead><tr>
                            {t.columns.map((c, ci) => (
                              <th key={ci} className="p-0.5 min-w-[110px]"><input className={`${inp} font-semibold text-[12px]`} value={c} maxLength={60}
                                onChange={(e) => setTable(ti, { columns: t.columns.map((x, k) => (k === ci ? e.target.value : x)) })} /></th>
                            ))}
                            <th className="p-0.5 w-[64px] whitespace-nowrap">
                              <button className="p-1 disabled:opacity-30" disabled={t.columns.length >= 6} onClick={() => addColumn(ti)} title="Add column"><Plus className="w-3.5 h-3.5" /></button>
                              <button className="p-1 disabled:opacity-30" disabled={t.columns.length <= 1} onClick={() => delColumn(ti)} title="Remove last column"><Minus className="w-3.5 h-3.5" /></button>
                            </th>
                          </tr></thead>
                          <tbody>
                            {t.rows.map((r, ri) => (
                              <tr key={ri}>
                                {t.columns.map((_, ci) => (
                                  <td key={ci} className="p-0.5"><input className={`${inp} text-[12px]`} value={r[ci] || ""} onChange={(e) => setCell(ti, ri, ci, e.target.value)} /></td>
                                ))}
                                <td className="p-0.5"><button className={iconDel} onClick={() => setTable(ti, { rows: t.rows.filter((_, j) => j !== ri) })} title="Remove row"><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={() => setTable(ti, { rows: [...t.rows, t.columns.map(() => "")] })} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add row</button>
                      <textarea rows={1} className={`${inp} text-[12px]`} value={t.note} onChange={(e) => setTable(ti, { note: e.target.value })} placeholder="Note under the table (optional), e.g. Paid directly by the client" />
                    </div>
                  ))}
                  <select className={`${inp} !w-auto text-[12px]`} value="" onChange={(e) => { addTable(Number(e.target.value)); e.target.value = ""; }}>
                    <option value="">+ Add a table…</option>
                    {TABLE_PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
                  </select>
                </Fold>

                <Fold title={sec("paymentSchedule").label} hint="milestones or module-wise" hidden={!sec("paymentSchedule").show} open={open.paymentSchedule} onToggle={() => toggle("paymentSchedule")} count={form.paymentSchedule.length}>
                  {form.paymentSchedule.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className={`${inp} col-span-12 sm:col-span-4`} value={p.label} onChange={(e) => setRow("paymentSchedule", i, { label: e.target.value })} placeholder="Advance / Module 1: Website" />
                      <div className="col-span-3 sm:col-span-2 relative">
                        <input type="number" min="0" max="100" className={`${inp} text-right pr-6`} value={p.percent} onChange={(e) => setRow("paymentSchedule", i, { percent: e.target.value })} title="Percent of the total" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[#8B92A9]">%</span>
                      </div>
                      <input type="number" min="0" className={`${inp} col-span-4 sm:col-span-2 text-right`} value={Number(p.percent) > 0 ? scheduleAmount(p, totals.grand) : p.amount}
                             disabled={Number(p.percent) > 0} title={Number(p.percent) > 0 ? "Worked out from the %" : "Fixed amount"} onChange={(e) => setRow("paymentSchedule", i, { amount: e.target.value })} />
                      <input className={`${inp} col-span-3 sm:col-span-3`} value={p.due} onChange={(e) => setRow("paymentSchedule", i, { due: e.target.value })} placeholder="When due" />
                      <button className={`${iconDel} col-span-2 sm:col-span-1`} onClick={() => delRow("paymentSchedule", i)} title="Remove"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => addRow("paymentSchedule", { label: "", percent: 0, amount: 0, due: "" })} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add row</button>
                    <button onClick={splitByModule} className={linkBtn} title="One row per module, in proportion to its items"><Split className="w-3.5 h-3.5" /> Split by module</button>
                    {form.paymentSchedule.length > 0 && (
                      <span className={`ml-auto text-[11px] font-semibold ${Math.abs(scheduleSum - totals.grand) < 0.05 ? "text-[#16A34A]" : "text-[#D97706]"}`}>
                        Schedule {money(scheduleSum, cur)} of {money(totals.grand, cur)}{schedulePct ? ` · ${schedulePct}%` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8B92A9]">Use % so amounts follow the total, or leave % at 0 to type a fixed amount. Give items a module name to split by module.</p>
                </Fold>

                <Fold title={sec("timeline").label} hidden={!sec("timeline").show} open={open.timeline} onToggle={() => toggle("timeline")} count={form.timeline.length}>
                  {form.timeline.map((t, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className={`${inp} col-span-12 sm:col-span-4`} value={t.phase} onChange={(e) => setRow("timeline", i, { phase: e.target.value })} placeholder="Phase" />
                      <input className={`${inp} col-span-4 sm:col-span-2`} value={t.duration} onChange={(e) => setRow("timeline", i, { duration: e.target.value })} placeholder="Week 1–2" />
                      <input className={`${inp} col-span-6 sm:col-span-5`} value={t.details} onChange={(e) => setRow("timeline", i, { details: e.target.value })} placeholder="Details (optional)" />
                      <button className={`${iconDel} col-span-2 sm:col-span-1`} onClick={() => delRow("timeline", i)} title="Remove"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                    </div>
                  ))}
                  <button onClick={() => addRow("timeline", { phase: "", duration: "", details: "" })} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add phase</button>
                </Fold>

                <Fold title={sec("serviceInfo").label} hidden={!sec("serviceInfo").show} open={open.serviceInfo} onToggle={() => toggle("serviceInfo")} count={form.serviceInfo ? "✓" : 0}>
                  <textarea rows={4} className={inp} value={form.serviceInfo} onChange={(e) => set("serviceInfo", e.target.value)} placeholder="Support hours, response times, what maintenance covers…" />
                </Fold>

                <Fold title={sec("suggestions").label} hidden={!sec("suggestions").show} open={open.suggestions} onToggle={() => toggle("suggestions")} count={form.suggestions ? "✓" : 0}>
                  <textarea rows={3} className={inp} value={form.suggestions} onChange={(e) => set("suggestions", e.target.value)} placeholder="What you recommend for this client and why" />
                </Fold>

                <Fold title={sec("customBlocks").label} hint="your own headings" hidden={!sec("customBlocks").show} open={open.customBlocks} onToggle={() => toggle("customBlocks")} count={form.customBlocks.length}>
                  {form.customBlocks.map((c, i) => (
                    <div key={i} className="rounded-lg border border-[#F0F2FA] dark:border-[#1E2130] p-2 space-y-1.5">
                      <div className="flex gap-2">
                        <input className={inp} value={c.title} onChange={(e) => setRow("customBlocks", i, { title: e.target.value })} placeholder="Heading, e.g. What we need from you" />
                        <button className={iconDel} onClick={() => delRow("customBlocks", i)} title="Remove"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                      </div>
                      <textarea rows={3} className={inp} value={c.body} onChange={(e) => setRow("customBlocks", i, { body: e.target.value })} placeholder="Text" />
                    </div>
                  ))}
                  <button onClick={() => addRow("customBlocks", { title: "", body: "" })} className={linkBtn}><Plus className="w-3.5 h-3.5" /> Add block</button>
                </Fold>

                <Fold title={sec("paymentTerms").label} hidden={!sec("paymentTerms").show} open={open.paymentTerms} onToggle={() => toggle("paymentTerms")} count={form.paymentTerms ? "✓" : 0}>
                  <textarea rows={3} className={inp} value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="50% advance, balance on delivery. Bank transfer or UPI." />
                </Fold>

                <Fold title={sec("terms").label} hidden={!sec("terms").show} open={open.terms} onToggle={() => toggle("terms")} count={form.terms ? "✓" : 0}>
                  <textarea rows={5} className={inp} value={form.terms} onChange={(e) => set("terms", e.target.value)} placeholder="1. Prices are valid until the date shown." />
                </Fold>

                <Fold title={sec("notes").label} hidden={!sec("notes").show} open={open.notes} onToggle={() => toggle("notes")} count={form.remark ? "✓" : 0}>
                  <textarea rows={2} className={inp} value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder="Anything else for the client" />
                </Fold>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "upload" && !loading && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
            {err && <span className="text-[12px] text-[#DC2626] mr-auto">{err}</span>}
            <button onClick={submitUpload} disabled={saving} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60">
              <Upload className="w-4 h-4" /> {saving ? "Uploading…" : "Upload quotation"}
            </button>
          </div>
        )}
        {view === "edit" && !loading && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
            {err && <span className="text-[12px] text-[#DC2626] mr-auto">{err}</span>}
            <div className="flex gap-2 ml-auto">
              <button onClick={previewDraft} disabled={saving} className={btnGhost} title="See the finished quotation before saving"><Eye className="w-4 h-4" /> Preview</button>
              <button onClick={() => save(false)} disabled={saving} className={btnGhost}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => save(true)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60">
                <Printer className="w-4 h-4" /> Save and print
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>,
    document.body
  );
}
