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
//    invoiceId:     "Invoice1",
//    date:          "22 Jun 2025",
//    planName:      "Growth Plan + WhatsApp Blast, AI Credits Pack × 2",
//    billingCycle:  "monthly" | "yearly" | "one_time",
//    baseAmount:    4098,
//    transactionId: "pay_mK3dL9nQrT2",
//    paymentMethod: "Razorpay",
//    status:        "Paid" | "Pending",
//    lineItems: [
//      {
//        type: "plan" | "addon",
//        name: "SkyUp CRM — Growth Plan",
//        sub:  "Monthly subscription (1 month)",
//        hsn:  "998315",
//        quantity: 1,
//        billingPeriod: "monthly",
//        autoRenew: true,
//        amount: 2117.80,
//      },
//      ...
//    ],
//    customer: {
//      name:    "Acme Corp Pvt Ltd",
//      email:   "billing@acmecorp.com",
//      address: "12, MG Road, Bengaluru - 560001",
//      gstin:   "29AABCU9603R1ZX",
//    }
//  }
//
//  NOTE: every line amount is GST-INCLUSIVE. GST is split out per row for
//  the tax breakdown table, not added on top of the total.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";

// ── SET YOUR LOGO HERE ────────────────────────────────────────────────────────
// FIX: was missing quotes — must be a valid string or null
const COMPANY_LOGO_URL = "/public/skyup_logo1.svg"; // e.g. "/assets/logo.png"
// ─────────────────────────────────────────────────────────────────────────────

const GST_RATE = 0.18;

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── Build the GST-split line items the table renders ─────────────────────────
function buildRows(invoice) {
  const raw =
    Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          {
            type: "plan",
            name: invoice.planName || "SkyUp CRM Subscription",
            sub:
              invoice.billingCycle === "yearly"
                ? "Annual subscription (12 months)"
                : invoice.billingCycle === "monthly"
                ? "Monthly subscription (1 month)"
                : "One-time purchase",
            hsn: "998315",
            quantity: 1,
            amount: invoice.baseAmount,
          },
        ];

  return raw.map((item) => {
    const amount  = +(Number(item.amount) || 0).toFixed(2);
    const taxable = +(amount / (1 + GST_RATE)).toFixed(2);
    // FIX: compute sgst symmetrically to avoid float drift
    const cgst    = +(taxable * (GST_RATE / 2)).toFixed(2);
    const sgst    = +(taxable * (GST_RATE / 2)).toFixed(2);
    return { ...item, amount, taxable, cgst, sgst };
  });
}

