import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getLead, getLeadActionSummary, getLeadCallLogs, getMeetingRemarks, updateLead } from '../api.js';
import { downloadVCard } from '../contactCard.js';
import { isIOS } from '../pwa.js';
import CallLogList from '../components/CallLogList.jsx';
import { STATUS_OPTIONS, STATUS_TONE, TEMPERATURES, TEMP_TONE } from '../constants.js';
import { fmtDate, fmtRelativeDay, initials, maskPhone, telHref } from '../format.js';
import { useLeads } from '../leads.jsx';
import { peekReturnedCall, savePendingCall } from '../pendingCall.js';
import AttachRecording from '../components/AttachRecording.jsx';
import RemarkSheet from '../components/RemarkSheet.jsx';
import LogCallSheet from '../components/LogCallSheet.jsx';
import FollowUpSheet from '../components/FollowUpSheet.jsx';
import { TopBar } from '../components/Shell.jsx';
import { useToast } from '../components/Toast.jsx';
import { IconCalendar, IconDownload, IconEdit, IconPhone, IconSpark } from '../components/icons.jsx';

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
  const [logOpen, setLogOpen] = useState(false);     // iPhone: "Log a call" for calls the app couldn't see
  const [askRec, setAskRec] = useState(false);       // iPhone: "Recorded this call? Attach it" after a remark
  const [fuOpen, setFuOpen] = useState(false);       // Set / change follow-up

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
  const history = [...(lead.callHistory || [])].reverse();

  return (
    <>
      <TopBar title={lead.name} back="/agent/leads" />
      <div className="page">
        {/* 1 ─ Who: name, number, stage tags, and the four things you do with a lead */}
        <section className="lead-hero" aria-label="Lead">
          <div className="lead-hero-top">
            <div className="avatar" aria-hidden="true">{initials(lead.name)}</div>
            <div className="lead-hero-id">
              <h2>{lead.name}</h2>
              <div className="muted">{maskPhone(lead.phone)}{lead.source ? ` · ${lead.source}` : ''}</div>
              <div className="lead-hero-tags">
                <span className={`tag tone-${STATUS_TONE[lead.status] || 'muted'}`}>{lead.status}</span>
                {lead.temperature ? <span className={`tag tone-${TEMP_TONE[lead.temperature] || 'muted'}`}>{lead.temperature}</span> : null}
              </div>
            </div>
          </div>
          <div className="quick-actions">
            {tel ? (
              <a className="qa qa-call" href={tel} onClick={() => savePendingCall(lead)}><span className="qa-ic"><IconPhone /></span>Call</a>
            ) : <button className="qa" disabled><span className="qa-ic"><IconPhone /></span>No number</button>}
            <button className="qa" onClick={() => { setAfterCall(false); setCall(peekReturnedCall(id)); setSheet(true); }}><span className="qa-ic"><IconEdit /></span>Remark</button>
            <button className="qa" onClick={() => { downloadVCard(lead); toast('Contact card ready. Open it to add to Contacts.'); }}><span className="qa-ic"><IconDownload /></span>Save contact</button>
          </div>
          {lead.secondaryPhone && telHref(lead.secondaryPhone) ? (
            <a className="lead-hero-link" href={telHref(lead.secondaryPhone)}
              onClick={() => savePendingCall({ ...lead, phone: lead.secondaryPhone })}><IconPhone />Call secondary number · {maskPhone(lead.secondaryPhone)}</a>
          ) : null}
        </section>

        {/* 2 ─ When: the next follow-up */}
        {lead.status !== 'Not Interested' ? (() => {
          const fu = lead.followUpDate ? new Date(lead.followUpDate) : null;
          const overdue = fu && fu.getTime() < Date.now();
          return (
            <button className={`fu-set${overdue ? ' overdue' : fu ? ' set' : ''}`} onClick={() => setFuOpen(true)} aria-label={fu ? 'Change follow-up' : 'Set follow-up'}>
              <IconCalendar />
              <span className="fu-set-text">
                <span className="small">{fu ? (overdue ? 'Follow-up overdue' : 'Next follow-up') : 'No follow-up set'}</span>
                <b>{fu ? fmtRelativeDay(fu) : 'Set a follow-up date & time'}</b>
              </span>
              <span className="fu-set-action">{fu ? 'Change' : 'Set'}</span>
            </button>
          );
        })() : null}

        {/* 3 ─ Calls: the log, then the two call tools */}
        <div className="section">
          <div className="section-head">
            <h2>Calls</h2>
            {calls && calls.length > 3 ? (
              <button onClick={() => setAllCalls((v) => !v)}>{allCalls ? 'Show less' : `Show all ${calls.length}`}</button>
            ) : null}
          </div>
          {askRec ? (
            <div className="ask-rec" role="status">
              <b>Did you record this call?</b>
              <span className="small muted">Attach the recording now to save the exact talk time and get an AI summary.</span>
              <div className="ask-rec-actions">
                <button className="btn sm" onClick={() => { setAskRec(false); const el = document.querySelector('[data-testid="recording-input"]'); if (el) el.click(); }}>Attach recording</button>
                <button className="btn sm ghost" onClick={() => setAskRec(false)}>Not now</button>
              </div>
            </div>
          ) : null}
          {calls === null ? <div className="spinner" /> : calls.length ? (
            <CallLogList logs={allCalls ? calls : calls.slice(0, 3)} />
          ) : (
            <div className="list empty">
              <b>No calls logged yet</b>
              {isIOS() ? 'Use the Call button above — calls made from this app are logged here automatically.' : 'Calls appear here after the SkyUp Android app syncs them.'}
            </div>
          )}
          <AttachRecording compact lead={lead} onAttached={() => { setAskRec(false); toast('Recording attached'); load(); loadCalls(); }}
            extraAction={isIOS() ? <button className="btn sm ghost" onClick={() => setLogOpen(true)}><IconPhone />Log a call</button> : null} />
        </div>

        {/* 4 ─ Where it stands */}
        <div className="section">
          <div className="section-head"><h2>Lead stage</h2></div>
          <div className="stage-card">
            <label className="stage-row">
              <span>Status</span>
              <select className="select" value={lead.status}
                onChange={(e) => change('status', e.target.value, 'Status')} aria-label="Lead status">
                {[...new Set([...STATUS_OPTIONS, lead.status])].map((st) => <option key={st}>{st}</option>)}
              </select>
            </label>
            <div className="stage-row">
              <span>Temperature</span>
              <div className="seg" role="group" aria-label="Lead temperature">
                {TEMPERATURES.map((t) => (
                  <button key={t} className={`t-${t}${lead.temperature === t ? ' on' : ''}`}
                    aria-pressed={lead.temperature === t}
                    onClick={() => lead.temperature !== t && change('temperature', t, 'Temperature')}>{t}</button>
                ))}
              </div>
            </div>
          </div>
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
          <div className="section-head"><h2>Details</h2></div>
          <dl className="kv">
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
          if (afterCall && isIOS()) setAskRec(true);
        }}
      />
      {fuOpen ? <FollowUpSheet
        lead={lead}
        onClose={() => setFuOpen(false)}
        onSaved={(d) => { setFuOpen(false); setLead((l) => ({ ...l, followUpDate: d.toISOString() })); patchLocal(id, { followUpDate: d.toISOString() }); toast(`Follow-up set for ${fmtRelativeDay(d)}`); load(); }}
      /> : null}
      {logOpen ? <LogCallSheet
        onClose={() => setLogOpen(false)}
        lead={lead}
        onLogged={(c) => {
          setLogOpen(false);
          setTimeout(loadCalls, 800);
          if (c.callType === 'missed') { toast('Missed call logged'); return; }
          setCall(c); setAfterCall(true); setSheet(true);         // then the usual remark for the outcome
        }}
      /> : null}
    </>
  );
}
