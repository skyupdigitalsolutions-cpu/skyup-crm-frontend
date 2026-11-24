// components/quotation/quotationTemplate.js
// Everything about how a quotation LOOKS, driven by the company's quotation
// settings (GET /api/quotations/settings): company header and footer bar,
// cover page, title, layout style, colour, font, which columns and sections
// show (in what order, under what heading, optionally numbered "01 …"),
// letterhead, bank details + payment QR, signature / stamp, client sign-off.
import { getBrand, getUser } from "../../data/sessionStore";

// ── Defaults ────────────────────────────────────────────────────────────────
export const SECTION_DEFS = [
  { key: "client",          label: "Quotation for" },
  { key: "subject",         label: "Subject" },
  { key: "introduction",    label: "Project overview" },
  { key: "aboutUs",         label: "About us" },
  { key: "highlights",      label: "Highlights" },
  { key: "scope",           label: "Scope of work" },
  { key: "items",           label: "Quotation", fixed: true },
  { key: "totals",          label: "Totals", fixed: true },
  { key: "optionalItems",   label: "Optional add-ons" },
  { key: "customTables",    label: "Tables" },
  { key: "paymentSchedule", label: "Payment milestones" },
  { key: "timeline",        label: "Timeline" },
  { key: "serviceInfo",     label: "Service information" },
  { key: "suggestions",     label: "Our suggestions" },
  { key: "customBlocks",    label: "Additional information" },
  { key: "paymentTerms",    label: "Payment terms" },
  { key: "terms",           label: "Terms and conditions" },
  { key: "bankDetails",     label: "Bank details" },
  { key: "notes",           label: "Notes" },
  { key: "signature",       label: "Signature" },
];

export const COLUMN_DEFS = [
  { key: "index",       label: "Sl.No" },
  { key: "description", label: "Service", fixed: true },
  { key: "billing",     label: "Billing" },
  { key: "qty",         label: "Qty" },
  { key: "unitPrice",   label: "Unit price" },
  { key: "amount",      label: "Charges", fixed: true },
];

