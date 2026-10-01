// src/utils/customFields.js — helpers for company custom lead fields.

export function formatCustomValue(field, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (field.type === "checkbox") return v ? "Yes" : "No";
  if (field.type === "multiselect") return Array.isArray(v) ? v.join(", ") : String(v);
  if (field.type === "date") { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  if (field.type === "datetime") { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  return String(v);
}


/** Client-side required check — mirrors the backend so users get instant feedback. */
export function missingRequiredCustomFields(fields, values) {
  return (fields || []).filter((f) => f.required && f.showInForm !== false).filter((f) => {
    const v = values?.[f.key];
    return v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
  }).map((f) => f.label);
}
