// components/QuotationModal.jsx
// Quotations for one lead, opened from the Lead Management table.
//   list view → this lead's quotations (print / edit / delete) + "New quotation"
//   edit view → line items (qty × price, billing period), discount, GST, live totals
// Backend: /api/quotations (numbering, totals and scoping are done server-side).
// Print opens a clean A4 page; the browser's "Save as PDF" makes the PDF.
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { getBrand, getUser } from "../data/sessionStore";
import { X, Plus, Trash2, Printer, Pencil, FileText, Loader2, ArrowLeft, Upload, ExternalLink, Eye, Stamp } from "lucide-react";

const BILLING = [
  { value: "one_time",    label: "One-time",    short: "" },
  { value: "monthly",     label: "Monthly",     short: "/month" },
  { value: "quarterly",   label: "Quarterly",   short: "/quarter" },
  { value: "half_yearly", label: "Half-yearly", short: "/half-year" },
  { value: "yearly",      label: "Yearly",      short: "/year" },
];
const STATUS = ["draft", "sent", "accepted", "rejected"];
const STATUS_STYLE = {
  draft:    "bg-[#F0F2FA] text-[#4B5168] dark:bg-[#1E2130] dark:text-[#9DA3BB]",
  sent:     "bg-[#EEF3FF] text-[#2563EB] dark:bg-[#1A2540] dark:text-[#4F8EF7]",
  accepted: "bg-[#f0fdf4] text-[#16A34A] dark:bg-[#052e1c] dark:text-[#4ADE80]",
  rejected: "bg-[#FEF2F2] text-[#DC2626] dark:bg-[#2D0A0A] dark:text-[#F87171]",
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n, cur = "INR") => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n || 0); }
  catch { return `${cur} ${r2(n).toLocaleString("en-IN")}`; }
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Same maths as Quotation.recalc() on the backend, for the live preview.
function computeTotals(q) {
  let oneTime = 0, recurring = 0;
  for (const li of q.lineItems) {
    const t = r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0));
    if (li.billing && li.billing !== "one_time") recurring += t; else oneTime += t;
  }
  let disc = 0;
  if (q.discountType === "percent") disc = oneTime * (Number(q.discountValue) || 0) / 100;
  else if (q.discountType === "amount") disc = Number(q.discountValue) || 0;
  disc = r2(Math.min(disc, oneTime));
  const gst = r2((oneTime - disc) * (Number(q.gstPercent) || 0) / 100);
  return { oneTime: r2(oneTime), recurring: r2(recurring), disc, gst, grand: r2(oneTime - disc + gst) };
}

const emptyItem = (description = "") => ({ description, quantity: 1, unitPrice: 0, billing: "one_time" });

function blankForm(lead, isSuperAdmin) {
  const services = [...new Set([...(lead.services || []), lead.service].filter(Boolean))];
  return {
    title: services.length ? `Quotation for ${services.join(", ")}` : "",
    clientName: lead.name && lead.name !== "Unknown" ? lead.name : "",
    clientCompany: "", clientGSTIN: "", clientAddress: "",
    // Admins only ever see masked contact details in the CRM, so don't
    // prefill them here — super admins (who see full details) get them.
    clientPhone: isSuperAdmin && lead.phone ? lead.phone : "",
    clientEmail: isSuperAdmin && lead.email ? lead.email : "",
    lineItems: services.length ? services.map((s) => emptyItem(s)) : [emptyItem()],
    optedServices: services,
    currency: "INR",
    discountType: "none", discountValue: 0, discountedBy: "",
    gstPercent: 18,
    status: "draft", remark: "",
    // Admin page: the lead's agent. Employee screens: the logged-in employee.
    handledBy: (lead.agent && lead.agent !== "Unassigned" ? lead.agent : "") || getUser()?.name || "",
  };
}

function formFrom(q) {
  return {
    title: q.title || "", clientName: q.clientName || "", clientCompany: q.clientCompany || "",
    clientGSTIN: q.clientGSTIN || "", clientAddress: q.clientAddress || "",
    clientPhone: q.clientPhone || "", clientEmail: q.clientEmail || "",
    lineItems: (q.lineItems || []).map((li) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, billing: li.billing || "one_time" })),
    optedServices: q.optedServices || [], currency: q.currency || "INR",
    discountType: q.discountType || "none", discountValue: q.discountValue || 0, discountedBy: q.discountedBy || "",
    gstPercent: q.gstPercent ?? 0, status: q.status || "draft", remark: q.remark || "", handledBy: q.handledBy || "",
  };
}

