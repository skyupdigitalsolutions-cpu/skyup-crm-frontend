// components/quotation/QuotationSettingsPanel.jsx
// Admin-only: how this company's quotations look and what they start with.
//   Look              — title, layout style, colour, font, letterhead, signature / stamp
//   Columns & sections — show / hide / rename columns; show / hide / rename / reorder sections
//   Defaults          — number prefix, currency, GST %, validity, default terms / payment terms / service info
//   Saved services    — services with prices to pick from in the quotation form
import { useState } from "react";
import { Upload, Loader2, Eye, ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  SECTION_DEFS, COLUMN_DEFS, FONTS, LAYOUTS, BILLING, resolveTemplate, printQuotation, sampleQuotation, fmtDate,
  SKYUP_SERVICE_LIBRARY,
} from "./quotationTemplate";

const TABS = [
  ["company", "Company & bank"],
  ["look", "Look"],
  ["layout", "Columns & sections"],
  ["defaults", "Defaults"],
  ["catalog", "Saved services"],
];

const inp = "w-full px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]";
const lbl = "block text-[11px] font-semibold text-[#8B92A9] mb-1";
const btn = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-60";
const btnPrimary = "px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4fd8] text-white text-[12px] font-semibold disabled:opacity-60";
const sub = "text-[11px] text-[#8B92A9]";

// Everything editable, from the server's settings (fills defaults for old records).
function draftFrom(st = {}) {
  const t = resolveTemplate(st);
  return {
    documentTitle: st.documentTitle || "Quotation",
    layoutStyle: t.layout, accentColor: t.accent, fontFamily: FONTS[st.fontFamily] ? st.fontFamily : "arial",
    marginTopMm: st.marginTopMm ?? 40, marginBottomMm: st.marginBottomMm ?? 25, marginSideMm: st.marginSideMm ?? 15,
    hideBuiltInHeader: st.hideBuiltInHeader ?? true,
    signatoryName: st.signatoryName || "", signatoryTitle: st.signatoryTitle || "",
    columns: Object.fromEntries(t.columns.map((c) => [c.key, { show: c.show, label: c.label === c.defaultLabel ? "" : c.label }])),
    sections: t.sections.map((s) => ({ key: s.key, show: s.show, label: s.label === s.defaultLabel ? "" : s.label })),
    numberPrefix: st.numberPrefix || "SKY", currency: st.currency || "INR",
    defaultGstPercent: st.defaultGstPercent ?? 18, validityDays: st.validityDays ?? 15,
    defaultTerms: st.defaultTerms || "", defaultPaymentTerms: st.defaultPaymentTerms || "", defaultServiceInfo: st.defaultServiceInfo || "",
    catalog: (st.catalog || []).map((c) => ({ name: c.name, details: c.details || "", unitPrice: c.unitPrice || 0, billing: c.billing || "one_time", module: c.module || "", category: c.category || "", note: c.note || "" })),
    companyName: st.companyName || "", companyAddress: st.companyAddress || "", companyGstin: st.companyGstin || "",
    companyPhone: st.companyPhone || "", companyEmail: st.companyEmail || "", companyWebsite: st.companyWebsite || "",
    defaultAboutUs: st.defaultAboutUs || "", bankDetails: st.bankDetails || "", qrCaption: st.qrCaption || "",
    showFooterBar: st.showFooterBar ?? true, numberedHeadings: !!st.numberedHeadings, clientSignature: st.clientSignature ?? true,
    showGstSuffix: !!st.showGstSuffix, coverPageDefault: !!st.coverPageDefault,
  };
}

