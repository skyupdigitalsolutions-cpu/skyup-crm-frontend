// src/utils/leadServices.js — a lead's services as an array (new `services[]`
// field, falling back to the old single/comma-separated `service`).
export function leadServices(lead) {
  if (Array.isArray(lead?.services) && lead.services.length) return lead.services.filter(Boolean);
  return lead?.service ? String(lead.service).split(/\s*[,|]\s*/).filter(Boolean) : [];
}
