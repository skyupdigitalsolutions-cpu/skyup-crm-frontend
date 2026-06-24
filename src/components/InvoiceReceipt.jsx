// ─────────────────────────────────────────────────────────────────────────────
//  InvoiceReceipt.jsx
//
//  Professional GST tax invoice (card layout). Renders the plan + every add-on
//  bought in the same checkout as its own row, with the columns:
//    SL.No. · Description · Tax Rate · Qty · Rate · Amount
//
//  Key behaviours
//  • Every line `amount` is GST-INCLUSIVE. The taxable value and tax are derived
//    from it; the breakdown is shown for reporting only and never added on top.
//  • GST split is location-aware: if the customer's state code equals the
//    seller's (Karnataka / 29) it is an INTRA-state supply → CGST + SGST.
//    Otherwise it is an INTER-state supply → IGST. Pass customer.stateCode
//    (the 2-digit GST state code) to drive this; it also auto-derives from the
//    first two digits of customer.gstin when stateCode is absent.
//  • Tax breakdown always sums EXACTLY back to the inclusive total (CGST/SGST
//    are computed as half + residual to avoid ±0.01 rounding drift).
//
//  USAGE:
//    <InvoiceReceipt invoice={invoiceData} company={companyDetails} onClose={fn} />
//
//  invoiceData shape (unchanged from before, plus optional customer.stateCode):
//  {
//    invoiceId, date, planName, billingCycle, baseAmount,
//    transactionId, paymentMethod, status,
//    lineItems: [{ type:"plan"|"addon", name, sub, quantity, amount }],
//    activated: ["Growth Plan · Monthly", ...],   // optional chips
//    customer: { name, email, address, gstin, stateCode }
//  }
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";

// ── Brand / seller constants ─────────────────────────────────────────────────
const COMPANY_LOGO_URL = "/skyup_logo1.svg"; // null → "S" monogram
const SELLER_STATE_CODE = "29";                      // Karnataka
const HSN_SAC = "998315";                            // SAC for the service
const GST_RATE = 0.18;

const BRAND = "#000000";
const INK   = "#000000";
const MUTED = "#000000";
const LINE  = "#000000";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function stateCodeOf(invoice) {
  const c = invoice.customer || {};
  if (c.stateCode) return String(c.stateCode).trim();
  if (c.gstin && /^\d{2}/.test(c.gstin)) return c.gstin.slice(0, 2);
  return null;
}

// Indian-format amount in words (rupees + paise).
function amountInWords(num) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x) => (x < 20 ? ones[x] : (tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "")).trim());
  const three = (x) => {
    const h = Math.floor(x / 100), r = x % 100;
    let s = "";
    if (h) s += ones[h] + " Hundred" + (r ? " and " : "");
    if (r) s += two(r);
    return s.trim();
  };
  let rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let w;
  if (rupees === 0) w = "Zero";
  else {
    const cr = Math.floor(rupees / 10000000); rupees %= 10000000;
    const la = Math.floor(rupees / 100000);   rupees %= 100000;
    const th = Math.floor(rupees / 1000);     rupees %= 1000;
    const hu = rupees;
    const parts = [];
    if (cr) parts.push(three(cr) + " Crore");
    if (la) parts.push(three(la) + " Lakh");
    if (th) parts.push(three(th) + " Thousand");
    if (hu) parts.push(three(hu));
    w = parts.join(" ").trim();
  }
  let out = "Indian Rupees " + w;
  if (paise) out += ` and ${paise}/100`;
  return out + " Only";
}

// Build GST-split rows. Each line `amount` is GST-inclusive.
function buildRows(invoice) {
  const raw =
    Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          {
            type: "plan",
            name: invoice.planName || "SkyUp CRM Subscription",
            sub:
              invoice.billingCycle === "yearly" ? "Annual subscription (12 months)"
              : invoice.billingCycle === "monthly" ? "Monthly subscription (1 month)"
              : "One-time purchase",
            quantity: 1,
            amount: invoice.baseAmount,
          },
        ];

  return raw.map((item, i) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const amount = +(Number(item.amount) || 0).toFixed(2);   // GST-inclusive
    const taxable = +(amount / (1 + GST_RATE)).toFixed(2);
    const rate = +(taxable / qty).toFixed(2);                // per-unit, pre-GST
    const tax = +(amount - taxable).toFixed(2);
    return { ...item, sl: i + 1, quantity: qty, amount, taxable, rate, tax };
  });
}

