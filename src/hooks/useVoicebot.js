import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../data/axiosConfig';

// ─────────────────────────────────────────────────────────────────────────────
// useVoicebot.js  —  rewired for Saanvi (skyupdigitalsolutions.in)
//
// WHAT CHANGED (only 2 functions):
//   callLead()   — was: POST /calls/initiate
//                  now: POST /call-me   (Saanvi's real endpoint)
//                       also creates a lead in Saanvi first via POST /api/leads
//
//   pollResult() — was: GET /calls/:callId/result
//                  now: GET /api/leads/:saanviLeadId  (poll until Completed)
//                       maps Saanvi fields → shape the UI already expects
//
// ADD to frontend .env:
//   VITE_SAANVI_URL=https://skyupdigitalsolutions.in
//
// VoiceBotPanel.jsx and Campaigns.jsx are UNTOUCHED.
// ─────────────────────────────────────────────────────────────────────────────

const getSaanviUrl = () =>
  localStorage.getItem('saanvi_api_url') ||
  import.meta.env.VITE_SAANVI_URL ||
  'https://skyupdigitalsolutions.in';

export const LEAD_TEMP = {
  HOT:  'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
};

function scoreToTemp(score) {
  if (score >= 70) return LEAD_TEMP.HOT;
  if (score >= 40) return LEAD_TEMP.WARM;
  return LEAD_TEMP.COLD;
}