export const FONTS = {
  arial:     { label: "Arial",            css: "Arial, Helvetica, sans-serif" },
  helvetica: { label: "Helvetica",        css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  segoe:     { label: "Segoe UI",         css: "'Segoe UI', Roboto, Arial, sans-serif" },
  verdana:   { label: "Verdana",          css: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet",        css: "'Trebuchet MS', Arial, sans-serif" },
  georgia:   { label: "Georgia (serif)",  css: "Georgia, 'Times New Roman', serif" },
  times:     { label: "Times New Roman",  css: "'Times New Roman', Times, serif" },
};

export const LAYOUTS = {
  classic: "Classic — black rules, grey table header",
  modern:  "Modern — coloured headings and table header",
  minimal: "Minimal — light lines, lots of white space",
};

export const BILLING = [
  { value: "one_time",    label: "One-time",    short: "",           period: "" },
  { value: "monthly",     label: "Monthly",     short: "/month",     period: "Monthly" },
  { value: "quarterly",   label: "Quarterly",   short: "/quarter",   period: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly", short: "/half-year", period: "Half-yearly" },
  { value: "yearly",      label: "Yearly",      short: "/year",      period: "Yearly" },
];

// Ready-made shapes for the "Tables" section (from real Skyup quotations).
export const TABLE_PRESETS = [
  { name: "Payment terms (two columns)", title: "Payment terms", columns: ["Term", "Details"],
    rows: [["Payment terms", "50% advance, 50% on delivery"], ["Ad budget", "Paid directly to Meta / Google by client"], ["GST", "Extra as applicable"], ["Proposal validity", "30 days from date of issue"]] },
  { name: "Monthly running costs", title: "Monthly infrastructure & running costs", columns: ["Service", "Billing", "Cost (INR)"],
    rows: [["Backend server hosting", "Monthly", "₹3,000"], ["Database hosting", "Monthly", "₹2,000"], ["Domain name", "Yearly", "₹1,500"]],
    note: "Indicative starting rates; may vary with usage and traffic. Paid directly by the client." },
  { name: "Third-party / API charges", title: "Third-party & API charges — usage based", columns: ["Service / API", "Use case", "Indicative monthly cost"],
    rows: [["WhatsApp Business API", "Notifications and customer conversations", "₹2,000–₹25,000+"], ["SMS / OTP", "OTP and transactional alerts", "₹500–₹10,000+"]],
    note: "Usage charges are billed by the provider at actuals and are not included in the development price." },
  { name: "Third-party integration (MSG91, MongoDB, AWS)", title: "Third party integration", columns: ["Service", "Charges"],
    rows: [["MSG91", "Platform Fee: ₹500 / Month\nExtra – Service & Utility Messages: ₹0.25 / message\nExtra – Marketing Messages: ₹0.875 / message"],
           ["MongoDB", "Minimum ₹750 / Month\nIf usage exceeds, extra charged as per actual usage"],
           ["AWS Server / Deploy", "₹1,400 / Month\nExtra as Applicable"]],
    note: "Third-party charges are paid directly by the client." },
  { name: "Rate card (Basic / Standard / Premium)", title: "Additional content — rate card", columns: ["Format", "Basic", "Standard", "Premium"],
    rows: [["Instagram reel (up to 30 sec)", "₹500", "₹1,000", "₹1,500"], ["Promotional video (1–3 min)", "₹1,500", "₹3,000", "₹5,000"]] },
  { name: "Comparison (Feature / Option A / Option B)", title: "Plan comparison", columns: ["Feature", "Standard", "Advanced"],
    rows: [["Response latency", "Normal", "Low"], ["AI reasoning", "Standard", "Enhanced"], ["Best for", "Standard conversations", "Nuanced interactions"]] },
  { name: "App store / one-time fees", title: "App store & registration fees", columns: ["Platform", "Billing", "Fee (INR)"],
    rows: [["Google Play Store — Android", "One-time", "₹2,500"], ["Apple App Store — iOS", "Yearly", "₹10,000"]],
    note: "Paid directly by the client; not included in the development total." },
  { name: "Blank table", title: "", columns: ["Column 1", "Column 2"], rows: [["", ""]] },
];

// Skyup's standard service packages (from the Skyup Quotation app). Admins
// load them into "Saved services" with one click and edit from there.
export const SKYUP_SERVICE_LIBRARY = [
  {
    "category": "CRM Packages",
    "name": "CRM - Basic",
    "details": "Access Limits:\n• 1 Super Admin\n• 1 Admin\n• 5 Users\n• 5,000 Leads\n• 1 Meta Account\n• 1 Google Account\n• 1 Website\n\nFeatures:\n• Lead Management\n• Contacts Management\n• Projects\n• Reports\n• Attendance\n• Daily Report\n• AI Remark Summary\n• Website Tracking\n• Call Recording\n• Meta Ads Integration\n\nRestrictions:\n• SMS Blast ×\n• WhatsApp Blast ×\n• Email Blast ×",
    "unitPrice": 3499,
    "billing": "monthly",
    "module": "",
    "note": "Monthly: 3,499 (incl. GST)"
  },
  {
    "category": "CRM Packages",
    "name": "CRM - Pro",
    "details": "Access Limits:\n• 1 Super Admin\n• 3 Admins\n• 30 Users\n• 20,000 Leads\n• 3 Meta Accounts\n• 3 Google Accounts\n• 3 Websites\n• 6,000 AI Minutes/Month\n\nFeatures:\n• Lead Management\n• Contacts Management\n• Projects, Attendance\n• Reports, Daily Report\n• AI Remark Summary\n• Email Blast, WhatsApp Blast\n• SMS Blast\n• Campaign Management\n• Website Tracking\n• Call Recording\n• Call Transcription\n• Google Ads Integration\n• Meta Ads Integration\n• WhatsApp Automation",
    "unitPrice": 7499,
    "billing": "monthly",
    "module": "",
    "note": "Monthly: 7,499 (incl. GST)"
  },
  {
    "category": "CRM Packages",
    "name": "CRM - Advance Plan",
    "details": "Access Limits:\n• 1 Super Admin\n• 5 Admins\n• 50 Users\n• 50,000 Leads\n• 5 Meta Accounts\n• 5 Google Accounts\n• 5 Websites\n• 15,000 AI Minutes/Month\n\nFeatures:\n• Lead Management\n• Contacts Management\n• Reports\n• Attendance\n• Daily Report\n• AI Remark Summary\n• Email Blast\n• WhatsApp Blast\n• SMS Blast\n• Campaign Management\n• Website Tracking\n• Call Recording\n• Call Transcription\n• AI Call Summary\n• Google Ads Integration\n• Meta Ads Integration\n• WhatsApp Automation",
    "unitPrice": 15499,
    "billing": "monthly",
    "module": "",
    "note": "Monthly: 15,499 (incl. GST)"
  },
  {
    "category": "CRM Packages",
    "name": "CRM - Enterprise Plan",
    "details": "Fully customized as per your requirements",
    "unitPrice": 0,
    "billing": "one_time",
    "module": "",
    "note": "Custom Pricing"
  },
  {
    "category": "CRM Packages",
    "name": "CRM - Mobile",
    "details": "• Attendance\n• Calling\n• Notification\n• Meeting management",
    "unitPrice": 0,
    "billing": "one_time",
    "module": "",
    "note": "Applicable for all Plans"
  },
  {
    "category": "CRM Packages",
    "name": "SET-UP",
    "details": "Set-up cost as per the plan you choose",
    "unitPrice": 0,
    "billing": "one_time",
    "module": "",
    "note": "Set-up cost depends on chosen plan"
  },
  {
    "category": "AI Automation",
    "name": "AI Automation",
    "details": "• AI-powered lead scoring and routing\n• Automated customer responses via chat and email\n• Workflow automation for follow-ups and meetings\n• Smart campaign triggers based on customer behavior\n• AI-based analytics and recommendation engine",
    "unitPrice": 0,
    "billing": "one_time",
    "module": "",
    "note": "Pricing as per your requirements"
  },
  {
    "category": "AI Automation",
    "name": "WhatsApp Automation & AI Chatbot",
    "details": "WhatsApp Business Integration:\n• WhatsApp Business API setup\n• Send & receive messages\n• Bulk messaging templates configuration\n• Production-ready integration",
    "unitPrice": 0,
    "billing": "one_time",
    "module": "",
    "note": "Pricing as per your requirements"
  },
  {
    "category": "Digital Marketing",
    "name": "SEO & Organic Visibility",
    "details": "• Technical SEO + Core Web Vitals Fixes\n• On-Page Optimization\n• 4 SEO Blogs / Month\n• GBP Management\n• 6–10 Backlinks / Month\n• Monthly Keyword Ranking Report",
    "unitPrice": 20000,
    "billing": "monthly",
    "module": "",
    "note": ""
  },
  {
    "category": "Digital Marketing",
    "name": "Social Media & GBP Management",
    "details": "• 12 Designed Posts / Month\n• 4 Reel Scripts + Video Editing\n• Caption & Hashtag Strategy\n• Community Management\n• Monthly Analytics Report",
    "unitPrice": 15000,
    "billing": "monthly",
    "module": "",
    "note": ""
  },
  {
    "category": "Digital Marketing",
    "name": "Google Ads & Meta Ads Management",
    "details": "• Google Search & Display Campaigns\n• Facebook & Instagram Ads\n• Funnel-Based Ad Strategy\n• A/B Testing & Optimization\n• 8 Ad Creatives / Month\n• Monthly Performance Report",
    "unitPrice": 20000,
    "billing": "monthly",
    "module": "",
    "note": ""
  },
  {
    "category": "Digital Marketing",
    "name": "Website Design & Development",
    "details": "• Custom Corporate Website Design\n• Responsive UI/UX Design\n• Mobile-friendly development\n• CMS or e-commerce integration\n• Final pricing shared after discussion",
    "unitPrice": 35000,
    "billing": "one_time",
    "module": "",
    "note": "(5 - 6 pages)"
  }
];

// Subject lines by category (from the Skyup Quotation app).
export const SUBJECT_PRESETS = [
  "Proposal for CRM Setup & Lead Automation Services-reg",
  "Proposal for CRM Implementation & Customer Management Services-reg",
  "Proposal for AI-Based Business Automation Services-reg",
  "Proposal for AI Chatbot & WhatsApp Automation Services-reg",
  "Proposal for Digital Branding, Organic Marketing, SEO & AI-Based Customer Automation Services-reg",
  "Proposal for SEO & Organic Visibility Services-reg",
  "Proposal for Social Media, GBP & Meta/Google Ads Management Services-reg",
  "Proposal for Website Design & Development Services-reg",
];

// A saved service → a quotation item. No price → its note ("Custom Pricing")
// is printed in place of an amount; with a price, the note goes under it.
export function itemFromCatalog(c) {
  const price = Number(c.unitPrice) || 0;
  const note = String(c.note || "").trim();
  return {
    description: c.name, details: c.details || "", module: c.module || "", quantity: 1, unitPrice: price,
    billing: c.billing || "one_time",
    priceLabel: price > 0 ? "" : (note || "As per requirement"),
    chargeNote: price > 0 ? note : "",
  };
}

// Services grouped by category, in catalog order: [[category, [{...c, index}]]].
export function groupCatalog(catalog = []) {
  const groups = new Map();
  catalog.forEach((c, index) => {
    const k = String(c.category || "").trim() || "Other services";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ ...c, index });
  });
  return [...groups.entries()];
}

// ── helpers ────────────────────────────────────────────────────────────────
export const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const money = (n, cur = "INR") => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur || "INR", maximumFractionDigits: 2 }).format(n || 0); }
  catch { return `${cur} ${r2(n).toLocaleString("en-IN")}`; }
};
// Whole rupees print without ".00" (₹2,999 not ₹2,999.00) — like the samples.
export const moneyShort = (n, cur = "INR") => money(n, cur).replace(/\.00$/, "");
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const billingOf = (b) => BILLING.find((x) => x.value === b) || BILLING[0];
const lineTotalOf = (li) => li.lineTotal ?? r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0));

