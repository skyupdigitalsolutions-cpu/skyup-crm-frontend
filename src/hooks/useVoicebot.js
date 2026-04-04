import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../data/axiosConfig';

const getVoicebotUrl = () =>
  localStorage.getItem('voicebot_api_url') ||
  import.meta.env.VITE_VOICEBOT_API ||
  '';

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

export function useVoicebot() {
  const [callQueue,   setCallQueue]   = useState([]);
  const [currentCall, setCurrentCall] = useState(null);
  const [results,     setResults]     = useState([]);
  const [isRunning,   setIsRunning]   = useState(false);
  const [error,       setError]       = useState(null);
  const abortRef = useRef(false);

  // ── Initiate a single voice-bot call ──────────────────────────────────────
  const callLead = useCallback(async (lead) => {
    const phone = lead.phone || lead.mobile;
    if (!phone) throw new Error('Lead has no phone number');

    const e164 = phone.startsWith('+') ? phone : `+91${phone}`;

    const payload = {
      phone:    e164,
      leadId:   lead.id || lead._id,
      leadName: lead.name,
    };

    const { data } = await axios.post(
      `${getVoicebotUrl()}/calls/initiate`,
      payload
    );

    return data;
  }, []);

  // ── Poll for call result ──────────────────────────────────────────────────
  const pollResult = useCallback(async (callId, maxWaitMs = 180_000) => {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      if (abortRef.current) throw new Error('Aborted');
      await new Promise((r) => setTimeout(r, 4000));

      const { data } = await axios.get(
        `${getVoicebotUrl()}/calls/${callId}/result`
      );

      if (
        data.status === 'completed' ||
        data.status === 'failed'    ||
        data.status === 'no_answer' ||
        data.status === 'busy'
      ) {
        return data;
      }
    }
    throw new Error('Call timed out');
  }, []);

  // ── Update lead temperature + side-effects in CRM ────────────────────────
  const updateLeadTemp = useCallback(async (leadId, temperature, summary, score) => {
    await api.patch(`/lead/${leadId}/temperature`, {
      temperature,
      voiceBotSummary: summary,
      voiceBotScore:   score,
      lastCalledAt:    new Date().toISOString(),
    });

    if (temperature === LEAD_TEMP.WARM) {
      await api.patch(`/lead/admin/${leadId}/assign-roundrobin`);
    }

    if (temperature === LEAD_TEMP.HOT) {
      await api.post('/lead/admin/notify-hot', {
        leadId,
        score,
        summary,
      });
    }
  }, []);

  // ── Run the full queue ────────────────────────────────────────────────────
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

        let outcome = {
          lead,
          temperature:  LEAD_TEMP.COLD,
          status:       'failed',
          summary:      '',
          score:        0,
        };

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
            status:       result.status,
            summary:      result.summary || '',
            score:        result.score ?? 0,
            duration:     result.duration ?? 0,
            recordingUrl: result.recording_url || null,
          };

          const id = lead.id || lead._id;
          if (id) await updateLeadTemp(id, temperature, outcome.summary, outcome.score);

        } catch (err) {
          // ✅ per-lead error: record it on the outcome but keep the queue running
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
      // ✅ outer catch: unexpected fatal error — surface it and stop cleanly
      setError(fatalErr.message);
    } finally {
      // ✅ always runs — guarantees isRunning resets even on fatal throw
      setCurrentCall(null);
      setIsRunning(false);
    }
  }, [callLead, pollResult, updateLeadTemp]);

  const stopQueue = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  // ── Call a single lead immediately ────────────────────────────────────────
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
      if (id) await updateLeadTemp(id, temperature, result.summary || '', result.score ?? 0);

      const outcome = { lead, temperature, ...result };
      setResults((prev) => [...prev, outcome]);
      onDone?.(outcome);
    } catch (err) {
      setError(err.message);
    } finally {
      setCurrentCall(null);
    }
  }, [callLead, pollResult, updateLeadTemp]);

  return {
    callQueue,
    currentCall,
    results,
    isRunning,
    error,
    runQueue,
    stopQueue,
    callSingleLead,
  };
}