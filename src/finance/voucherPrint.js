// src/finance/voucherPrint.js — prints a payment voucher laid out like the
// paper voucher book (A5): logo + office address + GST, "PAYMENT VOUCHER",
// Date / Voucher No., Debit Account Head, Date | Details of expenditure | Rs. | Ps.,
// TOTAL / LESS TDS % / PAYABLE TOTAL, RUPEES (in words), CASH / Cheque No. /
// Online Payment, and the Particulars block — left BLANK for names and
// signatures by hand.
import { SKYUP_LOGO, isSkyupCompany } from "../assets/skyupLogo";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rs = (n) => Math.floor(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN");
const ps = (n) => String(Math.round((Number(n) || 0) * 100) % 100).padStart(2, "0");
const d2 = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const MIN_ROWS = 7;   // the paper voucher has 7 ruled rows above TOTAL

function payLine(v) {
  if (v.paymentMode === "cheque") return `Cheque No. ${esc(v.paymentRef)}`;
  if (v.paymentMode === "online") return `Online Payment${v.paymentRef ? ` — ${esc(v.paymentRef)}` : ""}`;
  return "Cash";
}

// Exactly the paper layout. Only the blanks are filled in; nothing is added.
function oneVoucher(v, coIn) {
  // Skyup's vouchers always carry the real Skyup logo (header + watermark).
  const co = isSkyupCompany(coIn) ? { ...coIn, logo: SKYUP_LOGO } : coIn;
  const lines = v.lines || [];
  const blanks = Math.max(0, MIN_ROWS - lines.length);
  const rows = lines.map((l) => `<tr><td class="c">${esc(d2(l.date))}</td><td>${esc(l.details)}</td><td class="r">${l.amount ? rs(l.amount) : ""}</td><td class="c">${l.amount ? ps(l.amount) : ""}</td></tr>`).join("")
    + Array.from({ length: blanks }, () => `<tr><td></td><td></td><td></td><td></td></tr>`).join("");
  const [addr1, ...addrRest] = String(co.address || "").split("\n").map((x) => x.trim()).filter(Boolean);
  return `
  <section class="v">
    ${co.logo ? `<img class="wm" src="${esc(co.logo)}" alt="">` : ""}
    <header>
      ${co.logo ? `<img class="logo" src="${esc(co.logo)}" alt="">` : `<div class="cname">${esc(co.name)}</div>`}
      ${addr1 ? `<div class="addr"><b>Office Address:</b> ${esc(addr1)}${addrRest.map((x) => `<br>${esc(x)}`).join("")}</div>` : ""}
      ${co.gstin ? `<div class="addr">GST No.: ${esc(co.gstin)}</div>` : ""}
    </header>
    <div class="titlebar">
      <div></div>
      <div class="title">PAYMENT VOUCHER</div>
      <div class="date">Date:<span class="dots">${esc(d2(v.voucherDate))}</span></div>
    </div>
    <div class="head">Debit Account Head<span class="dots">${esc(v.debitAccountHead)}</span></div>
    <table class="grid">
      <colgroup><col style="width:16%"><col style="width:53%"><col style="width:17%"><col style="width:14%"></colgroup>
      <thead><tr><th>Date</th><th>Details of expenditure</th><th>Rs.</th><th>Ps.</th></tr></thead>
      <tbody>${rows}
        <tr><td></td><td class="lbl">TOTAL</td><td class="r">${rs(v.total)}</td><td class="c">${ps(v.total)}</td></tr>
        <tr><td></td><td class="lbl">LESS TDS ${Number(v.tdsPercent) ? `${esc(v.tdsPercent)} ` : ""}%</td><td class="r">${v.tdsAmount ? rs(v.tdsAmount) : ""}</td><td class="c">${v.tdsAmount ? ps(v.tdsAmount) : ""}</td></tr>
        <tr><td></td><td class="lbl">PAYABLE TOTAL</td><td class="r">${rs(v.payableTotal)}</td><td class="c">${ps(v.payableTotal)}</td></tr>
      </tbody>
    </table>
    <div class="box">
      <div class="ln">RUPEES<span class="dots">${esc(v.amountInWords)}</span></div>
      <div class="ln">CASH/Cheque No./ Online Payment :<span class="dots">${payLine(v)}</span></div>
    </div>
    <table class="sig">
      <colgroup><col style="width:28%"><col style="width:41%"><col style="width:31%"></colgroup>
      <tr><th class="l">Particulars</th><th>Name</th><th>Signature</th></tr>
      <tr><td>Amount received by</td><td></td><td></td></tr>
      <tr><td>Voucher Prepared by</td><td></td><td></td></tr>
      <tr><td>Authorised Person</td><td></td><td></td></tr>
    </table>
    ${v.status === "cancelled" ? `<div class="stamp">CANCELLED</div>` : ""}
  </section>`;
}

// copies: how many identical copies to print (the book's carbon copy has no label)
export function renderVoucherHtml(v, co = {}, { copies = [""], preview = false, paper = "A5" } = {}) {
  const pages = copies.map(() => oneVoucher(v, co)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Payment voucher</title>
<style>
  @page { size: ${paper}; margin: 7mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; color: #111; font-size: 12.5px; }
  .v { position: relative; border: 1.2px solid #222; padding: 9px 0 0; break-after: page; page-break-after: always; overflow: hidden; }
  .v:last-child { break-after: auto; page-break-after: auto; }
  .wm { position: absolute; left: 50%; top: 50%; width: 56%; transform: translate(-50%, -50%); opacity: .08; filter: grayscale(1); z-index: 0; pointer-events: none; }
  .v > header, .v > .titlebar, .v > .head, .v > table, .v > .box { position: relative; z-index: 1; }
  header { text-align: center; font-family: Arial, Helvetica, sans-serif; padding: 0 12px; }
  .logo { height: 12.5mm; max-width: 70mm; object-fit: contain; display: block; margin: 0 auto 3px; }
  .cname { font-size: 17px; font-weight: 800; }
  .addr { font-size: 12.3px; line-height: 1.3; }
  .titlebar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; margin: 5px 12px 0; }
  .title { border: 1.2px solid #222; padding: 1px 7px; font-weight: 700; font-size: 16.5px; letter-spacing: .3px; }
  .date { justify-self: end; display: flex; align-items: baseline; transform: translateY(9px); font-size: 13px; }
  .date .dots { min-width: 105px; }
  .dots { display: inline-block; border-bottom: 1.2px dotted #333; padding: 0 3px 0 4px; line-height: 1.25; }
  .head { display: flex; align-items: baseline; margin: 7mm 12px 3mm; font-size: 13px; }
  .head .dots { width: 74%; }
  table { width: 100%; border-collapse: collapse; }
  .grid { border-top: 1px solid #222; }
  .grid th, .grid td { border: 1px solid #222; padding: 1px 5px; height: 7.6mm; vertical-align: middle; }
  .grid th { font-weight: 400; font-size: 13px; height: 6.8mm; }
  .grid tr > :first-child { border-left: 0; } .grid tr > :last-child { border-right: 0; }
  .grid td.lbl { padding-left: 29%; text-align: left; white-space: nowrap; font-size: 12.5px; }   /* 29% of the table = 55% into the Details column, as printed */
  .r { text-align: right; } .c { text-align: center; }
  .box { border-top: 1px solid #222; padding: 4mm 12px 0.5mm; font-size: 13px; }
  .ln { display: flex; align-items: baseline; margin: 0 0 4.5mm; white-space: nowrap; }
  .ln .dots { flex: 1; white-space: normal; margin-left: 2px; }
  .sig { border-top: 1px solid #222; }
  .sig th, .sig td { border: 1px solid #222; padding: 3px 9px; height: 9.2mm; font-weight: 400; text-align: left; font-size: 13px; }
  .sig th { height: 8mm; } .sig th:not(.l) { text-align: center; }
  .sig tr > :first-child { border-left: 0; } .sig tr > :last-child { border-right: 0; } .sig tr:last-child > * { border-bottom: 0; }
  .stamp { position: absolute; z-index: 2; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg); border: 4px solid #c0392b; color: #c0392b;
           font: 800 36px Arial, sans-serif; padding: 4px 18px; opacity: .55; letter-spacing: 3px; }
  @media screen { body { background: #e5e7eb; padding: 16px; } .v { background: #fff; max-width: 134mm; margin: 0 auto 16px; box-shadow: 0 2px 10px rgba(0,0,0,.2); } }
  ${preview ? `.pv { background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:6px 10px; font: 12px Arial, sans-serif; max-width:134mm; margin:0 auto 8px; } @media print { .pv { display: none; } }` : ""}
</style></head><body>
  ${preview ? `<div class="pv"><b>Preview — not saved yet.</b> This banner doesn't print.</div>` : ""}
  ${pages}
  ${preview ? "" : `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>`}
</body></html>`;
}

export function printVoucher(v, co, opts = {}, win = null) {
  const w = win || window.open("", "_blank");
  if (!w) { alert("Allow pop-ups for this site to print the voucher."); return; }
  w.document.open(); w.document.write(renderVoucherHtml(v, co, opts)); w.document.close();
}
