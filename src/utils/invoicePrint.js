// utils/invoicePrint.js
// Renders a finance invoice as a clean A4 page and opens the print dialog
// ("Save as PDF" gives the file to send the client).
//   doc = { invoice, seller } as returned by
//         GET /finance/my/:id/document   (employee)
//         GET /finance-panel/:id         (finance team, plus seller)
//   win = a window opened during the click (pop-up blockers reject
//         window.open() after an await). Optional.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const lines = (s) => esc(s).replace(/\n/g, "<br>");

export function invoiceFileName(inv) {
  const num = String(inv?.invoiceNumber || "invoice").replace(/[^a-zA-Z0-9-]+/g, "-");
  const who = String(inv?.customerName || "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Invoice-${num}${who ? `-${who}` : ""}`;
}

export function printInvoice({ invoice: inv, seller = {} }, win = null) {
  const payments = [...(inv.payments || [])].sort((a, b) => new Date(a.paidOn) - new Date(b.paidOn));
  const q = inv.quotationInfo;
  const balance = Number(inv.balance) || 0;
  const status = inv.paymentStatus === "paid" ? "PAID" : inv.paymentStatus === "partial" ? "PARTLY PAID" : "";

  const rows = (inv.services || []).length
    ? inv.services.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td class="n">${inr(s.amount)}</td></tr>`).join("")
    : `<tr><td>1</td><td>${esc(inv.service || inv.description || "Services")}</td><td class="n">${inr(inv.totalAmount)}</td></tr>`;

  const sellerLines = [
    seller.address && lines(seller.address),
    seller.gstin && `GSTIN: ${esc(seller.gstin)}`,
    [seller.phone, seller.email].filter(Boolean).map(esc).join(" · "),
    seller.website && esc(seller.website),
  ].filter(Boolean).map((x) => `<div>${x}</div>`).join("");

  const billTo = [
    inv.businessName && `<div style="font-weight:bold">${esc(inv.businessName)}</div>`,
    inv.clientAddress && `<div>${lines(inv.clientAddress)}</div>`,
    inv.clientGSTIN && `<div>GSTIN: ${esc(inv.clientGSTIN)}</div>`,
  ].filter(Boolean).join("");

  const paymentRows = payments.map((p) =>
    `<tr><td>${esc(day(p.paidOn))}</td><td>${esc([p.method, p.reference].filter(Boolean).join(" · ") || "—")}</td><td class="n">${inr(p.amount)}</td></tr>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoiceFileName(inv))}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12.5px; margin: 0; }
  @media screen { body { max-width: 800px; margin: 24px auto; padding: 0 24px; } }
  .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .top img { max-height: 56px; max-width: 200px; display: block; margin-bottom: 6px; }
  .seller-name { font-size: 16px; font-weight: bold; }
  .muted { color: #555; }
  h1 { font-size: 24px; letter-spacing: 2px; margin: 0 0 6px; text-align: right; }
  .meta td { padding: 2px 0 2px 12px; text-align: right; }
  .stamp { display: inline-block; border: 2px solid #15803d; color: #15803d; font-weight: bold; padding: 2px 10px; margin-top: 6px; letter-spacing: 1px; }
  .stamp.partial { border-color: #b45309; color: #b45309; }
  .label { font-size: 10.5px; text-transform: uppercase; color: #555; margin: 16px 0 4px; letter-spacing: .5px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.items th { background: #f2f2f2; text-align: left; font-size: 10.5px; text-transform: uppercase; }
  table.items th, table.items td { border: 1px solid #ddd; padding: 7px 8px; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 290px; border-collapse: collapse; margin-top: 10px; }
  .totals td { padding: 4px 0; }
  .totals .grand td { border-top: 2px solid #111; font-weight: bold; font-size: 14px; padding-top: 7px; }
  .due td { font-weight: bold; color: ${balance > 0 ? "#b91c1c" : "#15803d"}; }
  .two { display: flex; gap: 24px; margin-top: 18px; }
  .two > div { flex: 1; }
  .box { border: 1px solid #ddd; padding: 8px 10px; white-space: normal; }
  .sign { text-align: right; margin-top: 36px; }
  .sign .line { display: inline-block; border-top: 1px solid #111; padding-top: 4px; min-width: 180px; text-align: center; }
  .foot { margin-top: 24px; font-size: 10.5px; color: #777; text-align: center; }
</style></head><body>
  <div class="top">
    <div>
      ${seller.logo ? `<img src="${esc(seller.logo)}" alt="">` : ""}
      ${seller.name ? `<div class="seller-name">${esc(seller.name)}</div>` : ""}
      <div class="muted">${sellerLines}</div>
    </div>
    <div>
      <h1>INVOICE</h1>
      <table class="meta">
        <tr><td class="muted">Invoice no.</td><td><b>${esc(inv.invoiceNumber)}</b></td></tr>
        <tr><td class="muted">Date</td><td>${esc(day(inv.createdAt || inv.conversionDate))}</td></tr>
        ${q?.number ? `<tr><td class="muted">Quotation ref.</td><td>${esc(q.number)}</td></tr>` : ""}
      </table>
      ${status ? `<div style="text-align:right"><span class="stamp ${status === "PAID" ? "" : "partial"}">${status}</span></div>` : ""}
    </div>
  </div>

  <div class="label">Bill to</div>
  <div style="font-size:14px;font-weight:bold">${esc(inv.customerName)}</div>
  ${billTo}

  <table class="items">
    <thead><tr><th style="width:36px">#</th><th>Description</th><th class="n" style="width:140px">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr class="grand"><td>Total</td><td class="n">${inr(inv.totalAmount)}</td></tr>
    ${Number(inv.paidAmount) > 0 ? `<tr><td>Paid</td><td class="n">${inr(inv.paidAmount)}</td></tr>` : ""}
    <tr class="due"><td>${balance > 0 ? "Balance due" : "Balance"}</td><td class="n">${inr(balance)}</td></tr>
  </table>

  ${payments.length ? `<div class="label">Payments received</div>
  <table class="items"><thead><tr><th style="width:120px">Date</th><th>Method / reference</th><th class="n" style="width:140px">Amount</th></tr></thead><tbody>${paymentRows}</tbody></table>` : ""}

  ${(seller.bankDetails || seller.terms) ? `<div class="two">
    ${seller.bankDetails ? `<div><div class="label">Payment details</div><div class="box">${lines(seller.bankDetails)}</div></div>` : ""}
    ${seller.terms ? `<div><div class="label">Terms</div><div class="box">${lines(seller.terms)}</div></div>` : ""}
  </div>` : ""}

  <div class="sign"><div class="line">${esc(seller.signatory || (seller.name ? `For ${seller.name}` : "Authorised signatory"))}</div></div>
  <div class="foot">This is a computer-generated invoice.</div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;

  const w = win || window.open("", "_blank");
  if (!w) { alert("Allow pop-ups for this site to download the invoice."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
