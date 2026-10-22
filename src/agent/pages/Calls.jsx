// Calls by day — the web version of the mobile app's "Calls" screen.
// Calls come from the server: synced by the agent's Android app, or — on iPhone —
// logged by this app for calls made with its Call button (see appCallLog.js).
// Remarks saved on leads that day are listed too.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCallLogsForDay, getUncalledLeads, isAutoCallEntry } from '../api.js';
import { fmtTime, initials, maskPhone, telHref } from '../format.js';
import { useLeads } from '../leads.jsx';
import { savePendingCall } from '../pendingCall.js';
import { approx } from '../appCallLog.js';
import { isIOS } from '../pwa.js';
import { TopBar } from '../components/Shell.jsx';
import { IconBack, IconPhone, IconRefresh } from '../components/icons.jsx';

const TYPES = {
  outgoing: { label: 'Outgoing', tone: 'blue' },
  incoming: { label: 'Incoming', tone: 'green' },
  missed: { label: 'Missed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'amber' },
};
const FILTERS = [['all', 'All'], ['outgoing', 'Outgoing'], ['incoming', 'Incoming'], ['missed', 'Missed']];
const REMARK_SLACK_MS = 2 * 60 * 1000;
const AUTO_REMARK = /^(outgoing|incoming|missed|rejected|voicemail|blocked|unknown)?\s*call\b.*from mobile app/i;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(d) {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d) - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function fmtTalk(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60 ? `${s % 60}s` : ''}`.trim();
}

const leadIdOf = (log) => String(log.matchedLead?._id || log.matchedLeadId || '');

export default function Calls() {
  const { leads } = useLeads();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [logs, setLogs] = useState([]);
  const [uncalled, setUncalled] = useState({ leads: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const isToday = startOfDay(new Date()).getTime() === day.getTime();
  const dateStr = ymd(day);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const tz = -new Date().getTimezoneOffset();
    const [l, u] = await Promise.allSettled([
      getCallLogsForDay(dateStr, tz),
      getUncalledLeads(dateStr, tz),
    ]);
    if (l.status === 'fulfilled') {
      setLogs(l.value
        .map((x) => ({ ...x, _ts: x.timestamp ? new Date(x.timestamp).getTime() : 0 }))
        .filter((x) => x._ts)
        .sort((a, b) => b._ts - a._ts));
    } else { setLogs([]); setError(l.reason?.message || 'Could not load calls.'); }
    setUncalled(u.status === 'fulfilled' ? u.value : { leads: [], total: 0 });
    setLoading(false);
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);
  // Refresh when coming back to the app (e.g. after a call).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  // A call is done when it has a real remark, or the lead got a remark at/after the call.
  const isDone = useCallback((log) => {
    const r = (log.remark || '').trim();
    if (r && !AUTO_REMARK.test(r)) return true;
    const lead = leadById.get(leadIdOf(log));
    return !!(lead?.lastManualRemarkAt && lead.lastManualRemarkAt >= log._ts - REMARK_SLACK_MS);
  }, [leadById]);

  // Remarks agents saved on their leads that day (covers calls the phone couldn't log).
  const remarks = useMemo(() => {
    const from = day.getTime();
    const to = from + 86400000;
    const out = [];
    for (const l of leads) {
      for (const h of l.callHistory || []) {
        if (!h?.remark || isAutoCallEntry(h)) continue;
        const t = h.calledAt ? new Date(h.calledAt).getTime() : 0;
        if (t >= from && t < to) out.push({ lead: l, h, t });
      }
    }
    return out.sort((a, b) => b.t - a.t);
  }, [leads, day]);

  const stats = useMemo(() => ({
    total: logs.length,
    outgoing: logs.filter((l) => l.callType === 'outgoing').length,
    incoming: logs.filter((l) => l.callType === 'incoming').length,
    missed: logs.filter((l) => l.callType === 'missed' || l.callType === 'rejected').length,
    talk: logs.reduce((s, l) => s + (Number(l.duration) || 0), 0),
    talkEstimated: logs.some((l) => l.durationEstimated && Number(l.duration) > 0),
  }), [logs]);

  const shown = useMemo(() => logs.filter((l) =>
    filter === 'all' || l.callType === filter || (filter === 'missed' && l.callType === 'rejected')), [logs, filter]);
  const pending = shown.filter((l) => leadIdOf(l) && !isDone(l));
  const rest = shown.filter((l) => !(leadIdOf(l) && !isDone(l)));

  const shiftDay = (n) => setDay((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return startOfDay(x); });

  return (
    <>
      <TopBar
        title="Calls"
        right={
          <button className="icon-btn" onClick={load} aria-label="Refresh calls" disabled={loading}>
            <span style={{ display: 'inline-grid', animation: loading ? 'agent-spin 0.8s linear infinite' : 'none' }}><IconRefresh /></span>
          </button>
        }
      />
      <div className="page">
        <div className="daybar">
          <button className="icon-btn" onClick={() => shiftDay(-1)} aria-label="Previous day"><IconBack /></button>
          <label className="daybar-label">
            <b>{dayLabel(day)}</b>
            <input
              type="date"
              value={dateStr}
              max={ymd(new Date())}
              onChange={(e) => e.target.value && setDay(startOfDay(new Date(`${e.target.value}T00:00:00`)))}
              aria-label="Pick a day"
            />
          </label>
          <button className="icon-btn flip" onClick={() => shiftDay(1)} disabled={isToday} aria-label="Next day"><IconBack /></button>
        </div>

        <div className="stats stats-4" style={{ marginTop: 12 }}>
          <div className="stat"><b>{stats.total}</b><span>Calls</span></div>
          <div className="stat"><b>{stats.outgoing}</b><span>Outgoing</span></div>
          <div className="stat"><b>{stats.missed}</b><span>Missed</span></div>
          <div className="stat"><b className="stat-sm">{stats.talkEstimated ? '≈ ' : ''}{fmtTalk(stats.talk)}</b><span>Talk time</span></div>
        </div>

        <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Filter calls">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>

        {error ? <div className="alert error" style={{ marginTop: 14 }}>{error}</div> : null}

        {loading && !logs.length ? <div className="spinner" /> : (
          <>
            {pending.length ? (
              <div className="section">
                <div className="section-head"><h2>Remark pending</h2><span className="small muted">{pending.length}</span></div>
                <div className="list">{pending.map((l) => <CallRow key={l._id} log={l} lead={leadById.get(leadIdOf(l))} pending />)}</div>
              </div>
            ) : null}

            <div className="section">
              <div className="section-head"><h2>{pending.length ? 'Other calls' : 'All calls'}</h2></div>
              {rest.length ? (
                <div className="list">{rest.map((l) => <CallRow key={l._id} log={l} lead={leadById.get(leadIdOf(l))} done={!!leadIdOf(l)} />)}</div>
              ) : (
                <div className="list empty">
                  <b>{logs.length ? 'No calls match this filter' : 'No calls logged'}</b>
                  {logs.length ? 'Choose All to see every call.' : (isIOS() ? 'Calls you make with the Call button in this app are logged here. iPhone doesn’t let apps see other calls, so calls made from the Phone app or received calls won’t appear.' : 'Calls appear here when the SkyUp Android app syncs them.')}
                </div>
              )}
            </div>

            {remarks.length ? (
              <div className="section">
                <div className="section-head"><h2>Remarks saved</h2><span className="small muted">{remarks.length}</span></div>
                <div className="list">
                  {remarks.map(({ lead, h, t }, i) => (
                    <Link key={`${lead.id}-${i}`} to={`/agent/leads/${lead.id}`} className="row" style={{ color: 'inherit' }}>
                      <span className="avatar" aria-hidden="true">{initials(lead.name)}</span>
                      <span className="row-main">
                        <span className="row-title"><span>{lead.name}</span></span>
                        <span className="row-sub" style={{ display: 'block' }}>{fmtTime(t)}{h.outcome ? `, ${h.outcome}` : ''}</span>
                        <span className="row-sub" style={{ display: 'block', whiteSpace: 'normal' }}>{h.remark}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {isToday && uncalled.leads.length ? (
              <div className="section">
                <div className="section-head"><h2>Not called yet</h2><span className="small muted">{uncalled.total}</span></div>
                <div className="list">
                  {uncalled.leads.map((u) => {
                    const id = String(u._id || u.id);
                    const phone = u.primaryPhone || u.mobile || u.phone || '';
                    const tel = telHref(phone);
                    const days = u.daysSinceAssigned ?? 0;
                    return (
                      <div className="row" key={id}>
                        <Link to={`/agent/leads/${id}`} className="row-link">
                          <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                          <span className="row-main">
                            <span className="row-title"><span>{u.name || 'Unknown'}</span></span>
                            <span className="row-sub" style={{ display: 'block' }}>
                              {maskPhone(phone)}, {days <= 0 ? 'assigned today' : `waiting ${days} ${days === 1 ? 'day' : 'days'}`}
                            </span>
                          </span>
                        </Link>
                        {tel ? (
                          <a className="row-call" href={tel} aria-label={`Call ${u.name || 'lead'}`}
                            onClick={() => savePendingCall({ id, name: u.name, phone })}><IconPhone /></a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function CallRow({ log, lead, pending, done }) {
  const t = TYPES[log.callType] || TYPES.outgoing;
  const id = leadIdOf(log);
  const name = lead?.name || log.matchedLead?.name || log.contactName || maskPhone(log.phoneNumber);
  const body = (
    <>
      <span className={`call-type tone-${t.tone}`} aria-hidden="true"><IconPhone /></span>
      <span className="row-main">
        <span className="row-title"><span>{name}</span></span>
        <span className="row-sub" style={{ display: 'block' }}>
          {t.label}, {fmtTime(log._ts)}{Number(log.duration) > 0 ? `, ${approx(log)}${fmtTalk(log.duration)}` : ''}
        </span>
        {pending ? <span className="row-meta"><span className="tag tone-amber">Remark pending</span></span> : null}
        {done ? <span className="row-meta"><span className="tag tone-green">Remark added</span></span> : null}
      </span>
    </>
  );
  if (!id) return <div className="row">{body}</div>;
  return (
    <Link to={`/agent/leads/${id}${pending ? '?remark=1' : ''}`} className="row" style={{ color: 'inherit' }}>{body}</Link>
  );
}
