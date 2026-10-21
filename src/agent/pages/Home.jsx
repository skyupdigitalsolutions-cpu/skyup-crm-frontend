import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCallLogsForDay } from '../api.js';
import { approx } from '../appCallLog.js';
import { Link } from 'react-router-dom';
import { computeWorkedSecs, useAttendance } from '../attendance.jsx';
import { useAuth } from '../auth.jsx';
import { useLeads } from '../leads.jsx';
import { fmtDuration, fmtTalk, fmtTime } from '../format.js';
import LeadRow from '../components/LeadRow.jsx';
import { TopBar } from '../components/Shell.jsx';
import { useToast } from '../components/Toast.jsx';
import InstallTip from '../components/InstallTip.jsx';
import ConfirmSheet from '../components/ConfirmSheet.jsx';

const STATUS = {
  active: { label: 'Working', color: 'var(--green)' },
  on_break: { label: 'On break', color: 'var(--orange)' },
  on_call: { label: 'On a call', color: 'var(--blue)' },
  idle: { label: 'Idle', color: 'var(--red)' },
  logged_out: { label: 'Clocked out', color: 'var(--text-muted)' },
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function ShiftPanel() {
  const { record, startBreak, endBreak, clockOut } = useAttendance();
  const toast = useToast();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [askClockOut, setAskClockOut] = useState(false);

  const st = STATUS[record?.status] || STATUS.active;
  const onBreak = record?.status === 'on_break' || record?.status === 'idle';
  const worked = computeWorkedSecs(record, now);

  // Ribbon: clock-in → max(now, clock-in + 9h). Blue = shift so far, orange = breaks.
  const start = record?.loginTime ? new Date(record.loginTime).getTime() : now;
  const span = Math.max(now - start, 9 * 3600 * 1000);
  const pct = (t) => `${Math.min(100, Math.max(0, ((t - start) / span) * 100))}%`;
  const breaks = (record?.breaks || []).filter((b) => b?.startTime).map((b) => {
    const s = new Date(b.startTime).getTime();
    const e = b.endTime ? new Date(b.endTime).getTime() : now;
    return { left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` };
  });

  const act = async (fn, done) => {
    setBusy(true);
    try { await fn(); if (done) toast(done); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="shift" aria-label="Today’s shift">
      <div className="shift-top">
        <span className="shift-status"><span className="dot" style={{ background: st.color }} />{st.label}</span>
        <span className="small muted">In at {fmtTime(record?.loginTime)}</span>
      </div>
      <div className="shift-clock" aria-label={`Worked ${fmtDuration(worked)}`}>{fmtDuration(worked)}</div>
      <div className="shift-sub">Worked today{record?.totalBreakMinutes ? `, ${record.totalBreakMinutes} min on breaks` : ''}</div>

      <div className="ribbon" aria-hidden="true">
        <div className="ribbon-work" style={{ width: pct(now) }} />
        {breaks.map((b, i) => <div key={i} className="ribbon-break" style={{ left: b.left, width: b.width }} />)}
      </div>
      <div className="ribbon-scale" aria-hidden="true">
        <span>{fmtTime(start)}</span>
        <span>{fmtTime(start + span)}</span>
      </div>
      <div className="ribbon-key" aria-hidden="true">
        <span><i style={{ background: 'var(--blue)' }} />Shift</span>
        <span><i style={{ background: 'var(--orange)' }} />Breaks</span>
      </div>

      <div className="shift-actions">
        {onBreak ? (
          <button className="btn" disabled={busy} onClick={() => act(endBreak, 'Back to work')}>End break</button>
        ) : (
          <button className="btn ghost" disabled={busy} onClick={() => act(startBreak, 'Break started')}>Take a break</button>
        )}
        <button
          className="btn danger"
          disabled={busy}
          onClick={() => setAskClockOut(true)}
        >
          Clock out
        </button>
      </div>
      <ConfirmSheet
        open={askClockOut}
        title="Clock out for today?"
        body={`You’ve worked ${fmtDuration(worked)} today.`}
        confirmLabel="Clock out"
        busy={busy}
        onConfirm={() => act(clockOut).finally(() => setAskClockOut(false))}
        onClose={() => setAskClockOut(false)}
      />
    </section>
  );
}

// Today's calls at a glance — taps through to the Calls tab.
function TodayCalls() {
  const [logs, setLogs] = useState(null);
  const load = useCallback(async () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let rows = null;
    try { rows = await getCallLogsForDay(ymd, -d.getTimezoneOffset()); } catch { /* keep what is shown */ }
    setLogs((l) => rows || l || []);
  }, []);
  useEffect(() => {
    load();
    const onVis = () => { if (document.visibilityState === 'visible') setTimeout(load, 1500); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const list = logs || [];
  const talk = list.reduce((s, l) => s + (Number(l.duration) || 0), 0);
  const est = list.some((l) => l.durationEstimated && Number(l.duration) > 0);
  const connected = list.filter((l) => Number(l.duration) > 0).length;
  return (
    <Link to="/agent/calls" className="card-link" aria-label="Open today's call log">
      <span className="card-link-head"><b>Today’s calls</b><span className="chev" aria-hidden="true" /></span>
      <span className="mini-stats">
        <span><b>{logs ? list.length : '–'}</b>Calls</span>
        <span><b>{logs ? connected : '–'}</b>Connected</span>
        <span><b>{logs ? `${est ? approx({ durationEstimated: true }) : ''}${fmtTalk(talk)}` : '–'}</b>Talk time</span>
      </span>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { leads, loading } = useLeads();

  const { due, counts } = useMemo(() => {
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const dueList = leads
      .filter((l) => l.followUpDate && new Date(l.followUpDate) <= endToday && l.status !== 'Converted' && l.status !== 'Not Interested')
      .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
    return {
      due: dueList,
      counts: {
        total: leads.length,
        fresh: leads.filter((l) => l.status === 'New').length,
        newToday: leads.filter((l) => l.date && new Date(l.date) >= startToday).length,
      },
    };
  }, [leads]);

  const first = (user?.name || '').split(' ')[0];

  return (
    <>
      <TopBar title={first ? `Hi, ${first}` : 'Home'} />
      <div className="page">
        <InstallTip />
        <ShiftPanel />

        <div className="section">
          <TodayCalls />
        </div>

        <div className="section">
          <div className="stats">
            <Link to="/agent/leads" className="stat" style={{ color: 'inherit' }}><b>{counts.total}</b><span>My leads</span></Link>
            <Link to="/agent/leads?status=New" className="stat" style={{ color: 'inherit' }}><b>{counts.fresh}</b><span>Not called</span></Link>
            <Link to="/agent/leads" className="stat" style={{ color: 'inherit' }}><b>{counts.newToday}</b><span>New today</span></Link>
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <h2>Follow-ups due</h2>
            {due.length > 5 ? <Link to="/agent/leads?view=followups">See all {due.length}</Link> : null}
          </div>
          {loading && !leads.length ? <div className="spinner" /> : due.length ? (
            <div className="list">
              {due.slice(0, 5).map((l) => <LeadRow key={l.id} lead={l} showFollowUp />)}
            </div>
          ) : (
            <div className="list empty"><b>No follow-ups due</b>Follow-ups you set on a lead show up here on the day.</div>
          )}
        </div>
      </div>
    </>
  );
}
