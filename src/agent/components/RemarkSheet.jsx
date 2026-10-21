import { useEffect, useState } from 'react';
import { addCallRemark, logAppCall, markNotInterested } from '../api.js';
import { appCallPayload, sendAppCall, shouldLogAppCalls } from '../appCallLog.js';
import { clearReturnedCall } from '../pendingCall.js';
import { OUTCOMES_ANSWERED, OUTCOMES_NOT_ANSWERED, autoStatusForOutcome } from '../constants.js';
import { toLocalInput } from '../format.js';
import Sheet from './Sheet.jsx';

const NEEDS_FOLLOWUP = ['Call Back Later', 'Interested', 'Client Meeting', 'Proposal Sent'];

// `call`: the call the employee just came back from (pendingCall.js), or null. On iPhone the saved remark also
// completes that call's log record (appCallLog.js).
export default function RemarkSheet({ open, onClose, lead, afterCall, call, onSaved }) {
  const [outcome, setOutcome] = useState('');
  const [remark, setRemark] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setOutcome(''); setRemark(''); setFollowUp(''); setError(''); }
  }, [open]);

  const notAnswered = OUTCOMES_NOT_ANSWERED.includes(outcome);
  const isNI = outcome === 'Not Interested';
  const showFollowUp = outcome && !isNI;

  const quickFollowUp = (hours) => {
    const d = new Date(Date.now() + hours * 3600 * 1000);
    if (hours >= 24) d.setHours(11, 0, 0, 0);
    setFollowUp(toLocalInput(d));
  };

  const save = async () => {
    if (!outcome) { setError('Choose what happened on the call.'); return; }
    if (!notAnswered && !remark.trim()) { setError('Add a short remark about the call.'); return; }
    if (outcome === 'Call Back Later' && !followUp) { setError('Pick when to call back.'); return; }
    setBusy(true); setError('');
    try {
      const text = remark.trim() || outcome;
      if (isNI) {
        await markNotInterested(lead.id, text);
        onSaved?.({ status: 'Not Interested', lastOutcome: outcome, remark: text });
      } else {
        const status = autoStatusForOutcome(outcome, lead.status) || undefined;
        const followUpDate = followUp ? new Date(followUp).toISOString() : undefined;
        await addCallRemark(lead.id, { remark: text, outcome, followUpDate, status });
        onSaved?.({
          lastOutcome: outcome, remark: text,
          ...(status ? { status } : {}), ...(followUpDate ? { followUpDate } : {}),
        });
      }
      if (call) {
        if (shouldLogAppCalls()) sendAppCall(logAppCall, appCallPayload(call, { outcome, remark: text }));   // kept and retried if offline
        clearReturnedCall();
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={busy ? undefined : onClose} label="Add call remark">
      <h3>{afterCall ? `How did the call with ${lead?.name?.split(' ')[0] || 'the lead'} go?` : 'Add a remark'}</h3>
      {error ? <div className="alert error" role="alert" style={{ marginTop: 10 }}>{error}</div> : null}

      <div className="group-label">They answered</div>
      <div className="chip-grid">
        {OUTCOMES_ANSWERED.map((o) => (
          <button key={o} className={`chip${outcome === o ? ' on' : ''}`} onClick={() => setOutcome(o)}>{o}</button>
        ))}
      </div>
      <div className="group-label">They didn’t answer</div>
      <div className="chip-grid">
        {OUTCOMES_NOT_ANSWERED.map((o) => (
          <button key={o} className={`chip${outcome === o ? ' on' : ''}`} onClick={() => setOutcome(o)}>{o}</button>
        ))}
      </div>

      <label className="field" style={{ marginTop: 16 }}>
        <span>{isNI ? 'Reason they’re not interested' : notAnswered ? 'Remark (optional)' : 'Remark'}</span>
        <textarea className="textarea" value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder={isNI ? 'e.g. Already using another provider' : 'What did you discuss?'} />
      </label>

      {showFollowUp ? (
        <div className="field">
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-sec)' }}>
            Follow-up {outcome === 'Call Back Later' ? '' : '(optional)'}
          </span>
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className="chip" onClick={() => quickFollowUp(2)}>In 2 hours</button>
            <button className="chip" onClick={() => quickFollowUp(24)}>Tomorrow</button>
            <button className="chip" onClick={() => quickFollowUp(72)}>In 3 days</button>
          </div>
          <input className="input" type="datetime-local" value={followUp} min={toLocalInput(new Date())}
            onChange={(e) => setFollowUp(e.target.value)} aria-label="Follow-up date and time" />
        </div>
      ) : null}

      <button className="btn block" disabled={busy} onClick={save} style={{ marginTop: 6 }}>
        {busy ? 'Saving…' : 'Save remark'}
      </button>
    </Sheet>
  );
}
