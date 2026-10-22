// src/agent/pages/FollowUps.jsx — the mobile app's Follow-ups screen, for the /agent web app.
// Data: GET /reports/follow-ups (an employee gets only their own). Logic: ../followUps.js (shared with the mobile app).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFollowUpsReport } from '../api.js';
import { TopBar } from '../components/Shell.jsx';
import { IconPhone, IconRefresh, IconSearch } from '../components/icons.jsx';
import { STATUS_TONE } from '../constants.js';
import { URGENCY_CFG, countBySource, countByUrgency, filterItems, groupItems, normalizeReport } from '../followUps.js';
import { fmtRelativeDay, fmtTime, maskPhone, telHref } from '../format.js';
import { savePendingCall } from '../pendingCall.js';

const URGENCY_FILTERS = [['all', 'All'], ['overdue', 'Overdue'], ['today', 'Due today'], ['upcoming', 'Upcoming'], ['missing', 'No date']];
const SOURCE_FILTERS = [['all', 'All'], ['employee', 'Set by me'], ['auto', 'Automatic']];

function Card({ it }) {
  const tel = telHref(it.mobile);
  const when = it.scheduledAt ? `${fmtRelativeDay(it.scheduledAt)}, ${fmtTime(it.scheduledAt)}` : '';
  return (
    <div className="fu-card" data-testid="fu-card">
      <div className="fu-top">
        <div style={{ minWidth: 0 }}>
          <Link className="fu-name" to={`/agent/leads/${it.leadId}`}>{it.name || 'Unknown'}</Link>
          <div className="fu-when">
            {it.kind === 'missing' ? it.daysLabel : [when, it.type && it.type !== 'follow-up' ? it.type : '', it.daysLabel].filter(Boolean).join(' · ')}
          </div>
          <div className="fu-when">{maskPhone(it.mobile)}</div>
        </div>
        <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
          {it.status ? <span className={`tag tone-${STATUS_TONE[it.status] || 'muted'}`}>{it.status}</span> : null}
          {it.kind === 'followup' && it.origin === 'auto' ? <span className="tag tone-muted">Automatic</span> : null}
        </div>
      </div>
      {it.remark ? (
        <div className="fu-quote">
          <b>Your remark:</b> {it.remark.text}
          {it.remark.at ? <small>{fmtRelativeDay(it.remark.at)}</small> : null}
        </div>
      ) : it.kind === 'followup' ? <div className="small muted" style={{ marginTop: 8 }}>No remark written on this lead yet.</div> : null}
      {it.note && it.kind === 'followup' ? <div className="small muted" style={{ marginTop: 6 }}>Follow-up note: {it.note}</div> : null}
      <div className="fu-actions">
        {tel ? <a className="btn green" href={tel} onClick={() => savePendingCall({ id: it.leadId, name: it.name, phone: it.mobile })}><IconPhone />Call</a> : null}
        <Link className="btn ghost" to={`/agent/leads/${it.leadId}`}>Open lead</Link>
      </div>
    </div>
  );
}

export default function FollowUps() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [urgency, setUrgency] = useState('all');
  const [source, setSource] = useState('all');
  const [q, setQ] = useState('');
  const last = useRef(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setReport(await getFollowUpsReport()); last.current = Date.now(); }
    catch (e) { setError(e.message || 'Could not load follow-ups.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - last.current > 60000) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const items = useMemo(() => normalizeReport(report), [report]);
  const counts = useMemo(() => countByUrgency(items), [items]);
  const bySource = useMemo(() => countBySource(items), [items]);
  const shown = useMemo(() => filterItems(items, { urgency, source, search: q }), [items, urgency, source, q]);
  const groups = useMemo(() => groupItems(shown), [shown]);

  return (
    <>
      <TopBar title="Follow-ups" right={
        <button className="icon-btn" onClick={load} aria-label="Refresh follow-ups" disabled={loading}>
          <span style={{ display: 'inline-grid', animation: loading ? 'agent-spin 0.8s linear infinite' : 'none' }}><IconRefresh /></span>
        </button>
      } />
      <div className="page">
        <label className="search">
          <IconSearch />
          <input type="search" placeholder="Search name, number, note…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search follow-ups" />
        </label>
        <div className="chips" style={{ marginTop: 12 }} role="group" aria-label="Filter by urgency">
          {URGENCY_FILTERS.map(([k, label]) => (
            <button key={k} className={`chip${urgency === k ? ' on' : ''}`} aria-pressed={urgency === k} onClick={() => setUrgency(k)}>
              {label} ({k === 'all' ? counts.total : counts[k] || 0})
            </button>
          ))}
        </div>
        {bySource.auto > 0 ? (
          <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Filter by who set the follow-up">
            {SOURCE_FILTERS.map(([k, label]) => (
              <button key={k} className={`chip${source === k ? ' on' : ''}`} aria-pressed={source === k} onClick={() => setSource(k)}>
                {label}{k === 'all' ? '' : ` (${bySource[k] || 0})`}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="alert error" role="alert" style={{ marginTop: 16 }}>
            {error} <button className="btn ghost" style={{ marginTop: 8 }} onClick={load}>Try again</button>
          </div>
        ) : null}
        {loading && !report ? <div className="spinner" /> : null}
        {report && !items.length ? <div className="list empty" style={{ marginTop: 16 }}><b>Nothing pending</b>Follow-ups you schedule on a lead appear here.</div> : null}
        {report && items.length && !shown.length ? <div className="list empty" style={{ marginTop: 16 }}><b>No follow-ups match</b>Clear the search or filters.</div> : null}

        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <div className="fu-head">
              <h2><span className={`dot dot-${g.tone}`} />{g.title}</h2>
              <span className="small muted">{g.data.length}</span>
            </div>
            {g.data.map((it) => <Card key={it.key} it={it} />)}
          </section>
        ))}
      </div>
    </>
  );
}