function parseDuration(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// Maps Saanvi lead document → shape the VoiceBotPanel UI already expects
function mapSaanviLead(saanviLead) {
  const statusMap = {
    'Completed':   'completed',
    'In Progress': 'in-progress',
    'Pending':     'pending',
    'No Answer':   'no_answer',
    'Busy':        'busy',
    'Failed':      'failed',
  };
  return {
    status:        statusMap[saanviLead.callStatus] || 'pending',
    score:         saanviLead.score          ?? 0,
    summary:       saanviLead.classReason    || '',
    Quality:       saanviLead.classification || 'Cold',
    duration:      parseDuration(saanviLead.callDuration),
    recording_url: saanviLead.recordingUrl   || null,
    reason:        saanviLead.classReason    || '',
    nextAction:    saanviLead.nextAction     || '',
    service:       saanviLead.service        || '',
    callSid:       saanviLead.callSid        || '',
    transcript:    saanviLead.transcript     || '',
  };
}

export function useVoicebot() {
  const [callQueue,   setCallQueue]   = useState([]);
  const [currentCall, setCurrentCall] = useState(null);
  const [results,     setResults]     = useState([]);
  const [isRunning,   setIsRunning]   = useState(false);
  const [error,       setError]       = useState(null);
  const abortRef = useRef(false);

  // ── Step 1: Initiate a Saanvi call ───────────────────────────────────────
  // Old: POST /calls/initiate  → { callId }
  // New: POST /api/leads       → create lead in Saanvi first
  //      POST /call-me         → trigger call, returns { callSid }
  //      returns { callId: saanviLeadId }  so pollResult can fetch by leadId
  const callLead = useCallback(async (lead) => {
    const phone = lead.phone || lead.mobile;
    if (!phone) throw new Error('Lead has no phone number');
    const e164 = phone.startsWith('+') ? phone : '+91' + phone;
    const base = getSaanviUrl();

    // Create a lead record in Saanvi so the call result gets attached to it
    const { data: saanviLead } = await axios.post(`${base}/api/leads`, {
      name:    lead.name    || 'Lead',
      phone:   e164,
      service: lead.service || lead.remark || 'Not specified',
      source:  'CRM Campaign',
    });

    // Trigger the outbound call
    const { data: callResp } = await axios.post(`${base}/call-me`, {
      phone:   e164,
      leadId:  saanviLead._id,
      service: lead.service || lead.remark || 'Not specified',
    });

    if (!callResp.success) throw new Error('Saanvi call initiation failed');

    return { callId: saanviLead._id };  // use lead _id as "callId" for polling
  }, []);

  // ── Step 2: Poll Saanvi lead doc until call is classified ────────────────
  // Old: GET /calls/:callId/result
  // New: GET /api/leads/:saanviLeadId  — poll every 5s until Completed
  const pollResult = useCallback(async (saanviLeadId, maxWaitMs = 180_000) => {
    const base     = getSaanviUrl();
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      if (abortRef.current) throw new Error('Aborted');
      await new Promise((r) => setTimeout(r, 5000));

      const { data: saanviLead } = await axios.get(`${base}/api/leads/${saanviLeadId}`);
      const mapped = mapSaanviLead(saanviLead);

      if (
        mapped.status === 'completed' ||
        mapped.status === 'failed'    ||
        mapped.status === 'no_answer' ||
        mapped.status === 'busy'
      ) {
        return mapped;
      }
    }
    throw new Error('Call timed out');
  }, []);

  // ── Step 3: Save enriched result into CRM lead ───────────────────────────
  // PATCH /lead/:id/temperature — existing CRM endpoint, unchanged
  const updateLeadTemp = useCallback(async (leadId, temperature, summary, score, extra = {}) => {
    await api.patch(`/lead/${leadId}/temperature`, {
      temperature,
      voiceBotSummary:    summary,
      voiceBotScore:      score,
      voiceBotReason:     extra.reason      || '',
      voiceBotNextAction: extra.nextAction   || '',
      voiceBotService:    extra.service      || '',
      voiceBotCallSid:    extra.callSid      || '',
      voiceBotDuration:   extra.duration     ?? null,
      voiceBotTranscript: extra.transcript   || '',
      lastCalledByBot:    new Date().toISOString(),
    });

    if (temperature === LEAD_TEMP.WARM) {
      await api.patch(`/lead/admin/${leadId}/assign-roundrobin`);
    }
    if (temperature === LEAD_TEMP.HOT) {
      await api.post('/lead/admin/notify-hot', { leadId, score, summary });
    }
  }, []);

  // ── runQueue — logic unchanged, just passes extra Saanvi fields ──────────
  const runQueue = useCallback(async (leads) => {
    abortRef.current = false;
    setIsRunning(true);
    setError(null);
    setResults([]);
    setCallQueue(leads.map((l) => ({ ...l, queueStatus: 'pending' })));

    try {
      for (let i = 0; i < leads.length; i++) {
        if (abortRef.current) break;

        const lead = leads[i];
        setCurrentCall({ lead, status: 'calling', callId: null });
        setCallQueue((q) =>
          q.map((item, idx) => idx === i ? { ...item, queueStatus: 'calling' } : item)
        );

        let outcome = { lead, temperature: LEAD_TEMP.COLD, status: 'failed', summary: '', score: 0 };

        try {
          const { callId } = await callLead(lead);
          setCurrentCall((c) => ({ ...c, callId, status: 'in-progress' }));

          const result = await pollResult(callId);

          const temperature = result.status === 'completed'
            ? scoreToTemp(result.score ?? 50)
            : LEAD_TEMP.COLD;

          outcome = {
            lead,
            temperature,
            Quality:      result.Quality,
            status:       result.status,
            summary:      result.summary      || '',
            score:        result.score        ?? 0,
            duration:     result.duration     ?? 0,
            recordingUrl: result.recording_url || null,
          };

          const id = lead.id || lead._id;
          if (id) await updateLeadTemp(id, temperature, outcome.summary, outcome.score, {
            reason:     result.reason      || '',
            nextAction: result.nextAction  || '',
            service:    result.service     || '',
            callSid:    result.callSid     || '',
            duration:   result.duration    ?? 0,
            transcript: result.transcript  || '',
          });

        } catch (err) {
          outcome.errorMsg = err.message;
          outcome.status   = 'failed';
        }

        setResults((prev) => [...prev, outcome]);
        setCallQueue((q) =>
          q.map((item, idx) =>
            idx === i
              ? { ...item, queueStatus: outcome.status === 'completed' ? 'done' : 'failed' }
              : item
          )
        );

        if (i < leads.length - 1 && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch (fatalErr) {
      setError(fatalErr.message);
    } finally {
      setCurrentCall(null);
      setIsRunning(false);
    }
  }, [callLead, pollResult, updateLeadTemp]);

  const stopQueue = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  const callSingleLead = useCallback(async (lead, onDone) => {
    setError(null);
    setCurrentCall({ lead, status: 'calling', callId: null });
    try {
      const { callId } = await callLead(lead);
      setCurrentCall((c) => ({ ...c, callId, status: 'in-progress' }));

      const result = await pollResult(callId);
      const temperature = result.status === 'completed'
        ? scoreToTemp(result.score ?? 50)
        : LEAD_TEMP.COLD;

      const id = lead.id || lead._id;
      if (id) await updateLeadTemp(id, temperature, result.summary || '', result.score ?? 0, {
        reason:     result.reason      || '',
        nextAction: result.nextAction  || '',
        service:    result.service     || '',
        callSid:    result.callSid     || '',
        duration:   result.duration    ?? 0,
        transcript: result.transcript  || '',
      });

      const outcome = { lead, temperature, Quality: result.Quality, ...result };
      setResults((prev) => [...prev, outcome]);
      onDone?.(outcome);
    } catch (err) {
      setError(err.message);
    } finally {
      setCurrentCall(null);
    }
  }, [callLead, pollResult, updateLeadTemp]);

  return { callQueue, currentCall, results, isRunning, error, runQueue, stopQueue, callSingleLead };
}