// Plain text → HTML. Lines starting with "-", "•" or "*" become bullet lists
// (two columns when long), "## Heading" lines become sub-headings, blank lines
// split paragraphs, "**bold**" is bold. Everything else is escaped.
export function richText(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  let html = "", list = [], para = [];
  const flushList = () => { if (list.length) { html += `<ul class="${list.length > 7 ? "cols" : ""}">${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`; list = []; } };
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (bullet) { flushPara(); list.push(bullet[1]); continue; }
    flushList();
    if (!line) { flushPara(); continue; }
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) { flushPara(); html += `<h4>${inline(h[1])}</h4>`; continue; }
    // "Access Limits:" / "Features:" on their own line → small bold heading
    if (/^[^.:]{2,40}:$/.test(line)) { flushPara(); html += `<div class="lbl">${inline(line)}</div>`; continue; }
    para.push(line);
  }
  flushList(); flushPara();
  return html;
}

// Settings (possibly partial / older) → a complete template.
export function resolveTemplate(settings = {}) {
  const st = settings || {};
  const saved = Array.isArray(st.sections) ? st.sections.filter((x) => SECTION_DEFS.some((d) => d.key === x.key)) : [];
  // Saved sections are rearranged among the slots they occupy in the default
  // order; sections never saved keep their default place.
  const savedKeys = [...new Set(saved.map((x) => x.key))];
  const defaultKeys = SECTION_DEFS.map((d) => d.key);
  const slots = defaultKeys.map((k, i) => (savedKeys.includes(k) ? i : -1)).filter((i) => i !== -1);
  const order = [...defaultKeys];
  slots.forEach((slot, n) => { order[slot] = savedKeys[n]; });
  const sections = order.map((key) => {
    const def = SECTION_DEFS.find((d) => d.key === key);
    const sv = saved.find((x) => x.key === key) || {};
    return { key, label: sv.label || def.label, defaultLabel: def.label, show: def.fixed ? true : sv.show !== false, fixed: !!def.fixed };
  });
  const columns = COLUMN_DEFS.map((d) => {
    const cv = st.columns?.[d.key] || {};
    return { key: d.key, label: cv.label || d.label, defaultLabel: d.label, show: d.fixed ? true : cv.show !== false, fixed: !!d.fixed };
  });
  const brand = getBrand() || {};
  const user = getUser() || {};
  return {
    title: st.documentTitle || "Quotation",
    layout: LAYOUTS[st.layoutStyle] ? st.layoutStyle : "classic",
    accent: /^#[0-9a-fA-F]{6}$/.test(st.accentColor || "") ? st.accentColor : "#1F3A8A",
    font: FONTS[st.fontFamily] ? FONTS[st.fontFamily].css : FONTS.arial.css,
    sections, columns,
    letterhead: st.letterheadUrl ? { url: st.letterheadUrl, top: Number(st.marginTopMm ?? 40), bottom: Number(st.marginBottomMm ?? 25), side: Number(st.marginSideMm ?? 15), hideHeader: st.hideBuiltInHeader ?? true } : null,
    stampUrl: st.stampUrl || "", signatoryName: st.signatoryName || "", signatoryTitle: st.signatoryTitle || "",
    company: {
      name: st.companyName || brand.name || user.company?.name || user.companyName || "",
      logo: brand.logoUrl || brand.headerLogoUrl || "",
      address: st.companyAddress || "", gstin: st.companyGstin || "",
      phone: st.companyPhone || "", email: st.companyEmail || "", website: st.companyWebsite || "",
    },
    bankDetails: st.bankDetails || "", qrUrl: st.qrUrl || "", qrCaption: st.qrCaption || "",
    showFooterBar: st.showFooterBar ?? true, numbered: !!st.numberedHeadings,
    clientSignature: st.clientSignature ?? true, gstSuffix: !!st.showGstSuffix,
  };
}

// Same maths as Quotation.recalc() on the backend, plus per-period recurring
// totals with GST ("Monthly subtotal / GST / Monthly total").
export function computeTotals(q) {
  // Same steps as Quotation.recalc() on the backend: round each figure to
  // paise first, so the printed lines always add up.
  let oneTime = 0;
  const periods = {};
  for (const li of q.lineItems || []) {
    if (!String(li.description || "").trim()) continue;
    const t = r2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0));
    if (li.billing && li.billing !== "one_time") periods[li.billing] = (periods[li.billing] || 0) + t; else oneTime += t;
  }
  oneTime = r2(oneTime);
  let disc = 0;
  if (q.discountType === "percent") disc = oneTime * (Number(q.discountValue) || 0) / 100;
  else if (q.discountType === "amount") disc = Number(q.discountValue) || 0;
  disc = r2(Math.min(Math.max(disc, 0), oneTime));
  const gstPct = Number(q.gstPercent) || 0;
  const taxable = r2(oneTime - disc);
  const gst = r2(taxable * gstPct / 100);
  const recurringByPeriod = BILLING.filter((b) => periods[b.value] > 0).map((b) => {
    const subtotal = r2(periods[b.value]);
    const g = r2(subtotal * gstPct / 100);
    return { billing: b.value, period: b.period, subtotal, gst: g, total: r2(subtotal + g) };
  });
  const recurring = r2(recurringByPeriod.reduce((a, p) => a + p.subtotal, 0));
  return { oneTime, recurring, disc, gst, grand: r2(taxable + gst), recurringByPeriod };
}

