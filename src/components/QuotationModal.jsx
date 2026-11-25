// components/QuotationModal.jsx
// Quotations for one lead (Lead Management, employee Leads, agent app).
//   list     → this lead's quotations (print / edit / delete), New, Upload PDF, Template settings (admins)
//   edit     → items (with details + module), saved-service picker, discount, GST, live totals,
//              and the extra sections: scope, optional add-ons, payment schedule (module-wise),
//              timeline, service info, suggestions, additional info, payment terms, T&C, notes
//   upload   → a ready-made PDF / image, still gets the next number
//   settings → company template (quotation/QuotationSettingsPanel.jsx), admins only
// The look comes from the company's settings (quotation/quotationTemplate.js).
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { getUser } from "../data/sessionStore";
import { getRole } from "../data/dataService";
import { X, Plus, Trash2, Printer, Pencil, FileText, Loader2, ArrowLeft, Upload, ExternalLink, Eye, Settings2, ChevronDown, ChevronRight, ChevronUp, Split, Minus, Search, BookmarkPlus, Check, Package, Link2, Unlink, LayoutTemplate, Save } from "lucide-react";
import {
  BILLING, TABLE_PRESETS, SUBJECT_PRESETS, r2, money, fmtDate, resolveTemplate, computeTotals, buildModuleSchedule, scheduleAmount, printQuotation,
  itemFromCatalog, groupCatalog, settingsForDesign,
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

// The lead's phone / email as the CRM already holds them in the browser
// (decrypted with the company key). Masked or still-encrypted values are skipped.
function leadContact(lead = {}) {
  const usable = (v) => { const t = String(v || "").trim(); return t && !t.startsWith("enc:") && !t.includes("•") ? t : ""; };
  return {
    phone: usable(lead.primaryPhone) || usable(lead.phone) || usable(lead.mobile) || usable(lead.secondaryPhone),
    email: usable(lead.email),
  };
}

// Record that this user saw the lead's full phone / email, exactly as the 👁
// reveal button on the Leads page does (same audit log, same endpoints).
function logContactReveal(lead, { phone, email }) {
  const id = lead._id || lead.id;
  if (!id) return;
  const role = getRole();
  const base = role === "admin" || role === "superadmin" ? `/lead/admin/${id}` : `/lead/${id}`;
  if (phone) api.post(`${base}/reveal-phone`).catch(() => {});
  if (email) api.post(`${base}/reveal-email`).catch(() => {});
}

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
    // The lead's own contact details (the reveal is logged when the form opens).
    clientPhone: leadContact(lead).phone,
    clientEmail: leadContact(lead).email,
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
    coverPage: !!st.coverPageDefault, coverSubtitle: "", showTotals: true, designId: null,
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
    coverPage: !!q.coverPage, coverSubtitle: q.coverSubtitle || "", showTotals: q.showTotals !== false, designId: q.designId || null,
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
const inp = "w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#B0B6C6] dark:placeholder:text-[#5B6278] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition";
const lbl = "block text-[11.5px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1";
const btnGhost = "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60";
const linkBtn = "flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:underline";
const iconDel = "flex justify-center items-center p-1.5 rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A]";

function Fold({ title, hint, hidden, count, open, onToggle, children }) {
  if (!open && !count) return null;   // shown as a "+ Section" button in the More sections bar
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
// mode "modal": pop-up for one lead (agent app). mode "page": the Quotations
// page — opens straight into `start` ("new" | "edit" | "upload" | "settings"),
// works with or without a lead, and links / matches leads from the details.
const NO_LEAD = {};
// What a content template carries — never the client, lead, number, status or dates.
const TEMPLATE_FIELDS = ["title", "lineItems", "optionalItems", "timeline", "paymentSchedule", "customBlocks", "scopeOfWork", "serviceInfo",
  "suggestions", "terms", "paymentTerms", "introduction", "aboutUs", "highlights", "customTables", "coverPage", "coverSubtitle",
  "showTotals", "designId", "remark", "currency", "discountType", "discountValue", "gstPercent"];
const pickTemplate = (o = {}) => Object.fromEntries(TEMPLATE_FIELDS.filter((k) => k in o).map((k) => [k, o[k]]));
export default function QuotationModal({ lead: leadProp = null, isSuperAdmin = false, onClose, onToast,
                                         mode = "modal", start = "list", startQuotation = null, onChanged }) {
  const isPage = mode === "page";
  const [linkedLead, setLinkedLead] = useState(leadProp);
  const lead = linkedLead || NO_LEAD;
  const leadIdOf = (l) => (l ? l._id || l.id : null);
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
  const [templates, setTemplates] = useState([]);          // content templates (Start from template)
  const [canEditTemplates, setCanEditTemplates] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState(null);
  useEffect(() => {
    api.get("/quotations/templates").then((r) => { setTemplates(r.data?.templates || []); setCanEditTemplates(!!r.data?.canEdit); }).catch(() => {});
  }, []);

  const toast = (m, t = "success") => (onToast ? onToast(m, t) : null);
  const tpl = useMemo(() => resolveTemplate(settingsForDesign(settings || {}, form.designId)), [settings, form.designId]);
  const sec = (key) => tpl.sections.find((s) => s.key === key) || { label: key, show: true };

  const load = async () => {
    if (isPage) { setLoading(false); return; }   // the page shows its own list
    setLoading(true);
    try {
      const r = await api.get("/quotations", { params: { leadId: lead._id || lead.id } });
      setItems(r.data?.quotations || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't load quotations.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadProp?.id, leadProp?._id]);
  useEffect(() => {
    api.get("/quotations/settings")
      .then((r) => { setSettings(r.data?.settings || {}); setCanEditSettings(!!r.data?.canEdit); })
      .catch(() => setSettings({}));   // still works with built-in defaults
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !isPage) onClose(); };
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
  const revealed = useRef(new Set());
  const loadPrefill = async (base, { force = false, forLead = null } = {}) => {
    const L = forLead || linkedLead;
    if (!leadIdOf(L)) return;
    const lead = L;
    setPrefilling(true);
    try {
      const r = await api.get(`/quotations/lead/${leadIdOf(L)}/prefill`);
      const { details: server = {}, from: serverFrom = {}, services = [], lastQuotation = null } = r.data || {};
      // Phone / email: the lead record is the source of truth; an older
      // quotation's typed value is only a fallback.
      const own = leadContact(lead);
      const details = { ...server }, from = { ...serverFrom };
      if (own.phone) { details.clientPhone = own.phone; from.clientPhone = "lead"; }
      if (own.email) { details.clientEmail = own.email; from.clientEmail = "lead"; }
      if (!details.clientName && lead.name && lead.name !== "Unknown") { details.clientName = lead.name; from.clientName = "lead"; }
      setPrefill({ from, lastQuotation, details });
      // Showing the lead's own phone / email = a reveal, logged like the 👁 button.
      const key = String(leadIdOf(L));
      if (!revealed.current.has(key) && (from.clientPhone === "lead" || from.clientEmail === "lead")) {
        revealed.current.add(key);
        logContactReveal(L, { phone: from.clientPhone === "lead", email: from.clientEmail === "lead" });
      }
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
      // Server details unavailable: still show where the lead's own values came from.
      const own = leadContact(lead);
      const from = {};
      if (lead.name && lead.name !== "Unknown") from.clientName = "lead";
      if (own.phone) from.clientPhone = "lead";
      if (own.email) from.clientEmail = "lead";
      setPrefill({ from, lastQuotation: null, details: { clientName: lead.name, clientPhone: own.phone, clientEmail: own.email } });
      if (force) setErr(e?.response?.data?.message || "Couldn't load the lead's saved details — filled what this screen has.");
    } finally { setPrefilling(false); }
  };

  const startNew = () => {
    const f = blankForm(lead, isSuperAdmin, settings || {});
    setForm(f); setEditId(null); setErr(""); setPrefill(null);
    setOpen({ cover: f.coverPage });
    setView("edit");
    if (leadIdOf(linkedLead)) loadPrefill(f);
  };
  const startEdit = (q) => {
    const f = formFrom(q);
    setForm(f); setEditId(q._id); setErr(""); setPrefill(null);
    if (isPage) setLinkedLead(q.lead ? { _id: q.lead, id: String(q.lead), name: q.leadInfo?.name || "", businessName: q.leadInfo?.businessName || "" } : null);
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

  // Page mode: open straight into the requested view once settings are loaded.
  const started = useRef(false);
  useEffect(() => {
    if (!isPage || started.current || !settings) return;
    started.current = true;
    if (start === "new") startNew();
    else if (start === "edit" && startQuotation) startEdit(startQuotation);
    else if (start === "upload") startUpload();
    else if (start === "settings") setView("settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  const goBack = () => { setErr(""); if (isPage) onClose(); else setView("list"); };

  // ── Lead linking: match the typed client details to a lead ──
  const [matches, setMatches] = useState([]);
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState(null);
  const dismissed = useRef(new Set());       // leads the user unlinked — never auto-link them again

  const linkLead = (l, { auto = false } = {}) => {
    const next = { _id: l._id, id: l.id || String(l._id), name: l.name, businessName: l.businessName || "", match: l.match || "" };
    setLinkedLead(next); setMatches([]); setLeadSearchOpen(false); setLeadSearch(""); setLeadResults(null);
    toast(auto ? `Linked to lead ${l.name} — matched by ${l.match}` : `Linked to lead ${l.name}`);
    // New quotation: fill any empty client fields from the lead (nothing typed is overwritten).
    if (!editId) loadPrefill(null, { forLead: next });
  };
  const unlinkLead = () => {
    if (linkedLead) dismissed.current.add(String(leadIdOf(linkedLead)));
    setLinkedLead(null); setPrefill(null);
  };

  useEffect(() => {
    if (!isPage || (view !== "edit" && view !== "upload") || linkedLead) { setMatches([]); return; }
    const { clientPhone, clientEmail, clientName, clientCompany } = form;
    const enough = String(clientPhone || "").replace(/\D/g, "").length >= 10 || /@/.test(clientEmail || "")
      || String(clientName || "").trim().length >= 3 || String(clientCompany || "").trim().length >= 3;
    if (!enough) { setMatches([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/quotations/match-lead", { params: { phone: clientPhone, email: clientEmail, name: clientName, company: clientCompany } });
        const list = (r.data?.leads || []).filter((l) => !dismissed.current.has(String(l.id)));
        const exact = list.filter((l) => l.exact);
        if (exact.length === 1) linkLead(exact[0], { auto: true });   // one sure match (phone / email) → link it
        else setMatches(list);
      } catch { setMatches([]); }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPage, view, linkedLead, form.clientPhone, form.clientEmail, form.clientName, form.clientCompany]);

  useEffect(() => {
    if (!leadSearchOpen) return;
    const q = leadSearch.trim();
    if (q.length < 3) { setLeadResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/quotations/match-lead", { params: { phone: q, email: q, name: q, company: q } });
        setLeadResults(r.data?.leads || []);
      } catch { setLeadResults([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [leadSearch, leadSearchOpen]);

  // Fill the quotation from a content template. Client, lead, dates and status stay.
  const applyTemplate = (t) => {
    if (!t) return;
    const typed = form.lineItems.some((li) => String(li.description || "").trim());
    if (typed && !window.confirm(`Fill this quotation from "${t.name}"?\nItems, sections, terms, discount, GST and design are replaced. Client details stay.`)) return;
    const c = pickTemplate(t.content || {});
    const ff = formFrom({ ...c, currency: c.currency || form.currency });
    setForm((f) => {
      const next = { ...f };
      for (const k of Object.keys(c)) if (k in ff) next[k] = ff[k];
      if (!c.title) next.title = f.title;
      return next;
    });
    setAppliedTemplate(t._id);
    setOpen((o) => ({ ...o, cover: !!c.coverPage, scope: !!c.scopeOfWork, paymentSchedule: (c.paymentSchedule || []).length > 0,
      customTables: (c.customTables || []).length > 0, timeline: (c.timeline || []).length > 0, introduction: !!c.introduction }));
    toast(`Filled from template "${t.name}"`);
  };

  // Admins: save this quotation's content (never the client) as a template.
  const saveAsTemplate = async () => {
    const body = cleanBody();
    if (!body.lineItems.length) return setErr("Add at least one item before saving a template.");
    const current = templates.find((t) => t._id === appliedTemplate);
    const name = window.prompt("Template name (client details are not saved):", current?.name || form.title || "");
    if (name === null) return;
    const clean = name.trim(); if (!clean) return;
    const existing = templates.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing && !window.confirm(`A template called "${existing.name}" exists. Replace its content with this quotation's?`)) return;
    try {
      const r = existing
        ? await api.put(`/quotations/templates/${existing._id}`, { name: clean, content: pickTemplate(body) })
        : await api.post("/quotations/templates", { name: clean, content: pickTemplate(body) });
      const t = r.data?.template;
      setTemplates((list) => [...list.filter((x) => x._id !== t._id), t].sort((a, b) => a.name.localeCompare(b.name)));
      setAppliedTemplate(t._id);
      toast(existing ? `Template "${t.name}" updated` : `Saved as template "${t.name}"`);
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't save the template."); }
  };

  const designs = settings?.designs || [];
  const changeDesign = (id) => {
    const eff = settingsForDesign(settings || {}, id);
    setForm((f) => ({ ...f, designId: id || null, ...(editId ? {} : { coverPage: !!eff.coverPageDefault }) }));
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
      // eslint-disable-next-line no-unused-vars
      .map(({ _more, ...li }) => ({ ...li, description: li.description.trim(), quantity: Number(li.quantity) || 0, unitPrice: Number(li.unitPrice) || 0 }));
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
      leadId: leadIdOf(linkedLead) || null,
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
      onChanged?.();
      if (isPage) { onClose(); return; }
      await load();
      setView("list");
    } catch (e) {
      printWin?.close();
      setErr(e?.response?.data?.message || "Couldn't save the quotation.");
    } finally { setSaving(false); }
  };

  const startUpload = () => {
    setUpFile(null);
    if (isPage) {
      const f = blankForm(lead, isSuperAdmin, settings || {});
      setForm(f); setPrefill(null);
      if (leadIdOf(linkedLead)) loadPrefill(f);
    }
    setUpForm({ title: blankForm(lead, isSuperAdmin, settings || {}).title, amount: "", status: "sent", remark: "" });
    setErr(""); setView("upload");
  };
  const submitUpload = async () => {
    if (!upFile) return setErr("Choose a PDF or image of the quotation.");
    if (upFile.size > 15 * 1024 * 1024) return setErr("The file is larger than 15 MB.");
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.append("file", upFile);
    if (leadIdOf(linkedLead)) fd.append("leadId", leadIdOf(linkedLead));
    fd.append("clientName", form.clientName || (lead.name && lead.name !== "Unknown" ? lead.name : ""));
    for (const k of ["clientCompany", "clientPhone", "clientEmail"]) if (form[k]) fd.append(k, form[k]);
    fd.append("title", upForm.title.trim());
    fd.append("amount", String(Number(upForm.amount) || 0));
    fd.append("status", upForm.status);
    fd.append("remark", upForm.remark.trim());
    const handledBy = (lead.agent && lead.agent !== "Unassigned" ? lead.agent : "") || getUser()?.name || "";
    if (handledBy) fd.append("handledBy", handledBy);
    try {
      const r = await api.post("/quotations/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      toast(`Quotation ${r.data?.quotation?.number || ""} uploaded`);
      onChanged?.();
      if (isPage) { onClose(); return; }
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
    <div className="space-y-3">
      {form[list].map((li, i) => {
        const amount = r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0));
        const hasExtras = !!(li.module || li.priceLabel || li.chargeNote);
        const showMore = li._more ?? hasExtras;
        const isOptional = list === "optionalItems";
        const iconBtn = "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130] disabled:opacity-30 disabled:hover:bg-transparent";
        return (
          <div key={i} className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#161922] shadow-sm">
            {/* card header: number + actions, all labelled */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#F0F2FA] dark:border-[#1E2130] bg-[#FAFBFD] dark:bg-[#13161E] rounded-t-xl">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#8B92A9] mr-auto">{isOptional ? "Optional item" : "Item"} {i + 1}</span>
              <button className={iconBtn} disabled={i === 0} onClick={() => moveItem(list, i, -1)} title="Move this item up"><ChevronUp className="w-3.5 h-3.5" />Up</button>
              <button className={iconBtn} disabled={i === form[list].length - 1} onClick={() => moveItem(list, i, 1)} title="Move this item down"><ChevronDown className="w-3.5 h-3.5" />Down</button>
              {canEditSettings && !isOptional && (
                <button className={iconBtn} onClick={() => saveToLibrary(li)} title="Save this item to Saved services, to add it quickly next time">
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#2563EB]" />Save as service
                </button>
              )}
              <button className={`${iconBtn} hover:!bg-[#FEF2F2] dark:hover:!bg-[#2D0A0A]`} disabled={!isOptional && form.lineItems.length === 1}
                      onClick={() => delRow(list, i)} title="Remove this item"><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />Remove</button>
            </div>

            <div className="p-3 space-y-3">
              {/* name + line amount */}
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label className={lbl}>Service / item name</label>
                  <input className={`${inp} !text-[14px] !font-semibold !py-2`} value={li.description} placeholder="e.g. Website Design & Development"
                         onChange={(e) => setRow(list, i, { description: e.target.value })} />
                </div>
                <div className="text-right shrink-0 pb-1.5 min-w-[96px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8B92A9]">Amount</div>
                  <div className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">
                    {li.priceLabel ? <span className="text-[13px] text-[#E07B12]">{li.priceLabel}</span> : money(amount, cur).replace(/\.00$/, "")}
                    {!li.priceLabel && li.billing !== "one_time" && <span className="text-[11px] font-medium text-[#8B92A9]">{BILLING.find((b) => b.value === li.billing)?.short}</span>}
                  </div>
                </div>
              </div>

              {/* billing · quantity · unit price — all labelled */}
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_140px_1fr] gap-3">
                <div>
                  <label className={lbl}>Billing</label>
                  <select className={`${inp} h-[38px] !py-0`} value={li.billing} onChange={(e) => setRow(list, i, { billing: e.target.value })}>
                    {BILLING.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Quantity</label>
                  <div className="flex items-stretch h-[38px] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15 overflow-hidden">
                    <button type="button" className="px-2.5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130] disabled:opacity-30" title="One less"
                            disabled={!(Number(li.quantity) > 0)} onClick={() => setRow(list, i, { quantity: Math.max(0, r2((Number(li.quantity) || 0) - 1)) })}><Minus className="w-3.5 h-3.5" /></button>
                    <input type="number" min="0" step="any" inputMode="decimal" aria-label="Quantity"
                           className="w-full min-w-0 text-center bg-transparent text-[13px] text-[#0F1117] dark:text-[#F0F2FA] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                           value={li.quantity} onChange={(e) => setRow(list, i, { quantity: e.target.value })} onFocus={(e) => e.target.select()} />
                    <button type="button" className="px-2.5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="One more"
                            onClick={() => setRow(list, i, { quantity: r2((Number(li.quantity) || 0) + 1) })}><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={lbl}>Unit price{li.billing !== "one_time" ? ` (${BILLING.find((b) => b.value === li.billing)?.short.replace("/", "per ")})` : ""}</label>
                  <div className="flex items-stretch h-[38px] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15 overflow-hidden">
                    <span className="px-2.5 flex items-center text-[13px] font-semibold text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#1A1D27] border-r border-[#E4E7EF] dark:border-[#262A38]">{cur === "INR" ? "₹" : cur}</span>
                    <input type="number" min="0" step="any" inputMode="decimal" aria-label="Unit price" placeholder="0"
                           className="w-full min-w-0 px-3 text-right bg-transparent text-[13px] text-[#0F1117] dark:text-[#F0F2FA] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                           value={Number(li.unitPrice) === 0 && li.unitPrice !== "0" ? "" : li.unitPrice}
                           onChange={(e) => setRow(list, i, { unitPrice: e.target.value === "" ? 0 : e.target.value })} />
                  </div>
                </div>
              </div>

              {/* deliverables — grows with the text */}
              <div>
                <label className={lbl}>Key deliverables <span className="font-normal normal-case text-[#B0B6C6]">— optional, one per line; start a line with • or - for a bullet</span></label>
                <textarea rows={Math.min(10, Math.max(2, String(li.details || "").split("\n").length + 1))} className={`${inp} text-[12.5px] leading-5 resize-y`} value={li.details}
                          onChange={(e) => setRow(list, i, { details: e.target.value })} placeholder={"• Full profile management\n• Posts, stories and reporting"} />
              </div>

              {/* rarely used: behind "More options" */}
              <button type="button" onClick={() => setRow(list, i, { _more: !showMore })} className="flex items-center gap-1 text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:text-[#2563EB]">
                {showMore ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                More options{!showMore && hasExtras ? " (in use)" : ""}
                <span className="font-normal text-[#B0B6C6]">— {withModule ? "module, " : ""}price text, note under the price</span>
              </button>
              {showMore && (
                <div className={`grid grid-cols-1 ${withModule ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] p-3`}>
                  {withModule && (
                    <div>
                      <label className={lbl}>Module</label>
                      <input className={inp} value={li.module} list="q-modules" onChange={(e) => setRow(list, i, { module: e.target.value })} placeholder="e.g. Module 1: Leads" />
                      <p className="mt-1 text-[10.5px] text-[#8B92A9]">Groups items and lets you split the payment by module.</p>
                    </div>
                  )}
                  <div>
                    <label className={lbl}>Price text</label>
                    <input className={inp} value={li.priceLabel || ""} maxLength={80} onChange={(e) => setRow(list, i, { priceLabel: e.target.value })} placeholder="e.g. Custom Pricing" />
                    <p className="mt-1 text-[10.5px] text-[#8B92A9]">Printed instead of the amount.</p>
                  </div>
                  <div>
                    <label className={lbl}>Note under the price</label>
                    <input className={inp} value={li.chargeNote || ""} maxLength={120} onChange={(e) => setRow(list, i, { chargeNote: e.target.value })} placeholder="e.g. (5 - 6 pages)" />
                    <p className="mt-1 text-[10.5px] text-[#8B92A9]">Small line printed under the amount.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const modules = [...new Set([...(form.lineItems || []).map((l) => l.module), ...catalog.map((c) => c.module)].filter(Boolean))];

  // Linked-lead bar (page mode): shown on the builder and on the upload form.
  const leadBar = isPage && (

                <div className={`rounded-xl border p-3 ${linkedLead ? "border-[#BBF7D0] bg-[#F0FDF4] dark:border-[#14532D] dark:bg-[#052e1c]" : "border-[#FDE68A] bg-[#FFFBEB] dark:border-[#78350F] dark:bg-[#2A1E05]"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link2 className={`w-4 h-4 ${linkedLead ? "text-[#16A34A]" : "text-[#D97706]"}`} />
                    {linkedLead ? (
                      <span className="text-[13px] text-[#0F1117] dark:text-[#F0F2FA]">
                        Linked to lead <b>{linkedLead.name}</b>{linkedLead.businessName ? ` · ${linkedLead.businessName}` : ""}
                        {linkedLead.match && <span className="ml-1.5 text-[11px] text-[#16A34A]">(matched by {linkedLead.match})</span>}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#92400E] dark:text-[#FCD34D]">Not linked to a lead yet — type the client's phone or email and it links automatically, or find the lead.</span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      <button className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-[#2563EB] hover:bg-white/70 dark:hover:bg-black/20" onClick={() => { setLeadSearchOpen((o) => !o); setLeadSearch(""); setLeadResults(null); }}>
                        {linkedLead ? "Change lead" : "Find lead"}
                      </button>
                      {linkedLead && (
                        <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-[#DC2626] hover:bg-white/70 dark:hover:bg-black/20" onClick={unlinkLead} title="Remove the link to this lead">
                          <Unlink className="w-3.5 h-3.5" /> Unlink
                        </button>
                      )}
                    </div>
                  </div>
                  {!linkedLead && matches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-semibold text-[#92400E] dark:text-[#FCD34D]">Possible leads for these details:</div>
                      {matches.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] px-2.5 py-1.5">
                          <div className="flex-1 min-w-0 text-[12.5px]">
                            <b className="text-[#0F1117] dark:text-[#F0F2FA]">{m.name}</b>{m.businessName ? ` · ${m.businessName}` : ""}
                            <span className="text-[#8B92A9]"> {m.phoneHint} · matched by {m.match}</span>
                          </div>
                          <button className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[11px] font-semibold" onClick={() => linkLead(m)}>Link</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {leadSearchOpen && (
                    <div className="mt-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input className={`${inp} pl-8`} autoFocus value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Search leads by name, company, phone or email…" />
                      </div>
                      {leadResults && (
                        <div className="mt-1.5 max-h-[200px] overflow-y-auto space-y-1">
                          {leadResults.length === 0 && <div className="text-[12px] text-[#8B92A9] px-1 py-2">No lead found for "{leadSearch}".</div>}
                          {leadResults.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] px-2.5 py-1.5">
                              <div className="flex-1 min-w-0 text-[12.5px]"><b className="text-[#0F1117] dark:text-[#F0F2FA]">{m.name}</b>{m.businessName ? ` · ${m.businessName}` : ""}<span className="text-[#8B92A9]"> {m.phoneHint}</span></div>
                              <button className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[11px] font-semibold" onClick={() => linkLead(m)}>Link</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
  );

  const card = isPage ? "rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-4 sm:p-5 shadow-sm space-y-4" : "space-y-4";

  // "More sections": sections with content (or opened) show as cards, the rest as "+ Section" buttons.
  const sectionChips = [
    { key: "cover", title: "Cover page & highlights", empty: !(form.coverPage || form.highlights.length) },
    { key: "introduction", title: sec("introduction").label, empty: !form.introduction, hidden: !sec("introduction").show },
    { key: "aboutUs", title: sec("aboutUs").label, empty: !form.aboutUs, hidden: !sec("aboutUs").show },
    { key: "scope", title: sec("scope").label, empty: !form.scopeOfWork, hidden: !sec("scope").show },
    { key: "optionalItems", title: sec("optionalItems").label, empty: !form.optionalItems.length, hidden: !sec("optionalItems").show },
    { key: "customTables", title: sec("customTables").label, empty: !form.customTables.length, hidden: !sec("customTables").show },
    { key: "paymentSchedule", title: sec("paymentSchedule").label, empty: !form.paymentSchedule.length, hidden: !sec("paymentSchedule").show },
    { key: "timeline", title: sec("timeline").label, empty: !form.timeline.length, hidden: !sec("timeline").show },
    { key: "serviceInfo", title: sec("serviceInfo").label, empty: !form.serviceInfo, hidden: !sec("serviceInfo").show },
    { key: "suggestions", title: sec("suggestions").label, empty: !form.suggestions, hidden: !sec("suggestions").show },
    { key: "customBlocks", title: sec("customBlocks").label, empty: !form.customBlocks.length, hidden: !sec("customBlocks").show },
    { key: "paymentTerms", title: sec("paymentTerms").label, empty: !form.paymentTerms, hidden: !sec("paymentTerms").show },
    { key: "terms", title: sec("terms").label, empty: !form.terms, hidden: !sec("terms").show },
    { key: "notes", title: sec("notes").label, empty: !form.remark, hidden: !sec("notes").show },
  ];

  const totalsBox = (
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
  );

  const editBody = (
            <div className="space-y-4">
              <datalist id="q-modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
              <datalist id="q-subjects">{SUBJECT_PRESETS.map((t) => <option key={t} value={t} />)}</datalist>

              {leadBar}

              {!isPage && (templates.length > 0 || designs.length > 0) && (
                <div className="flex flex-wrap items-end gap-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] p-3">
                  {templates.length > 0 && (
                    <div className="flex-1 min-w-[220px]">
                      <label className={lbl}><LayoutTemplate className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />Start from template</label>
                      <select className={inp} value="" onChange={(e) => { applyTemplate(templates.find((t) => t._id === e.target.value)); e.target.value = ""; }}>
                        <option value="">{appliedTemplate ? `Using "${templates.find((t) => t._id === appliedTemplate)?.name || "template"}" — pick another…` : "Pick a template to fill items, terms and more…"}</option>
                        {templates.map((t) => <option key={t._id} value={t._id}>{t.name}{t.description ? ` — ${t.description}` : ""}</option>)}
                      </select>
                    </div>
                  )}
                  {designs.length > 0 && (
                    <div className="min-w-[200px]">
                      <label className={lbl}>Design</label>
                      <select className={inp} value={form.designId || ""} onChange={(e) => changeDesign(e.target.value || null)}>
                        <option value="">{settings?.standardDesignName || "Standard"}</option>
                        {designs.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <section className={card}>
              {/* Client — filled from the lead, all editable */}
              <div className="flex flex-wrap items-center gap-2 -mb-1">
                <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Client</span>
                <span className="text-[11px] text-[#8B92A9]">
                  {prefilling ? "Fetching the lead's details…"
                    : prefill ? `Filled from the lead${prefill.lastQuotation ? `, its last quotation ${prefill.lastQuotation}` : ""} and finance records — change anything below.`
                    : "Type the client's details, or fetch them from the lead."}
                </span>
                {leadIdOf(linkedLead) && <button type="button" onClick={() => loadPrefill(null, { force: true })} disabled={prefilling}
                        className={`${linkBtn} ml-auto disabled:opacity-50`} title="Replace the client fields with the lead's saved details">
                  {prefilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5 rotate-180" />} Fill again from lead
                </button>}
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
                <div className={`sm:col-span-2 grid grid-cols-1 ${isPage ? "" : "sm:grid-cols-[1fr_170px]"} gap-3`}>
                  <div><label className={lbl}>{sec("subject").label}</label><input className={inp} list="q-subjects" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Proposal for … Services-reg (pick a suggestion or type)" /></div>
                  {!isPage && <div><label className={lbl}>Valid until</label><input type="date" className={inp} value={form.validUntil || ""} onChange={(e) => set("validUntil", e.target.value)} /></div>}
                </div>
              </div>

              </section>

              <section className={card}>
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
                <button onClick={() => addRow("lineItems", emptyItem())} className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#C9D4EE] dark:border-[#2A3550] py-2.5 text-[13px] font-semibold text-[#2563EB] hover:bg-[#F8FAFF] dark:hover:bg-[#141A2A]"><Plus className="w-4 h-4" /> Add item</button>
              </div>

              </section>

              <section className={card}>
              {isPage && <div className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3">Pricing</div>}
              {/* Discount / GST / totals */}
              <div className={`grid grid-cols-1 ${isPage ? "" : "sm:grid-cols-2"} gap-4`}>
                <div className={isPage ? "grid grid-cols-1 sm:grid-cols-3 gap-3 items-start" : "space-y-3"}>
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
                    {!isPage && <div><label className={lbl}>Status</label>
                      <select className={inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
                        {STATUS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>}
                  </div>
                  {!isPage && <div><label className={lbl}>Prepared by <span className="font-normal text-[#8B92A9]">— for the CRM only, not printed on the quotation</span></label><input className={inp} value={form.handledBy} onChange={(e) => set("handledBy", e.target.value)} /></div>}
                </div>

                {!isPage && totalsBox}
              </div>

              </section>

              <section className={card}>
              {/* Extra sections */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">More sections <span className="normal-case font-normal">— add only what you need; empty sections are left out of the quotation</span></div>
                {sectionChips.some((c) => c.empty && !open[c.key]) && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {sectionChips.filter((c) => c.empty && !open[c.key]).map((c) => (
                      <button key={c.key} type="button" onClick={() => toggle(c.key)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed text-[12px] font-semibold transition
                                ${c.hidden ? "border-[#E4E7EF] text-[#B0B6C6] dark:border-[#262A38]" : "border-[#C9D4EE] text-[#2563EB] hover:bg-[#F8FAFF] dark:border-[#2A3550] dark:hover:bg-[#141A2A]"}`}
                              title={c.hidden ? "Turned off in Template settings — it won't print" : `Add ${c.title}`}>
                        <Plus className="w-3.5 h-3.5" />{c.title}
                      </button>
                    ))}
                  </div>
                )}

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
              </section>
            </div>
  );

  const shell = (
      <div className={isPage
          ? "w-full max-w-5xl mx-auto flex flex-col rounded-2xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] shadow-sm"
          : "w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] shadow-xl"} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {(view !== "list" || isPage) && (
            <button onClick={goBack} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title={isPage ? "Back to quotations" : "Back to list"}>
              <ArrowLeft className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" />
            </button>
          )}
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</div>
            <div className="text-[11px] text-[#8B92A9] truncate">{view === "settings" ? "Applies to every quotation in your company" : linkedLead ? `Lead: ${linkedLead.name}` : "Not linked to a lead"}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Close">
            <X className="w-4 h-4 text-[#8B92A9]" />
          </button>
        </div>

        {view === "settings" ? (
          <QuotationSettingsPanel api={api} settings={settings || {}} toast={toast}
            onClose={goBack}
            onSaved={(st, opts) => { setSettings(st); if (!opts?.keepOpen) goBack(); }} />
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
              {leadBar}
              {isPage && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[["clientName", "Client name", ""], ["clientCompany", "Client company", "Business / company name"],
                    ["clientPhone", "Phone", "+91 98765 43210"], ["clientEmail", "Email", "client@company.com"]].map(([k, label, ph]) => (
                    <div key={k}>
                      <label className={lbl}>{label}{prefill?.from?.[k] && form[k] && form[k] === prefill.details?.[k] ? <span className="font-normal normal-case text-[#16A34A]"> · from {prefill.from[k]}</span> : null}</label>
                      <input className={inp} value={form[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}
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
            editBody
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
              {canEditTemplates && (
                <button onClick={saveAsTemplate} disabled={saving} className={btnGhost} title="Save this quotation's items, sections, terms and design as a reusable template (not the client)">
                  <Save className="w-4 h-4" /> Save as template
                </button>
              )}
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
  );
  // ── Page mode, editing: two columns — form cards + a sticky summary ──
  if (isPage && view === "edit" && !loading) {
    const sideCard = "rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] p-4 shadow-sm";
    const actions = (
      <>
        {canEditTemplates && (
          <button onClick={saveAsTemplate} disabled={saving} className={btnGhost} title="Save this quotation's items, sections, terms and design as a reusable template (not the client)">
            <Save className="w-4 h-4" /> <span className="hidden xl:inline">Save as</span> template
          </button>
        )}
        <button onClick={previewDraft} disabled={saving} className={btnGhost} title="See the finished quotation before saving"><Eye className="w-4 h-4" /> Preview</button>
        <button onClick={() => save(false)} disabled={saving} className={btnGhost}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</button>
        <button onClick={() => save(true)} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12.5px] font-semibold disabled:opacity-60 shadow-sm">
          <Printer className="w-4 h-4" /> Save &amp; print
        </button>
      </>
    );
    return (
      <div className="max-w-[1280px] mx-auto">
        {/* sticky top bar */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-[#F6F7FB]/90 dark:bg-[#0F1117]/90 backdrop-blur border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={goBack} className="p-2 rounded-xl hover:bg-white dark:hover:bg-[#1A1D27] border border-transparent hover:border-[#E4E7EF] dark:hover:border-[#262A38]" title="Back to quotations">
              <ArrowLeft className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" />
            </button>
            <div className="min-w-0 mr-auto">
              <div className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                {editId ? `Edit ${items.find((x) => x._id === editId)?.number || startQuotation?.number || "quotation"}` : `New ${tpl.title.toLowerCase()}`}
                {form.clientCompany || form.clientName ? <span className="font-normal text-[#8B92A9]"> · {form.clientCompany || form.clientName}</span> : null}
              </div>
              <div className={`text-[11.5px] ${linkedLead ? "text-[#16A34A]" : "text-[#D97706]"}`}>{linkedLead ? `Linked to lead ${linkedLead.name}` : "Not linked to a lead"}</div>
            </div>
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
          {err && <div className="mt-2 rounded-lg bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 text-[12.5px] text-[#B91C1C] dark:text-[#FCA5A5]">{err}</div>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start pb-10">
          <div className="min-w-0">{editBody}</div>

          {/* summary */}
          <aside className="space-y-4 lg:sticky lg:top-[92px]">
            <div className={sideCard}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#8B92A9]">{form.showTotals === false ? "Rate card" : "Total"}</div>
              <div className="text-[28px] leading-tight font-extrabold text-[#0F1117] dark:text-[#F0F2FA] mt-0.5">{money(totals.grand, cur)}</div>
              <div className="text-[11.5px] text-[#8B92A9] mb-3">{Number(form.gstPercent) > 0 ? `incl. ${form.gstPercent}% GST` : "no GST"}{totals.recurringByPeriod.length ? " · one-time" : ""}</div>
              {totalsBox}
            </div>

            <div className={`${sideCard} space-y-3`}>
              <div>
                <label className={lbl}>Status</label>
                <div className="grid grid-cols-4 gap-1">
                  {STATUS.map((st) => (
                    <button key={st} type="button" onClick={() => set("status", st)}
                            className={`py-1.5 rounded-lg text-[11.5px] font-semibold capitalize border transition ${form.status === st ? `${STATUS_STYLE[st]} border-transparent ring-2 ring-offset-1 ring-[#2563EB]/30` : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]"}`}>{st}</button>
                  ))}
                </div>
              </div>
              {designs.length > 0 && (
                <div><label className={lbl}>Design</label>
                  <select className={inp} value={form.designId || ""} onChange={(e) => changeDesign(e.target.value || null)}>
                    <option value="">{settings?.standardDesignName || "Standard"}</option>
                    {designs.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div><label className={lbl}>Valid until</label><input type="date" className={inp} value={form.validUntil || ""} onChange={(e) => set("validUntil", e.target.value)} /></div>
              {templates.length > 0 && (
                <div><label className={lbl}><LayoutTemplate className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />Start from template</label>
                  <select className={inp} value="" onChange={(e) => { applyTemplate(templates.find((t) => t._id === e.target.value)); e.target.value = ""; }}>
                    <option value="">{appliedTemplate ? `Using "${templates.find((t) => t._id === appliedTemplate)?.name || "template"}"` : "Pick a template…"}</option>
                    {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div><label className={lbl}>Prepared by <span className="font-normal text-[#8B92A9]">· CRM only</span></label><input className={inp} value={form.handledBy} onChange={(e) => set("handledBy", e.target.value)} /></div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (isPage) return shell;
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-3" onClick={onClose}>{shell}</div>,
    document.body
  );
}