export default function QuotationSettingsPanel({ api, settings, onSaved, onClose, toast }) {
  const [tab, setTab]     = useState("company");
  const [d, setD]         = useState(() => draftFrom(settings));
  const [busy, setBusy]   = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [err, setErr]     = useState("");
  const [images, setImages] = useState({ letterheadUrl: settings?.letterheadUrl || "", stampUrl: settings?.stampUrl || "", qrUrl: settings?.qrUrl || "" });
  const imagesFrom = (st) => ({ letterheadUrl: st.letterheadUrl || "", stampUrl: st.stampUrl || "", qrUrl: st.qrUrl || "" });

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const merged = { ...(settings || {}), ...d, ...images };   // what the preview shows

  const upload = async (kind, file) => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return setErr("Upload a PNG, JPG or WEBP image. Export a PDF or Word letterhead as an image first.");
    if (file.size > 5 * 1024 * 1024) return setErr("The image is larger than 5 MB.");
    setBusy(kind); setErr("");
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.post(`/quotations/settings/image/${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      setImages(imagesFrom(r.data.settings));
      onSaved?.(r.data.settings, { keepOpen: true });
      const sz = r.data.size;
      if (kind === "letterhead" && sz?.width && sz?.height && Math.abs(sz.height / sz.width - 297 / 210) > 0.08) {
        toast?.("Letterhead uploaded. It isn't A4-shaped, so it will be stretched to fit — check the preview.", "error");
      } else toast?.({ stamp: "Signature / stamp uploaded", qr: "Payment QR uploaded" }[kind] || "Letterhead uploaded");
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't upload the image."); }
    finally { setBusy(""); }
  };

  const removeImage = async (kind) => {
    const ask = { stamp: "Remove the signature / stamp image?", qr: "Remove the payment QR?" }[kind] || "Remove the letterhead? Quotations will print with your logo and name again.";
    if (!window.confirm(ask)) return;
    setBusy(`rm-${kind}`); setErr("");
    try {
      const r = await api.put("/quotations/settings", { stamp: { removeStamp: true }, qr: { removeQr: true } }[kind] || { removeLetterhead: true });
      setImages(imagesFrom(r.data.settings));
      onSaved?.(r.data.settings, { keepOpen: true });
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't remove the image."); }
    finally { setBusy(""); }
  };

  const save = async () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(d.accentColor)) return setErr("Pick a valid colour.");
    if (!String(d.numberPrefix).replace(/[^A-Za-z0-9-]/g, "")) return setErr("Enter a number prefix (letters, numbers or -).");
    setBusy("save"); setErr("");
    try {
      const body = { ...d, catalog: d.catalog.filter((c) => String(c.name).trim()) };
      const r = await api.put("/quotations/settings", body);
      toast?.("Quotation settings saved");
      onSaved?.(r.data.settings);
    } catch (e) { setErr(e?.response?.data?.message || "Couldn't save the settings."); }
    finally { setBusy(""); }
  };

  const moveSection = (i, dir) => setD((x) => {
    const list = [...x.sections]; const j = i + dir;
    if (j < 0 || j >= list.length) return x;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...x, sections: list };
  });
  const setSection = (i, patch) => setD((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setColumn = (k, patch) => setD((x) => ({ ...x, columns: { ...x.columns, [k]: { ...x.columns[k], ...patch } } }));
  const setCat = (i, patch) => setD((x) => ({ ...x, catalog: x.catalog.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${tab === k ? "bg-[#2563EB] text-white" : "bg-[#F0F2FA] dark:bg-[#1E2130] text-[#4B5168] dark:text-[#9DA3BB]"}`}>{label}</button>
          ))}
        </div>

        {tab === "company" && (
          <div className="space-y-3">
            <p className={sub}>Printed in the header, footer bar and bank block of every quotation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Company name</label><input className={inp} value={d.companyName} maxLength={120} onChange={(e) => set("companyName", e.target.value)} placeholder="Skyup Digital Solutions LLP" /></div>
              <div><label className={lbl}>GSTIN</label><input className={inp} value={d.companyGstin} maxLength={20} onChange={(e) => set("companyGstin", e.target.value.toUpperCase())} placeholder="29AFUFS6710E1ZJ" /></div>
              <div className="sm:col-span-2"><label className={lbl}>Office address</label>
                <textarea rows={2} className={inp} value={d.companyAddress} maxLength={400} onChange={(e) => set("companyAddress", e.target.value)} placeholder={"No 23, 2nd Floor, E Block, 14A Main Road,\nSahakaranagar, Bengaluru 560092"} /></div>
              <div><label className={lbl}>Phone</label><input className={inp} value={d.companyPhone} maxLength={40} onChange={(e) => set("companyPhone", e.target.value)} placeholder="+91 88678 67775" /></div>
              <div><label className={lbl}>Email</label><input className={inp} value={d.companyEmail} maxLength={120} onChange={(e) => set("companyEmail", e.target.value)} placeholder="contact@yourcompany.com" /></div>
              <div className="sm:col-span-2"><label className={lbl}>Website</label><input className={inp} value={d.companyWebsite} maxLength={120} onChange={(e) => set("companyWebsite", e.target.value)} placeholder="yourcompany.com" /></div>
            </div>
            <div><label className={lbl}>About us (fills every new quotation)</label>
              <textarea rows={3} className={inp} value={d.defaultAboutUs} maxLength={5000} onChange={(e) => set("defaultAboutUs", e.target.value)} placeholder="We are a Bengaluru-based full-service digital marketing agency…" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4">
              <div><label className={lbl}>Bank details</label>
                <textarea rows={5} className={inp} value={d.bankDetails} maxLength={1000} onChange={(e) => set("bankDetails", e.target.value)}
                          placeholder={"**Account Name:** Your Company LLP\n**Bank Name:** Kotak Mahindra Bank\n**Account Number:** 1234567890\n**IFSC Code:** KKBK0000000\n**Branch:** Sahakara Nagar"} />
                <p className={`${sub} mt-1`}>Wrap words in **double stars** to make them bold.</p></div>
              <div>
                <label className={lbl}>Payment QR</label>
                <div className="w-[150px] h-[150px] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white flex items-center justify-center overflow-hidden mb-2">
                  {images.qrUrl ? <img src={images.qrUrl} alt="Payment QR" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-[#8B92A9] text-center px-2">UPI / PhonePe QR image</span>}
                </div>
                <div className="flex gap-1.5">
                  <label className={`${btn} !px-2 cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                    {busy === "qr" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{images.qrUrl ? "Replace" : "Upload"}
                    <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload("qr", e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {images.qrUrl && <button className={`${btn} !px-2 text-[#DC2626]`} disabled={!!busy} onClick={() => removeImage("qr")}>Remove</button>}
                </div>
                <input className={`${inp} mt-2 text-[12px]`} value={d.qrCaption} maxLength={80} onChange={(e) => set("qrCaption", e.target.value)} placeholder="Scan using any UPI app" />
              </div>
            </div>
          </div>
        )}

        {tab === "look" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Document title</label>
                <input className={inp} value={d.documentTitle} maxLength={40} onChange={(e) => set("documentTitle", e.target.value)} placeholder="Quotation, Proposal, Estimate…" /></div>
              <div><label className={lbl}>Layout style</label>
                <select className={inp} value={d.layoutStyle} onChange={(e) => set("layoutStyle", e.target.value)}>
                  {Object.entries(LAYOUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className={lbl}>Accent colour</label>
                <div className="flex gap-2">
                  <input type="color" value={d.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-[34px] w-12 rounded border border-[#E4E7EF] dark:border-[#262A38] bg-transparent" />
                  <input className={inp} value={d.accentColor} maxLength={7} onChange={(e) => set("accentColor", e.target.value)} />
                </div></div>
              <div><label className={lbl}>Font</label>
                <select className={inp} value={d.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
                  {Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {[["showFooterBar", "Footer bar with phone · website · email on every page"],
                ["numberedHeadings", "Number the section headings (01, 02, 03…)"],
                ["clientSignature", "Client sign-off block (For <client> — Authorised signatory)"],
                ["showGstSuffix", "Show \"+ GST\" after item prices"],
                ["coverPageDefault", "New quotations start with a cover page"]].map(([k, label]) => (
                <label key={k} className="flex items-start gap-2 text-[12px] text-[#0F1117] dark:text-[#F0F2FA]">
                  <input type="checkbox" className="mt-0.5" checked={!!d[k]} onChange={(e) => set(k, e.target.checked)} />{label}
                </label>
              ))}
            </div>

            {/* letterhead */}
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3">
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Letterhead</div>
              <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-4">
                <div className="w-[130px] aspect-[210/297] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white overflow-hidden relative">
                  {images.letterheadUrl ? (
                    <>
                      <img src={images.letterheadUrl} alt="Letterhead" className="absolute inset-0 w-full h-full object-fill" />
                      <div className="absolute border-2 border-dashed border-[#2563EB] bg-[#2563EB]/10" title="The quotation text goes inside this area"
                           style={{ top: `${(d.marginTopMm / 297) * 100}%`, bottom: `${(d.marginBottomMm / 297) * 100}%`, left: `${(d.marginSideMm / 210) * 100}%`, right: `${(d.marginSideMm / 210) * 100}%` }} />
                    </>
                  ) : <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] text-[#8B92A9]">No letterhead</div>}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <label className={`${btn} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                      {busy === "letterhead" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {images.letterheadUrl ? "Replace letterhead" : "Upload letterhead"}
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload("letterhead", e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    {images.letterheadUrl && <button className={`${btn} text-[#DC2626]`} disabled={!!busy} onClick={() => removeImage("letterhead")}>Remove</button>}
                  </div>
                  <p className={sub}>A full A4 page image (PNG/JPG, up to 5 MB). Printed behind every page. Blue box = where the text goes.</p>
                  {images.letterheadUrl && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {[["marginTopMm", "Top (mm)", 0, 150], ["marginBottomMm", "Bottom (mm)", 0, 150], ["marginSideMm", "Sides (mm)", 5, 60]].map(([k, l, min, max]) => (
                          <div key={k}><label className={lbl}>{l}</label>
                            <input type="number" min={min} max={max} className={inp} value={d[k]} onChange={(e) => set(k, Math.min(max, Math.max(min, Number(e.target.value) || 0)))} /></div>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-[12px] text-[#0F1117] dark:text-[#F0F2FA]">
                        <input type="checkbox" checked={d.hideBuiltInHeader} onChange={(e) => set("hideBuiltInHeader", e.target.checked)} />
                        Hide our logo and company name (the letterhead has them)
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* signature / stamp */}
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-3">
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Signature and stamp</div>
              <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-4">
                <div className="w-[130px] h-[80px] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white flex items-center justify-center overflow-hidden">
                  {images.stampUrl ? <img src={images.stampUrl} alt="Signature / stamp" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-[#8B92A9]">No image</span>}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <label className={`${btn} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                      {busy === "stamp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {images.stampUrl ? "Replace image" : "Upload signature / stamp"}
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload("stamp", e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    {images.stampUrl && <button className={`${btn} text-[#DC2626]`} disabled={!!busy} onClick={() => removeImage("stamp")}>Remove</button>}
                  </div>
                  <p className={sub}>A PNG with a transparent background looks best.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Signatory name</label><input className={inp} value={d.signatoryName} maxLength={80} onChange={(e) => set("signatoryName", e.target.value)} placeholder="Authorised signatory" /></div>
                    <div><label className={lbl}>Designation</label><input className={inp} value={d.signatoryTitle} maxLength={80} onChange={(e) => set("signatoryTitle", e.target.value)} placeholder="Director" /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "layout" && (
          <div className="space-y-5">
            <div>
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Item table columns</div>
              <p className={`${sub} mb-2`}>Untick to hide. Type a new name to rename. Description and Amount are always shown.</p>
              <div className="space-y-1.5">
                {COLUMN_DEFS.map((c) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <input type="checkbox" disabled={c.fixed} checked={c.fixed || d.columns[c.key]?.show !== false} onChange={(e) => setColumn(c.key, { show: e.target.checked })} />
                    <span className="w-24 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{c.label}</span>
                    <input className={inp} value={d.columns[c.key]?.label || ""} maxLength={40} placeholder={c.label} onChange={(e) => setColumn(c.key, { label: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Sections</div>
              <p className={`${sub} mb-2`}>Order, show or hide, and rename. Sections with no content are skipped automatically on each quotation.</p>
              <div className="space-y-1.5">
                {d.sections.map((s, i) => {
                  const def = SECTION_DEFS.find((x) => x.key === s.key);
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button className="p-0.5 disabled:opacity-30" disabled={i === 0} onClick={() => moveSection(i, -1)} title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button className="p-0.5 disabled:opacity-30" disabled={i === d.sections.length - 1} onClick={() => moveSection(i, 1)} title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <input type="checkbox" disabled={def?.fixed} checked={def?.fixed || s.show} onChange={(e) => setSection(i, { show: e.target.checked })} title={def?.fixed ? "Always shown" : "Show on quotations"} />
                      <span className={`w-36 text-[12px] ${s.show || def?.fixed ? "text-[#4B5168] dark:text-[#9DA3BB]" : "text-[#B5BAC9] line-through"}`}>{def?.label}</span>
                      {["customBlocks", "customTables", "totals", "signature"].includes(s.key)
                        ? <span className={sub}>{s.key === "customBlocks" || s.key === "customTables" ? "Each one uses its own title" : "No heading"}</span>
                        : <input className={inp} value={s.label} maxLength={60} placeholder={def?.label} onChange={(e) => setSection(i, { label: e.target.value })} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "defaults" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={lbl}>Number prefix</label>
                <input className={inp} value={d.numberPrefix} maxLength={12} onChange={(e) => set("numberPrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} /></div>
              <div><label className={lbl}>Currency</label>
                <select className={inp} value={d.currency} onChange={(e) => set("currency", e.target.value)}>
                  {["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "SAR", "QAR"].map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div><label className={lbl}>Default GST %</label>
                <select className={inp} value={d.defaultGstPercent} onChange={(e) => set("defaultGstPercent", Number(e.target.value))}>
                  {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
                </select></div>
              <div><label className={lbl}>Valid for (days)</label>
                <input type="number" min={0} max={365} className={inp} value={d.validityDays} onChange={(e) => set("validityDays", Math.min(365, Math.max(0, Number(e.target.value) || 0)))} /></div>
            </div>
            <p className={sub}>Numbers look like {String(d.numberPrefix || "SKY")}/{new Date().getFullYear()}/0001 and restart each year. A new prefix applies to new quotations only. Valid for 0 days = no validity date.</p>
            <div><label className={lbl}>Default terms and conditions</label>
              <textarea rows={5} className={inp} value={d.defaultTerms} maxLength={10000} onChange={(e) => set("defaultTerms", e.target.value)} placeholder={"1. Prices are valid until the date shown.\n2. Changes after sign-off are quoted separately."} /></div>
            <div><label className={lbl}>Default payment terms</label>
              <textarea rows={3} className={inp} value={d.defaultPaymentTerms} maxLength={5000} onChange={(e) => set("defaultPaymentTerms", e.target.value)} placeholder="50% advance, balance on delivery. Bank transfer or UPI." /></div>
            <div><label className={lbl}>Default service information</label>
              <textarea rows={3} className={inp} value={d.defaultServiceInfo} maxLength={8000} onChange={(e) => set("defaultServiceInfo", e.target.value)} placeholder="Support hours, response times, what's included in maintenance…" /></div>
            <p className={sub}>These fill every new quotation; people can still change them on each one.</p>
          </div>
        )}

        {tab === "catalog" && (
          <div className="space-y-2">
            <p className={sub}>Services people add straight into a quotation with "Add services" — grouped by category, with price, billing and full deliverables.
              No price? The note (e.g. "Custom Pricing") prints instead of an amount; with a price, the note prints under it.</p>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => setD((x) => {
                const have = new Set(x.catalog.map((c) => c.name.trim().toLowerCase()));
                const extra = SKYUP_SERVICE_LIBRARY.filter((c) => !have.has(c.name.trim().toLowerCase())).map((c) => ({ ...c }));
                toast?.(extra.length ? `Added ${extra.length} standard packages — review and Save settings` : "All standard packages are already here");
                return { ...x, catalog: [...x.catalog, ...extra] };
              })}>
                <Plus className="w-4 h-4" /> Load Skyup standard packages ({SKYUP_SERVICE_LIBRARY.length})
              </button>
              <input className={`${inp} !w-56`} value={catFilter} onChange={(e) => setCatFilter(e.target.value)} placeholder="Filter by name or category" />
            </div>
            <datalist id="q-cats">{[...new Set(d.catalog.map((c) => c.category).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
            {d.catalog.length === 0 && <div className="text-center py-6 text-[12px] text-[#8B92A9]">No saved services yet.</div>}
            {d.catalog.map((c, i) => {
              const f = catFilter.trim().toLowerCase();
              if (f && !`${c.name} ${c.category}`.toLowerCase().includes(f)) return null;
              return (
                <div key={i} className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] p-2.5 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <input className={`${inp} col-span-12 sm:col-span-4`} value={c.category} list="q-cats" maxLength={60} placeholder="Category" onChange={(e) => setCat(i, { category: e.target.value })} />
                    <input className={`${inp} col-span-12 sm:col-span-7 font-semibold`} value={c.name} maxLength={300} placeholder="Service name" onChange={(e) => setCat(i, { name: e.target.value })} />
                    <button className="col-span-12 sm:col-span-1 flex justify-center items-center rounded-lg hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A]" title="Remove"
                            onClick={() => setD((x) => ({ ...x, catalog: x.catalog.filter((_, j) => j !== i) }))}><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <input type="number" min="0" className={`${inp} col-span-4 sm:col-span-2 text-right`} value={c.unitPrice} placeholder="Price" onChange={(e) => setCat(i, { unitPrice: Number(e.target.value) || 0 })} title="Price (0 = no fixed price)" />
                    <select className={`${inp} col-span-4 sm:col-span-2`} value={c.billing} onChange={(e) => setCat(i, { billing: e.target.value })}>
                      {BILLING.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                    <input className={`${inp} col-span-4 sm:col-span-3`} value={c.module} maxLength={80} placeholder="Module (optional)" onChange={(e) => setCat(i, { module: e.target.value })} />
                    <input className={`${inp} col-span-12 sm:col-span-5`} value={c.note} maxLength={120} placeholder='Price note, e.g. "(5 - 6 pages)" or "Custom Pricing"' onChange={(e) => setCat(i, { note: e.target.value })} />
                  </div>
                  <textarea rows={Math.min(8, Math.max(2, String(c.details || "").split("\n").length))} className={`${inp} text-[12px]`} value={c.details} maxLength={3000}
                            placeholder={"Key deliverables — one per line\n• bullets; a line ending in : is a heading"} onChange={(e) => setCat(i, { details: e.target.value })} />
                </div>
              );
            })}
            <button className={btn} onClick={() => setD((x) => ({ ...x, catalog: [...x.catalog, { name: "", details: "", unitPrice: 0, billing: "one_time", module: "", category: "", note: "" }] }))}>
              <Plus className="w-4 h-4" /> Add service
            </button>
          </div>
        )}

        {settings?.updatedByName && <p className={`${sub} mt-4`}>Last changed by {settings.updatedByName}{settings.updatedAt ? ` on ${fmtDate(settings.updatedAt)}` : ""}.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
        {err && <span className="text-[12px] text-[#DC2626] w-full">{err}</span>}
        <button className={btn} onClick={onClose} disabled={busy === "save"}>Cancel</button>
        <div className="flex gap-2 ml-auto">
          <button className={btn} onClick={() => printQuotation(sampleQuotation(merged), null, { preview: true, settings: merged })} title="A filled-in sample with these settings">
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button className={btnPrimary} onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </>
  );
}
