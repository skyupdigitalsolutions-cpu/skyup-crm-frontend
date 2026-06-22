// ─────────────────────────────────────────────────────────────────────────────
//  InvoiceReceipt.jsx
//
//  Professional, multi-line-item GST tax invoice. Renders the plan + every
//  add-on purchased in the same checkout as its own row, with its own GST
//  split — matching what verify-payment / getInvoices now persist on Payment
//  (see models/Payment.js lineItems[]).
//
//  Logo is hardcoded below — replace COMPANY_LOGO_URL with your image URL
//  or base64 string. Set COMPANY_LOGO_URL = null to show the "S" mark.
//
//  USAGE:
//    import InvoiceReceipt from "./InvoiceReceipt";
//
//    <InvoiceReceipt
//      invoice={invoiceData}
//      company={companyDetails}   // optional overrides
//      onClose={() => {}}
//    />
//
//  invoiceData shape:
//  {
//    invoiceId:     "CART-2025-06-49321",
//    date:          "22 Jun 2025",
//    planName:      "Growth Plan + WhatsApp Blast, AI Credits Pack × 2",  // fallback label
//    billingCycle:  "monthly" | "yearly" | "one_time",
//    baseAmount:    4098,                      // GST-inclusive grand total
//    transactionId: "pay_mK3dL9nQrT2",
//    paymentMethod: "Razorpay",                // optional
//    status:        "Paid" | "Pending",
//    lineItems: [                              // optional — falls back to a
//      {                                       // single synthesized row from
//        type: "plan" | "addon",                // planName/baseAmount above
//        name: "SkyUp CRM — Growth Plan",         // if omitted/empty.
//        sub:  "Monthly subscription (1 month)",
//        hsn:  "998315",
//        quantity: 1,
//        billingPeriod: "monthly",
//        autoRenew: true,
//        amount: 2117.80,                       // GST-inclusive line amount
//      },
//      ...
//    ],
//    customer: {
//      name:    "Acme Corp Pvt Ltd",
//      email:   "billing@acmecorp.com",
//      address: "12, MG Road, Bengaluru - 560001",
//      gstin:   "29AABCU9603R1ZX",          // optional
//    }
//  }
//
//  NOTE: every line amount is GST-INCLUSIVE. GST is split out per row for
//  the tax breakdown table, not added on top of the total.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";

// ── SET YOUR LOGO HERE ────────────────────────────────────────────────────────
// Replace with your image URL or a base64 string like "data:image/png;base64,..."
// Set to null to show the default "S" mark instead.
const COMPANY_LOGO_URL = /public/skyup_logo1.svg; // e.g. "/assets/logo.png" or "data:image/png;base64,..."
// ─────────────────────────────────────────────────────────────────────────────

const GST_RATE = 0.18;

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Build the GST-split line items the table renders ─────────────────────────
// Each line's `amount` is GST-inclusive; taxable/cgst/sgst are derived per row
// so multi-item invoices report tax correctly even when items have different
// quantities — this mirrors how the totals block sums across rows.
function buildRows(invoice) {
  const raw = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [{
        type: "plan",
        name: invoice.planName || "SkyUp CRM Subscription",
        sub:  invoice.billingCycle === "yearly" ? "Annual subscription (12 months)"
            : invoice.billingCycle === "monthly" ? "Monthly subscription (1 month)"
            : "One-time purchase",
        hsn:  "998315",
        quantity: 1,
        amount: invoice.baseAmount,
      }];

  return raw.map((item) => {
    const amount  = +(Number(item.amount) || 0).toFixed(2);
    const taxable = +(amount / (1 + GST_RATE)).toFixed(2);
    const cgst    = +(taxable * (GST_RATE / 2)).toFixed(2);
    const sgst    = +(amount - taxable - cgst).toFixed(2);
    return { ...item, amount, taxable, cgst, sgst };
  });
}

// ── PDF download via the browser's native print-to-PDF ───────────────────────
// Renders the exact same styled HTML used on screen into a hidden print frame
// and triggers the print dialog with "Save as PDF" — this guarantees the PDF
// always matches what's shown, instead of drifting from a separately hand-
// built PDF layout.
function printToPdf(node, title) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
            background: #fff; color: #0F172A; padding: 0;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          table { border-collapse: collapse; width: 100%; }
          @page { size: A4; margin: 14mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${node.innerHTML}</body>
    </html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 250);
}

