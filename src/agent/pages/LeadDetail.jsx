import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getLead, getLeadActionSummary, getLeadCallLogs, getMeetingRemarks, updateLead } from '../api.js';
import { downloadVCard } from '../contactCard.js';
import { isIOS } from '../pwa.js';
import CallLogList from '../components/CallLogList.jsx';
import { STATUS_OPTIONS, STATUS_TONE, TEMPERATURES } from '../constants.js';
import { fmtDate, fmtRelativeDay, initials, maskPhone, telHref, whatsappHref } from '../format.js';
import { useLeads } from '../leads.jsx';
import { peekReturnedCall, savePendingCall } from '../pendingCall.js';
import AttachRecording from '../components/AttachRecording.jsx';
import RemarkSheet from '../components/RemarkSheet.jsx';
import { TopBar } from '../components/Shell.jsx';
import { useToast } from '../components/Toast.jsx';
import { IconChat, IconDownload, IconEdit, IconPhone, IconSpark } from '../components/icons.jsx';

export default function LeadDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { leads, patchLocal } = useLeads();
  const toast = useToast();
  const nav = useNavigate();
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

  // Call log for this lead — refreshed when the employee comes back from a call.
  const [calls, setCalls] = useState(null);
  const [allCalls, setAllCalls] = useState(false);
  const loadCalls = useCallback(async () => {
    try { setCalls(await getLeadCallLogs(id)); } catch { setCalls((c) => c || []); }
  }, [id]);
  useEffect(() => {
    loadCalls();
    const onVis = () => { if (document.visibilityState === 'visible') setTimeout(loadCalls, 1500); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadCalls]);

  // Client meetings logged for this lead (Client Meeting outcome / Client visit log)
  const [meetings, setMeetings] = useState(null);
  useEffect(() => { let on = true; getMeetingRemarks(id).then((m) => { if (on) setMeetings(m); }); return () => { on = false; }; }, [id]);

  // AI summary + next action (same as the mobile app's "AI Action Summary")
  const [ai, setAi] = useState({ loading: false, data: null, error: '' });
  const runAi = async (refresh = false) => {
    setAi((s) => ({ ...s, loading: true, error: '' }));
    try { setAi({ loading: false, data: await getLeadActionSummary(id, { refresh }), error: '' }); }
    catch (e) {
      const msg = e.code === 'GROK_NOT_CONFIGURED' ? 'AI summary is not set up on the server.'
        : e.code === 'GROK_UNAVAILABLE' ? 'The AI summary service is busy. Try again in a moment.' : (e.message || 'Could not generate the summary.');
      setAi((s) => ({ ...s, loading: false, error: msg }));
    }
  };

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
          {wa ? <a className="btn wa" href={wa} target="_blank" rel="noreferrer"><IconChat />WhatsApp</a> : null}
        </div>
        {lead.secondaryPhone && telHref(lead.secondaryPhone) ? (
          <a className="btn block ghost" style={{ marginTop: 10 }} href={telHref(lead.secondaryPhone)}
            onClick={() => savePendingCall({ ...lead, phone: lead.secondaryPhone })}><IconPhone />Call secondary number</a>
        ) : null}
        <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => { setAfterCall(false); setCall(peekReturnedCall(id)); setSheet(true); }}>
          <IconEdit />Add remark
        </button>
        <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => { downloadVCard(lead); toast('Contact card ready. Open it to add to Contacts.'); }}>
          <IconDownload />Save to contacts
        </button>
        <AttachRecording lead={lead} onAttached={() => { toast('Recording attached'); load(); loadCalls(); }} />

        <div className="section">
          <div className="section-head">
            <h2>Call log</h2>
            {calls && calls.length > 3 ? (
              <button onClick={() => setAllCalls((v) => !v)}>{allCalls ? 'Show less' : `Show all ${calls.length}`}</button>
            ) : null}
          </div>
          {calls === null ? <div className="spinner" /> : calls.length ? (
            <CallLogList logs={allCalls ? calls : calls.slice(0, 3)} />
          ) : (
            <div className="list empty">
              <b>No calls logged yet</b>
              {isIOS() ? 'Tap Call above. Calls made from this app are logged here automatically.' : 'Calls appear here after the SkyUp Android app syncs them.'}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <h2>AI summary</h2>
            {ai.data ? <button onClick={() => runAi(true)} disabled={ai.loading}>{ai.loading ? 'Working…' : 'Refresh'}</button> : null}
          </div>
          {ai.data ? (
            <div className="ai-card" data-testid="ai-card">
              <h3>Summary</h3><p style={{ margin: 0 }}>{ai.data.summary}</p>
              {ai.data.nextAction ? (<><h3>Next action</h3><p style={{ margin: 0 }}>{ai.data.nextAction}</p></>) : null}
              {Array.isArray(ai.data.keyPoints) && ai.data.keyPoints.length ? (<><h3>Key points</h3><ul>{ai.data.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul></>) : null}
              {ai.data.sentiment || ai.data.suggestedTemp ? <p className="small muted" style={{ margin: '10px 0 0' }}>{[ai.data.sentiment ? `Sentiment: ${ai.data.sentiment}` : '', ai.data.suggestedTemp ? `Suggested temperature: ${ai.data.suggestedTemp}` : ''].filter(Boolean).join(' · ')}</p> : null}
            </div>
          ) : (
            <button className="btn block ghost" onClick={() => runAi(false)} disabled={ai.loading}><IconSpark />{ai.loading ? 'Thinking…' : 'Generate summary & next action'}</button>
          )}
          {ai.error ? <div className="alert error" role="alert" style={{ marginTop: 10 }}>{ai.error}</div> : null}
        </div>

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
            {lead.secondaryPhone ? <div className="kv-row"><dt>Secondary</dt><dd>{maskPhone(lead.secondaryPhone)}</dd></div> : null}
            <div className="kv-row"><dt>Source</dt><dd>{lead.source}</dd></div>
            {lead.campaign ? <div className="kv-row"><dt>Campaign</dt><dd>{lead.campaign}</dd></div> : null}
            {lead.industry ? <div className="kv-row"><dt>Industry</dt><dd>{lead.industry}</dd></div> : null}
            {lead.services?.length ? <div className="kv-row"><dt>Services</dt><dd>{lead.services.join(', ')}</dd></div> : null}
            <div className="kv-row"><dt>Received</dt><dd>{fmtDate(lead.date)}</dd></div>
            {lead.initialRemark ? <div className="kv-row"><dt>Enquiry</dt><dd>{lead.initialRemark}</dd></div> : null}
          </dl>
        </div>

        {meetings && meetings.length ? (
          <div className="section">
            <div className="section-head"><h2>Client meetings</h2></div>
            <ul className="timeline">
              {meetings.map((m, i) => (
                <li key={m._id || i}>
                  <div className="t-when">{fmtRelativeDay(m.createdAt || m.date || m.followUpDate)}</div>
                  <div className="t-what">{m.meetingType || 'Meeting'} · {m.outcome}</div>
                  {m.remark ? <div className="t-note">{m.remark}</div> : null}
                  {m.location ? <div className="t-note">Location: {m.location}</div> : null}
                  {m.followUpDate ? <div className="t-note">Meeting {fmtRelativeDay(m.followUpDate)}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="section">
          <div className="section-head"><h2>Remarks &amp; history</h2></div>
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
        onSaved={(changes, info) => {
          patchLocal(id, changes); toast((info && info.message) || 'Remark saved');
          if (changes.isClosed) { nav('/agent/leads'); return; }          // an invalid lead that was verified and closed leaves the list
          load(); setTimeout(loadCalls, 800); getMeetingRemarks(id).then(setMeetings);
        }}
      />
    </>
  );
}
