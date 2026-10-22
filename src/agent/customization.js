// src/agent/customization.js — the company's lists (industries, services) and lead-field rules, same defaults and
// merge as the mobile app (services/customizationService.js). GET /customization is cached for 10 minutes.
import { useEffect, useState } from 'react';
import { getCustomization as fetchCustomization } from './api.js';

export const DEFAULT_CUSTOMIZATION = {
  lists: {
    industries: ['Healthcare', 'Education', 'Real Estate', 'Logistics', 'Finance', 'IT Solutions', 'Digital Marketing', 'Construction', 'Local Business', 'Interior Designers', 'Professional Services'],
    services: ['SEO', 'Paid Ads', 'Website Design & Development', 'AI Automation', 'CRM', 'Video Editing', 'Graphic Design', 'Social Media Marketing', 'AI Voice Agent', 'Custom Software', 'WhatsApp Automation & Chatbots', 'ERP Systems', 'Mobile Applications', 'Branding'],
  },
  leadFields: {
    industry: { visible: true, required: false, label: 'Industry', allowOther: true },
    service: { visible: true, required: false, label: 'Service', multiple: true, allowOther: false },
  },
};

export function mergeCustomization(server) {
  if (!server || typeof server !== 'object') return DEFAULT_CUSTOMIZATION;
  const d = DEFAULT_CUSTOMIZATION;
  return {
    ...d, ...server,
    lists: { ...d.lists, ...(server.lists || {}) },
    leadFields: {
      ...d.leadFields, ...(server.leadFields || {}),
      industry: { ...d.leadFields.industry, ...((server.leadFields || {}).industry || {}) },
      service: { ...d.leadFields.service, ...((server.leadFields || {}).service || {}) },
    },
  };
}

export const industriesList = (c = DEFAULT_CUSTOMIZATION) => (Array.isArray(c?.lists?.industries) ? c.lists.industries : []);
export const servicesList = (c = DEFAULT_CUSTOMIZATION) => (Array.isArray(c?.lists?.services) ? c.lists.services : []);
export const leadField = (key, c = DEFAULT_CUSTOMIZATION) => c?.leadFields?.[key] || { visible: true, label: key };

/** A lead's services as an array (new services[] or the old single / comma-separated `service`). */
export function leadServicesOf(lead) {
  if (Array.isArray(lead?.services) && lead.services.length) return lead.services.filter(Boolean);
  return lead?.service ? String(lead.service).split(/\s*[,|]\s*/).filter(Boolean) : [];
}

let state = DEFAULT_CUSTOMIZATION, loadedAt = 0, inflight = null;
const subs = new Set();
const TTL = 10 * 60 * 1000;
export async function loadCustomization(force = false) {
  if (!force && loadedAt && Date.now() - loadedAt < TTL) return state;
  if (inflight) return inflight;
  inflight = fetchCustomization().then((data) => {
    const c = data && data.customization;
    if (c) { state = mergeCustomization(c); loadedAt = Date.now(); subs.forEach((f) => f(state)); }
    return state;
  }).catch(() => state).finally(() => { inflight = null; });
  return inflight;
}
export function resetCustomization() { state = DEFAULT_CUSTOMIZATION; loadedAt = 0; subs.forEach((f) => f(state)); }

/** React hook: the current company lists (defaults until the server answers). */
export function useCustomization() {
  const [c, setC] = useState(state);
  useEffect(() => { subs.add(setC); loadCustomization(); return () => { subs.delete(setC); }; }, []);
  return c;
}