// ── PDF download via the browser's native print-to-PDF ───────────────────────
function printToPdf(node, title) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(`
    <html><head><title>${title}</title><meta charset="utf-8"/>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#fff;color:${INK};-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        @page{size:A4;margin:14mm;}
      </style>
    </head><body>${node.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 250);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InvoiceReceipt({ invoice, company: companyProp, onClose }) {
  const printRef = useRef(null);

  const company = {
    name:    "SKYUP DIGITAL SOLUTIONS LLP",
    addr1:   "Parinidhi #23, E Block, 14th A Main Road",
    addr2:   "2nd Floor, Sahakaranagar, Bangalore - 560092",
    gstin:   "29AFUFS6710EIZJ",
    state:   "Karnataka",
    stateCode: SELLER_STATE_CODE,
    ...companyProp,
  };

  const rows    = buildRows(invoice);
  const taxable = +rows.reduce((s, r) => s + r.taxable, 0).toFixed(2);
  const taxTot  = +rows.reduce((s, r) => s + r.tax,     0).toFixed(2);
  const total   = +rows.reduce((s, r) => s + r.amount,  0).toFixed(2);

  const custCode = stateCodeOf(invoice);
  const intra = custCode ? custCode === company.stateCode : true; // default intra
  // Split exactly: CGST = half (rounded), SGST = residual.
  const cgst = intra ? +(taxTot / 2).toFixed(2) : 0;
  const sgst = intra ? +(taxTot - cgst).toFixed(2) : 0;
  const igst = intra ? 0 : taxTot;

  const isPaid   = (invoice.status || "Paid") === "Paid";
  const customer = invoice.customer || {};
  const activated = Array.isArray(invoice.activated) ? invoice.activated : [];

  function handlePrint() {
    if (printRef.current) printToPdf(printRef.current, invoice.invoiceId || "invoice");
  }

  const COLS = "42px 1fr 70px 46px 96px 108px";

  return (
    <div
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#0B0D14]/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="w-full max-w-[640px]">

        {/* ── Toolbar (not printed) ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
          <button onClick={handlePrint} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, background:"#1d4ed8" , color: "#fff", border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            <DownloadIcon /> Download PDF
          </button>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 8, border: "none", background: "#ffffff",
            color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CloseIcon />
          </button>
        </div>

        {/* ── Printable invoice card ── */}
        <div ref={printRef}>
          <div style={{
            background: "#fff", border: "1px solid #e6e8ee", borderRadius: 16,
            padding: "30px 32px", boxShadow: "0 8px 30px rgba(0,0,0,.06)",
          }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 12 }}>
                {COMPANY_LOGO_URL ? (
                  <img src={COMPANY_LOGO_URL} alt={company.name}
                    style={{ width: 34, height: 34, borderRadius: 9, objectFit: "contain", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, background: BRAND, color: "#fff",
                    fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0,
                  }}>S</div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.2px" }}>{company.name}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
                    {company.addr1},<br />{company.addr2}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                    <div><b>GSTIN:</b> {company.gstin}</div>
                    <div><b>HSN/SAC:</b> {HSN_SAC}</div>
                  </div>
                </div>
              </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px" }}>INVOICE</div>

  <StatusPill isPaid={isPaid} />

  <div style={{ display: "inline-block", textAlign: "left", marginTop: 12 }}>
    <table style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={{ fontSize: 11, color: MUTED, fontWeight: 700, padding: "2px 0", paddingRight: 10 }}>INVOICE NO.</td>
          <td style={{ fontSize: 11, fontWeight: 700, padding: "2px 0" }}>{invoice.invoiceId}</td>
        </tr>
        <tr>
          <td style={{ fontSize: 11, color: MUTED, fontWeight: 700, padding: "2px 0", paddingRight: 10 }}>DATE</td>
          <td style={{ fontSize: 11, padding: "2px 0" }}>{invoice.date}</td>
        </tr>
        {invoice.transactionId && (
          <tr>
            <td style={{ fontSize: 11, color: MUTED, fontWeight: 700, padding: "2px 0", paddingRight: 10 }}>TXN ID</td>
            <td style={{ fontSize: 11, padding: "2px 0" }}>{invoice.transactionId}</td>
          </tr>
        )}
        <tr>
          <td style={{ fontSize: 11, color: MUTED, fontWeight: 700, padding: "2px 0", paddingRight: 10 }}>PAID VIA</td>
          <td style={{ fontSize: 11, padding: "2px 0" }}>{invoice.paymentMethod || "Razorpay"}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
            </div>
            <div style={{ height: 1, background: "#e9e9e9", margin: "20px 0" }} />

            {/* Bill To */}
            <div>
              <SectionLabel>Bill To</SectionLabel>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#000000" }}>{customer.name || "—"}</div>
              {customer.email && <div style={{ fontSize: 12, color: BRAND, marginTop: 2 }}>{customer.email}</div>}
              {customer.address && <div style={{ fontSize: 12, marginTop: 3 }}>{customer.address}</div>}
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {customer.gstin && <><b>GSTIN:</b> {customer.gstin}</>}
                {custCode && <> &nbsp;·&nbsp;  <b>State:</b>{custCode}{intra ? "" : ""}</>}
              </div>
            </div>

            {/* Line items: SL.No. / Description / Tax Rate / Qty / Rate / Amount */}
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: "grid", gridTemplateColumns: COLS, padding: "9px 0",
                borderBottom: "2px solid #000", fontSize: 12, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: ".4px",
              }}>
                <div style={{ textAlign: "center" }}>SL.No.</div>
                <div>Description</div>
                <div style={{ textAlign: "center" }}>Tax Rate</div>
                <div style={{ textAlign: "center" }}>Qty</div>
                <div style={{ textAlign: "right" }}>Rate</div>
                <div style={{ textAlign: "right" }}>Amount</div>
              </div>

              {rows.map((r) => (
                <div key={r.sl} style={{
                  display: "grid", gridTemplateColumns: COLS, alignItems: "center",
                  padding: "13px 0", borderBottom: `1px solid ${LINE}`,
                }}>
                  <div style={{ fontSize: 12, textAlign: "center" }}>{r.sl}</div>
                  <div>
                    <TypeTag type={r.type} />
                    <span style={{ fontSize: 12, fontWeight: 600, verticalAlign: "middle", marginLeft: 7 }}>{r.name}</span>
                    {r.sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{r.sub}</div>}
                  </div>
                  <div style={{ fontSize: 12, textAlign: "center" }}>18%</div>
                  <div style={{ fontSize: 12, textAlign: "center" }}>{r.quantity}</div>
                  <div style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.rate)}</div>
                  <div style={{ fontSize: 12, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(r.amount)}</div>
                </div>
              ))}
            </div>



            {/* Summary */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <div style={{ width: 280 }}>
                <SumRow label="Taxable Value" value={`Rs. ${fmt(taxable)}`} />
                {intra ? (
                  <>
                    <SumRow label="CGST @ 9%" value={`Rs. ${fmt(cgst)}`} />
                    <SumRow label="SGST @ 9%" value={`Rs. ${fmt(sgst)}`} />
                  </>
                ) : (
                  <SumRow label="IGST @ 18%" value={`Rs. ${fmt(igst)}`} />
                )}
                <div style={{ height: 1, background: "#000", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Total (INR)</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: BRAND, fontVariantNumeric: "tabular-nums" }}>Rs. {fmt(total)}</span>
                </div>
                <SumRow label="Amount Paid" value={`Rs. ${fmt(isPaid ? total : 0)}`} small />

              </div>
            </div>

            {/* Amount in words + GST treatment */}
            <div style={{ marginTop: 14, fontSize: 12 }}>
              <b>In words:</b> {amountInWords(total)} &nbsp;·&nbsp;
              <span style={{ color: MUTED }}>{intra ? "Intra-state supply" : "Inter-state supply"}</span>
            </div>

            {/* Items activated */}
            {activated.length > 0 && (
              <div style={{ marginTop: 20, border: "1px solid #e6e8ee", borderRadius: 12, padding: "14px 16px" }}>
                <SectionLabel>Items Activated</SectionLabel>
                <div style={{ marginTop: 9 }}>
                  {activated.map((c, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 600, color: BRAND, marginRight: 18 }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: 9.5, color: MUTED, marginTop: 22, lineHeight: 1.7 }}>
              This is a computer-generated tax invoice and does not require a physical signature.<br />
              GST is included in the price as per the GST Act, 2017.<br />
              For queries: <span style={{ color: BRAND }}>{company.email}</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".7px", color: MUTED, marginBottom: 7 }}>
      {children}
    </div>
  );
}

function SumRow({ label, value, small }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: small ? 11 : 12, fontWeight: small ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: small ? 11 : 12, fontWeight: small ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function StatusPill({ isPaid }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 11px",
      borderRadius: 12, fontSize: 9, fontWeight: 800, letterSpacing: ".5px",
      border: `1px solid ${isPaid ? "#047857" : "#9a3412"}`,
      color: isPaid ? "#047857" : "#9a3412", background: "#fff",
    }}>
      {isPaid && <CheckIcon />}{isPaid ? "PAID" : "PENDING"}
    </span>
  );
}

function TypeTag({ type }) {
  const isPlan = type === "plan";
  const col = isPlan ? BRAND : "#047857";
  return (
    <span style={{
      display: "inline-block", fontSize: 8.5, fontWeight: 800, letterSpacing: ".5px",
      color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "1px 5px", verticalAlign: "middle",
    }}>
      {isPlan ? "PLAN" : "ADD-ON"}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
