// ─────────────────────────────────────────────────────────────────────────────
//  InvoiceReceipt.jsx
//
//  USAGE:
//    import InvoiceReceipt from "./InvoiceReceipt";
//
//    <InvoiceReceipt
//      invoice={invoiceData}       // see shape below
//      company={companyDetails}    // optional overrides
//      onClose={() => {}}          // called when modal dismissed
//      onDownload={() => {}}       // optional extra callback after PDF download
//    />
//
//  invoiceData shape:
//  {
//    invoiceId:     "INV-2025-03",
//    date:          "01 Mar 2025",
//    dueDate:       "01 Apr 2025",           // optional
//    planName:      "Growth",
//    billingCycle:  "monthly" | "yearly",
//    baseAmount:    2499,                    // number, before GST (₹)
//    transactionId: "TXN1234567890",
//    paymentMethod: "Visa •••• 4242",        // optional
//    status:        "Paid" | "Pending",
//    customer: {
//      name:    "Acme Corp",
//      email:   "billing@acmecorp.com",
//      address: "12, MG Road, Bengaluru - 560001",
//      gstin:   "29AABCU9603R1ZX",          // optional
//    }
//  }
//
//  companyDetails (optional, defaults shown):
//  {
//    name:    "SkyUp CRM Pvt. Ltd.",
//    address: "91springboard, Koramangala, Bengaluru - 560095",
//    gstin:   "29AABCS1429B1ZZ",
//    cin:     "U72900KA2022PTC150000",
//    email:   "billing@skyupcrm.com",
//    logo:    null,
//  }
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";

const GST_RATE = 0.18;

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Safe PDF string escape (ASCII-safe, no unicode issues) ────────────────────
function pdfEscape(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Strip any non-ASCII characters that would break Type1 font rendering
    .replace(/[^\x20-\x7E]/g, (c) => {
      // Replace common unicode chars with ASCII equivalents
      const map = {
        "\u2013": "-", "\u2014": "--", "\u2018": "'", "\u2019": "'",
        "\u201C": '"', "\u201D": '"', "\u20B9": "Rs.", "\u2022": "*",
        "\u2500": "-", "\u2502": "|", "\u2550": "=",
      };
      return map[c] || "";
    });
}

