import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getLead, updateLead } from '../api.js';
import { STATUS_OPTIONS, STATUS_TONE, TEMPERATURES } from '../constants.js';
import { fmtDate, fmtRelativeDay, initials, maskPhone, telHref, whatsappHref } from '../format.js';
import { useLeads } from '../leads.jsx';
import { peekReturnedCall, savePendingCall } from '../pendingCall.js';
import AttachRecording from '../components/AttachRecording.jsx';
import RemarkSheet from '../components/RemarkSheet.jsx';
import { TopBar } from '../components/Shell.jsx';
import { useToast } from '../components/Toast.jsx';
import { IconChat, IconEdit, IconPhone } from '../components/icons.jsx';

export default function LeadDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { leads, patchLocal } = useLeads();
  const toast = useToast();
  const cached = leads.find((l) => l.id === id);
  const [lead, setLead] = useState(cached || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  const [afterCall, setAfterCall] = useState(false);
  const [call, setCall] = useState(null);           // the call just made to this lead (pendingCall.js), if any

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setLead(await getLead(id)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Opened from the "you just finished a call" flow (see PendingCallResumer).
  useEffect(() => {
    if (params.get('remark') === '1') {
      setAfterCall(true); setCall(peekReturnedCall(id)); setSheet(true);
      const next = new URLSearchParams(params); next.delete('remark');
      setParams(next, { replace: true });
    }
  }, [params, setParams, id]);

  const change = async (field, value, label) => {
    const prev = lead[field];
    setLead((l) => ({ ...l, [field]: value }));
    patchLocal(id, { [field]: value });
    try {
      await updateLead(id, { [field]: value });
      toast(`${label} updated`);
    } catch (e) {
      setLead((l) => ({ ...l, [field]: prev }));
      patchLocal(id, { [field]: prev });
      toast(e.message);
    }
  };

  if (!lead) {
    return (
      <>
        <TopBar title="Lead" back="/agent/leads" />
        <div className="page">
          {loading ? <div className="spinner" /> : <div className="alert error">{error || 'Lead not found.'}</div>}
        </div>
      </>
    );
  }

  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  const history = [...(lead.callHistory || [])].reverse();

  return (
    <>
      <TopBar title={lead.name} back="/agent/leads" />
      <div className="page">
        <div className="lead-head">
          <div className="avatar" aria-hidden="true">{initials(lead.name)}</div>
          <h2>{lead.name}</h2>
          <div className="muted">{maskPhone(lead.phone)}</div>
          <div style={{ marginTop: 8 }}>
            <span className={`tag tone-${STATUS_TONE[lead.status] || 'muted'}`}>{lead.status}</span>
          </div>
        </div>

        <div className="lead-actions">
          {tel ? (
            <a className="btn green" href={tel} onClick={() => savePendingCall(lead)}><IconPhone />Call</a>
          ) : <button className="btn" disabled>No number</button>}
          {wa ? <a className="btn ghost" href={wa} target="_blank" rel="noreferrer"><IconChat />WhatsApp</a> : null}
        </div>
        <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => { setAfterCall(false); setCall(peekReturnedCall(id)); setSheet(true); }}>
          <IconEdit />Add remark
        </button>
        <AttachRecording lead={lead} onAttached={() => { toast('Recording attached'); load(); }} />

        <div className="section">
          <div className="section-head"><h2>Temperature</h2></div>
          <div className="seg" role="group" aria-label="Lead temperature">
            {TEMPERATURES.map((t) => (
              <button key={t} className={`t-${t}${lead.temperature === t ? ' on' : ''}`}
                aria-pressed={lead.temperature === t}
                onClick={() => lead.temperature !== t && change('temperature', t, 'Temperature')}>{t}</button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-head"><h2>Status</h2></div>
          <select className="select" value={lead.status}
            onChange={(e) => change('status', e.target.value, 'Status')} aria-label="Lead status">
            {[...new Set([...STATUS_OPTIONS, lead.status])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="section">
          <div className="section-head"><h2>Details</h2></div>
          <dl className="kv">
            {lead.followUpDate ? <div className="kv-row"><dt>Next follow-up</dt><dd>{fmtRelativeDay(lead.followUpDate)}</dd></div> : null}
            {lead.email ? <div className="kv-row"><dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div> : null}
            <div className="kv-row"><dt>Source</dt><dd>{lead.source}</dd></div>
            {lead.campaign ? <div className="kv-row"><dt>Campaign</dt><dd>{lead.campaign}</dd></div> : null}
            {lead.industry ? <div className="kv-row"><dt>Industry</dt><dd>{lead.industry}</dd></div> : null}
            {lead.services?.length ? <div className="kv-row"><dt>Services</dt><dd>{lead.services.join(', ')}</dd></div> : null}
            <div className="kv-row"><dt>Received</dt><dd>{fmtDate(lead.date)}</dd></div>
            {lead.initialRemark ? <div className="kv-row"><dt>Enquiry</dt><dd>{lead.initialRemark}</dd></div> : null}
          </dl>
        </div>

        <div className="section">
          <div className="section-head"><h2>History</h2></div>
          {history.length ? (
            <ul className="timeline">
              {history.map((h, i) => (
                <li key={h._id || i}>
                  <div className="t-when">{fmtRelativeDay(h.calledAt || h.timestamp)}</div>
                  <div className="t-what">{h.outcome || (h.callType ? `${h.callType} call` : h.recordingUrl ? 'Call recording' : 'Note')}</div>
                  {h.remark ? <div className="t-note">{h.remark}</div> : null}
                  {h.recordingUrl ? <div className="t-note">Recording attached</div> : null}
                </li>
              ))}
            </ul>
          ) : <div className="list empty"><b>No calls yet</b>Call this lead, then add a remark to start the history.</div>}
        </div>
      </div>

      <RemarkSheet
        open={sheet}
        onClose={() => setSheet(false)}
        lead={lead}
        afterCall={afterCall}
        call={call}
        onSaved={(changes) => { patchLocal(id, changes); toast('Remark saved'); load(); }}
      />
    </>
  );
}
