// ─────────────────────────────────────────────────────────────────────────────
// Shared report export — CSV download + clean printable PDF window.
//
// Used by every performance report tab (Meta Performance, Meta Ad-Level,
// Google Ads, Website) so they export identically.
//
// Why not window.print() on the live page?
//   The old approach hid the live DOM with `body * { visibility:hidden }` and
//   revealed a `.print-area`. That inherited dark-mode colours, clipped charts
//   and paginated badly. Instead we build a clean, self-contained document from
//   the report DATA and print THAT — so the output is consistent light-theme,
//   A4-friendly, and identical regardless of what's on screen.
//
// Shape used by both exporters:
//   {
//     title:     "Meta Ad Performance",
//     subtitle:  "Spend, CPM, CPC …",              // optional
//     rangeText: "2026-06-27 → 2026-07-27",         // optional
//     kpis:      [{ label: "Spend", value: "₹1,234" }, …],
//     sections:  [{ heading: "Campaign Breakdown",
//                   columns: ["Campaign", "Spend", "Leads"],
//                   rows:    [["Summer Sale", "₹800", "12"], …] }],
//     brand:     "Skyup Digital Solutions",         // optional
//   }
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_DEFAULT = "Skyup Digital Solutions";

const esc = (v) => (v == null ? "" : String(v));

function escapeHtml(v) {
  return esc(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stamp() {
  const d = new Date();
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function safeFilePart(s) {
  return esc(s).replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "report";
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function csvCell(v) {
  const s = esc(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Download the report as a CSV file. Includes title, range, a KPI block and
 * every section table. Opens in Excel / Google Sheets cleanly (UTF-8 BOM).
 */
export function exportReportCSV(report) {
  const { title = "Report", rangeText = "", kpis = [], sections = [] } = report || {};
  const lines = [];

  lines.push([title]);
  if (rangeText) lines.push([`Date range: ${rangeText}`]);
  lines.push([`Generated: ${stamp()}`]);
  lines.push([]);

  if (kpis.length) {
    lines.push(["Summary"]);
    kpis.forEach((k) => lines.push([k.label, k.value]));
    lines.push([]);
  }

  sections.forEach((sec) => {
    if (sec.heading) lines.push([sec.heading]);
    if (sec.columns && sec.columns.length) lines.push(sec.columns);
    (sec.rows || []).forEach((r) => lines.push(r));
    lines.push([]);
  });

  const csv = lines.map((row) => (row || []).map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const filename = `${safeFilePart(title)}_${new Date().toISOString().slice(0, 10)}.csv`;
  triggerDownload(blob, filename);
}

// ── Printable PDF (clean window) ───────────────────────────────────────────────
function kpiHtml(kpis) {
  if (!kpis || !kpis.length) return "";
  const cells = kpis
    .map(
      (k) => `
      <div class="kpi">
        <span class="kpi-l">${escapeHtml(k.label)}</span>
        <span class="kpi-v">${escapeHtml(k.value)}</span>
      </div>`
    )
    .join("");
  return `<div class="kpis">${cells}</div>`;
}

function sectionHtml(sec) {
  const head = sec.heading ? `<h2>${escapeHtml(sec.heading)}</h2>` : "";
  const cols = (sec.columns || []).map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = (sec.rows || [])
    .map((r) => `<tr>${(r || []).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  if (!cols && !body) return head + `<p class="muted">No data in this period.</p>`;
  return `
    ${head}
    <table>
      <thead><tr>${cols}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

/**
 * Open a clean, self-contained window with the report and trigger the browser's
 * print dialog (user chooses "Save as PDF"). Falls back to an alert if the
 * pop-up is blocked.
 */
export function exportReportPDF(report) {
  const {
    title = "Report",
    subtitle = "",
    rangeText = "",
    kpis = [],
    sections = [],
    brand = BRAND_DEFAULT,
  } = report || {};

  const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=1200");
  if (!w) {
    alert("Please allow pop-ups for this site to export the report as PDF.");
    return;
  }

  const css = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0F1117;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 28px 32px; }
    .top { display: flex; align-items: flex-start; justify-content: space-between;
      border-bottom: 2px solid #04050C; padding-bottom: 14px; margin-bottom: 20px; }
    .brand { font-size: 13px; font-weight: 800; letter-spacing: .3px; color: #2E6BFF; text-transform: uppercase; }
    h1 { font-size: 22px; font-weight: 800; margin: 6px 0 2px; }
    .sub { font-size: 12px; color: #6B7280; }
    .meta { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.5; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 22px; }
    .kpi { border: 1px solid #E4E7EF; border-radius: 10px; padding: 10px 12px; }
    .kpi-l { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: #8B92A9; margin-bottom: 4px; }
    .kpi-v { display: block; font-size: 16px; font-weight: 800; color: #0F1117; }
    h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
      color: #4B5168; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { text-align: left; background: #F1F3F9; color: #4B5168; font-weight: 700;
      padding: 7px 8px; border: 1px solid #E4E7EF; text-transform: uppercase; font-size: 9px; letter-spacing: .4px; }
    tbody td { padding: 6px 8px; border: 1px solid #E4E7EF; color: #0F1117; }
    tbody tr:nth-child(even) td { background: #Fafbfc; }
    .muted { font-size: 12px; color: #8B92A9; }
    .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E4E7EF;
      font-size: 10px; color: #9CA3AF; text-align: center; }
    @page { size: A4; margin: 14mm; }
    @media print { .no-print { display: none !important; } thead { display: table-header-group; } tr { break-inside: avoid; } }
  `;

  const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <div class="brand">${escapeHtml(brand)}</div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div class="meta">
        ${rangeText ? `<div><b>Period:</b> ${escapeHtml(rangeText)}</div>` : ""}
        <div>Generated ${escapeHtml(stamp())}</div>
      </div>
    </div>
    ${kpiHtml(kpis)}
    ${sections.map(sectionHtml).join("")}
    <div class="foot">${escapeHtml(brand)} · Confidential performance report</div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(doc);
  w.document.close();
}

export default { exportReportCSV, exportReportPDF };