// ── Core PDF builder (FIXED object order) ─────────────────────────────────────
//
//  Correct PDF object graph:
//    1 = Catalog  -> /Pages 2 0 R
//    2 = Pages    -> /Kids [3 0 R]    ← 3 MUST be the Page, not the stream
//    3 = Page     -> /Contents 4 0 R
//    4 = Stream   (actual text content)
//    5 = Font
//
//  The original code had objects 3 and 4 swapped, so /Kids [3 0 R] pointed
//  to the content stream instead of the page — resulting in a blank PDF.
//
function buildPDF(lines, filename) {
  // Build the content stream
  const streamBody =
    "BT\n/F1 9 Tf\n45 800 Td\n11 TL\n" +
    lines
      .map((l) => "(" + pdfEscape(l) + ") Tj\n0 -11 Td")
      .join("\n") +
    "\nET";

  // Calculate byte length BEFORE wrapping in obj header
  const streamLen = new TextEncoder().encode(streamBody).length;

  const objs = [
    // obj 1 — Catalog
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    // obj 2 — Pages (kids must reference obj 3 = Page)
    { id: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    // obj 3 — Page (contents reference obj 4 = stream)
    {
      id: 3,
      body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    },
    // obj 4 — Content stream
    {
      id: 4,
      body: `<< /Length ${streamLen} >>\nstream\n${streamBody}\nendstream`,
    },
    // obj 5 — Font
    { id: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>" },
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const o of objs) {
    offsets.push(pdf.length);
    pdf += `${o.id} 0 obj\n${o.body}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
//  InvoiceReceipt — full-page modal overlay
// ─────────────────────────────────────────────────────────────────────────────
export default function InvoiceReceipt({
  invoice,
  company: companyProp,
  onClose,
  onDownload,
}) {
  const printRef = useRef(null);

  const company = {
    name: "SkyUp CRM Pvt. Ltd.",
    address: "91springboard, Koramangala, Bengaluru - 560095, Karnataka",
    gstin: "29AABCS1429B1ZZ",
    cin: "U72900KA2022PTC150000",
    email: "billing@skyupcrm.com",
    logo: null,
    ...companyProp,
  };

  const base  = Number(invoice.baseAmount) || 0;
  const cgst  = +(base * (GST_RATE / 2)).toFixed(2);
  const sgst  = +(base * (GST_RATE / 2)).toFixed(2);
  const total = +(base + cgst + sgst).toFixed(2);
  const isPaid = invoice.status === "Paid";

  const lineItems = [
    {
      desc: `SkyUp CRM - ${invoice.planName} Plan`,
      sub:
        invoice.billingCycle === "yearly"
          ? "Annual subscription (12 months)"
          : "Monthly subscription (1 month)",
      hsn: "998315",
      qty: 1,
      rate: base,
      amount: base,
    },
  ];

  // ── Download handler ───────────────────────────────────────────────────────
  function handleDownload() {
    const SEP  = "----------------------------------------------------------------";
    const SEP2 = "================================================================";

    const lines = [
      "TAX INVOICE",
      SEP2,
      company.name,
      company.address,
      `GSTIN: ${company.gstin}   CIN: ${company.cin}`,
      `Email: ${company.email}`,
      SEP,
      `Invoice No : ${invoice.invoiceId}`,
      `Date       : ${invoice.date}`,
      `Status     : ${invoice.status}`,
      `Transaction: ${invoice.transactionId || "-"}`,
      SEP,
      "Bill To:",
      `  ${invoice.customer?.name || "-"}`,
      `  ${invoice.customer?.email || ""}`,
      `  ${invoice.customer?.address || ""}`,
      invoice.customer?.gstin ? `  GSTIN: ${invoice.customer.gstin}` : null,
      SEP,
      `${"Description".padEnd(32)} ${"HSN".padEnd(8)} ${"Qty".padEnd(4)} ${"Rate (Rs.)".padEnd(12)} Amount (Rs.)`,
      SEP,
      ...lineItems.map(
        (l) =>
          `${l.desc.slice(0, 32).padEnd(32)} ${l.hsn.padEnd(8)} ${String(l.qty).padEnd(4)} ${`Rs.${fmt(l.rate)}`.padEnd(12)} Rs.${fmt(l.amount)}`
      ),
      SEP,
      `${"Subtotal".padEnd(56)} Rs.${fmt(base)}`,
      `${"CGST @ 9%".padEnd(56)} Rs.${fmt(cgst)}`,
      `${"SGST @ 9%".padEnd(56)} Rs.${fmt(sgst)}`,
      SEP2,
      `${"TOTAL (INR)".padEnd(56)} Rs.${fmt(total)}`,
      SEP2,
      "",
      "This is a computer-generated invoice.",
      "It does not require a physical signature.",
      "Thank you for your business!",
    ].filter((l) => l !== null);

    buildPDF(lines, `${invoice.invoiceId}.pdf`);
    if (onDownload) onDownload(invoice);
  }

  // ── Print handler ──────────────────────────────────────────────────────────
  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`
      <html><head><title>${invoice.invoiceId}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 40px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>${content}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#F1F5F9] border-b border-[#E2E8F0]">
          <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-widest">
            Tax Invoice
          </span>
          <div className="flex items-center gap-2">
            <ToolBtn icon={<PrintIcon />} label="Print" onClick={handlePrint} />
            <ToolBtn icon={<DownloadIcon />} label="Download PDF" onClick={handleDownload} accent />
            <button
              onClick={onClose}
              className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div ref={printRef} className="p-8 bg-white">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              {company.logo ? (
                <div className="mb-2">{company.logo}</div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center">
                    <span className="text-white font-bold text-[13px]">S</span>
                  </div>
                  <span className="text-[16px] font-bold text-[#0F172A]">{company.name}</span>
                </div>
              )}
              <p className="text-[11px] text-[#64748B] leading-relaxed max-w-[260px]">{company.address}</p>
              <p className="text-[11px] text-[#64748B] mt-1">GSTIN: <span className="font-semibold text-[#0F172A]">{company.gstin}</span></p>
              <p className="text-[11px] text-[#64748B]">CIN: <span className="font-semibold text-[#0F172A]">{company.cin}</span></p>
              <p className="text-[11px] text-[#64748B]">{company.email}</p>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${isPaid ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FFF7ED] text-[#D97706]"}`}>
                  {invoice.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-[22px] font-bold text-[#0F172A] mb-1">{invoice.invoiceId}</p>
              <MetaRow label="Date" value={invoice.date} />
              {invoice.dueDate && <MetaRow label="Due Date" value={invoice.dueDate} />}
              {invoice.transactionId && <MetaRow label="Txn ID" value={invoice.transactionId} mono />}
              {invoice.paymentMethod && <MetaRow label="Paid via" value={invoice.paymentMethod} />}
            </div>
          </div>

          <div className="h-px bg-[#E2E8F0] mb-6" />

          {/* Bill To */}
          <div className="mb-7">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2">Bill To</p>
            <p className="text-[13px] font-bold text-[#0F172A]">{invoice.customer?.name || "—"}</p>
            {invoice.customer?.email && <p className="text-[12px] text-[#64748B]">{invoice.customer.email}</p>}
            {invoice.customer?.address && (
              <p className="text-[12px] text-[#64748B] max-w-[260px] leading-relaxed">{invoice.customer.address}</p>
            )}
            {invoice.customer?.gstin && (
              <p className="text-[12px] text-[#64748B] mt-0.5">
                GSTIN: <span className="font-semibold text-[#0F172A]">{invoice.customer.gstin}</span>
              </p>
            )}
          </div>

          {/* Line items table */}
          <div className="mb-6 rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <Th left>Description</Th>
                  <Th>HSN / SAC</Th>
                  <Th>Qty</Th>
                  <Th>Rate (₹)</Th>
                  <Th right>Amount (₹)</Th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <Td left>
                      <p className="font-semibold text-[#0F172A]">{item.desc}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">{item.sub}</p>
                    </Td>
                    <Td>{item.hsn}</Td>
                    <Td>{item.qty}</Td>
                    <Td>{fmt(item.rate)}</Td>
                    <Td right className="font-semibold">{fmt(item.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-[280px] space-y-1">
              <TotalRow label="Subtotal"     value={`₹ ${fmt(base)}`} />
              <TotalRow label="CGST @ 9%"   value={`₹ ${fmt(cgst)}`} />
              <TotalRow label="SGST @ 9%"   value={`₹ ${fmt(sgst)}`} />
              <div className="h-px bg-[#E2E8F0] my-2" />
              <TotalRow label="Total (INR)"  value={`₹ ${fmt(total)}`} bold accent />
              {isPaid && <TotalRow label="Amount Paid" value={`₹ ${fmt(total)}`} bold />}
              {isPaid && <TotalRow label="Balance Due" value="₹ 0.00" muted />}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-[#E2E8F0]">
            <p className="text-[10px] text-[#94A3B8] text-center leading-relaxed">
              This is a computer-generated tax invoice and does not require a physical signature.
              <br />
              GST is applicable as per the IGST / CGST + SGST provisions under GST Act 2017.
              <br />
              For queries: <span className="text-[#2563EB]">{company.email}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
        accent
          ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
          : "border border-[#CBD5E1] text-[#475569] hover:bg-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MetaRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-0.5">
      <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{label}</span>
      <span className={`text-[11px] font-semibold text-[#0F172A] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Th({ children, left, right }) {
  return (
    <th className={`px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap ${left ? "text-left" : right ? "text-right" : "text-center"}`}>
      {children}
    </th>
  );
}

function Td({ children, left, right }) {
  return (
    <td className={`px-4 py-3 text-[#475569] ${left ? "text-left" : right ? "text-right" : "text-center"}`}>
      {children}
    </td>
  );
}

function TotalRow({ label, value, bold, accent, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] ${bold ? "font-bold text-[#0F172A]" : muted ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
        {label}
      </span>
      <span className={`text-[12px] ${bold && accent ? "font-bold text-[#2563EB] text-[14px]" : bold ? "font-bold text-[#0F172A]" : muted ? "text-[#94A3B8]" : "text-[#0F172A]"}`}>
        {value}
      </span>
    </div>
  );
}

function PrintIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}