// Payment-row amount the backend will store: percent of grand total, else as typed.
export const scheduleAmount = (row, grand) => (Number(row.percent) > 0 ? r2(grand * Number(row.percent) / 100) : r2(row.amount));

// Module-wise payment breakdown: one row per module, its share of the grand
// total in proportion to its one-time items (percents add up to exactly 100).
export function buildModuleSchedule(lineItems = []) {
  const byModule = new Map();
  for (const li of lineItems) {
    if (!String(li.description || "").trim() || (li.billing && li.billing !== "one_time")) continue;
    const key = String(li.module || "").trim() || "Other items";
    byModule.set(key, (byModule.get(key) || 0) + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0));
  }
  const total = [...byModule.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  const rows = [...byModule.entries()].filter(([, v]) => v > 0).map(([label, v]) => ({ label, percent: Math.round((v / total) * 10000) / 100, amount: 0, due: "" }));
  const diff = Math.round((100 - rows.reduce((a, r) => a + r.percent, 0)) * 100) / 100;
  if (rows.length && diff) rows[rows.length - 1].percent = Math.round((rows[rows.length - 1].percent + diff) * 100) / 100;
  return rows;
}

// ── HTML ───────────────────────────────────────────────────────────────────
export function renderQuotationHtml(q, settings, { preview = false, autoPrint = false } = {}) {
  const t = resolveTemplate(settings);
  const co = t.company;
  const cur = q.currency || settings?.currency || "INR";
  const lh = t.letterhead;
  const showOwnHeader = !lh || !lh.hideHeader;
  const footerBar = t.showFooterBar && !lh && (co.phone || co.email || co.website);
  const col = Object.fromEntries(t.columns.map((c) => [c.key, c]));
  const shownCols = t.columns.filter((c) => c.show);
  const items = (q.lineItems || []).filter((li) => String(li.description || "").trim());
  const hasModules = items.some((li) => String(li.module || "").trim());
  const gstPct = Number(q.gstPercent) || 0;
  const totals = computeTotals(q);
  const showTotals = q.showTotals !== false;
  const clientLabel = q.clientCompany || q.clientName || "Client";

  // ── each section → HTML (empty sections render nothing) ──
  let secNo = 0;
  const heading = (label) => `<h3>${t.numbered ? `<span class="no">${String(++secNo).padStart(2, "0")}</span>` : ""}${esc(label)}</h3>`;
  const block = (label, inner, cls = "") => `<section class="sec ${cls}">${heading(label)}${inner}</section>`;
  const textBlock = (label, text, cls = "") => (String(text || "").trim() ? block(label, `<div class="txt">${richText(text)}</div>`, cls) : "");

  // The charge shown for an item: its own text ("Included", "₹199 per product"),
  // else the amount (+ "/month" when the Billing column is hidden, + " + GST" if set).
  const charge = (li) => {
    const note = String(li.chargeNote || "").trim() ? `<div class="cn">${esc(li.chargeNote)}</div>` : "";
    if (String(li.priceLabel || "").trim()) return esc(li.priceLabel) + note;
    if (!(lineTotalOf(li) > 0)) return `—${note}`;   // no price and no price text
    const b = billingOf(li.billing);
    return `${esc(moneyShort(lineTotalOf(li), cur))}${col.billing.show ? "" : esc(b.short)}${t.gstSuffix && gstPct ? " + GST" : ""}${note}`;
  };
  const cell = (c, li, i) => {
    switch (c.key) {
      case "index":       return `<td class="idx">${String(i + 1).padStart(2, "0")}</td>`;
      case "description": return `<td><div class="d">${esc(li.description)}</div>${li.details ? `<div class="det">${richText(li.details)}</div>` : ""}</td>`;
      case "billing":     return `<td>${esc(billingOf(li.billing).label)}</td>`;
      case "qty":         return `<td class="n">${li.priceLabel ? "" : esc(li.quantity)}</td>`;
      case "unitPrice":   return `<td class="n">${li.priceLabel ? "" : esc(moneyShort(li.unitPrice, cur))}</td>`;
      case "amount":      return `<td class="n amt">${charge(li)}</td>`;
      default: return "";
    }
  };
  const head = (c) => `<th class="${["qty", "unitPrice", "amount"].includes(c.key) ? "n" : ""}${c.key === "index" ? " idx" : ""}">${esc(c.label)}</th>`;

  let itemRows = "";
  if (hasModules) {
    const groups = new Map();
    items.forEach((li) => { const k = String(li.module || "").trim() || "Other items"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(li); });
    let n = 0;
    for (const [name, list] of groups) {
      itemRows += `<tr class="grp"><td colspan="${shownCols.length}">${esc(name)}</td></tr>`;
      for (const li of list) { itemRows += `<tr>${shownCols.map((c) => cell(c, li, n)).join("")}</tr>`; n++; }
      const sub = r2(list.filter((li) => !li.billing || li.billing === "one_time").reduce((a, li) => a + lineTotalOf(li), 0));
      if (groups.size > 1 && sub > 0 && list.length > 1) {
        itemRows += `<tr class="sub"><td colspan="${shownCols.length - 1}">${esc(name)} subtotal</td><td class="n">${esc(moneyShort(sub, cur))}</td></tr>`;
      }
    }
  } else {
    itemRows = items.map((li, i) => `<tr>${shownCols.map((c) => cell(c, li, i)).join("")}</tr>`).join("");
  }

  const highlightsHtml = (list) => (list || []).filter((h) => String(h.label || "").trim()).length
    ? `<div class="hl">${list.filter((h) => String(h.label || "").trim()).map((h, i) => `<div class="hl-box hl-${i % 3}"><div class="hl-l">${esc(h.label)}</div><div class="hl-v">${esc(h.value)}</div>${h.note ? `<div class="hl-n">${esc(h.note)}</div>` : ""}</div>`).join("")}</div>`
    : "";

  const S = {
    client: (s) => {
      const lines = [q.clientCompany && q.clientCompany !== q.clientName ? q.clientCompany : "", q.clientAddress, q.clientGSTIN && `GSTIN: ${q.clientGSTIN}`, q.clientPhone, q.clientEmail].filter(Boolean);
      return `<section class="sec client"><div class="to">${esc(s.label)}</div><div class="who">${esc(q.clientName || "—")}</div>${lines.map((x) => `<div>${esc(x).replace(/\n/g, "<br>")}</div>`).join("")}</section>`;
    },
    subject: (s) => (q.title ? `<section class="sec subj"><b>${esc(s.label)}:</b> ${esc(q.title)}</section>` : ""),
    introduction: (s) => textBlock(s.label, q.introduction),
    aboutUs: (s) => textBlock(s.label, q.aboutUs),
    highlights: (s) => (q.coverPage ? "" : (highlightsHtml(q.highlights) ? block(s.label, highlightsHtml(q.highlights), "keep") : "")),
    scope: (s) => textBlock(s.label, q.scopeOfWork),
    items: (s) => block(s.label, `<table class="it"><thead><tr>${shownCols.map(head).join("")}</tr></thead>
      <tbody>${itemRows || `<tr><td colspan="${shownCols.length}" class="muted">No items</td></tr>`}</tbody></table>`, "items"),
    totals: () => {
      if (!showTotals) return "";
      const rec = totals.recurringByPeriod;
      const hasOneTime = q.oneTimeSubtotal > 0 || !rec.length;
      return `<table class="totals">
      ${hasOneTime ? `
      <tr><td>${rec.length ? "One-time subtotal" : "Subtotal"}</td><td class="n">${esc(money(q.oneTimeSubtotal, cur))}</td></tr>
      ${q.discountAmount ? `<tr><td>Discount${q.discountType === "percent" ? ` (${esc(q.discountValue)}%)` : ""}${q.discountedBy ? ` <span class="muted">· approved by ${esc(q.discountedBy)}</span>` : ""}</td><td class="n">− ${esc(money(q.discountAmount, cur))}</td></tr>` : ""}
      ${gstPct ? `<tr><td>GST @ ${esc(gstPct)}%</td><td class="n">${esc(money(q.gstAmount, cur))}</td></tr>` : ""}
      <tr class="grand"><td>${rec.length ? "One-time total" : "Total"}${gstPct ? " (incl. GST)" : ""}</td><td class="n">${esc(money(q.grandTotal, cur))}</td></tr>` : ""}
      ${rec.map((p) => `
      <tr class="gap"><td colspan="2"></td></tr>
      <tr><td>${esc(p.period)} subtotal</td><td class="n">${esc(money(p.subtotal, cur))}</td></tr>
      ${gstPct ? `<tr><td>GST @ ${esc(gstPct)}%</td><td class="n">${esc(money(p.gst, cur))}</td></tr>` : ""}
      <tr class="grand rec"><td>${esc(p.period)} total${gstPct ? " (incl. GST)" : ""}</td><td class="n">${esc(money(p.total, cur))}</td></tr>`).join("")}
    </table>`;
    },
    optionalItems: (s) => {
      const list = (q.optionalItems || []).filter((o) => String(o.description || "").trim());
      if (!list.length) return "";
      return block(s.label, `<table class="it"><thead><tr><th>Item</th><th>Billing</th><th class="n">Charges</th></tr></thead><tbody>
        ${list.map((o) => `<tr><td><div class="d">${esc(o.description)}</div>${o.details ? `<div class="det">${richText(o.details)}</div>` : ""}</td>
          <td>${esc(billingOf(o.billing).label)}</td><td class="n amt">${o.priceLabel ? esc(o.priceLabel) : esc(moneyShort(lineTotalOf(o), cur)) + (t.gstSuffix && gstPct ? " + GST" : "")}</td></tr>`).join("")}
        </tbody></table><div class="note-s">Optional — not included in the total above.</div>`, list.length <= 8 ? "keep" : "");
    },
    customTables: () => (q.customTables || []).filter((tb) => (tb.rows || []).length || tb.title).map((tb) => {
      const cols = (tb.columns || []).length ? tb.columns : ["", ""];
      const rows = (tb.rows || []).map((r) => (Array.isArray(r) ? r : r.cells || []));
      // Right-align the last column only when it holds prices ("₹4,000–₹10,000",
      // "Free", "Client actuals") — not text like "50% advance" or "30 days".
      const priceLike = (v) => /^[₹$€£]/.test(v) || /^(free|included|nil|—|-|as per usage|client actuals|at actuals)$/i.test(v);
      const lastCells = rows.map((r) => String(r[cols.length - 1] || "").trim()).filter(Boolean);
      const lastIsMoney = lastCells.length > 0 && lastCells.filter(priceLike).length / lastCells.length >= 0.6;
      const inner = `<table class="it ct"><thead><tr>${cols.map((c, i) => `<th class="${i === cols.length - 1 && lastIsMoney && cols.length > 1 ? "n" : ""}">${esc(c)}</th>`).join("")}</tr></thead><tbody>
        ${rows.map((r) => `<tr>${cols.map((_, i) => `<td class="${i === 0 ? "d" : ""}${i === cols.length - 1 && lastIsMoney && cols.length > 1 ? " n" : ""}">${esc(r[i] || "").replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}
      </tbody></table>${tb.note ? `<div class="callout">${richText(tb.note)}</div>` : ""}`;
      return tb.title ? block(tb.title, inner, rows.length <= 10 ? "keep" : "") : `<section class="sec">${inner}</section>`;
    }).join(""),
    paymentSchedule: (s) => {
      const rows = (q.paymentSchedule || []).filter((p) => String(p.label || "").trim());
      if (!rows.length) return "";
      const amt = (p) => scheduleAmount(p, Number(q.grandTotal) || 0);
      const sum = r2(rows.reduce((a, p) => a + amt(p), 0));
      const anyPct = rows.some((p) => Number(p.percent) > 0);
      const anyDue = rows.some((p) => p.due);
      return block(s.label, `<table class="it"><thead><tr><th>Milestone</th>${anyDue ? "<th>Due</th>" : ""}<th class="n">${anyPct ? "Share &amp; amount" : "Amount"}</th></tr></thead><tbody>
        ${rows.map((p) => `<tr><td>${esc(p.label)}</td>${anyDue ? `<td>${esc(p.due)}</td>` : ""}<td class="n">${Number(p.percent) > 0 ? `<b>${esc(p.percent)}%</b> · ` : ""}${esc(money(amt(p), cur))}</td></tr>`).join("")}
        <tr class="sum"><td>Total${gstPct ? ` (incl. ${esc(gstPct)}% GST)` : ""}</td>${anyDue ? "<td></td>" : ""}<td class="n">${anyPct ? `${esc(r2(rows.reduce((a, p) => a + (Number(p.percent) || 0), 0)))}% · ` : ""}${esc(money(sum, cur))}</td></tr>
        </tbody></table>`, "keep");
    },
    timeline: (s) => {
      const rows = (q.timeline || []).filter((x) => String(x.phase || "").trim());
      if (!rows.length) return "";
      const anyDur = rows.some((x) => x.duration), anyDet = rows.some((x) => x.details);
      return block(s.label, `<table class="it"><thead><tr><th>Phase</th>${anyDur ? "<th>Duration</th>" : ""}${anyDet ? "<th>Details</th>" : ""}</tr></thead><tbody>
        ${rows.map((x) => `<tr><td class="d">${esc(x.phase)}</td>${anyDur ? `<td>${esc(x.duration)}</td>` : ""}${anyDet ? `<td>${esc(x.details)}</td>` : ""}</tr>`).join("")}</tbody></table>`, "keep");
    },
    serviceInfo: (s) => textBlock(s.label, q.serviceInfo),
    suggestions: (s) => textBlock(s.label, q.suggestions),
    customBlocks: () => (q.customBlocks || []).filter((c) => String(c.title || "").trim()).map((c) => textBlock(c.title, c.body || " ")).join(""),
    paymentTerms: (s) => textBlock(s.label, q.paymentTerms),
    terms: (s) => textBlock(s.label, q.terms),
    bankDetails: (s) => {
      const contact = [co.phone && `Phone: ${co.phone}`, co.email && `Email: ${co.email}`, co.website && `Web: ${co.website}`].filter(Boolean);
      if (!t.bankDetails && !t.qrUrl) return "";
      return block(s.label, `<div class="bank">
        <div class="bank-t">${t.bankDetails ? richText(t.bankDetails) : ""}${contact.length ? `<div class="muted contact">${contact.map(esc).join(" · ")}</div>` : ""}</div>
        ${t.qrUrl ? `<div class="qr"><img src="${esc(t.qrUrl)}" alt="Payment QR">${t.qrCaption ? `<div>${esc(t.qrCaption)}</div>` : ""}</div>` : ""}
      </div>`, "keep");
    },
    notes: (s) => textBlock(s.label, q.remark),
    signature: () => `<section class="signs${t.clientSignature ? " two" : ""}">
        <div class="sign">
          <div class="for">For ${esc(co.name || "us")}</div>
          ${t.stampUrl ? `<img class="stamp" src="${esc(t.stampUrl)}" alt="">` : `<div class="space"></div>`}
          <div class="line">${esc(t.signatoryName || "Authorised signatory")}</div>
          ${t.signatoryTitle ? `<div class="muted">${esc(t.signatoryTitle)}</div>` : ""}
        </div>
        ${t.clientSignature ? `<div class="sign">
          <div class="for">For ${esc(clientLabel)}</div>
          <div class="space"></div>
          <div class="line">Authorised signatory</div>
          <div class="muted">Accepted — name, date and seal</div>
        </div>` : ""}
      </section>`,
  };

  const sectionsHtml = t.sections.filter((s) => s.show).map((s) => (S[s.key] ? S[s.key](s) : "")).join("\n");

  // Company header: logo + name on the left, address / GSTIN on the right.
  const coLines = [co.address && `<div class="addr">${esc(co.address).replace(/\n/g, "<br>")}</div>`, co.gstin && `<div class="gst">GSTIN: ${esc(co.gstin)}</div>`].filter(Boolean).join("");
  const companyHeader = showOwnHeader ? `
  <header class="cohead">
    <div class="brand">${co.logo ? `<img src="${esc(co.logo)}" alt="">` : ""}${co.name && (!co.logo || !coLines) ? `<div class="cname">${esc(co.name)}</div>` : ""}</div>
    <div class="coinfo">${co.address ? `<div class="lbl">Office address:</div>` : ""}${coLines}</div>
  </header><div class="band"></div>` : "";

  const docMeta = `
  <div class="meta">
    <h1>${esc(t.title)}</h1>
    <div class="meta-r">
      <div><span class="muted">No.</span> <b>${esc(q.number)}</b></div>
      <div><span class="muted">Date:</span> ${esc(fmtDate(q.createdAt))}</div>
      ${q.validUntil ? `<div><span class="muted">Valid until:</span> ${esc(fmtDate(q.validUntil))}</div>` : ""}
      ${q.handledBy ? `<div><span class="muted">Prepared by:</span> ${esc(q.handledBy)}</div>` : ""}
    </div>
  </div>`;

  // Optional cover page (like the software proposals): label, big title,
  // subtitle, highlight boxes, prepared by / for / date. Then a page break.
  const cover = q.coverPage ? `
  <section class="cover">
    ${companyHeader}
    <div class="cv-label">${esc(t.title)}</div>
    <div class="cv-title">${esc(q.title || clientLabel)}</div>
    ${q.coverSubtitle ? `<div class="cv-sub">${esc(q.coverSubtitle)}</div>` : ""}
    <div class="cv-grid">
      <div><div class="cv-k">Prepared by</div><div>${esc(co.name || "—")}</div></div>
      <div><div class="cv-k">Prepared for</div><div>${esc(clientLabel)}</div></div>
      <div><div class="cv-k">Reference</div><div>${esc(q.number)}</div></div>
      <div><div class="cv-k">Date</div><div>${esc(fmtDate(q.createdAt))}</div></div>
    </div>
    ${highlightsHtml(q.highlights)}
    ${q.validUntil ? `<div class="cv-foot">Valid until ${esc(fmtDate(q.validUntil))} · Confidential — prepared for client evaluation</div>` : ""}
  </section>` : "";

  const content = `${preview ? `<div class="draft"><b>Preview — not saved yet.</b> The number is assigned when you save. Close this tab to go back and edit.</div>` : ""}
  ${cover}
  ${q.coverPage ? "" : companyHeader}
  ${docMeta}
  ${sectionsHtml}`;

  // One page frame for every mode: thead / tfoot spacers repeat on each
  // printed page, so text never runs into the letterhead or the footer bar.
  const top = lh ? lh.top : 12, bottom = lh ? lh.bottom : (footerBar ? 20 : 12), side = lh ? lh.side : 15;
  const contact = [co.phone && `☎ ${co.phone}`, co.website, co.email].filter(Boolean);
  const body = `${lh ? `<img class="lh-bg" src="${esc(lh.url)}" alt="">` : ""}
  ${footerBar ? `<div class="pfoot">${contact.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
  <table class="frame">
    <thead><tr><td style="height:${top}mm"></td></tr></thead>
    <tfoot><tr><td style="height:${bottom}mm"></td></tr></tfoot>
    <tbody><tr><td class="frame-body">${content}</td></tr></tbody>
  </table>`;

  const A = t.accent;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${preview ? `${esc(t.title)} preview` : esc(q.number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  :root { --accent: ${A}; }
  body { font-family: ${t.font}; color: #1a1a1a; font-size: 12.5px; line-height: 1.5; margin: 0; }
  p { margin: 0 0 6px; }
  .muted { color: #5b6170; }
  .draft { background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:8px 12px; margin-bottom:14px; font-size:12px; border-radius:4px; }
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead > tr > td, table.frame > tfoot > tr > td { padding: 0; border: 0; }
  table.frame > tbody > tr > td.frame-body { padding: 0 ${side}mm; border: 0; vertical-align: top; }

  /* company header */
  .cohead { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .cohead .brand img { max-height: 62px; max-width: 230px; display: block; }
  .cname { font-weight: 800; font-size: 18px; color: var(--accent); margin-top: 4px; }
  .coinfo { text-align: right; font-size: 11.5px; max-width: 55%; }
  .coinfo .lbl { font-weight: 700; }
  .coinfo .gst { font-weight: 700; margin-top: 4px; }
  .band { height: 7px; margin: 12px -${side}mm 14px; background: linear-gradient(90deg, var(--accent) 0 64%, #F7A23B 64% 100%); }
  .layout-minimal .band { height: 1px; background: #ddd; margin-left: 0; margin-right: 0; }

  .meta { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 6px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
  .meta-r { text-align: right; font-size: 11.5px; }

  .sec { margin-top: 16px; }
  .sec h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; margin: 0 0 7px; break-after: avoid; page-break-after: avoid; }
  .sec h3 .no { margin-right: 8px; }
  .sec h4 { font-size: 12.5px; margin: 8px 0 4px; }
  .sec.keep, .signs, .totals, .bank, .hl { break-inside: avoid; }
  .client .to { font-weight: 700; color: #C0392B; }
  .client .who { font-weight: 700; font-size: 14px; }
  .subj { font-size: 13px; }
  .txt ul, .det ul { margin: 2px 0 6px; padding-left: 18px; }
  .txt ul.cols { columns: 2; column-gap: 28px; }
  .txt li, .det li { margin: 1px 0; break-inside: avoid; }
  table.it { width: 100%; border-collapse: collapse; background: rgba(255,255,255,.9); }
  table.it th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  table.it th.n { text-align: right; }
  table.it th, table.it td { padding: 7px 9px; vertical-align: top; }
  table.it tr { break-inside: avoid; }
  table.it .idx { width: 44px; text-align: center; }
  .d { font-weight: 600; }
  .det { color: #444; font-size: 12px; margin-top: 3px; }
  .det p { margin: 0 0 3px; }
  .det .lbl, .txt .lbl { font-weight: 700; margin-top: 4px; }
  .amt { font-weight: 700; }
  .amt .cn { font-weight: 400; font-size: 11px; color: #555; white-space: normal; margin-top: 2px; }
  tr.grp td { font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; }
  tr.sub td { font-weight: 700; font-size: 11.5px; }
  tr.sum td { font-weight: 700; }
  .note-s { font-size: 11px; color: #777; margin-top: 4px; }
  .callout { margin-top: 8px; padding: 8px 12px; font-size: 11.5px; font-style: italic; background: #f5f7fb; border-left: 3px solid var(--accent); }
  .callout p { margin: 0; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin: 12px 0 0 auto; width: 320px; border-collapse: collapse; }
  .totals td { padding: 4px 0; }
  .totals tr.gap td { padding: 4px 0; }
  .grand td { font-weight: 700; font-size: 14.5px; padding-top: 7px; }
  .grand.rec td { font-size: 13.5px; }

  .hl { display: flex; gap: 0; margin: 6px 0; }
  .hl-box { flex: 1; padding: 12px 10px; text-align: center; color: #fff; }
  .hl-0 { background: var(--accent); } .hl-1 { background: #F28C28; } .hl-2 { background: color-mix(in srgb, var(--accent) 75%, black); }
  .hl-l { font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: .4px; }
  .hl-v { font-size: 19px; font-weight: 800; margin: 2px 0; }
  .hl-n { font-size: 10.5px; font-style: italic; opacity: .9; }

  .bank { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .bank .contact { margin-top: 6px; font-size: 11.5px; }
  .qr { text-align: center; font-size: 10.5px; }
  .qr img { width: 120px; height: 120px; object-fit: contain; display: block; margin: 0 auto 3px; }

  .signs { display: flex; justify-content: flex-end; gap: 40px; margin-top: 34px; }
  .signs.two { justify-content: space-between; }
  .sign { width: 230px; }
  .sign .for { font-weight: 700; color: var(--accent); margin-bottom: 4px; }
  .sign .stamp { max-height: 80px; max-width: 200px; display: block; margin: 0 0 4px; }
  .sign .space { height: 56px; }
  .sign .line { border-top: 1px solid #444; padding-top: 5px; font-weight: 600; }

  /* cover page */
  .cover { min-height: 245mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
  .cv-label { margin-top: 50mm; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #5b6170; }
  .cv-title { text-align: center; font-size: 34px; font-weight: 800; color: var(--accent); margin: 10px 0 6px; line-height: 1.15; }
  .cv-sub { text-align: center; font-size: 15px; font-weight: 600; margin-bottom: 26px; }
  .cv-grid { display: flex; justify-content: center; gap: 34px; margin: 24px 0 34px; text-align: center; font-weight: 600; }
  .cv-k { font-size: 10.5px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: #F28C28; margin-bottom: 3px; }
  .cv-foot { margin-top: auto; text-align: center; font-size: 11px; font-style: italic; color: #777; }

  /* footer bar on every page */
  .pfoot { position: fixed; left: 0; right: 0; bottom: 0; height: 11mm; display: flex; align-items: center; justify-content: space-around;
           background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; border-bottom: 3mm solid #F7A23B; }

  /* classic */
  .layout-classic .sec h3 { color: #111; }
  .layout-classic table.it th { background: #f1f2f6; }
  .layout-classic table.it th, .layout-classic table.it td { border: 1px solid #cfd3dc; }
  .layout-classic tr.grp td, .layout-classic tr.sub td { background: #f7f8fb; }
  .layout-classic .grand td { border-top: 2px solid #111; }

  /* modern */
  .layout-modern h1 { color: var(--accent); }
  .layout-modern .sec h3 { color: var(--accent); border-bottom: 2px solid #F7A23B; padding-bottom: 4px; }
  .layout-modern .sec h3 .no { color: #F28C28; }
  .layout-modern table.it th { background: var(--accent); color: #fff; }
  .layout-modern table.it td { border-bottom: 1px solid #e5e7eb; }
  .layout-modern table.it tbody tr:nth-child(even) td { background: #f5f7fb; }
  .layout-modern tr.grp td { background: color-mix(in srgb, var(--accent) 12%, white) !important; color: var(--accent); }
  .layout-modern .amt { color: #E07B12; }
  .layout-modern .grand td { border-top: 2px solid var(--accent); color: var(--accent); }

  /* minimal */
  .layout-minimal h1 { font-weight: 300; letter-spacing: 4px; color: var(--accent); }
  .layout-minimal .sec { margin-top: 22px; }
  .layout-minimal .sec h3 { color: var(--accent); font-weight: 600; font-size: 11.5px; }
  .layout-minimal table.it th { border-bottom: 1px solid #111; font-weight: 600; }
  .layout-minimal table.it td { border-bottom: 1px solid #eee; }
  .layout-minimal tr.grp td { color: var(--accent); padding-top: 12px; }
  .layout-minimal .grand td { border-top: 1px solid #111; color: var(--accent); }

  /* letterhead */
  .lh-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: -1; object-fit: fill; }
  @media screen {
    html { background: #e5e7eb; }
    body { width: 210mm; min-height: 297mm; margin: 16px auto; position: relative; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.25); }
    .lh-bg { position: absolute; }
    .pfoot { position: absolute; }
    .cover { border-bottom: 2px dashed #ccc; margin-bottom: 16px; padding-bottom: 12px; }
  }
</style></head><body class="layout-${t.layout}">
  ${body}
  ${autoPrint ? `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>` : ""}
</body></html>`;
}

// Opens the quotation in a new tab. Saved quotations open the print dialog
// ("Save as PDF"); previews don't. Uploaded quotations just open their file.
// `win` = a window opened during the click (pop-up blockers reject window.open
// after an await).
export function printQuotation(q, win = null, { preview = false, settings = null } = {}) {
  if (q.source === "uploaded" && q.fileUrl) {
    if (win) win.location.href = q.fileUrl; else window.open(q.fileUrl, "_blank", "noopener");
    return;
  }
  const html = renderQuotationHtml(q, settings, { preview, autoPrint: !preview });
  const w = win || window.open("", "_blank");
  if (!w) { alert("Allow pop-ups for this site to print the quotation."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// A filled-in sample (every section has content) for previewing settings.
export function sampleQuotation(settings = {}) {
  const st = settings || {};
  const cat = (st.catalog || []).slice(0, 3);
  const lineItems = cat.length
    ? cat.map((c, i) => ({ description: c.name, details: c.details || "", module: c.module || "", quantity: 1, unitPrice: c.unitPrice || 25000, billing: c.billing || "one_time", priceLabel: "" }))
    : [
        { description: "Social Media Management", details: "- Full profile management\n- Strategy creation\n- Posts, stories\n- Community & reporting", module: "", quantity: 1, unitPrice: 2999, billing: "monthly" },
        { description: "Reels 12/month", details: "- Three reels every week × 4 weeks\n- Editing (₹499 each)", module: "", quantity: 12, unitPrice: 499, billing: "monthly" },
        { description: "Website design and development", details: "- Up to 10 pages, mobile-friendly\n- Contact form and WhatsApp button", module: "", quantity: 1, unitPrice: 50000, billing: "one_time" },
        { description: "Meta Ads budget", details: "Paid directly to Meta by the client", module: "", quantity: 1, unitPrice: 0, billing: "monthly", priceLabel: "Client actuals" },
      ];
  const form = { lineItems, discountType: "none", discountValue: 0, gstPercent: st.defaultGstPercent ?? 18 };
  const t = computeTotals(form);
  return {
    ...form, source: "created", number: `${st.numberPrefix || "SKY"}/${new Date().getFullYear()}/0001`, createdAt: new Date().toISOString(),
    validUntil: (st.validityDays ?? 15) > 0 ? new Date(Date.now() + (st.validityDays ?? 15) * 86400000).toISOString() : null,
    title: "Proposal for Social Media and Website", coverSubtitle: "Digital growth package", coverPage: !!st.coverPageDefault, showTotals: true,
    currency: st.currency || "INR", handledBy: "Sales executive",
    clientName: "Jhansi Gopal", clientCompany: "Sample Sweets", clientAddress: "Bengaluru, India", clientGSTIN: "",
    lineItems: lineItems.map((li) => ({ ...li, lineTotal: li.quantity * li.unitPrice })),
    optionalItems: [{ description: "Google Ads management", details: "Search and Performance Max", quantity: 1, unitPrice: 15000, billing: "monthly", lineTotal: 15000 }],
    oneTimeSubtotal: t.oneTime, recurringSubtotal: t.recurring, discountAmount: t.disc, gstAmount: t.gst, grandTotal: t.grand,
    introduction: "This proposal covers a one-time website build followed by monthly social media management.",
    aboutUs: st.defaultAboutUs || "We are a full-service digital marketing agency specialising in SEO, paid advertising, social media, websites and AI automation.",
    highlights: [{ label: "One-time", value: moneyShort(t.grand, st.currency || "INR"), note: "Incl. GST" }, { label: "Monthly", value: moneyShort(t.recurringByPeriod[0]?.total || 0, st.currency || "INR"), note: "Incl. GST" }, { label: "Delivery", value: "4 weeks", note: "Website" }],
    scopeOfWork: "- Website build and launch\n- Monthly social media content and management",
    customTables: [{ title: "Payment terms", columns: ["Term", "Details"], rows: [{ cells: ["Payment terms", "50% advance"] }, { cells: ["Ad budget", "Paid directly to Meta by client"] }, { cells: ["GST", "Extra as applicable"] }] }],
    paymentSchedule: [{ label: "Advance on confirmation", percent: 50, due: "On signing" }, { label: "Balance on delivery", percent: 50, due: "On go-live" }],
    timeline: [{ phase: "Design", duration: "Week 1–2", details: "" }, { phase: "Build and launch", duration: "Week 3–4", details: "" }],
    serviceInfo: st.defaultServiceInfo || "", suggestions: "", customBlocks: [],
    paymentTerms: st.defaultPaymentTerms || "", terms: st.defaultTerms || "- Prices are valid until the date shown.\n- Changes after sign-off are quoted separately.",
    remark: "",
  };
}
