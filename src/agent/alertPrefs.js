// src/agent/alertPrefs.js — the employee's alert settings (Profile → Alerts), kept on this phone.
// They control both the in-app alerts and, when phone notifications are on, what the server pushes to this phone
// (sent to the server by push.js). Remote clock-in replies always show.
import { useEffect, useState } from 'react';

const KEY = 'agent_alert_prefs';
const EVENT = 'agent_alert_prefs_changed';
export const LEAD_TIMES = [5, 10, 15];               // minutes before a follow-up (the server announces at most 15 min early)
export const DEFAULT_PREFS = { newLeads: true, followUps: true, followUpLeadMin: 10, followUpSummary: true };

export function getAlertPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    const out = { ...DEFAULT_PREFS };
    for (const k of ['newLeads', 'followUps', 'followUpSummary']) if (typeof p[k] === 'boolean') out[k] = p[k];
    if (LEAD_TIMES.includes(Number(p.followUpLeadMin))) out.followUpLeadMin = Number(p.followUpLeadMin);
    return out;
  } catch { return { ...DEFAULT_PREFS }; }
}

export function setAlertPrefs(patch) {
  const next = { ...getAlertPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

/** React hook: the current settings, updated when they change. */
export function useAlertPrefs() {
  const [prefs, setPrefs] = useState(getAlertPrefs);
  useEffect(() => {
    const on = () => setPrefs(getAlertPrefs());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return prefs;
}
