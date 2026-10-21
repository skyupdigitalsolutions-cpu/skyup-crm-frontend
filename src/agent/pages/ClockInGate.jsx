import { useCallback, useEffect, useState } from 'react';
import { attendance as A } from '../api.js';
import { useAttendance } from '../attendance.jsx';
import { useAuth } from '../auth.jsx';
import Sheet from '../components/Sheet.jsx';
import { useAlerts } from '../alerts.jsx';
import { useSocketEvent } from '../socket.jsx';

// Same as the app: you must be clocked in to use the CRM.
export default function ClockInGate({ children }) {
  const { state, refresh, clockIn } = useAttendance();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { text, remote? }
  const [remote, setRemote] = useState('idle'); // idle | pending | approved | denied
  const [showRemote, setShowRemote] = useState(false);
  const { notify } = useAlerts();

  // Admin answered the remote clock-in request (live).
  useSocketEvent('meeting_permission_response', ({ approved, adminName } = {}) => {
    setRemote(approved ? 'approved' : 'denied');
    notify({
      title: approved ? 'Remote clock-in approved' : 'Remote clock-in declined',
      body: approved ? `${adminName || 'Your admin'} approved it. You can clock in now.`
        : `${adminName || 'Your admin'} declined it. Clock in from the office.`,
      tone: approved ? 'green' : 'red',
      tag: 'remote-clockin',
      serverPushed: true,
    });
  });

  const checkRemote = useCallback(async () => {
    try {
      const r = await A.remoteStatus();
      if (r?.hasPermission || r?.status === 'approved') setRemote('approved');
      else if (r?.isPending || r?.status === 'pending') setRemote('pending');
      else if (r?.status === 'denied') setRemote('denied');
      else setRemote('idle');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (state !== 'out') return undefined;
    checkRemote();
    const t = setInterval(checkRemote, 30000);
    return () => clearInterval(t);
  }, [state, checkRemote]);

  if (state === 'in') return children;
  if (state === 'loading') return <div className="spinner" aria-label="Checking attendance" />;

  const doClockIn = async () => {
    setBusy(true); setError(null);
    try {
      await clockIn();
    } catch (e) {
      if (e.code === 'location_required') {
        setError({ text: 'Your company needs your location to clock in. Allow location for this site in your browser settings, then tap Clock in again.' });
      } else if (e.code === 'outside_radius') {
        setError({ text: `${e.message} You can ask your admin to approve a remote clock-in.`, remote: true });
      } else {
        setError({ text: e.message || 'Could not clock in. Try again.' });
      }
    } finally { setBusy(false); }
  };

  const first = (user?.name || '').split(' ')[0];

  return (
    <main className="gate">
      <div className="brand">
        <img src="/agent-icons/icon-192.png" alt="" />
        <b>SkyUp CRM</b>
      </div>
      {state === 'error' ? (
        <>
          <h1>Can’t check attendance</h1>
          <p className="lead-in">The server didn’t respond. Check your internet connection and try again.</p>
          <button className="btn block" onClick={refresh}>Try again</button>
        </>
      ) : (
        <>
          <h1>{first ? `Good to see you, ${first}` : 'Start your day'}</h1>
          <p className="lead-in">Clock in to open your leads. Your browser will ask for your location.</p>
          {error ? <div className="alert error" role="alert">{error.text}</div> : null}
          {remote === 'pending' ? <div className="alert info">Remote clock-in requested. Waiting for your admin to approve.</div> : null}
          {remote === 'approved' ? <div className="alert ok">Your admin approved remote clock-in. You can clock in now.</div> : null}
          {remote === 'denied' ? <div className="alert error">Your admin declined the remote clock-in request.</div> : null}
          <button className="btn block green" disabled={busy} onClick={doClockIn}>
            {busy ? 'Clocking in…' : 'Clock in'}
          </button>
          {(error?.remote || remote === 'denied') && remote !== 'pending' ? (
            <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => setShowRemote(true)}>
              Request remote clock-in
            </button>
          ) : null}
          <button className="btn block ghost" style={{ marginTop: 10 }} onClick={logout}>Sign out</button>
        </>
      )}
      <RemoteSheet open={showRemote} onClose={() => setShowRemote(false)} onSent={() => { setRemote('pending'); setError(null); }} />
    </main>
  );
}

function RemoteSheet({ open, onClose, onSent }) {
  const [reason, setReason] = useState('');
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    if (!reason.trim()) { setErr('Add a reason for your admin.'); return; }
    setBusy(true); setErr('');
    try {
      await A.requestRemote(reason.trim(), where.trim());
      onSent(); onClose(); setReason(''); setWhere('');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Request remote clock-in">
      <h3>Request remote clock-in</h3>
      <p className="muted" style={{ marginTop: 0 }}>Your admin gets the request and can approve it.</p>
      {err ? <div className="alert error">{err}</div> : null}
      <label className="field"><span>Reason</span>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client meeting at Whitefield" />
      </label>
      <label className="field"><span>Location (optional)</span>
        <input className="input" value={where} onChange={(e) => setWhere(e.target.value)} />
      </label>
      <button className="btn block" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send request'}</button>
    </Sheet>
  );
}
