// src/agent/components/LogCallSheet.jsx — "Log a call" (iPhone).
// An iPhone can't show the app its call history, so calls the app didn't start — the lead calling the employee, a
// call made from the Phone app or WhatsApp, a missed call — are logged here by hand. The server stores them with
// talk time 0 (source 'manual-entry'), so hand-logged calls never inflate talk-time reports; attaching the call
// recording afterwards sets the real length. After logging, the normal remark sheet opens for the outcome.
import { useState } from 'react';
import { logAppCall } from '../api.js';
import { appCallPayload, sendAppCall } from '../appCallLog.js';
import { toLocalInput } from '../format.js';
import Sheet from './Sheet.jsx';

const KINDS = [
  { k: 'incoming', label: 'They called me' },
  { k: 'outgoing', label: 'I called them' },
  { k: 'missed', label: 'I missed their call' },
];
const MAX_BACK_MS = 7 * 24 * 3600 * 1000;

// The parent mounts this only while it is open, so every opening starts fresh (time = now).
export default function LogCallSheet({ onClose, lead, onLogged }) {
  const [kind, setKind] = useState('incoming');
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [bounds] = useState(() => ({ min: toLocalInput(new Date(Date.now() - MAX_BACK_MS)), max: toLocalInput(new Date(Date.now() + 60000)) }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const at = new Date(when).getTime();
    const now = Date.now();
    if (!Number.isFinite(at)) { setError('Choose when the call happened.'); return; }
    if (at > now + 5 * 60000) { setError('The call time can’t be in the future.'); return; }
    if (at < now - MAX_BACK_MS) { setError('Only calls from the last 7 days can be logged.'); return; }
    setBusy(true); setError('');
    const call = { leadId: String(lead.id), phone: lead.phone || '', dialedAt: Math.round(at / 1000) * 1000, returnedAt: null, callType: kind, manual: true };
    const body = appCallPayload(call, kind === 'missed' ? { outcome: 'Not Answered' } : undefined);
    await sendAppCall(logAppCall, body);          // kept and retried if the phone is offline
    setBusy(false);
    onLogged(call);
  };

  return (
    <Sheet open onClose={busy ? undefined : onClose} label="Log a call">
      <h3>Log a call</h3>
      <p className="muted" style={{ margin: '2px 0 14px' }}>
        For calls this app couldn’t see — when {lead?.name?.split(' ')[0] || 'the lead'} called you, or you called from the Phone app or WhatsApp.
      </p>
      <div className="group-label">What happened?</div>
      <div className="chip-grid">
        {KINDS.map((x) => (
          <button key={x.k} className={`chip${kind === x.k ? ' on' : ''}`} aria-pressed={kind === x.k} onClick={() => setKind(x.k)}>{x.label}</button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 16 }}>
        <span>When?</span>
        <input className="input" type="datetime-local" value={when} min={bounds.min} max={bounds.max} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <p className="small muted" style={{ margin: '0 2px 14px' }}>
        Calls logged by hand don’t add talk time. Attach the call recording afterwards to save the exact length.
      </p>
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      <button className="btn block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : kind === 'missed' ? 'Log missed call' : 'Next: add remark'}
      </button>
    </Sheet>
  );
}
