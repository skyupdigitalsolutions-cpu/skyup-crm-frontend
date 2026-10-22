import { useEffect, useMemo, useState } from 'react';
import { addCallRemark, logAppCall, markLeadInvalid, markNotInterested, postMeetingRemark } from '../api.js';
import { appCallPayload, sendAppCall, shouldLogAppCalls } from '../appCallLog.js';
import { OUTCOMES_ANSWERED, OUTCOMES_NOT_ANSWERED, autoStatusForOutcome } from '../constants.js';
import { industriesList, leadField, leadServicesOf, servicesList, useCustomization } from '../customization.js';
import { toLocalInput } from '../format.js';
import { clearReturnedCall } from '../pendingCall.js';
import Sheet from './Sheet.jsx';

const NEEDS_FOLLOWUP = ['Call Back Later', 'Interested', 'Client Meeting', 'Proposal Sent'];
export const MEETING_TYPES = ['In-Person', 'Site Visit', 'Demo', 'Video Call', 'Phone Call'];
const OTHER = '__other__';

// `call`: the call the employee just came back from (pendingCall.js), or null. On iPhone the saved remark also
// completes that call's log record (appCallLog.js).
// Same outcomes as the mobile app: answered / didn't answer / Invalid (sent for verification by a second employee),
// Client Meeting (needs the meeting date, and a meeting type), and the lead's industry and services.
export default function RemarkSheet({ open, onClose, lead, afterCall, call, onSaved }) {
  const cust = useCustomization();
  const INDUSTRIES = industriesList(cust);
  const SERVICES = servicesList(cust);
  const industryField = leadField('industry', cust);
  const serviceField = leadField('service', cust);
  const multiService = serviceField.multiple !== false;

  const [outcome, setOutcome] = useState('');
  const [remark, setRemark] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [meetingType, setMeetingType] = useState('In-Person');
  const [industry, setIndustry] = useState('');
  const [industryOther, setIndustryOther] = useState(false);
  const [services, setServices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const initialIndustry = (lead && lead.industry) || '';
  const initialServices = useMemo(() => leadServicesOf(lead), [lead]);
  useEffect(() => {
    if (!open) return;
    setOutcome(''); setRemark(''); setFollowUp(''); setMeetingType('In-Person'); setError('');
    setIndustry(initialIndustry);
    setIndustryOther(!!initialIndustry && !INDUSTRIES.some((x) => x.toLowerCase() === initialIndustry.toLowerCase()));
    setServices(initialServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead && lead.id]);

  const notAnswered = OUTCOMES_NOT_ANSWERED.includes(outcome);
  const isNI = outcome === 'Not Interested';
  const isInvalid = outcome === 'Invalid';
  const isMeeting = outcome === 'Client Meeting';
  const verifying = isInvalid && lead && lead.invalidStage === 'verification';
  const showFollowUp = outcome && !isNI && !isInvalid;
  const showDetails = OUTCOMES_ANSWERED.includes(outcome) && !isNI && (industryField.visible !== false || serviceField.visible !== false);

  const quickFollowUp = (hours) => {
    const d = new Date(Date.now() + hours * 3600 * 1000);
    if (hours >= 24) d.setHours(11, 0, 0, 0);
    setFollowUp(toLocalInput(d));
  };
  const toggleService = (v) => setServices((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : (multiService ? [...prev, v] : [v])));

  const finishCall = (text) => {
    if (!call) return;
    if (shouldLogAppCalls()) sendAppCall(logAppCall, appCallPayload(call, { outcome, remark: text }));   // kept and retried if offline
    clearReturnedCall();
  };

  const save = async (reject = false) => {
    if (!outcome) { setError('Choose what happened on the call.'); return; }
    if (isInvalid && !remark.trim()) { setError('Write why this number is invalid.'); return; }
    if (!notAnswered && !isInvalid && !remark.trim()) { setError('Add a short remark about the call.'); return; }
    if (outcome === 'Call Back Later' && !followUp) { setError('Pick when to call back.'); return; }
    if (isMeeting && !followUp) { setError('Set the date and time of the client meeting.'); return; }
    setBusy(true); setError('');
    try {
      const text = remark.trim() || outcome;
      if (isInvalid) {
        const res = await markLeadInvalid(lead.id, { remark: text, reject });
        const msg = (res && res.message) || (res && res.isClosed ? 'Lead verified Invalid and closed.' : 'Lead marked Invalid and sent for verification.');
        finishCall(text);
        onSaved?.({ status: 'Invalid', ...(res && res.isClosed ? { isClosed: true } : {}) }, { message: msg });
        onClose();
        return;
      }
      if (isNI) {
        await markNotInterested(lead.id, text);
        finishCall(text);
        onSaved?.({ status: 'Not Interested', lastOutcome: outcome, remark: text });
        onClose();
        return;
      }
      const status = autoStatusForOutcome(outcome, lead.status) || undefined;
      const followUpDate = followUp ? new Date(followUp).toISOString() : undefined;
      // only send the lead's industry / services when the employee changed them (never blank out what is already there)
      const industryChanged = showDetails && industry.trim() !== initialIndustry.trim();
      const servicesChanged = showDetails && JSON.stringify([...services].sort()) !== JSON.stringify([...initialServices].sort());
      await addCallRemark(lead.id, {
        remark: text, outcome, followUpDate, status,
        ...(industryChanged ? { industry: industry.trim() } : {}), ...(servicesChanged ? { services } : {}),
      });
      let info;
      if (isMeeting && followUpDate) {
        try { await postMeetingRemark(lead.id, { meetingType, outcome: 'Follow-Up Required', remark: text, location: null, followUpDate }, null); }
        catch { info = { message: 'Remark saved, but the meeting could not be scheduled. Add it from the Client visit log.' }; }
      }
      finishCall(text);
      onSaved?.({
        lastOutcome: outcome, remark: text,
        ...(status ? { status } : {}), ...(followUpDate ? { followUpDate } : {}),
        ...(industryChanged ? { industry: industry.trim() } : {}), ...(servicesChanged ? { services } : {}),
      }, info);
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
      <div className="group-label">Other</div>
      <div className="chip-grid">
        <button className={`chip${isInvalid ? ' on' : ''}`} onClick={() => setOutcome('Invalid')}>Invalid</button>
      </div>

      {verifying ? (
        <div className="alert" style={{ marginTop: 12 }} role="status">
          Another employee marked this lead invalid. Confirm that it is invalid, or say it is not.
        </div>
      ) : null}

      {isMeeting ? (
        <>
          <div className="group-label">Meeting type</div>
          <div className="chip-grid">
            {MEETING_TYPES.map((t) => <button key={t} className={`chip${meetingType === t ? ' on' : ''}`} aria-pressed={meetingType === t} onClick={() => setMeetingType(t)}>{t}</button>)}
          </div>
        </>
      ) : null}

      <label className="field" style={{ marginTop: 16 }}>
        <span>{isInvalid ? 'Why is it invalid?' : isNI ? 'Reason they’re not interested' : notAnswered ? 'Remark (optional)' : 'Remark'}</span>
        <textarea className="textarea" value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder={isInvalid ? 'e.g. Wrong number, switched off for days' : isNI ? 'e.g. Already using another provider' : 'What did you discuss?'} />
      </label>

      {showDetails ? (
        <div className="field">
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-sec)' }}>Lead details (optional)</span>
          {industryField.visible !== false ? (
            <>
              <select className="select" aria-label="Industry" value={industryOther ? OTHER : industry}
                onChange={(e) => { if (e.target.value === OTHER) { setIndustryOther(true); setIndustry(''); } else { setIndustryOther(false); setIndustry(e.target.value); } }}>
                <option value="">{industryField.label || 'Industry'}: not set</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                {industryField.allowOther !== false ? <option value={OTHER}>Other…</option> : null}
              </select>
              {industryOther ? <input className="input" style={{ marginTop: 8 }} placeholder="Type the industry" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry (other)" /> : null}
            </>
          ) : null}
          {serviceField.visible !== false ? (
            <div style={{ marginTop: 10 }}>
              <span className="small muted">{serviceField.label || 'Service'}{multiService ? ' (choose all that apply)' : ''}</span>
              <div className="chips" style={{ marginTop: 6 }} role="group" aria-label="Services">
                {SERVICES.map((s) => <button key={s} className={`chip${services.includes(s) ? ' on' : ''}`} aria-pressed={services.includes(s)} onClick={() => toggleService(s)}>{s}</button>)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showFollowUp ? (
        <div className="field">
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-sec)' }}>
            {isMeeting ? 'Meeting date and time' : `Follow-up ${outcome === 'Call Back Later' ? '' : '(optional)'}`}
          </span>
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className="chip" onClick={() => quickFollowUp(2)}>In 2 hours</button>
            <button className="chip" onClick={() => quickFollowUp(24)}>Tomorrow</button>
            <button className="chip" onClick={() => quickFollowUp(72)}>In 3 days</button>
          </div>
          <input className="input" type="datetime-local" value={followUp} min={toLocalInput(new Date())}
            onChange={(e) => setFollowUp(e.target.value)} aria-label={isMeeting ? 'Meeting date and time' : 'Follow-up date and time'} />
        </div>
      ) : null}

      {verifying ? (
        <>
          <button className="btn block" disabled={busy} onClick={() => save(false)} style={{ marginTop: 6 }}>{busy ? 'Saving…' : 'Confirm it is invalid'}</button>
          <button className="btn block ghost" disabled={busy} onClick={() => save(true)} style={{ marginTop: 8 }}>It is not invalid</button>
        </>
      ) : (
        <button className="btn block" disabled={busy} onClick={() => save(false)} style={{ marginTop: 6 }}>
          {busy ? 'Saving…' : 'Save remark'}
        </button>
      )}
    </Sheet>
  );
}
