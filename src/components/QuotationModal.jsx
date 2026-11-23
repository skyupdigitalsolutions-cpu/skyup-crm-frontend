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
import { X, Plus, Trash2, Printer, Pencil, FileText, Loader2, ArrowLeft, Upload, ExternalLink } from "lucide-react";

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
function printQuotation(q, win = null) {
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

  const rows = (q.lineItems || []).map((li, i) => `
    <tr><td>${i + 1}</td><td>${esc(li.description)}</td><td>${esc(billingLabel(li.billing))}</td>
    <td class="n">${esc(li.quantity)}</td><td class="n">${esc(money(li.unitPrice, cur))}</td><td class="n">${esc(money(li.lineTotal, cur))}</td></tr>`).join("");

  const client = [q.clientCompany, q.clientAddress, q.clientGSTIN && `GSTIN: ${q.clientGSTIN}`, q.clientPhone, q.clientEmail]
    .filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(q.number)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .top img { max-height: 54px; max-width: 200px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
  .muted { color: #555; }
  .grid { display: flex; justify-content: space-between; gap: 24px; margin: 18px 0; }
  .label { font-size: 11px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f2f2f2; text-align: left; font-size: 11px; text-transform: uppercase; }
  th, td { border: 1px solid #ddd; padding: 7px 8px; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 300px; margin-top: 12px; }
  .totals td { border: none; padding: 4px 0; }
  .grand td { border-top: 2px solid #111; font-weight: bold; font-size: 15px; padding-top: 8px; }
  .note { margin-top: 22px; white-space: pre-wrap; }
</style></head><body>
  <div class="top">
    <div>${logo ? `<img src="${esc(logo)}" alt="">` : ""}${companyName ? `<div style="font-weight:bold;font-size:16px;margin-top:6px">${esc(companyName)}</div>` : ""}</div>
    <div style="text-align:right"><h1>QUOTATION</h1>
      <div><b>${esc(q.number)}</b></div><div class="muted">Date: ${esc(fmtDate(q.createdAt))}</div>
      ${q.handledBy ? `<div class="muted">Prepared by: ${esc(q.handledBy)}</div>` : ""}</div>
  </div>
  <div class="grid">
    <div><div class="label">Quotation for</div><div style="font-weight:bold;font-size:15px">${esc(q.clientName || "—")}</div>${client}</div>
    ${q.title ? `<div style="text-align:right"><div class="label">Subject</div><div>${esc(q.title)}</div></div>` : ""}
  </div>
  <table><thead><tr><th>#</th><th>Description</th><th>Billing</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6" class="muted">No items</td></tr>`}</tbody></table>
  <table class="totals">
    <tr><td>One-time subtotal</td><td class="n">${esc(money(q.oneTimeSubtotal, cur))}</td></tr>
    ${q.discountAmount ? `<tr><td>Discount${q.discountType === "percent" ? ` (${esc(q.discountValue)}%)` : ""}</td><td class="n">− ${esc(money(q.discountAmount, cur))}</td></tr>` : ""}
    ${q.gstPercent ? `<tr><td>GST (${esc(q.gstPercent)}%)</td><td class="n">${esc(money(q.gstAmount, cur))}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td class="n">${esc(money(q.grandTotal, cur))}</td></tr>
    ${q.recurringSubtotal ? `<tr><td class="muted">Recurring charges</td><td class="n muted">${esc(money(q.recurringSubtotal, cur))} per period</td></tr>` : ""}
  </table>
  ${q.remark ? `<div class="note"><div class="label">Terms and notes</div>${esc(q.remark)}</div>` : ""}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
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
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = useMemo(() => computeTotals(form), [form]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, lineItems: f.lineItems.map((li, j) => (j === i ? { ...li, [k]: v } : li)) }));

  const startNew  = () => { setForm(blankForm(lead, isSuperAdmin)); setEditId(null); setErr(""); setView("edit"); };
  const startEdit = (q) => { setForm(formFrom(q)); setEditId(q._id); setErr(""); setView("edit"); };

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
      if (andPrint && q) printQuotation(q, printWin);
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
              {view === "list" ? "Quotations" : view === "upload" ? "Upload quotation" : editId ? "Edit quotation" : "New quotation"}
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
                      <button title={q.source === "uploaded" ? "Open file" : "Print / save as PDF"} onClick={() => printQuotation(q)} className="p-1.5 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#1E2130]">
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
