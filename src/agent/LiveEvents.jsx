// src/agent/LiveEvents.jsx — turns live events into alerts and fresh data.
//   • New / reassigned lead (socket) → lead added to the list + alert
//   • Follow-up coming up (5 / 10 / 15 min before, Profile → Alerts) → alert (checked every 30s)
import { useCallback, useEffect, useRef } from 'react';
import { getLead } from './api.js';
import { useAlerts } from './alerts.jsx';
import { fmtTime } from './format.js';
import { useLeads } from './leads.jsx';
import { useSocketEvent } from './socket.jsx';
import { getAlertPrefs } from './alertPrefs.js';

const FU_KEY = 'agent_followups_alerted';
const loadAlerted = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(FU_KEY) || '[]')); } catch { return new Set(); }
};

export default function LiveEvents() {
  const { leads, upsertLead, refresh } = useLeads();
  const { notify } = useAlerts();
  const alerted = useRef(loadAlerted());
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  useSocketEvent('new_lead_assigned', async (payload = {}) => {
    const reassigned = payload.eventType === 'reassigned';
    if (payload.leadId) {
      try { upsertLead(await getLead(payload.leadId)); } catch { refresh(); }
    } else {
      refresh();
    }
    if (!getAlertPrefs().newLeads) return;            // switched off in Profile → Alerts (the list still updates)
    notify({
      title: reassigned ? 'Lead reassigned to you' : 'New lead assigned',
      body: [payload.leadName, payload.source].filter(Boolean).join(' — ') || 'Open your leads to see it.',
      to: payload.leadId ? `/agent/leads/${payload.leadId}` : '/agent/leads',
      tag: `lead-${payload.leadId || Date.now()}`,
      tone: 'green',
      serverPushed: true,
    });
  });

  // Follow-up reminders: check when leads load/change and every 30 seconds.
  const check = useCallback(() => {
    const prefs = getAlertPrefs();
    if (!prefs.followUps) return;                       // switched off in Profile → Alerts
    const leadMs = prefs.followUpLeadMin * 60000;
    const now = Date.now();
    for (const l of leadsRef.current) {
      if (!l.followUpDate || l.status === 'Converted' || l.status === 'Not Interested') continue;
      const at = new Date(l.followUpDate).getTime();
      if (!(at > now - 60000 && at <= now + leadMs)) continue;
      const key = `${l.id}|${l.followUpDate}`;
      if (alerted.current.has(key)) continue;
      alerted.current.add(key);
      const mins = Math.round((at - now) / 60000);
      notify({
        title: mins > 0 ? `Follow-up in ${mins} min` : 'Follow-up due now',
        body: `${l.name}, ${fmtTime(at)}`,
        to: `/agent/leads/${l.id}`,
        tag: `fu-${key}`,
        tone: 'amber',
        serverPushed: true,                            // the server also sends a call-back reminder
      });
    }
    try { sessionStorage.setItem(FU_KEY, JSON.stringify([...alerted.current].slice(-300))); } catch { /* ignore */ }
  }, [notify]);

  useEffect(() => { check(); }, [leads, check]);
  useEffect(() => {
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [check]);

  return null;
}
