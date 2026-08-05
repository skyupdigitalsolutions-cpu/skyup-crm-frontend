// src/utils/sanitizeHtml.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side HTML sanitizer used before any dangerouslySetInnerHTML render.
//
// This is the "clean on the way OUT" layer. It protects against stored XSS even
// for data that was saved BEFORE the backend sanitizer was added (e.g. the
// existing email history already in MongoDB) — nothing dangerous can execute in
// an agent's browser regardless of how it got into the database.
//
// It strips <script>, event handlers (onerror/onclick/…), javascript: URLs,
// <iframe>/<svg onload> and similar, while keeping normal email formatting:
// text styling, inline styles, links, images, tables.
//
//   npm install dompurify
// ─────────────────────────────────────────────────────────────────────────────

import DOMPurify from "dompurify";

// Any link that opens a new tab also gets rel="noopener noreferrer" so the
// opened page can't reach back into this app via window.opener (tab-nabbing).
if (typeof DOMPurify.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Sanitize an HTML string for safe rendering via dangerouslySetInnerHTML.
 * Returns "" for null/empty input so it is always safe to spread into __html.
 *
 * Usage:
 *   import { sanitizeHtml } from "../utils/sanitizeHtml";
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.body) }} />
 */
export function sanitizeHtml(dirty) {
  if (dirty == null || dirty === "") return "";
  return DOMPurify.sanitize(String(dirty), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });
}

export default sanitizeHtml;