// ── PDF download via the browser's native print-to-PDF ───────────────────────
function printToPdf(node, title) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            background: #fff; color: #000000; padding: 0;
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

  const rows    = buildRows(invoice);
  const total   = +rows.reduce((s, r) => s + r.amount,  0).toFixed(2);
  const taxable = +rows.reduce((s, r) => s + r.taxable, 0).toFixed(2);
  const cgst    = +rows.reduce((s, r) => s + r.cgst,    0).toFixed(2);
  const sgst    = +rows.reduce((s, r) => s + r.sgst,    0).toFixed(2);
  const isPaid  = invoice.status === "Paid";

  const logoElement = COMPANY_LOGO_URL ? (
    <img
      src={COMPANY_LOGO_URL}
      alt={company.name}
      style={{ maxHeight: 40, maxWidth: 160, objectFit: "contain", display: "block" }}
    />
  ) : null;

  function handlePrint() {
    if (!printRef.current) return;
    printToPdf(printRef.current, invoice.invoiceId);
  }

  return (
    <div
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#0B0D14]/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="w-full max-w-[680px] bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Toolbar (not printed) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 28px",
            background: "#f0f0f0",
            borderBottom: "0.5px solid #c0c0c0",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#000000",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Tax Invoice
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* FIX: inline styles guarantee solid blue button regardless of Tailwind purge */}
            <button
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 6,
                background: "#1b3a8a",
                color: "#ffffff",
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.01em",
              }}
            >
              <DownloadIcon />
              Download PDF
            </button>
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "#000000",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Printable invoice ── */}
        <div ref={printRef} style={{ background: "#ffffff" }}>
          <div style={{ position: "relative", padding: "32px 32px 28px" }}>

            {/* Accent bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: "#1b3a8a",
              }}
            />

            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
              {/* Company left */}
              <div>
                {logoElement ? (
                  <div style={{ marginBottom: 10 }}>{logoElement}</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: "#1b3a8a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>S</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#000000", letterSpacing: "0.02em" }}>
                      {company.name}
                    </span>
                  </div>
                )}
                <p style={{ fontSize: 11, color: "#000000", lineHeight: 1.6, maxWidth: 250, margin: 0 }}>
                  {company.address}
                </p>
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: "#000000", margin: "2px 0" }}>
                    GSTIN &nbsp;<span style={{ fontWeight: 600 }}>{company.gstin}</span>
                  </p>
                  <p style={{ fontSize: 11, color: "#000000", margin: "2px 0" }}>
                    CIN &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ fontWeight: 600 }}>{company.cin}</span>
                  </p>
                  <p style={{ fontSize: 11, color: "#000000", margin: "2px 0" }}>{company.email}</p>
                </div>
              </div>

              {/* Invoice meta right */}
              <div style={{ textAlign: "right" }}>
                <StatusPill isPaid={isPaid} label={invoice.status} />
                <p style={{ fontSize: 18, fontWeight: 700, color: "#000000", margin: "10px 0 8px", letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                  {invoice.invoiceId}
                </p>
                <MetaRow label="Date"     value={invoice.date} />
                {invoice.dueDate       && <MetaRow label="Due date" value={invoice.dueDate} />}
                {invoice.transactionId && <MetaRow label="Txn ID"   value={invoice.transactionId} mono />}
                <MetaRow label="Paid via" value={invoice.paymentMethod || "Razorpay"} />
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "0.5px", background: "#000000", margin: "0 0 20px" }} />

            {/* ── Bill To ── */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: "#000000", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                Bill to
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#000000", margin: "0 0 3px" }}>
                {invoice.customer?.name || "—"}
              </p>
              {invoice.customer?.email && (
                <p style={{ fontSize: 11, color: "#000000", margin: "2px 0" }}>{invoice.customer.email}</p>
              )}
              {invoice.customer?.address && (
                <p style={{ fontSize: 11, color: "#000000", maxWidth: 280, lineHeight: 1.5, margin: "2px 0" }}>
                  {invoice.customer.address}
                </p>
              )}
              {invoice.customer?.gstin && (
                <p style={{ fontSize: 11, color: "#000000", margin: "4px 0 0" }}>
                  GSTIN &nbsp;<span style={{ fontWeight: 600 }}>{invoice.customer.gstin}</span>
                </p>
              )}
            </div>

            {/* ── Line items table ── */}
            <div
              style={{
                border: "0.5px solid #000000",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11.5,
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "21%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f0f0f0", borderBottom: "0.5px solid #000000" }}>
                    <Th left>Description</Th>
                    <Th>HSN / SAC</Th>
                    <Th>Qty</Th>
                    <Th right>Taxable (₹)</Th>
                    <Th right>Amount (₹)</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: i < rows.length - 1 ? "0.5px solid #d0d0d0" : "none" }}
                    >
                      <Td left>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <TypeTag type={item.type} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#000000" }}>
                            {item.name}
                          </span>
                        </div>
                        {item.sub && (
                          <p style={{ fontSize: 10.5, color: "#000000", margin: 0 }}>{item.sub}</p>
                        )}
                      </Td>
                      <Td center mono>{item.hsn || "998315"}</Td>
                      <Td center mono>{item.quantity || 1}</Td>
                      <Td right mono>{fmt(item.taxable)}</Td>
                      <Td right mono bold>{fmt(item.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 10, color: "#000000", lineHeight: 1.6, margin: "0 0 20px 2px" }}>
              * Total of ₹&nbsp;{fmt(total)} is GST-inclusive. The breakdown below is for tax reporting purposes only — no additional amount is charged.
            </p>

            {/* ── Totals ── */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <div style={{ width: 260 }}>
                <TotalRow label="Taxable value" value={`₹ ${fmt(taxable)}`} />
                <TotalRow label="CGST @ 9%"     value={`₹ ${fmt(cgst)}`} />
                <TotalRow label="SGST @ 9%"     value={`₹ ${fmt(sgst)}`} />
                <div style={{ height: "0.5px", background: "#000000", margin: "8px 0" }} />
                <TotalRow label="Total (INR)"   value={`₹ ${fmt(total)}`} grand />
                {isPaid && <TotalRow label="Amount paid" value={`₹ ${fmt(total)}`} bold />}
                {isPaid && <TotalRow label="Balance due"  value="₹ 0.00"           muted />}
              </div>
            </div>

            {/* ── Items activated ── */}
            {rows.length > 0 && (
              <div
                style={{
                  border: "0.5px solid #000000",
                  borderRadius: 8,
                  background: "#f0f0f0",
                  padding: "14px 16px",
                  marginBottom: 24,
                }}
              >
                <p style={{ fontSize: 9.5, fontWeight: 700, color: "#000000", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                  Items activated
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {rows.map((item, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 11px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        ...(item.type === "plan"
                          ? { background: "#eef2ff", color: "#3730a3" }
                          : { background: "#ecfdf5", color: "#166534" }),
                      }}
                    >
                      {item.name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ borderTop: "0.5px solid #000000", paddingTop: 18, textAlign: "center" }}>
              <p style={{ fontSize: 10.5, color: "#000000", lineHeight: 1.8, margin: 0 }}>
                This is a computer-generated tax invoice and does not require a physical signature.
                <br />
                GST is included in the price as per CGST + SGST provisions under the GST Act, 2017.
                <br />
                For queries, write to{" "}
                <span style={{ color: "#1b3a8a", fontWeight: 500 }}>{company.email}</span>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ isPaid, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        ...(isPaid
          ? { background: "#ecfdf5", color: "#166534" }
          : { background: "#fff7ed", color: "#9a3412" }),
      }}
    >
      {isPaid && <CheckIcon />}
      {label?.toUpperCase()}
    </span>
  );
}

function TypeTag({ type }) {
  const isPlan = type === "plan";
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 4,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        flexShrink: 0,
        ...(isPlan
          ? { background: "#eef2ff", color: "#3730a3" }
          : { background: "#ecfdf5", color: "#166534" }),
      }}
    >
      {isPlan ? "Plan" : "Add-on"}
    </span>
  );
}

function MetaRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: "#000000", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#000000",
          ...(mono ? { fontFamily: "'SF Mono', 'Fira Mono', monospace", fontSize: 10.5 } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Th({ children, left, right }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        fontSize: 9,
        fontWeight: 700,
        color: "#000000",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        textAlign: left ? "left" : right ? "right" : "center",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, left, center, right, mono, bold }) {
  return (
    <td
      style={{
        padding: "11px 14px",
        color: "#000000",
        verticalAlign: "top",
        textAlign: left ? "left" : right ? "right" : "center",
        ...(mono ? { fontVariantNumeric: "tabular-nums", fontSize: 11 } : {}),
        ...(bold ? { fontWeight: 600, fontSize: 11.5 } : {}),
      }}
    >
      {children}
    </td>
  );
}

function TotalRow({ label, value, grand, bold, muted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span
        style={{
          fontSize: grand ? 13 : bold ? 12 : 11.5,
          fontWeight: grand || bold ? 700 : 400,
          color: "#000000",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: grand ? 15 : bold ? 12 : 11.5,
          fontWeight: grand || bold ? 700 : 400,
          color: grand ? "#1b3a8a" : "#000000",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