// ─────────────────────────────────────────────────────────────────────────────
//  InvoiceReceipt
// ─────────────────────────────────────────────────────────────────────────────
export default function InvoiceReceipt({ invoice, company: companyProp, onClose }) {
  const printRef = useRef(null);

  const company = {
    name:    "SKYUP DIGITAL SOLUTIONS LLP",
    address: "Parinidhi #23, E Block, 14th A Main Road, 2nd Floor, Sahakaranagar, Bangalore - 560092",
    gstin:   "29AABCS1429B1ZZ",
    cin:     "U72900KA2022PTC150000",
    email:   "contact@skyupdigitalsolutions.com",
    ...companyProp,
  };

  const rows   = buildRows(invoice);
  const total  = +rows.reduce((s, r) => s + r.amount, 0).toFixed(2);
  const taxable = +rows.reduce((s, r) => s + r.taxable, 0).toFixed(2);
  const cgst    = +rows.reduce((s, r) => s + r.cgst, 0).toFixed(2);
  const sgst    = +rows.reduce((s, r) => s + r.sgst, 0).toFixed(2);
  const isPaid  = invoice.status === "Paid";

  const logoElement = COMPANY_LOGO_URL ? (
    <img
      src={COMPANY_LOGO_URL}
      alt={company.name}
      style={{ maxHeight: 44, maxWidth: 170, objectFit: "contain", display: "block" }}
    />
  ) : null;

  function handlePrint() {
    if (!printRef.current) return;
    printToPdf(printRef.current, invoice.invoiceId);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#0B0D14]/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="w-full max-w-[680px] bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Toolbar (not printed) ── */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.12em]">
            Tax Invoice
          </span>
          <div className="flex items-center gap-2">
            <ToolBtn icon={<DownloadIcon />} label="Download PDF" onClick={handlePrint} accent />
            <button
              onClick={onClose}
              className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Printable invoice ── */}
        <div ref={printRef} className="bg-white">
          <div className="relative px-9 py-9">
            {/* Signature accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-[#1E3A8A]" />

            {/* Header */}
            <div className="flex items-start justify-between mb-8 pl-1">
              <div>
                {logoElement ? (
                  <div className="mb-2.5">{logoElement}</div>
                ) : (
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-9 h-9 rounded-[10px] bg-[#1E3A8A] flex items-center justify-center">
                      <span className="text-white font-bold text-[14px] tracking-tight">S</span>
                    </div>
                    <span className="text-[15px] font-bold text-[#0F172A] tracking-tight">{company.name}</span>
                  </div>
                )}
                <p className="text-[11px] text-[#64748B] leading-[1.55] max-w-[270px]">{company.address}</p>
                <div className="mt-2 space-y-0.5">
                  <p className="text-[11px] text-[#64748B]">GSTIN&nbsp; <span className="font-semibold text-[#334155]">{company.gstin}</span></p>
                  <p className="text-[11px] text-[#64748B]">CIN&nbsp;&nbsp;&nbsp; <span className="font-semibold text-[#334155]">{company.cin}</span></p>
                  <p className="text-[11px] text-[#64748B]">{company.email}</p>
                </div>
              </div>

              <div className="text-right">
                <StatusPill isPaid={isPaid} label={invoice.status} />
                <p className="text-[20px] font-bold text-[#0F172A] mt-3 mb-2 tracking-tight tabular-nums">{invoice.invoiceId}</p>
                <MetaRow label="Date"   value={invoice.date} />
                {invoice.dueDate       && <MetaRow label="Due date" value={invoice.dueDate} />}
                {invoice.transactionId && <MetaRow label="Txn ID"   value={invoice.transactionId} mono />}
                <MetaRow label="Paid via" value={invoice.paymentMethod || "Razorpay"} />
              </div>
            </div>

            <div className="h-px bg-[#E2E8F0] mb-7 ml-1" />

            {/* Bill To */}
            <div className="mb-7 pl-1">
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.12em] mb-2">Bill to</p>
              <p className="text-[13.5px] font-bold text-[#0F172A]">{invoice.customer?.name || "—"}</p>
              {invoice.customer?.email   && <p className="text-[11.5px] text-[#64748B] mt-0.5">{invoice.customer.email}</p>}
              {invoice.customer?.address && <p className="text-[11.5px] text-[#64748B] max-w-[280px] leading-[1.5]">{invoice.customer.address}</p>}
              {invoice.customer?.gstin   && (
                <p className="text-[11.5px] text-[#64748B] mt-1">
                  GSTIN&nbsp; <span className="font-semibold text-[#334155]">{invoice.customer.gstin}</span>
                </p>
              )}
            </div>

            {/* Line items */}
            <div className="mb-4 ml-1 rounded-xl border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <Th left>Description</Th>
                    <Th>HSN / SAC</Th>
                    <Th>Qty</Th>
                    <Th>Taxable (₹)</Th>
                    <Th right>Amount (₹)</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                      <Td left>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <TypeTag type={item.type} />
                          <p className="font-semibold text-[#0F172A]">{item.name}</p>
                        </div>
                        {item.sub && <p className="text-[10.5px] text-[#94A3B8]">{item.sub}</p>}
                      </Td>
                      <Td className="tabular-nums">{item.hsn || "998315"}</Td>
                      <Td className="tabular-nums">{item.quantity || 1}</Td>
                      <Td className="tabular-nums">{fmt(item.taxable)}</Td>
                      <Td right className="font-semibold tabular-nums">{fmt(item.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-[#94A3B8] mb-6 pl-2 leading-relaxed">
              * Total price of ₹&nbsp;{fmt(total)} is GST-inclusive. The breakdown below is for tax reporting purposes only — no additional amount is charged.
            </p>

            {/* Totals */}
            <div className="flex justify-end mb-8 pl-1">
              <div className="w-full max-w-[300px] space-y-1.5">
                <TotalRow label="Taxable value" value={`₹ ${fmt(taxable)}`} />
                <TotalRow label="CGST @ 9%"      value={`₹ ${fmt(cgst)}`} />
                <TotalRow label="SGST @ 9%"      value={`₹ ${fmt(sgst)}`} />
                <div className="h-px bg-[#E2E8F0] my-2.5" />
                <TotalRow label="Total (INR)"   value={`₹ ${fmt(total)}`} bold accent big />
                {isPaid && <TotalRow label="Amount paid" value={`₹ ${fmt(total)}`} bold />}
                {isPaid && <TotalRow label="Balance due"  value="₹ 0.00"           muted />}
              </div>
            </div>

            {/* Items activated */}
            {rows.length > 0 && (
              <div className="mb-7 pl-1">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.12em] mb-2.5">Items activated</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((item, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${
                          item.type === "plan"
                            ? "bg-[#EEF2FF] text-[#1E3A8A]"
                            : "bg-[#ECFDF5] text-[#047857]"
                        }`}
                      >
                        {item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-6 border-t border-[#E2E8F0] pl-1">
              <p className="text-[10px] text-[#94A3B8] text-center leading-relaxed">
                This is a computer-generated tax invoice and does not require a physical signature.
                <br />
                GST is included in the price as per CGST + SGST provisions under the GST Act, 2017.
                <br />
                For queries, write to <span className="text-[#1E3A8A] font-medium">{company.email}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
        accent
          ? "bg-[#1E3A8A] text-white hover:bg-[#1E2F6E]"
          : "border border-[#CBD5E1] text-[#475569] hover:bg-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusPill({ isPaid, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wide ${
      isPaid ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF7ED] text-[#C2410C]"
    }`}>
      {isPaid && <CheckIcon />}
      {label?.toUpperCase()}
    </span>
  );
}

function TypeTag({ type }) {
  const isPlan = type === "plan";
  return (
    <span className={`text-[8.5px] font-bold px-1.5 py-[1px] rounded uppercase tracking-wide ${
      isPlan ? "bg-[#EEF2FF] text-[#1E3A8A]" : "bg-[#ECFDF5] text-[#047857]"
    }`}>
      {isPlan ? "Plan" : "Add-on"}
    </span>
  );
}

function MetaRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-1">
      <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{label}</span>
      <span className={`text-[11px] font-semibold text-[#0F172A] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Th({ children, left, right }) {
  return (
    <th className={`px-4 py-3 text-[9.5px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] whitespace-nowrap ${left ? "text-left" : right ? "text-right" : "text-center"}`}>
      {children}
    </th>
  );
}

function Td({ children, left, right, className = "" }) {
  return (
    <td className={`px-4 py-3 text-[#475569] ${left ? "text-left" : right ? "text-right" : "text-center"} ${className}`}>
      {children}
    </td>
  );
}

function TotalRow({ label, value, bold, accent, muted, big }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] ${bold ? "font-bold text-[#0F172A]" : muted ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
        {label}
      </span>
      <span className={`tabular-nums ${
        bold && accent ? `font-bold text-[#1E3A8A] ${big ? "text-[15px]" : "text-[12px]"}`
        : bold ? "text-[12px] font-bold text-[#0F172A]"
        : muted ? "text-[12px] text-[#94A3B8]"
        : "text-[12px] text-[#0F172A]"
      }`}>
        {value}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