// ── Printable A4 page ──────────────────────────────────────────────────────
// `win` = a window already opened during the click (pop-up blockers reject
// window.open() called after an await).
// preview: true → unsaved draft from the form. Shows a "not saved" banner
// (printed too, so a draft can't pass as a real quotation) and skips the
// automatic print dialog.
// settings: the company's letterhead settings (GET /quotations/settings).
//   With a letterhead image, it is printed full-bleed behind EVERY page, and
//   thead/tfoot spacers (repeated by the browser on each printed page) keep
//   the text inside the letterhead's blank area.
function printQuotation(q, win = null, { preview = false, settings = null } = {}) {
  const brand = getBrand() || {};
  const user = getUser() || {};
  const companyName = brand.name || user.company?.name || user.companyName || "";
  const logo = brand.logoUrl || brand.headerLogoUrl || "";
  const cur = q.currency || "INR";
  const billingLabel = (b) => BILLING.find((x) => x.value === b)?.label || "One-time";

  if (q.source === "uploaded" && q.fileUrl) {
    if (win) win.location.href = q.fileUrl; else window.open(q.fileUrl, "_blank", "noopener");
    return;
  }

  const lh = settings?.letterheadUrl ? settings : null;
  const top = lh ? Number(lh.marginTopMm ?? 40) : 16;
  const bottom = lh ? Number(lh.marginBottomMm ?? 25) : 16;
  const side = lh ? Number(lh.marginSideMm ?? 15) : 16;
  const showOwnHeader = !lh || !lh.hideBuiltInHeader;

  const rows = (q.lineItems || []).map((li, i) => `
    <tr><td>${i + 1}</td><td>${esc(li.description)}</td><td>${esc(billingLabel(li.billing))}</td>
    <td class="n">${esc(li.quantity)}</td><td class="n">${esc(money(li.unitPrice, cur))}</td><td class="n">${esc(money(li.lineTotal, cur))}</td></tr>`).join("");

  const client = [q.clientCompany, q.clientAddress, q.clientGSTIN && `GSTIN: ${q.clientGSTIN}`, q.clientPhone, q.clientEmail]
    .filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("");

  const content = `
  ${preview ? `<div class="draft"><b>Preview — not saved yet.</b> The quotation number is assigned when you save. Close this tab to go back and edit.</div>` : ""}
  <div class="top${showOwnHeader ? "" : " slim"}">
    <div>${showOwnHeader ? `${logo ? `<img src="${esc(logo)}" alt="">` : ""}${companyName ? `<div style="font-weight:bold;font-size:16px;margin-top:6px">${esc(companyName)}</div>` : ""}` : ""}</div>
    <div style="text-align:right"><h1>QUOTATION</h1>
      <div><b>${esc(q.number)}</b></div><div class="muted">Date: ${esc(fmtDate(q.createdAt))}</div>
      ${q.handledBy ? `<div class="muted">Prepared by: ${esc(q.handledBy)}</div>` : ""}</div>
  </div>
  <div class="grid">
    <div><div class="label">Quotation for</div><div style="font-weight:bold;font-size:15px">${esc(q.clientName || "—")}</div>${client}</div>
    ${q.title ? `<div style="text-align:right"><div class="label">Subject</div><div>${esc(q.title)}</div></div>` : ""}
  </div>
  <table class="it"><thead><tr><th>#</th><th>Description</th><th>Billing</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6" class="muted">No items</td></tr>`}</tbody></table>
  <table class="totals">
    <tr><td>One-time subtotal</td><td class="n">${esc(money(q.oneTimeSubtotal, cur))}</td></tr>
    ${q.discountAmount ? `<tr><td>Discount${q.discountType === "percent" ? ` (${esc(q.discountValue)}%)` : ""}</td><td class="n">− ${esc(money(q.discountAmount, cur))}</td></tr>` : ""}
    ${q.gstPercent ? `<tr><td>GST (${esc(q.gstPercent)}%)</td><td class="n">${esc(money(q.gstAmount, cur))}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td class="n">${esc(money(q.grandTotal, cur))}</td></tr>
    ${q.recurringSubtotal ? `<tr><td class="muted">Recurring charges</td><td class="n muted">${esc(money(q.recurringSubtotal, cur))} per period</td></tr>` : ""}
  </table>
  ${q.remark ? `<div class="note"><div class="label">Terms and notes</div>${esc(q.remark)}</div>` : ""}`;

  const body = lh
    ? `<img class="lh-bg" src="${esc(lh.letterheadUrl)}" alt="">
  <table class="lh-wrap">
    <thead><tr><td class="lh-space" style="height:${top}mm"></td></tr></thead>
    <tfoot><tr><td class="lh-space" style="height:${bottom}mm"></td></tr></tfoot>
    <tbody><tr><td class="lh-body">${content}</td></tr></tbody>
  </table>`
    : content;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${preview ? "Quotation preview" : esc(q.number)}</title>
<style>
  @page { size: A4; margin: ${lh ? "0" : "16mm"}; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; margin: 0; }
  .draft { background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:8px 12px; margin-bottom:14px; font-size:12px; border-radius:4px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .top.slim { border-bottom-width: 1px; padding-bottom: 8px; }
  .top img { max-height: 54px; max-width: 200px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
  .muted { color: #555; }
  .grid { display: flex; justify-content: space-between; gap: 24px; margin: 18px 0; }
  .label { font-size: 11px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
  table.it { width: 100%; border-collapse: collapse; margin-top: 8px; background: rgba(255,255,255,.85); }
  table.it th { background: #f2f2f2; text-align: left; font-size: 11px; text-transform: uppercase; }
  table.it th, table.it td { border: 1px solid #ddd; padding: 7px 8px; vertical-align: top; }
  table.it tr { break-inside: avoid; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 300px; margin-top: 12px; border-collapse: collapse; break-inside: avoid; }
  .totals td { padding: 4px 0; }
  .grand td { border-top: 2px solid #111; font-weight: bold; font-size: 15px; padding-top: 8px; }
  .note { margin-top: 22px; white-space: pre-wrap; break-inside: avoid; }
  /* letterhead */
  .lh-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: -1; object-fit: fill; }
  table.lh-wrap { width: 100%; border-collapse: collapse; }
  table.lh-wrap > thead > tr > td, table.lh-wrap > tfoot > tr > td { padding: 0; border: 0; }
  table.lh-wrap > tbody > tr > td.lh-body { padding: 0 ${side}mm; border: 0; vertical-align: top; }
  @media screen {
    body { background: #e5e7eb; }
    ${lh
      ? `body > table.lh-wrap, body > .lh-bg { width: 210mm; }
    body { width: 210mm; min-height: 297mm; margin: 16px auto; position: relative; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.25); }
    .lh-bg { position: absolute; }`
      : `body { max-width: 178mm; margin: 16px auto; padding: 16mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.25); }`}
  }
</style></head><body>
  ${body}
  ${preview ? "" : `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>`}
</body></html>`;

  const w = win || window.open("", "_blank");
  if (!w) { alert("Allow pop-ups for this site to print the quotation."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function QuotationModal({ lead, isSuperAdmin = false, onClose, onToast }) {
  const [view, setView]       = useState("list");   // "list" | "edit"
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(() => blankForm(lead, isSuperAdmin));
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [upFile, setUpFile]   = useState(null);
  const [upForm, setUpForm]   = useState({ title: "", amount: "", status: "sent", remark: "" });
  // Company letterhead for printing (everyone reads it; admins can change it).
  const [lhSettings, setLhSettings] = useState(null);
  const [lhCanEdit, setLhCanEdit]   = useState(false);
  const [lhDraft, setLhDraft]       = useState(null);   // margins / toggle being edited
  const [lhBusy, setLhBusy]         = useState("");

  const toast = (m, t = "success") => (onToast ? onToast(m, t) : null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/quotations", { params: { leadId: lead._id || lead.id } });
      const list = r.data?.quotations || [];
      setItems(list);
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't load quotations.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);
  useEffect(() => {
    api.get("/quotations/settings")
      .then((r) => { setLhSettings(r.data?.settings || null); setLhCanEdit(!!r.data?.canEdit); })
      .catch(() => {});   // printing still works without a letterhead
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = useMemo(() => computeTotals(form), [form]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, lineItems: f.lineItems.map((li, j) => (j === i ? { ...li, [k]: v } : li)) }));

  const startNew  = () => { setForm(blankForm(lead, isSuperAdmin)); setEditId(null); setErr(""); setView("edit"); };
  const startEdit = (q) => { setForm(formFrom(q)); setEditId(q._id); setErr(""); setView("edit"); };

  // Build what the saved quotation will look like from the current form —
  // same maths as the backend — and open it without saving.
  const previewDraft = () => {
    const lineItems = form.lineItems
      .filter((li) => String(li.description || "").trim())
      .map((li) => ({ ...li, quantity: Number(li.quantity) || 0, unitPrice: Number(li.unitPrice) || 0,
                      lineTotal: r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)) }));
    if (!lineItems.length) return setErr("Add at least one item with a description to preview.");
    setErr("");
    const existing = editId ? items.find((x) => x._id === editId) : null;
    printQuotation({
      ...form, lineItems, source: "created",
      number: existing?.number || "Number assigned on save",
      createdAt: existing?.createdAt || new Date().toISOString(),
      discountValue: Number(form.discountValue) || 0, gstPercent: Number(form.gstPercent) || 0,
      oneTimeSubtotal: totals.oneTime, recurringSubtotal: totals.recurring,
      discountAmount: totals.disc, gstAmount: totals.gst, grandTotal: totals.grand,
    }, null, { preview: true, settings: lhSettings });
  };

  const openLetterhead = () => {
    const st = lhSettings || {};
    setLhDraft({ marginTopMm: st.marginTopMm ?? 40, marginBottomMm: st.marginBottomMm ?? 25, marginSideMm: st.marginSideMm ?? 15, hideBuiltInHeader: st.hideBuiltInHeader ?? true });
    setErr(""); setView("letterhead");
  };

  const uploadLetterhead = async (file) => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return setErr("Upload the letterhead as a PNG, JPG or WEBP image. Export a PDF letterhead as an image first.");
    if (file.size > 5 * 1024 * 1024) return setErr("The image is larger than 5 MB.");
    setLhBusy("upload"); setErr("");
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.post("/quotations/settings/letterhead", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      setLhSettings(r.data.settings);
      const sz = r.data.size;
      if (sz?.width && sz?.height && Math.abs(sz.height / sz.width - 297 / 210) > 0.08) {
        toast("Letterhead uploaded. It isn't A4-shaped, so it will be stretched to fit the page — check the preview.", "error");
      } else toast("Letterhead uploaded");
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't upload the letterhead."); }
    finally { setLhBusy(""); }
  };

  const saveLetterhead = async (extra = {}) => {
    setLhBusy(extra.removeLetterhead ? "remove" : "save"); setErr("");
    try {
      const r = await api.put("/quotations/settings", { ...lhDraft, ...extra });
      setLhSettings(r.data.settings);
      toast(extra.removeLetterhead ? "Letterhead removed" : "Letterhead settings saved");
      if (!extra.removeLetterhead) setView("list");
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't save the letterhead settings."); }
    finally { setLhBusy(""); }
  };

  // Sample quotation on the letterhead, using the margins being edited.
  const previewLetterhead = () => {
    const sample = blankForm(lead, isSuperAdmin);
    const lineItems = [
      { description: sample.lineItems[0]?.description || "Website design and development", quantity: 1, unitPrice: 50000, billing: "one_time", lineTotal: 50000 },
      { description: "Social media management", quantity: 1, unitPrice: 10000, billing: "monthly", lineTotal: 10000 },
    ];
    printQuotation({
      ...sample, lineItems, source: "created", number: "SAMPLE", createdAt: new Date().toISOString(),
      gstPercent: 18, oneTimeSubtotal: 50000, recurringSubtotal: 10000, discountAmount: 0, gstAmount: 9000, grandTotal: 59000,
      remark: "This is a sample to check the letterhead layout.",
    }, null, { preview: true, settings: { ...(lhSettings || {}), ...lhDraft } });
  };

  const save = async (andPrint = false) => {
    const lineItems = form.lineItems
      .filter((li) => String(li.description || "").trim())
      .map((li) => ({ ...li, description: li.description.trim(), quantity: Number(li.quantity) || 0, unitPrice: Number(li.unitPrice) || 0 }));
    if (!form.clientName.trim()) return setErr("Enter the client's name.");
    if (!lineItems.length) return setErr("Add at least one item with a description.");
    if (form.discountType !== "none" && form.discountValue > 0 && !form.discountedBy.trim())
      return setErr("Enter who approved the discount.");

    const printWin = andPrint ? window.open("", "_blank") : null;
    setSaving(true); setErr("");
    const body = { ...form, lineItems, leadId: lead._id || lead.id,
      discountValue: Number(form.discountValue) || 0, gstPercent: Number(form.gstPercent) || 0 };
    try {
      const r = editId ? await api.put(`/quotations/${editId}`, body) : await api.post("/quotations", body);
      const q = r.data?.quotation;
      toast(editId ? `Quotation ${q?.number || ""} updated` : `Quotation ${q?.number || ""} created`);
      if (andPrint && q) printQuotation(q, printWin, { settings: lhSettings });
      await load();
      setView("list");
    } catch (e) {
      printWin?.close();
      setErr(e?.response?.data?.message || "Couldn't save the quotation.");
    } finally { setSaving(false); }
  };

  const startUpload = () => {
    setUpFile(null);
    setUpForm({ title: blankForm(lead, isSuperAdmin).title, amount: "", status: "sent", remark: "" });
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
      const r = await api.post("/quotations/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },   // stops axios turning FormData into JSON
        timeout: 120000,
      });
      toast(`Quotation ${r.data?.quotation?.number || ""} uploaded`);
      await load();
      setView("list");
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't upload the quotation.");
    } finally { setSaving(false); }
  };

  const remove = async (q) => {
    if (!window.confirm(`Delete quotation ${q.number}? Its number won't be reused.`)) return;
    try { await api.delete(`/quotations/${q._id}`); toast(`Quotation ${q.number} deleted`); load(); }
    catch (e) { toast(e?.response?.data?.message || "Couldn't delete the quotation.", "error"); }
  };

  const inp = "w-full px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]";
  const lbl = "block text-[11px] font-semibold text-[#8B92A9] mb-1";

  // Portal to <body> so a transformed/animated parent (agent app lists) can't
  // trap the fixed overlay inside itself.
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {view !== "list" && (
            <button onClick={() => setView("list")} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Back to list">
              <ArrowLeft className="w-4 h-4 text-[#4B5168] dark:text-[#9DA3BB]" />
            </button>
          )}
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {view === "list" ? "Quotations" : view === "upload" ? "Upload quotation" : view === "letterhead" ? "Quotation letterhead" : editId ? "Edit quotation" : "New quotation"}
            </div>
            <div className="text-[11px] text-[#8B92A9] truncate">{lead.name}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]" title="Close">
            <X className="w-4 h-4 text-[#8B92A9]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" /></div>
          ) : view === "list" ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold">
                  <Plus className="w-4 h-4" /> New quotation
                </button>
                <button onClick={startUpload} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
                  <Upload className="w-4 h-4" /> Upload PDF
                </button>
                {lhCanEdit && (
                  <button onClick={openLetterhead} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]" title="Company letterhead used for every quotation">
                    <Stamp className="w-4 h-4" /> Letterhead
                  </button>
                )}
              </div>
              <div className="mb-3 text-[11px] text-[#8B92A9]">
                {lhSettings?.letterheadUrl ? "Quotations print on your company letterhead." : lhCanEdit ? "No letterhead set — quotations print with your logo and name. Add one with Letterhead." : ""}
              </div>
              {err && <div className="mb-2 text-[12px] text-[#DC2626]">{err}</div>}
              {items.length === 0 && (
                <div className="text-center py-8 text-[12px] text-[#8B92A9]">
                  No quotations for this lead yet. Build one with the item form, or upload a PDF you already have.
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
                      <div className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{q.source === "uploaded" && !q.grandTotal ? "—" : money(q.grandTotal, q.currency)}</div>
                      {q.recurringSubtotal > 0 && <div className="text-[10px] text-[#8B92A9]">+ {money(q.recurringSubtotal, q.currency)} recurring</div>}
                    </div>
                    <div className="flex gap-1">
                      <button title={q.source === "uploaded" ? "Open file" : "Print / save as PDF"} onClick={() => printQuotation(q, null, { settings: lhSettings })} className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]">
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
          ) : view === "letterhead" ? (
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5">
              <div>
                <div className="w-[180px] aspect-[210/297] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white overflow-hidden relative">
                  {lhSettings?.letterheadUrl ? (
                    <>
                      <img src={lhSettings.letterheadUrl} alt="Current letterhead" className="absolute inset-0 w-full h-full object-fill" />
                      {lhDraft && (
                        <div className="absolute border-2 border-dashed border-[#2563EB] bg-[#2563EB]/10"
                             style={{ top: `${(lhDraft.marginTopMm / 297) * 100}%`, bottom: `${(lhDraft.marginBottomMm / 297) * 100}%`,
                                      left: `${(lhDraft.marginSideMm / 210) * 100}%`, right: `${(lhDraft.marginSideMm / 210) * 100}%` }}
                             title="Quotation text goes inside this area" />
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-center p-3 text-[11px] text-[#8B92A9]">No letterhead yet</div>
                  )}
                </div>
                {lhSettings?.letterheadUrl && <p className="mt-1.5 text-[10px] text-[#8B92A9]">Blue box = where the quotation text goes.</p>}
              </div>
              <div className="space-y-4">
                <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[#C9D4EE] dark:border-[#2A3550] bg-[#F8FAFF] dark:bg-[#141A2A] cursor-pointer hover:border-[#2563EB] text-[12px] font-semibold text-[#2563EB] ${lhBusy ? "opacity-60 pointer-events-none" : ""}`}>
                  {lhBusy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {lhSettings?.letterheadUrl ? "Replace letterhead image" : "Upload letterhead image"}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden"
                         onChange={(e) => { uploadLetterhead(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                <p className="text-[11px] text-[#8B92A9] -mt-2">A full A4 page image (PNG or JPG, up to 5 MB) with your header and footer on it. If your letterhead is a PDF or Word file, export it as an image first.</p>
                {lhDraft && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[["marginTopMm", "Top space (mm)", 0, 150], ["marginBottomMm", "Bottom space (mm)", 0, 150], ["marginSideMm", "Side space (mm)", 5, 60]].map(([k, label, min, max]) => (
                        <div key={k}><label className={lbl}>{label}</label>
                          <input type="number" min={min} max={max} className={inp} value={lhDraft[k]}
                                 onChange={(e) => setLhDraft((d) => ({ ...d, [k]: Math.min(max, Math.max(min, Number(e.target.value) || 0)) }))} />
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-[12px] text-[#0F1117] dark:text-[#F0F2FA]">
                      <input type="checkbox" checked={lhDraft.hideBuiltInHeader} onChange={(e) => setLhDraft((d) => ({ ...d, hideBuiltInHeader: e.target.checked }))} />
                      Hide our logo and company name (the letterhead already has them)
                    </label>
                  </>
                )}
                {lhSettings?.updatedByName && <p className="text-[11px] text-[#8B92A9]">Last changed by {lhSettings.updatedByName}{lhSettings.updatedAt ? ` on ${fmtDate(lhSettings.updatedAt)}` : ""}.</p>}
              </div>
            </div>
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
                <div className="sm:col-span-2"><label className={lbl}>Subject</label><input className={inp} value={upForm.title} onChange={(e) => setUpForm((f) => ({ ...f, title: e.target.value }))} placeholder="Website redesign and SEO" /></div>
                <div><label className={lbl}>Quotation total (₹, for reports)</label><input type="number" min="0" className={inp} value={upForm.amount} onChange={(e) => setUpForm((f) => ({ ...f, amount: e.target.value }))} placeholder="47790" /></div>
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
              {/* Client */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Client name *</label><input className={inp} value={form.clientName} onChange={(e) => set("clientName", e.target.value)} /></div>
                <div><label className={lbl}>Client company</label><input className={inp} value={form.clientCompany} onChange={(e) => set("clientCompany", e.target.value)} /></div>
                <div><label className={lbl}>Phone</label><input className={inp} value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="+91 98765 43210" /></div>
                <div><label className={lbl}>Email</label><input className={inp} value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="client@company.com" /></div>
                <div><label className={lbl}>GSTIN</label><input className={inp} value={form.clientGSTIN} onChange={(e) => set("clientGSTIN", e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" /></div>
                <div><label className={lbl}>Address</label><input className={inp} value={form.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={lbl}>Subject</label><input className={inp} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Website redesign and SEO" /></div>
              </div>

              {/* Items */}
              <div>
                <label className={lbl}>Items</label>
                <div className="space-y-2">
                  {form.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className={`${inp} col-span-12 sm:col-span-5`} value={li.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description" />
                      <select className={`${inp} col-span-4 sm:col-span-2`} value={li.billing} onChange={(e) => setItem(i, "billing", e.target.value)}>
                        {BILLING.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                      <input type="number" min="0" className={`${inp} col-span-3 sm:col-span-1 text-right`} value={li.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} title="Quantity" />
                      <input type="number" min="0" className={`${inp} col-span-5 sm:col-span-2 text-right`} value={li.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} title="Unit price" />
                      <div className="col-span-10 sm:col-span-1 text-right text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">
                        {money(r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)), form.currency).replace(/\.00$/, "")}
                      </div>
                      <button className="col-span-2 sm:col-span-1 flex justify-center p-1.5 rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A] disabled:opacity-30"
                              onClick={() => set("lineItems", form.lineItems.filter((_, j) => j !== i))} disabled={form.lineItems.length === 1} title="Remove item">
                        <Trash2 className="w-4 h-4 text-[#DC2626]" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => set("lineItems", [...form.lineItems, emptyItem()])} className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
              </div>

              {/* Discount / GST / totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Discount</label>
                      <select className={inp} value={form.discountType} onChange={(e) => set("discountType", e.target.value)}>
                        <option value="none">None</option><option value="percent">Percent (%)</option><option value="amount">Amount (₹)</option>
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
                  <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">One-time subtotal</span><span>{money(totals.oneTime)}</span></div>
                  {totals.disc > 0 && <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">Discount</span><span className="text-[#DC2626]">− {money(totals.disc)}</span></div>}
                  {Number(form.gstPercent) > 0 && <div className="flex justify-between"><span className="text-[#4B5168] dark:text-[#9DA3BB]">GST ({form.gstPercent}%)</span><span>{money(totals.gst)}</span></div>}
                  <div className="flex justify-between pt-1.5 border-t border-[#E4E7EF] dark:border-[#262A38] font-bold text-[15px] text-[#0F1117] dark:text-[#F0F2FA]"><span>Total</span><span>{money(totals.grand)}</span></div>
                  {totals.recurring > 0 && <div className="flex justify-between text-[11px] text-[#8B92A9]"><span>Recurring (not in total)</span><span>{money(totals.recurring)}</span></div>}
                </div>
              </div>

              <div><label className={lbl}>Terms and notes (printed on the quotation)</label>
                <textarea rows={3} className={inp} value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder="50% advance, balance on delivery. Valid for 15 days." />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "letterhead" && !loading && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
            {err && <span className="text-[12px] text-[#DC2626] w-full">{err}</span>}
            {lhSettings?.letterheadUrl && (
              <button onClick={() => { if (window.confirm("Remove the letterhead? Quotations will print with your logo and name again.")) saveLetterhead({ removeLetterhead: true }); }}
                      disabled={!!lhBusy} className="px-3 py-2 rounded-xl text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A] disabled:opacity-60">
                Remove letterhead
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button onClick={previewLetterhead} disabled={!lhSettings?.letterheadUrl || !!lhBusy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60" title="Sample quotation on your letterhead">
                <Eye className="w-4 h-4" /> Preview
              </button>
              <button onClick={() => saveLetterhead()} disabled={!!lhBusy} className="px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60">
                {lhBusy === "save" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
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
              <button onClick={previewDraft} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60" title="See the finished quotation before saving">
                <Eye className="w-4 h-4" /> Preview
              </button>
              <button onClick={() => save(false)} disabled={saving} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => save(true)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60">
                <Printer className="w-4 h-4" /> Save and print
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  , document.body);
}
